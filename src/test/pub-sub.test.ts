import * as redis from 'redis';
import { PubSub as PubSubInterface } from 'eip';
import * as should from 'should';
import { PubSub } from '../lib';

const redisPub = redis.createClient();
const redisSub = redis.createClient({ return_buffers: true });

import * as sinon from 'sinon';
const sandbox = sinon.sandbox.create();

describe('PubSub', function() {
  let pubSub: PubSubInterface;

  beforeEach(function() {
    pubSub = new PubSub(2, 2000, redisPub, redisSub, 'test');
  });

  afterEach(function() {
    sandbox.restore();
    redisSub.unsubscribe('test:id');
    redisSub.unsubscribe('test:id2');
    redisSub.unsubscribe('test:id3');
    redisPub.del('test-counter');
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
      (await pubSub.subscribe('id', event)).should.equal(false);
      (await pubSub.subscribe('id2', event2)).should.equal(false);
      (await pubSub.subscribe('id3', event3)).should.equal(true);
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
      pubSub.on(PubSub.PROCESSED, (id, event, result) => {
        event.should.equal(event2);
        result.should.eql('result');
        id.should.eql('id');
      });
      (await pubSub.subscribe('id', event2)).should.equal(true);
      await pubSub.unsubscribe('id', 'result');
    });
  });
});
