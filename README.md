[![Build Status](https://travis-ci.org/hlapp/node-red-embedded-start.svg?branch=master)](https://travis-ci.org/hlapp/node-red-embedded-start)
[![npm](https://img.shields.io/npm/v/node-red-embedded-start.svg)](https://www.npmjs.com/package/node-red-embedded-start)
[![npm](https://img.shields.io/npm/dt/node-red-embedded-start.svg)](https://www.npmjs.com/package/node-red-embedded-start)
[![david-dm](https://david-dm.org/hlapp/node-red-embedded-start.svg)](https://david-dm.org/hlapp/node-red-embedded-start)
[![david-dm](https://david-dm.org/hlapp/node-red-embedded-start/dev-status.svg)](https://david-dm.org/hlapp/node-red-embedded-start?type=dev)

# node-red-embedded-start

When running Node-RED as an embedded application, the method to start
Node-RED (`RED.start()`) returns (more precisely, the promise it returns
resolves) before the runtime API is ready to be interacted with, resulting
in obscure internal Node-RED errors (typically, `TypeError` being thrown)
if one calls certain runtime or admin API method too early. This module
allows waiting deterministically for the runtime API for flows to be ready.

If your primary need is to interact programmatically with the flows API of
an embedded Node-RED instance once it starts up, then this module is for
you. One example use case likely faced by many developers (such as myself)
of nodes for Node-RED is running automatic testing for their node(s). Ideally
such testing can include testing discovery, loading, and running of nodes
by a live embedded Node-RED instance. 

_(In the wild, those who run such tests, including Node-RED itself, seem
to be using mocks of Node-RED. Not only do the mocks take a lot of code to
create, they are also at risk of diverging from what a live Node-RED instance
does. Hence, personally I would rather test manually than use a mock, or
waste my time on creating one.)_

## Installation

```
$ npm install --save node-red-embedded-start
```

If your use case is automatic testing of a Node-RED node, then you will only
need this for development and not in production, and hence use `--save-dev`
then instead of `--save`:

```
$ npm install --save-dev node-red-embedded-start
```

Note that the module does not itself have a dependency declared on `node-red`
(except for development, because it is used for testing itself). To use it,
you will have to have either a Node-RED instance (usually called `RED`), or
the `node-red` module you use for your embedded application needs to be
installed in a place where this module can find it (meaning either global,
or in the same or a higher `node_modules/` directory).

## Usage

There are two general ways to use this module. One is to insert it into the
promise chain from RED.start():

```js
var embeddedStart = require('node-red-embedded-start');
RED.start().then(embeddedStart(RED)).then((result) => {
    // result is whatever RED.start() resolved to
    // RED.node.getFlow() etc are now ready to use
}).catch((err) => {
    // theoretically, RED.start() could have rejected, but in practice
    // this isn't possible (at present) given the Node-RED code
    // so in practice embeddedStart() timed out (see below)
});
```

The other way is to inject it into `RED.start()`:

```js
var RED = require('node-red');
var embeddedStart = require('node-red-embedded-start');
embeddedStart.inject(RED);

// then use RED.start() just as you would normally
RED.start().then((result) => {
    // RED.node.getFlow() etc are now ready to use
});
```

### Usage & API details

#### Generate a wait function: `embeddedStart([RED[, timeout]])`

```js
var waitFunc = embeddedStart(RED, timeout);

RED.start().then(waitFunc).then(() => {
    // do whatever
});
```

* `RED` is the embedded Node-RED instance.
* `timeout` is the time in milliseconds after which waiting for the
  `nodes-started` event should time out. Optional, default is 30 seconds.
* If both parameters are omitted, `RED` will be loaded from the `node-red`
  module, and hence if that fails, the call will fail.

The returned function takes one optional parameter, the value that the
returned promise should resolve to. Normally, this should be the value to
which `RED.start()` resolves, so that it is passed through.

#### Call a wait function: `embeddedStart([RED, timeout,] result)`

```js
RED.start().then((result) => embeddedStart(RED, undefined, result)).then(() => {
    // do whatever
});
```

* `RED` is the embedded Node-RED instance.
* `timeout` is the time in milliseconds after which waiting for the
  `nodes-started` event should time out. Defaults to 30 seconds if undefined.
* If only the `result` parameter is provided, `RED` will be loaded from the
  `node-red` module, and hence if that fails, the call will fail.

#### Inject a wait function: `embeddedStart.inject([RED [, timeout])`

```js
embeddedStart.inject(RED, timeout);

RED.start().then((result) => {
    // do whatever
});
```

* `RED` is the embedded Node-RED instance.
* `timeout` is the time in milliseconds after which waiting for the
  `nodes-started` event should time out. Optional, default is 30 seconds.
* If both parameters are omitted, `RED` will be loaded from the `node-red`
  module, and hence if that fails, the call will fail.
* The injected function will pass through any arguments passed to
  `RED.start()`, and also value to which the original method resolves to. 

## Motivation

Calling the Node-RED runtime flow API methods such as `RED.nodes.addFlow()`
after `RED.start()` resolves results in a `TypeError`. `RED.nodes.getFlows()`
returns `null`, not a valid data structure. One solution could be to wait for
some time and hope for the best. Although a couple of seconds will often
suffice, the time needed will depend on processor speed, storage speed,
number of flows, number of nodes in those flows, and various other factors.
A wait-and-hope-for-the-best solution seems therefore unsatisfactory, and
still requires code to implement.

This issue has been brought to the attention of the Node-RED developers
[Node-RED issue #1168], but they responded that the behaviour is intentional
and will thus not be fixed.

This module allows waiting instead for a certain event (`nodes-started`) to
fire. The event fires at a point in time during the Node-RED startup when
the code driving the flow API is initialized and thus ready for interaction.

## Caveats

* If you run Node-RED standalone rather than embedded, the problem does not
  apply in practice, and hence this module will have no benefits for you.
* Due to the highly asynchronous nature of the Node-RED startup process,
  the flow API being ready does _not_ (and _should_ not) mean that any other
  components have fully completed their initialization as well. For example,
  the constructors of nodes may themselves have launched initialization tasks
  asynchronously, and there is no way of knowing which in which stage
  these are. See [Node-RED issue 698] for discussion.

## License

MIT

[Node-RED issue #1168]: https://github.com/node-red/node-red/issues/1168
[Node-RED issue 698]: https://github.com/node-red/node-red/issues/698