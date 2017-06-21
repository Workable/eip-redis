import { Queue as QueueInterface } from 'eip';
import { Queue } from '../lib';
import * as redis from 'redis';
import * as sinon from 'sinon';

const sandbox = sinon.sandbox.create();
const redisPub = redis.createClient();

describe('Queue', function() {
  let queue: QueueInterface;

  beforeEach(function() {
    queue = new Queue(redisPub, 'test');
  });

  afterEach(function() {
    sandbox.restore();
    redisPub.del('test:events:id');
    redisPub.del('test:events:id1');
    redisPub.del('test:events:id2');
    redisPub.del('test:events:id3');
    redisPub.del('test:events:id4');
    redisPub.del('test:priority:0');
    redisPub.del('test:priority:1');
    redisPub.del('test:priority:2');
    redisPub.del('test:priority:3');
    redisPub.del('test:priority:4');
    redisPub.del('test:priority:5');
    redisPub.del('test:priority:10');
  });

  describe('enqueue', function() {
    it('should add event to queue', async function() {
      await queue.enqueue('id', -1, 'event');
      (await queue.dequeue()).should.eql(['event']);
    });
  });

  describe('dequeue', function() {
    it('should dequeue same events using priority', async function() {
      await queue.enqueue('id', 5, 'event1');
      await queue.enqueue('id1', 3, 'event2');
      await queue.enqueue('id2', 4, 'event3');
      await queue.enqueue('id3', 2, 'event4');
      await queue.enqueue('id', 5, 'event5');
      await queue.enqueue('id1', 3, 'event6');
      await queue.enqueue('id2', 4, 'event7');
      await queue.enqueue('id3', 2, 'event8');
      await queue.enqueue('id4', 11, 'event9');

      (await queue.dequeue()).should.eql(['event9']);
      (await queue.dequeue()).should.eql(['event1', 'event5']);
      (await queue.dequeue()).should.eql(['event3', 'event7']);
      (await queue.dequeue()).should.eql(['event6', 'event2']);
      (await queue.dequeue()).should.eql(['event8', 'event4']);
      (await queue.dequeue()).should.eql([]);
    });
  });
});
