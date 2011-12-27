//
// zordon WAN transport plugin for hook.io
// bryn austin bellomy / signalenvelope dec 2011
//

var Hook = require('hook.io').Hook,
    Ranger = require(__dirname + '/../../hook.io-ranger/lib/ranger').Ranger,
    util = require('util'),
    EventEmitter2 = require('eventemitter2').EventEmitter2

require('./extend')

var Zordon = exports.Zordon = function Zordon(options) {
	Hook.call(this, options)
	var self = this

  /* member vars */
  self._zEmitter = new EventEmitter2({
    delimiter: self.delimiter,
    wildcard: self.wildcard
  })
  self.listenerRangers = []
  self.rangers = []
  self.otherZordons = []

	self.options = options
  
  /* caught events */
	self.on('hook::ready', self.onHookReady)
  self.on('error::*', self.onError)
  
  /* caught events from rangers */
  self.rangerOn(   'ranger::new-dude-in-town', self.onHeardSomebodySomewhere.bind(self))
  self.rangerOn(   'zordon::brawwwr',          self.onHeardSomebodySomewhere.bind(self))
  self.rangerOn('*::ranger::new-dude-in-town', self.onHeardSomebodySomewhere.bind(self))
  self.rangerOn('*::zordon::brawwwr',          self.onHeardSomebodySomewhere.bind(self))
}

// Zordon inherits from Hook
util.inherits(Zordon, Hook)


Zordon.prototype.rangerOn = function(event, cb) {
  var self = this
  self._zEmitter.on(event, cb)
}

Zordon.prototype.rangerEmit = function(event, data, specificRangerName) {
  var self = this
  require('async').forEach(self.rangers,
    function(iterRanger, foreachCallback) {
      if (!(specificRangerName && iterRanger.name != specificRangerName))
        iterRanger.emit(event, data)
      foreachCallback()
    },
    function(err) { if (err) { /* @@TODO */ console.error('>>> ERROR:', err); return } })
}

Zordon.prototype.rangerRelay = function(event, data, cb) {
  var self = this
  self._zEmitter.emit(event, data, cb)
}

Zordon.prototype.spawnRanger = function(listener, _rangerOptions, zordonToConnectTo) {
  var self = this
  var rangerOptions = _rangerOptions || {}
  
  if (!listener) {
    if (zordonToConnectTo) {
      rangerOptions['hook-host'] = zordonToConnectTo['hook-host']
      if (zordonToConnectTo['hook-port']) rangerOptions['hook-port'] = zordonToConnectTo['hook-port']
    }
  }
  
  var theRanger = new Ranger(rangerOptions, self)
  theRanger.start()
  
  if (listener) self.listenerRangers.push(theRanger)
  else self.rangers.push(theRanger)
}



/* events */

Zordon.prototype.onHookReady = function(data) {
  var self = this,
      async = require('async')

  /* rangers :: because you always need a bitch to get shit done */
  
  // listening rangers
  if (self.options['listen-on']) {
    var listeningRangerOptions = {}
    if (self.options['ranger-name']) listeningRangerOptions.name = self.options['ranger-name'] // listening ranger hook name
    self.parseHostPortArgs(self.options['listen-on'], function(err, argList) {
      if (err) { /* @@TODO */ console.error('>>> ERROR:', err); return }
      async.forEach(argList,
        function(iterArg, foreachCallback) {
          self.spawnRanger(true, iterArg.extend(listeningRangerOptions)) // spawn a localhost ranger to guard the hood
          foreachCallback()
        },
        function(err) { if (err) { /* @@TODO */ console.error('>>> ERROR:', err) } }
      )
    })
  }
  
  // remote rangers to go hang with any known remote rangers and their zordons
  if (self.options['known']) {
    self.parseHostPortArgs(self.options['known'], function(err, argList) {
      if (err) { /* @@TODO */ console.error('>>> ERROR:', err); return }
      async.forEach(argList,
        function(iterZordon, foreachCallback) { 
          self.spawnRanger(false, iterZordon.extend({ name: 'ranger-' + self.name + '-listener' }), iterZordon) // spawn a remote ranger
          foreachCallback()
        },
        function(err) { if (err) { /* @@TODO */ console.error('>>> ERROR:', err) } }
      )
    })
  }

  /* setup timers */
  setInterval(self.emitBrawwwr.bind(self), self.options['local-broadcast-interval'] * 1000)
  setInterval(self.removeOldZordons.bind(self), self.options['remote-zordon-ttl'] * 1000) // nobody lives forever
  if (self.options['log-discovered-list'])
    setInterval(self.logDiscoveredList.bind(self), self.options['log-discovered-list'] * 1000)
}

