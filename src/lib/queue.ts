import { Queue as QueueInterface } from 'eip';
import * as Redis from 'redis';
import * as promisify from 'pify';

export default class Queue extends QueueInterface {
  private sadd: Function;
  private spop: Function;
  private scard: Function;
  private del: Function;

  constructor(public redis: Redis.RedisClient, public ns: string) {
    super();
    this.sadd = promisify(this.redis.sadd.bind(this.redis));
    this.spop = promisify(this.redis.spop.bind(this.redis));
    this.scard = promisify(this.redis.scard.bind(this.redis));
    this.del = promisify(this.redis.del.bind(this.redis));
  }

  async enqueue(id: string, priority: number, event: any) {
    if (priority > 10) {
      priority = 10;
    } else if (priority < 0) {
      priority = 0;
    }

    await this.sadd(`${this.ns}:priority:${priority}`, id);
    await this.sadd(`${this.ns}:events:${id}`, JSON.stringify(event));
    return;
  }

  async dequeue() {
    for (let priority = 10; priority >= 0; priority--) {
      const id = await this.spop(`${this.ns}:priority:${priority}`);
      if (id) {
        const count = await this.scard(`${this.ns}:events:${id}`);
        const events = await this.spop(`${this.ns}:events:${id}`, count + 10);
        await this.del(`${this.ns}:events:${id}`);
        if (events && events.length > 0) {
          return events.map(e => JSON.parse(e));
        }
      }
    }
    return [];
  }
}
