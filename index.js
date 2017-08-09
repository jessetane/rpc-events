module.exports = RpcEmitter

var RpcEngine = require('rpc-engine')
var inherits = require('inherits')
var Emitter = require('events')

inherits(RpcEmitter, RpcEngine)

function RpcEmitter (opts) {
  RpcEngine.call(this, opts)
  this._subscriptions = {
    local: {},
    remote: {}
  }
  this._interface = new Emitter()
  this._interface.subscribe = this._subscribe.bind(this)
  this._interface.unsubscribe = this._unsubscribe.bind(this)
  this.close = this.close.bind(this)
}

RpcEmitter.prototype.subscribe = function (name, fn, cb) {
  cb = typeof cb === 'function' ? cb : null
  if (!this._subscriptions.remote[name]) {
    this._subscriptions.remote[name] = fn
    var self = this
    this.call('subscribe', name, function (err) {
      if (!self._subscriptions.remote[name]) return
      if (err) {
        if (cb) {
          cb.apply(null, arguments)
        } else {
          self.emit('error', err)
        }
      } else {
        self.on(name, fn)
      }
    })
  }
  if (cb) {
    cb()
  }
}

RpcEmitter.prototype._subscribe = function (name, cb) {
  var path = name.split(this.pathDelimiter)
  var emitter = this.lookupInterface(path.slice(0, -1))
  if (!emitter || !emitter.on) {
    cb(new Error('Emitter not found'))
    return
  }
  if (!this._subscriptions.local[name]) {
    var self = this
    var event = path[path.length - 1]
    var fn = function () {
      var args = Array.prototype.slice.call(arguments)
      args.unshift(name)
      self.call.apply(self, args)
    }
    this._subscriptions.local[name] = [
      emitter,
      event,
      fn
    ]
    emitter.on(event, fn)
  }
  cb()
}

RpcEmitter.prototype.unsubscribe = function (name, fn, cb) {
  delete this._subscriptions.remote[name]
  this.removeListener(name, fn)
  if (this.listenerCount(name) === 0) {
    this.call('unsubscribe', name, cb)
  } else if (typeof cb === 'function') {
    cb()
  }
}

RpcEmitter.prototype._unsubscribe = function (name, cb) {
  var subscription = this._subscriptions.local[name]
  if (subscription) {
    subscription[0].removeListener(subscription[1], subscription[2])
    delete this._subscriptions.local[name]
  }
  if (typeof cb === 'function') {
    cb()
  }
}

RpcEmitter.prototype.close = function () {
  for (var name in this._subscriptions.local) {
    var subscription = this._subscriptions.local[name]
    delete this._subscriptions.local[name]
    subscription[0].removeListener(subscription[1], subscription[2])
  }
  for (var name in this._subscriptions.remote) {
    var fn = this._subscriptions.remote[name]
    delete this._subscriptions.remote[name]
    this.removeListener(name, fn)
  }
  RpcEngine.prototype.close.call(this)
}
