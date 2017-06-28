import * as redis from 'redis';
import * as should from 'should';
import { PubSub } from '../lib';

const redisPub = redis.createClient();
const redisSub = redis.createClient({ return_buffers: true });

import * as sinon from 'sinon';
const sandbox = sinon.sandbox.create();

describe('PubSub', function() {
  let pubSub: PubSub;

  beforeEach(function() {
    pubSub = new PubSub(2, redisPub, redisSub, 'test');
  });

  afterEach(function() {
    sandbox.restore();
    redisSub.unsubscribe('test:subsribe:id');
    redisSub.unsubscribe('test:subsribe:id2');
    redisSub.unsubscribe('test:subsribe:id3');
    redisSub.unsubscribe('test:subsribe:id4');
    redisPub.del('test-counter');
    redisPub.del('test:pending:id');
    redisPub.del('test:pending:id2');
    redisPub.del('test:pending:id3');
    redisPub.del('test:pending:id4');
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
  });

  describe('unsubscribe', function() {
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
});
