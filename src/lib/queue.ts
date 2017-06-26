import { Queue as QueueInterface } from 'eip';
import * as Redis from 'redis';
import * as promisify from 'pify';

export default class Queue extends QueueInterface {
  private spop: Function;

  constructor(public redis: Redis.RedisClient, public ns: string, private maxConcurrentRequests = 10) {
    super();
    this.spop = promisify(this.redis.spop.bind(this.redis));
  }

  async enqueue(id: string, priority: number, event: any) {
    if (priority > 10) {
      priority = 10;
    } else if (priority < 0) {
      priority = 0;
    }

    await new Promise((resolve, reject) =>
      this.redis
        .multi()
        .sadd(`${this.ns}:priority:${priority}`, id)
        .set(`${this.ns}:events:${id}`, JSON.stringify(event))
        .exec((err, res) => (err ? reject(err) : resolve(res)))
    );
  }

  async dequeue() {
    for (let priority = 10; priority >= 0; priority--) {
      const id = await this.spop([`${this.ns}:priority:${priority}`]);
      if (id) {
        const event = await (<Promise<string>>new Promise((resolve, reject) =>
          this.redis
            .multi()
            .get(`${this.ns}:events:${id}`)
            .del(`${this.ns}:events:${id}`)
            .exec((err, res) => (err ? reject(err) : resolve(res[0])))
        ));
        return [JSON.parse(event)];
      }
    }
    return [];
  }
}
