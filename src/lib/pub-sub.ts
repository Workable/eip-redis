import { PubSub as PubSubInterface } from 'eip';
import * as Redis from 'redis';
import * as promisify from 'pify';
import * as EventEmmiter from 'events';

export default class PubSub extends PubSubInterface {
  private pubsub: Function;
  private publish: Function;
  private unsub: Function;
  private incr: Function;
  private decr: Function;
  private events: Map<String, any> = new Map();

  constructor(
    eventsPerPeriod,
    public redisPub: Redis.RedisClient,
    public redisSub: Redis.RedisClient,
    public ns: string
  ) {
    super(eventsPerPeriod);
    this.pubsub = promisify(this.redisPub.pubsub.bind(this.redisPub));
    this.publish = promisify(this.redisPub.publish.bind(this.redisPub));
    this.unsub = promisify(this.redisSub.unsubscribe.bind(this.redisSub));
    this.incr = promisify(this.redisPub.incr.bind(this.redisPub));
    this.decr = promisify(this.redisPub.decr.bind(this.redisPub));
    this.redisSub.on('message', (channel, message) => {
      const id = channel.toString().replace(`${this.ns}:`, '');
      if (this.events.has(id)) {
        this.events.get(id).emit(PubSub.PROCESSED, JSON.parse(message.toString()));
        this.events.delete(id);
      }
    });
  }

  async subscribe(id: string, event) {
    const [, eventSubscription] = await this.pubsub(['NUMSUB', `${this.ns}:${id}`]);
    if (eventSubscription) {
      this.redisSub.subscribe(`${this.ns}:${id}`);
      if (!this.events.has(id)) {
        this.events.set(id, new EventEmmiter.EventEmitter());
      }

      this.events.get(id).on(PubSub.PROCESSED, result => {
        this.inject(id, event, result);
      });
      return true;
    }

    const counter = await this.incr(`${this.ns}-counter`);
    if (counter <= this.eventsPerPeriod) {
      this.redisSub.subscribe(`${this.ns}:${id}`);
      return false;
    } else {
      await this.decr(`${this.ns}-counter`);
      this.reject(id, event);
      return true;
    }
  }

  async timeout() {
    await this.decr(`${this.ns}-counter`);
  }

  async unsubscribe(id: string, result) {
    await this.publish(`${this.ns}:${id}`, JSON.stringify(result));
    await this.unsub(`${this.ns}:${id}`);
  }
}
