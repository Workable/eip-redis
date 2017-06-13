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
const { PubSub } = require('eip-redis')
const pubSub = new PubSub(1, 1000) // eventsPerPeriod, periodInMS
const aggregator = new eip.Route().throttleResource({ pubSub });
```

## License

MIT
