# eip-mongo

Enterprise Integration Patterns for javascript redis adapter.

Create a redis pubsub to be used in resource-throttler.
Aggregate events through many nodes.

# Dependencies

In order for this module to work a redis connection is required.

## Installation

```
npm install --save eip-redis
```

## Usage

```javascript
const eip = require('eip');
const redis = require('redis');
const { PubSub, Queue } = require('eip-redis');
const { Timer } = require('eip-timer');

const redisPub = redis.createClient();
const redisSub =  redis.createClient({return_buffers:true});

const pubSub = new PubSub(1, 1000, redisPub, redisSub, 'namespace') // eventsPerPeriod, periodInMS
const queue = new Queue(redisPub, 'namespace');
const resource = x => x;

const throttler = new eip.Route().throttleResource({ pubSub, queue, resource, timer });
```

## License

MIT
