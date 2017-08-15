var tape = require('tape')
var Rpc = require('./')
var Emitter = require('events')

var a = new Rpc()
var b = new Rpc()

a.send = b.receive
b.send = a.receive

tape('subscribe to, and unsubscribe from remote events', function (t) {
  t.plan(2)
  b.subscribe('event', handler, t.fail)
  a.getInterface().emit('event', 42)
  function handler (data) {
    t.equal(data, 42)
    b.unsubscribe('event', handler)
    t.equal(b.listenerCount('event'), 0)
    a.getInterface().emit('event', 42)
  }
})

tape('subscribe to, and unsubscribe from remote events on sub interfaces', function (t) {
  t.plan(2)
  a.setInterface('sub', new Emitter())
  b.subscribe('sub.event', handler, t.fail)
  a.getInterface('sub').emit('event', 42)
  function handler (data) {
    t.equal(data, 42)
    b.unsubscribe('sub.event', handler)
    t.equal(b.listenerCount('sub.event'), 0)
    a.getInterface('sub').emit('event', 42)
    a.setInterface('sub', null)
  }
})

tape('call error handler if remote emitter is not found', function (t) {
  t.plan(2)
  b.subscribe('sub.event', t.fail, function (err) {
    t.equal(err.message, 'Interface not found')
    t.equal(err.code, -32000)
  })
})

tape('call error handler if remote subscription times out', function (t) {
  t.plan(2)
  b.timeout = 10
  b.send = function () {
    b.send = a.receive
  }
  b.subscribe('event', t.fail, function (err) {
    t.equal(err.message, 'Call timed out')
    t.equal(err.code, -32603)
    b.timeout = 0
  })
  a.getInterface().emit('event', 42)
})

tape('only create one remote subscription even if there are multiple local listeners', function (t) {
  t.plan(4)
  var iface = a.getInterface()
  iface.subscribe = function () {
    t.pass()
    Rpc.prototype._subscribe.apply(a, arguments)
  }
  iface.unsubscribe = function () {
    t.pass()
    Rpc.prototype._unsubscribe.apply(a, arguments)
  }
  b.subscribe('event', on1, t.fail)
  function on1 (data) {
    t.equal(data, 42)
    b.unsubscribe('event', on1)
  }
  b.subscribe('event', on2, t.fail)
  function on2 (data) {
    t.equal(data, 42)
    b.unsubscribe('event', on2)
    iface.subscribe = a._subscribe.bind(a)
    iface.unsubscribe = a._unsubscribe.bind(a)
  }
  iface.emit('event', 42)
})

tape('call error handlers if remote side removes interface', function (t) {
  t.plan(6)
  var oldDefaultInterface = a.getInterface()
  a.setInterface('sub', new Emitter())
  b.subscribe('event1', handler1, err => {
    t.equal(err.message, 'Interface was removed')
  })
  b.subscribe('event2', handler2, err => {
    t.equal(err.message, 'Interface was removed')
    a.setInterface('sub', null)
  })
  b.subscribe('sub.event3', handler3, err => {
    t.equal(err.message, 'Interface was removed')
    a.setInterface('', oldDefaultInterface)
  })
  function handler1 (evt) {
    t.equal(evt, 41)
  }
  function handler2 (evt) {
    t.equal(evt, 42)
  }
  function handler3 (evt) {
    t.equal(evt, 43)
    a.setInterface('', null)
  }
  a.getInterface().emit('event1', 41)
  a.getInterface().emit('event2', 42)
  a.getInterface('sub').emit('event3', 43)
})

tape('handle accidential double subscribe gracefully', function (t) {
  t.plan(2)
  var iface = a.getInterface()
  b.subscribe('event', handler, t.fail)
  b.send = function () {
    b.send = a.receive
  }
  b.unsubscribe('event', handler)
  b.subscribe('event', handler, t.pass)
  a.getInterface().emit('event', 42)
  function handler (data) {
    t.equal(data, 42)
    a.close()
  }
})

tape('reject out order calls', function (t) {
  t.plan(2)
  b.timeout = 20
  b.send = function (m) {
    b.send = a.receive
    setTimeout(function () {
      a.receive(m)
      t.equal(a.getInterface().listenerCount('event'), 0)
    }, 10)
  }
  b.subscribe('event', handler, t.fail)
  b.unsubscribe('event', handler)
  b.subscribe('event', handler, t.fail)
  a.getInterface().emit('event', 42)
  function handler (data) {
    t.equal(data, 42)
    a.send = b.receive
    b.send = a.receive
    b.timeout = 0
    b.unsubscribe('event', handler)
  }
})

tape('wrap sequence numbers', function (t) {
  t.plan(3)
  var a = new Rpc({
    send: function (m) {
      b.receive(m)
    }
  })
  var b = new Rpc({
    send: function (m) {
      a.receive(m)
    }
  })
  a._subscriptionSequence.remote = Math.pow(2, 32) - 1
  b._subscriptionSequence.local = Math.pow(2, 32) - 1
  b.subscribe('event', handler, t.fail)
  t.equal(a._subscriptionSequence.remote, 0)
  t.equal(b._subscriptionSequence.local, 0)
  a.getInterface().emit('event', 42)
  function handler (data) {
    t.equal(data, 42)
    b.unsubscribe('event', handler)
  }
})

tape('show that unsubscribe is "best effort"', function (t) {
  t.plan(1)
  b.timeout = 10
  b.subscribe('event', t.fail, t.fail)
  b.send = function () {
    b.send = a.receive
  }
  b.unsubscribe('event', t.fail)
  b.once('event', function (data) {
    t.equal(data, 42)
    b.timeout = 0
    b.unsubscribe('event', t.fail)
  })
  a.getInterface().emit('event', 42)
})
