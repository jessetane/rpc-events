# rpc-events
An [rpc-engine](https://github.com/jessetane/rpc-engine) subclass that makes doing pub-sub things super easy.

## Why
Making a remote procedure call to an [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter)'s `on` or `removeListener` methods doesn't really do what you want.

## How
[JSON-RPC style notifications](http://www.jsonrpc.org/specification#notification) + wrappers for `on` and `removeListener`. See the [API](#api) section below.

## Example
``` javascript
var Rpc = require('rpc-events')

var a = new Rpc()
var b = new Rpc()

a.send = b.receive
b.send = a.receive

a.subscribe('event', handler)

function handler (evt) {
  console.log(evt) // => 42
  a.unsubscribe('event', handler)
}

b.getInterface().emit('event', 42)
```

## Test
``` bash
$ npm run test
```

## API
See [rpc-engine](https://github.com/jessetane/rpc-engine) for the superclass API.

## Methods

### `rpc.setInterface(path[, iface])`
### `rpc.setInterface(iface)`
Same as superclass, but `iface` must implement `on` and `removeListener` (see [`EventEmitter`](https://nodejs.org/api/events.html) API).

### `rpc.subscribe(eventName, handler[, onerror])`
Subscribe to a remote event.
* `eventName` A `String`.
* `handler` A `Function`.
* `onerror` A `Function`. Will be called if the remote side removes the interface before the local side has called `unsubscribe`.

### `rpc.unsubscribe(eventName, handler)`
Unsubscribe from a remote event.
* `eventName` A `String`.
* `handler` A `Function`.

### `rpc.open()`
This method will reinform the remote about the currently active subscriptions. This is useful for implementing persistent connections where transports may come and go transparently.

### `rpc.close()`
This method extends the superclass implementation to ensure all local and remote subscriptions are torn down before cancelling outstanding requests.

### `rpc.closeLocal()`
### `rpc.closeRemote()`
These methods are invoked by `rpc.close` but can be useful independently. Closing the local side removes everything created by calls to `rpc.subscribe`, and closing the remote side removes all subscriptions created by the remote peer. `rpc.closeRemote` is useful in situations where you plan to reopen the connection at some point without losing track of your subscriptions, but can't be sure if the remote plans to do the same.

## Releases
* 2.1
  * Add `open` method
  * Split `close` out into its local and remote components
* 2.0
  * rpc-engine@6.0.0
  * Alter API to support scenario where remote side removes the interface a local subscription is associated with.
  * Try to ensure local behavior is correct even if remote side misses messages or receives them out of order.
* 1.0
  * First release

## License
MIT
