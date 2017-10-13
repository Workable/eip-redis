const redis = require('redis');
const pubSub = require('./build/lib/pub-sub').default;
    
async function test () {
    const {createClient} = redis;var pub = createClient();var sub = createClient({ return_buffers: true });var pubs = new pubSub(2, pub, sub, 'test', 30);
    await pubs.subscribe('1', {event:true})
	}

test()
    

