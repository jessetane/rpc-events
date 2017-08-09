var tape = require('tape')
var Rpc = require('./')
var Emitter = require('events')

var a = new Rpc()
var b = new Rpc()

a.send = b.receive
b.send = a.receive

tape('subscribe to remote events', function (t) {
  t.plan(2)
  a.interface.x = {
    y: {
      z: new Emitter()
    }
  }
  b.subscribe('x.y.z.wow', onwow)
  function onwow (evt) {
    t.equal(evt, 42)
    b.unsubscribe('x.y.z.wow', onwow)
    t.equal(b.listenerCount('x.y.z.wow'), 0)
    a.interface.x.y.z.emit('wow', 42)
  }
  a.interface.x.y.z.emit('wow', 42)
})
