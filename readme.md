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

a.subscribe('event', handler)
function handler (evt) {
  console.log(evt) // => 42
  a.unsubscribe('event', handler)
}

b.interface.emit('event', 42)
```

## Test
``` bash
$ npm run test
```

## API
See [rpc-engine](https://github.com/jessetane/rpc-engine) for the superclass API.

## Methods

### `rpc.subscribe(eventName, handler[, cb])`
Subscribe to a remote event.
* `eventName` A `String`.
* `handler` A `Function`.
* `cb` A `Function`. Optionally can be passed to find out if the remote subscription was set up successfully.

### `rpc.unsubscribe(eventName, handler[, cb])`
Unsubscribe from a remote event.
* `eventName` A `String`.
* `handler` A `Function`.
* `cb` A `Function`. Optionally can be passed to find out if the remote subscription was torn down successfully.

### `rpc.close()`
This method extends the superclass implementation to ensure all remote subscriptions are torn down before cancelling outstanding requests.

## Releases
* 1.0
  * First release

## License
MIT
