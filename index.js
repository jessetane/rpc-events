module.exports = RpcEmitter

var MAX_INT = Math.pow(2, 32) - 1
var MAX_INT_HALF = Math.round(MAX_INT / 2)

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
  this._subscriptionSequence = {
    local: Math.round(Math.random() * MAX_INT),
    remote: null
  }
  var self = this
  this.on('interface-add', function (iface, path) {
    if (path === '') {
      iface.subscribe = self._subscribe.bind(self)
      iface.unsubscribe = self._unsubscribe.bind(self)
    }
  })
  this.on('interface-remove', this._oninterfaceRemove)
  this.setInterface('', new Emitter())
  this.close = this.close.bind(this)
}

RpcEmitter.prototype.close = function () {
  for (var localIfaceName in this._subscriptions.local) {
    var localIface = this._subscriptions.local[localIfaceName]
    var iface = this._interfaces[localIfaceName]
    for (var localEventName in localIface) {
      var subscription = localIface[localEventName]
      if (iface) {
        var fn = subscription[0]
        iface.removeListener(localEventName, fn)
      }
      var cb = subscription[1]
      if (cb) {
        var err = new Error('Interface was removed')
        err.code = -32002
        cb(err)
      }
    }
    delete this._subscriptions.local[localIfaceName]
  }
  this._subscriptionSequence.remote = null
  RpcEngine.prototype.close.call(this)
}

RpcEmitter.prototype.subscribe = function (path, fn, cb) {
  var sep = path.lastIndexOf(this.pathDelimiter)
  var remoteIfaceName = sep > 0 ? path.slice(0, sep) : ''
  var remoteIface = this._subscriptions.remote[remoteIfaceName]
  if (!remoteIface) {
    remoteIface = this._subscriptions.remote[remoteIfaceName] = {}
  }
  var remoteEventName = sep > 0 ? path.slice(sep + 1) : path
  var subscription = remoteIface[remoteEventName]
  if (subscription) {
    this.on(path, fn)
    subscription.handlers.push([fn, cb])
    return
  }
  var id = this.generateCallId()
  subscription = remoteIface[remoteEventName] = { id, handlers: [[fn, cb]] }
  var self = this
  this.call(id, 'subscribe', this._generateLocalSubscriptionSequence(), path, function (err) {
    if (err) {
      if (err.data && err.data.existingCallbackId) {
        id = err.data.existingCallbackId
      } else {
        teardown(err)
        return
      }
    }
    self._callbacks[id] = teardown
    self.on(path, fn)
    function teardown (err) {
      subscription.handlers.forEach(function (handler) {
        var fn = handler[0]
        var cb = handler[1]
        self.removeListener(remoteEventName, fn)
        if (cb) cb(err)
      })
      delete remoteIface[remoteEventName]
      if (Object.keys(remoteIface).length === 0) {
        delete self._subscriptions.remote[remoteIfaceName]
      }
    }
  })
}

RpcEmitter.prototype.unsubscribe = function (path, fn) {
  var sep = path.lastIndexOf(this.pathDelimiter)
  var remoteIfaceName = sep > 0 ? path.slice(0, sep) : ''
  var remoteIface = this._subscriptions.remote[remoteIfaceName]
  if (!remoteIface) {
    return
  }
  var remoteEventName = sep > 0 ? path.slice(sep + 1) : path
  var subscription = remoteIface[remoteEventName]
  if (!subscription) {
    return
  }
  for (var i = subscription.handlers.length - 1; i > -1; i--) {
    var handler = subscription.handlers[i]
    if (handler[0] === fn) {
      this.removeListener(path, fn)
      subscription.handlers.splice(i, 1)
      break
    }
  }
  if (subscription.handlers.length === 0) {
    var cb = this._callbacks[subscription.id]
    if (cb) clearTimeout(cb.timeout)
    delete this._callbacks[subscription.id]
    delete remoteIface[remoteEventName]
    if (Object.keys(remoteIface).length === 0) {
      delete this._subscriptions.remote[remoteIfaceName]
    }
    this.call('unsubscribe', this._generateLocalSubscriptionSequence(), path)
  }
}

RpcEmitter.prototype._subscribe = function (i, path, cb) {
  if (!this._isRemoteSubscriptionSequenceValid(i)) return
  var sep = path.lastIndexOf(this.pathDelimiter)
  var localIfaceName = sep > 0 ? path.slice(0, sep) : ''
  var iface = this._interfaces[localIfaceName]
  if (!iface) {
    var err = new Error('Interface not found')
    err.code = -32000
    cb(err)
    return
  }
  var localIface = this._subscriptions.local[localIfaceName]
  if (!localIface) {
    localIface = this._subscriptions.local[localIfaceName] = {}
  }
  var localEventName = sep > 0 ? path.slice(sep + 1) : path
  var subscription = localIface[localEventName]
  if (subscription) {
    var err = new Error('Subscription exists')
    var _cb = subscription[1]
    err.data = {
      existingCallbackId: _cb.id
    }
    err.code = -32001
    cb(err)
    return
  }
  iface.on(localEventName, fn)
  localIface[localEventName] = [fn, cb]
  var self = this
  cb()
  function fn () {
    var args = Array.prototype.slice.call(arguments)
    args.unshift(path)
    self.call.apply(self, args)
  }
}

RpcEmitter.prototype._unsubscribe = function (i, path) {
  if (!this._isRemoteSubscriptionSequenceValid(i)) return
  var sep = path.lastIndexOf(this.pathDelimiter)
  var localIfaceName = sep > 0 ? path.slice(0, sep) : ''
  var localIface = this._subscriptions.local[localIfaceName]
  if (!localIface) return
  var localEventName = sep > 0 ? path.slice(sep + 1) : path
  var subscription = localIface[localEventName]
  if (!subscription) return
  delete localIface[localEventName]
  var iface = this._interfaces[localIfaceName]
  if (iface) {
    iface.removeListener(localEventName, subscription[0])
  }
  if (Object.keys(localIface).length === 0) {
    delete this._subscriptions.local[localIfaceName]
  }
  return subscription
}

RpcEmitter.prototype._oninterfaceRemove = function (iface, path) {
  var sep = path.lastIndexOf(this.pathDelimiter)
  var localIface = this._subscriptions.local[path]
  if (!localIface) return
  delete this._subscriptions.local[path]
  for (var localEventName in localIface) {
    var subscription = localIface[localEventName]
    if (subscription) {
      iface.removeListener(localEventName, subscription[0])
      var cb = subscription[1]
      if (cb) {
        var err = new Error('Interface was removed')
        err.code = -32002
        cb(err)
      }
    }
  }
}

RpcEmitter.prototype._generateLocalSubscriptionSequence = function () {
  var i = ++this._subscriptionSequence.local
  if (i >= MAX_INT) {
    i = this._subscriptionSequence.local = 0
  }
  return i
}

RpcEmitter.prototype._isRemoteSubscriptionSequenceValid = function (i) {
  if (i >= 0) {
    if (this._subscriptionSequence.remote === null ||
        this._subscriptionSequence.remote < i ||
        this._subscriptionSequence.remote - MAX_INT_HALF > i) {
      this._subscriptionSequence.remote = i
      return true
    }
  }
}
