import * as redis from 'redis';
import * as should from 'should';
import { PubSub } from '../lib';
import * as promisify from 'pify';

const redisPub = redis.createClient();
const redisSub = redis.createClient({ return_buffers: true });

import * as sinon from 'sinon';
const sandbox = sinon.sandbox.create();
const originalkill = process.kill.bind(process);

const wait = async (timeout = 10) => {
  await new Promise(r => setTimeout(r, timeout));
};

describe('PubSub', function() {
  let pubSub: PubSub;

  beforeEach(function() {
    pubSub = new PubSub(2, redisPub, redisSub, 'test', 10);
  });

  beforeEach(function() {
    redisSub.unsubscribe('test:subsribe:id');
    redisSub.unsubscribe('test:subsribe:id1');
    redisSub.unsubscribe('test:subsribe:id2');
    redisSub.unsubscribe('test:subsribe:id3');
    redisSub.unsubscribe('test:subsribe:id4');
    redisPub.del('test-counter');
    redisPub.del('test:pending:id');
    redisPub.del('test:pending:id1');
    redisPub.del('test:pending:id2');
    redisPub.del('test:pending:id3');
    redisPub.del('test:pending:id4');
  });

  afterEach(function() {
    sandbox.restore();
    pubSub.close();
  });

  describe('subscribe', function() {
    it('should mark first event and subscribe to event already in progress', async function() {
      const event = {};
      const event2 = {};
      (await pubSub.subscribe('id', event)).should.equal(false);
      (await pubSub.subscribe('id', event2)).should.equal(true);
    });

    it('should add event to queue', async function() {
      const event = {};
      const event2 = {};
      const event3 = {};
      const event4 = {};
      let counter = 0;
      const promise = new Promise(r => {
        pubSub.on(PubSub.OVERFLOW, (id, e) => {
          counter++;
          switch (counter) {
            case 1:
              e.should.eql(event3);
              break;
            case 2:
              e.should.eql(event4);
              r();
              break;
          }
        });
      });
      (await pubSub.subscribe('id', event)).should.equal(false);
      (await promisify(redisPub.ttl.bind(redisPub))('test:pending:id')).should.equal(10);
      (await pubSub.subscribe('id2', event2)).should.equal(false);
      (await pubSub.subscribe('id3', event3)).should.equal(true);
      (await pubSub.subscribe('id3', event3)).should.equal(true);
      (await pubSub.subscribe('id4', event4)).should.equal(true);
      const pending = await new Promise((resolve, reject) =>
        redisPub.get('test:pending:id3', (err, data) => (err ? reject(err) : resolve(data)))
      );
      pending.should.equal('2');
      await promise;
    });
  });

  describe('timeout', function() {
    it('should reduce counter', async function() {
      const event = {};
      const event2 = {};
      const event3 = {};
      (await pubSub.subscribe('id', event)).should.equal(false);
      (await pubSub.subscribe('id2', event2)).should.equal(false);
      await pubSub.timeout();
      (await pubSub.subscribe('id3', event3)).should.equal(false);
    });

    it('should never reduce bellow 0', async function() {
      await pubSub.timeout();
      await pubSub.timeout();
      const counter = await promisify(redisPub.get.bind(redisPub))('test-counter');
      counter.should.equal('0');
    });
  });

  describe('publish', function() {
    it('should broadcast that event has been processed', async function() {
      const event = {};
      const event2 = {};
      (await pubSub.subscribe('id', event)).should.equal(false);
      let counter = 0;
      const promise = new Promise(r => {
        pubSub.on(PubSub.PROCESSED, (id, e, result) => {
          if (counter === 0) {
            e.should.equal(event);
            counter++;
            return;
          }
          e.should.equal(event2);
          result.should.eql('result');
          id.should.eql('id');
          r();
        });
      });
      (await pubSub.subscribe('id', event2)).should.equal(true);
      await pubSub.publish('id', 'result');
      await promise;
    });
  });

  describe('beforeExit', function() {
    it('should wait for event to finish and then quit', async function() {
      const exit = sandbox.stub(process, 'kill');
      const event = {};
      const event2 = {};
      (await pubSub.subscribe('id1', event)).should.equal(false);
      (await pubSub.subscribe('id1', event2)).should.equal(true);
      originalkill(process.pid);
      await pubSub.publish('id1', 'result');
      await wait();
      exit.args.should.eql([[process.pid]]);
    });

    it('should wait for two events to finish', async function() {
      const exit = sandbox.stub(process, 'kill');
      exit.args.should.eql([]);
      const event = {};
      const event2 = {};
      (await pubSub.subscribe('id1', event)).should.equal(false);
      (await pubSub.subscribe('id2', event2)).should.equal(false);
      originalkill(process.pid);
      await pubSub.publish('id1', 'result');
      await pubSub.publish('id2', 'result');
      await wait();
      exit.args.should.eql([[process.pid]]);
    });

    it('should wait for two events to finish and never quit', async function() {
      const exit = sandbox.stub(process, 'kill');
      const event = {};
      const event2 = {};
      (await pubSub.subscribe('id1', event)).should.equal(false);
      (await pubSub.subscribe('id2', event2)).should.equal(false);
      originalkill(process.pid);
      await pubSub.publish('id1', 'result');
      await wait();
      exit.args.should.eql([]);
    });
  });
});
