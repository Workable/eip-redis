import { PubSub as PubSubInterface } from 'eip';
import * as Redis from 'redis';
import * as promisify from 'pify';
import * as EventEmmiter from 'events';

export default class PubSub extends PubSubInterface {
  private pubsub: Function;
  private pub: Function;
  private unsub: Function;
  private incr: Function;
  private decr: Function;
  private get: Function;
  private del: Function;
  private events: Map<String, any> = new Map();

  constructor(
    eventsPerPeriod,
    public redisPub: Redis.RedisClient,
    public redisSub: Redis.RedisClient,
    public ns: string
  ) {
    super(eventsPerPeriod);
    this.pubsub = promisify(this.redisPub.pubsub.bind(this.redisPub));
    this.pub = promisify(this.redisPub.publish.bind(this.redisPub));
    this.unsub = promisify(this.redisSub.unsubscribe.bind(this.redisSub));
    this.incr = promisify(this.redisPub.incr.bind(this.redisPub));
    this.decr = promisify(this.redisPub.decr.bind(this.redisPub));
    this.get = promisify(this.redisPub.get.bind(this.redisPub));
    this.del = promisify(this.redisPub.del.bind(this.redisPub));
    this.redisSub.on('message', (channel, message) => {
      const id = channel.toString().replace(`${this.ns}:subscribe:`, '');
      this.unsub(`${this.ns}:subscribe:${id}`);
      this.del(`${this.ns}:pending:${id}`);
      if (this.events.has(id)) {
        this.events.get(id).emit(PubSub.PROCESSED, JSON.parse(message.toString()));
        this.events.delete(id);
      }
    });
    this.beforeExit = this.beforeExit.bind(this);

    process.on('SIGTERM', this.beforeExit);
    process.on('SIGINT', this.beforeExit);
  }

  private async beforeExit() {
    let size = this.events.size;
    await new Promise((resolve, reject) => {
      if (size === 0) {
        resolve();
      }
      for (const [, entry] of this.events.entries()) {
        entry.on(PubSub.PROCESSED, () => {
          size = size - 1;
          if (size === 0) {
            resolve();
          }
        });
      }
    });
    process.exit(0); // eslint-disable-line no-pro
  }

  private addEventListener(id, event, subscribe) {
    this.redisSub.subscribe(`${this.ns}:subscribe:${id}`);

    if (!subscribe) {
      return;
    }
    if (!this.events.has(id)) {
      this.events.set(id, new EventEmmiter.EventEmitter());
    }
    this.events.get(id).on(PubSub.PROCESSED, result => {
      this.inject(id, event, result);
    });
  }

  async subscribe(id: string, event, subscribe = true) {
    const pending = parseInt(await this.incr(`${this.ns}:pending:${id}`), 10);
    this.addEventListener(id, event, subscribe);
    if (pending > 1 && subscribe) {
      return true;
    }

    const counter = parseInt(await this.incr(`${this.ns}-counter`), 10);
    if (counter <= this.eventsPerPeriod || !subscribe) {
      return false;
    } else {
      await this.decr(`${this.ns}-counter`);
      this.reject(id, event);
      return true;
    }
  }

  async timeout() {
    const counter = await this.decr(`${this.ns}-counter`);
    if (counter < 0) {
      await this.incr(`${this.ns}-counter`);
    }
  }

  async publish(id: string, result) {
    await this.pub(`${this.ns}:subscribe:${id}`, JSON.stringify(result));
  }

  close() {
    process.removeListener('SIGTERM', this.beforeExit);
    process.removeListener('SIGINT', this.beforeExit);
  }
}