Zordon.prototype.emitBrawwwr = function() {
  var self = this
  var message = {
    addr: self['hook-host'],
    port: self['hook-port'],
    name: self.name,
    knownZordons: self.otherZordons
  }
  self.emit('zordon::brawwwr', message)
}

Zordon.prototype.onHeardSomebodySomewhere = function(otherZordon) {
  var self = this
  self.tryToAddOtherZordon(otherZordon)
  
  if (otherZordon.knownZordons) {
    require('async').forEach(otherZordon.knownZordons,
      function(iterRemoteZordon, foreachCallback) {
        self.tryToAddOtherZordon(iterRemoteZordon)
        foreachCallback()
      },
      function(err) { if (err) { /* @@TODO */ console.error('>>> ERROR:', err); return } })
  }
}

Zordon.prototype.onError = function() {
  var self = this
  console.error('** ZORDON ERROR >>', arguments)
}



/* utility */

Zordon.prototype.tryToAddOtherZordon = function(otherZordon) {
  var self = this

  // don't add any zordons running on the same interface as myself
  if (((self['hook-host'] && otherZordon.addr) && self['hook-host'] == otherZordon.addr)
      || ((self['hook-port'] && otherZordon.port) && self['hook-port'] == otherZordon.port))
    return
  
  // make sure we haven't added this zordon yet
  if (otherZordon.addr && otherZordon.port) {
    require('async').every(self.otherZordons,
      function(iterZordon, everyCallback) {
        var isDifferent = ((iterZordon.addr && otherZordon.addr) && iterZordon.addr != otherZordon.addr)
                       || ((iterZordon.port && otherZordon.port) && iterZordon.port != otherZordon.port)

        // if we already have this guy, update his timestamp so we don't discard him when the cache is pruned
        if (!isDifferent)
          iterZordon.lastTelegram = new Date().getTime() // don't prune me bro!!!!!
        
        everyCallback(isDifferent)
      },
      function(addable) {
        if (addable) {
          otherZordon.lastTelegram = new Date().getTime()
          self.otherZordons.push(otherZordon)
        }
      })
  }
}

Zordon.prototype.removeOldZordons = function() {
  var self = this
  var async = require('async')
  
  async.filter(self.otherZordons,
    function(item, filterCallback) {
      if (new Date().getTime() - item.lastTelegram > self.options['remote-zordon-ttl'] * 1000)
        filterCallback(false)
      else filterCallback(true)
    },
    function(remaining) {
      self.otherZordons = remaining
    })
}

Zordon.prototype.parseHostPortArgs = function(arg, cb) {
  if (!(arg instanceof Array)) arg = [ arg ]
  require('async').map(arg,
    function(iterArg, mapCallback) {
      var addr = iterArg.split(':')
      var toReturn = {}
      if (addr.length == 2) {
        toReturn['hook-host'] = addr[0]
        toReturn['hook-port'] = addr[1]
      }
      else if (addr.length == 1) {
        if (typeof addr[0] == 'number')      toReturn['hook-port'] = addr[0]
        else if (typeof addr[0] == 'string') toReturn['hook-host'] = addr[0]
      }
      mapCallback(null, toReturn)
    },
    cb)
}

Zordon.prototype.logDiscoveredList = function() {
  var self = this
  console.log("Known remote Zordons:", self.otherZordons)
}
