/*jshint evil: true */
/*global Promise: true */
'use strict';
var fs = require('fs'),
    path = require('path');

if (typeof Promise === 'undefined') {
  var Promise = require('./support/prim');
}

/*
Assumes the JS environment has these capabilities:
- Promise
- Function.prototype.bind
*/

function Lifecycle(parent) {
  'use strict';
  this.parent = parent;
  this.top = parent ? parent.top : this;
  this.modules = {};
  this.instantiated = {};
  this.registry = {};
  this.waiting = {};
  this.factorySequences = [];
}

(function() {
  'use strict';

  function log(msg) {
    console.log(msg);
  }

  function fslog(fs, msg) {
    var fsId = '[none]';
    if (fs && fs.desc) {
      fsId = '[' + fs.desc + ']';
    }
    return log(fsId + ' ' + msg);
  }

  function evaluate(lifecycle, normalizedId, location, source) {
    /*jshint evil: true */
    eval(source);
  }

  var hasOwn = Object.prototype.hasOwnProperty;
  function hasProp(obj, prop) {
      return hasOwn.call(obj, prop);
  }

  function getOwn(obj, prop) {
      return hasProp(obj, prop) && obj[prop];
  }

  // These helpers are useful when dealing with Lifecycle instance properties,
  // matches what is used internally.
  Lifecycle.hasProp = hasProp;
  Lifecycle.getOwn = getOwn;

  function moduleError(id, err) {
    var newError = new Error(id + ' failed: ' + err);
    newError.originalError = err;
    throw newError;
  }

  function ensurePromise(value) {
    if (!value || !value.then) {
      return Promise.resolve(value);
    }
    return value;
  }

  var fsIdCounter = 0;

  Lifecycle.prototype = {
    getWaiting: function(normalizedId) {
      var waiting = getOwn(this.waiting, normalizedId);
      if (!waiting) {
        waiting = this.parent && this.parent.getWaiting(normalizedId);
      }
      return waiting || undefined;
    },

    removeWaiting: function(normalizedId) {
      if (hasProp(this.waiting, normalizedId)) {
        delete this.waiting[normalizedId];
      } else if (this.parent) {
        this.parent.removeWaiting(normalizedId);
      }
    },

    getRegistered: function(normalizedId) {
      var record,
          registered = getOwn(this.registry, normalizedId);

      if (registered) {
        record = {
          instance: this,
          registered: registered
        };
      } else if (this.parent) {
        record = this.parent.getRegistered(normalizedId);
      }
      return record;
    },

    removeRegistered: function(normalizedId) {
      if (hasProp(this.registry, normalizedId)) {
        delete this.registry[normalizedId];
      } else if (this.parent) {
        this.parent.removeRegistry(normalizedId);
      }
    },

    getModule: function(normalizedId, throwOnMiss) {
      if (hasProp(this.modules, normalizedId)) {
        return this.modules[normalizedId];
      } else if (this.parent) {
        return this.parent.getModule(normalizedId, throwOnMiss);
      }

      if (throwOnMiss) {
        throw new Error(normalizedId + ' is not set yet.');
      }
    },

    setModule: function(normalizedId, value, isTemp) {
      if(!hasProp(this.instantiated, normalizedId)) {
        log('Setting module for ' + normalizedId + ': ' + value +
            (isTemp ? ' [temporary]' : ''));
        this.modules[normalizedId] = value;
        if (!isTemp) {
          this.instantiated[normalizedId] = true;
        }
      }
      return value;
    },

    /**
     * Triggers loading and resolution of modules. Outside callers of this
     * function should only pass id and refId. factorySequence is used
     * internally to track recursive tracing of modules and proper cycle
     * breaking.
     * @param  {String} id              The string ID of the module
     * @param  {String} refId           A reference module ID, used to normalize
     * the id value to an absolute ID.
     * @param  {Array} [factorySequence] Used internally to track execution
     * order based on dependency tree.
     * @return {Promise}                 Promise, resolves to module ID value.
     */
    useUnnormalized: function(id, refId, factorySequence) {
      var normalizedId;

      fslog(factorySequence, 'useUnnormalized: ' + id + ', ' + refId);
      // Top level use calls may be loader plugin resources, so ask for depend
      // hooks to determine if there are any other dependencies for the id
      // before proceeding.
      return ensurePromise(this.top.depend(refId, [id]))
      .then(function() {
        fslog(factorySequence, 'useUnnormalized.then: ' + id + ', ' + refId);
        try {
          normalizedId = this.top.normalize(id, refId);
        } catch (e) {
          moduleError(id + ', ' + refId, e);
        }
        return this.use(normalizedId, refId, factorySequence);
      }.bind(this));
    },

    /**
     * Triggers loading and resolution of modules after an ID has been
     * normalized. Outside callers of this function should only pass id and
     * refId. factorySequence is used internally to track recursive tracing of
     * modules and proper cycle breaking.
     * @param  {String} normalizedId    The normalized string ID of the module
     * @param  {String} refId           A reference module ID, used to relate
     * this use call to another module for cycle/dependency tracing.
     * @param  {Array} [factorySequence] Used internally to track execution
     * order based on dependency tree.
     * @return {Promise}                 Promise, resolves to module ID value.
     */
    use: function(normalizedId, refId, factorySequence) {
      var instantiated = false;

      return Promise.resolve().then(function() {
        fslog(factorySequence, 'use: ' + normalizedId + ', ' + refId);

        // If already defined, just resturn the module.
        if (hasProp(this.instantiated, normalizedId)) {
          fslog(factorySequence, 'use: ' + normalizedId +
                ' has module, returning');
          instantiated = true;
          return;
        }

        if (!factorySequence) {
          this.factorySequences.push(factorySequence = {
            desc: (refId || '[Top]') + ' asking for ' + normalizedId +
                  ' (id' + (fsIdCounter++) + ')',
            depCount: 0,
            depOrder: [],
            depIds: {},
            cycleDetected: {}
          });

          fslog(factorySequence, 'use: created factorySequence: ' +
                normalizedId + ': ' + refId);

          // Indicate refId as already being in the factorySequence, so
          // if it shows up in execution sequence later, it is considered a
          // cycle.
          if (refId) {
            factorySequence.depIds[refId] = true;
          }
        }

        if (hasProp(factorySequence.depIds, normalizedId)) {
          if (!hasProp(factorySequence.cycleDetected, normalizedId)) {
            factorySequence.cycleDetected[normalizedId] = true;
            this.cycleDetected(normalizedId, factorySequence.depOrder);
          }

          // Return from here to break the cycle
          instantiated = true;
          return;
        } else {
          factorySequence.depCount += 1;
          factorySequence.depOrder.unshift(normalizedId);
          factorySequence.depIds[normalizedId] = true;
        }

        // If already waiting on the module, then just wait for it.
        var waiting;
        try {
          waiting = this.getWaiting(normalizedId);
        } catch (e) {
          moduleError(normalizedId, e);
        }

        if (waiting) {
          fslog(factorySequence, 'use: returning waiting: ' + normalizedId);
          return waiting;
        }

        // No waiting record, but could have a registered entry from a bulk
        // module load, waiting for a top level dependency chain to activate
        // and trace dependencies.
        var record = this.getRegistered(normalizedId);
        if (record) {
          var registered = record.registered;
          fslog(factorySequence, 'use: returning registered entry: ' +
                normalizedId);
          return (record.instance.waiting[normalizedId] =
            record.instance.callDepend(normalizedId,
                                       registered.deps,
                                       factorySequence));
        }

        // Not already waiting or in registry, needs to be fetched/loaded.
        var location = this.top.locate(normalizedId, 'js');
        fslog(factorySequence, 'use: calling load: ' + normalizedId +
              ', ' + location);
        return this.top.load(normalizedId, location, factorySequence);
      }.bind(this))
      .then(function() {
        // If considered "instantiate" skip the dependency tracing for
        // factorySequence. Could really be instantiated or a cycle that should
        // be considered "instantiated" to resolve the cycle.
        if (instantiated) {
          return;
        }

        // Now that the module has had its deps normalized, use them all, and
        // track them on the factorySequence. Need this to happen for every
        // factorySequence that comes through to poperly get full dependency
        // chain. But only needs to be done if module is still in registry
        // waiting completion of full processing.
        var record = this.getRegistered(normalizedId);
        if (record) {
          return this.useDeps(normalizedId,
                              record.registered.deps,
                              factorySequence);
        }
      }.bind(this))
      .then(function() {
        fslog(factorySequence, 'use.then: ' + normalizedId);

        // If the ID was part of a factory sequence, indicate complete. It may
        // not be if the module was already in modules.
        if (factorySequence && !instantiated) {
          this.factorySequenceDepComplete(factorySequence);
        }
        var value = this.getModule(normalizedId);

        fslog(factorySequence, 'use.then returning module value: ' +
              normalizedId + ': ' + value);
        return value;
      }.bind(this));
    },

    /**
     * Used internally by lifecycle to complete the load of a resource.
     * @param  {String} normalizedId
     * @param  {String} location
     * @param  {Array} factorySequence
     * @return {Promise}
     */
    load: function(normalizedId, location, factorySequence) {
      fslog(factorySequence, 'load: calling fetch, setting waiting: ' +
            normalizedId);
      return (this.waiting[normalizedId] =
      ensurePromise(this.fetch(normalizedId, location))
      .then(function(source) {
        fslog(factorySequence, 'load.fetch.then: ' + normalizedId);
        log(source);

        try {
          // Protect against fetch promise results being something like a
          // module value, in the case of plugins.
          if (typeof source === 'string' && source) {
            source = this.translate(normalizedId, location, source);
            fslog(factorySequence, 'load.fetch.then called translate: ' +
                  normalizedId);
            log(source);
          }

          // Some cases, like script tag-based loading, do not have source to
          // evaluate, hidden by browser security restrictions from seeing the
          // source.
          if (typeof source === 'string' && source) {
            fslog(factorySequence, 'load.fetch.then calling evaluate: ' +
                  normalizedId);
            this.evaluate(normalizedId, location, source);
          }

          var registered = getOwn(this.registry, normalizedId);

          fslog(factorySequence, 'load.fetch.then calling ' +
                'callDepend: ' + normalizedId + ': ' + registered);

          return this.top.callDepend(normalizedId,
                                     registered.deps,
                                     factorySequence);
        } catch (e) {
          moduleError(normalizedId, e);
        }
      }.bind(this)));
    },

    useDeps: function(normalizedId, deps, factorySequence) {
      if (!deps || !deps.length) {
        return;
      }

      return Promise.all(deps.map(function(depId) {
        return this.use(depId, normalizedId, factorySequence);
      }.bind(this)));
    },

    /**
     * Use this to register a module for resolution without going through the
     * load steps. Useful for cases like multiple inlined modules in a file,
     * where they will not need to be loaded from the network.
     * @param {String} normalizedId
     * @param {Array} deps
     * @param {Function} factory
     */
    addToRegistry: function(normalizedId, deps, factory) {
      // Favor this registry vs asking up the parent chain, to support local
      // module definitions.
      if (!hasProp(this.registry, normalizedId)) {
        var entry = {
          deps: deps,
          factory: factory
        };

        this.registry[normalizedId] = entry;

        log('addToRegistry: ' + normalizedId + ': ' + deps);
      }
    },

    /**
     * Calls the depend function, then normalizes the dependency IDs before
     * resolving.
     * @param  {String} normalizedId
     * @param  {Array} deps
     * @return {Promise}
     */
    callDepend: function(normalizedId, deps, factorySequence) {
      fslog(factorySequence, 'callDepend: ' + normalizedId + ', ' + deps);

      if (!deps || !deps.length) {
        return Promise.resolve([]);
      }

      return ensurePromise(this.depend(normalizedId, deps))
      .then(function(deps) {
        fslog(factorySequence, 'callDepend.then: ' + normalizedId +
                               ', ' + deps);

        var normalizedDeps = deps.map(function(depId) {
          return this.normalize(depId, normalizedId);
        }.bind(this));

        // The normalized reference ID could be undefined if a top level .use
        // call outside of a module.
        if (normalizedId) {
          this.registry[normalizedId].deps = normalizedDeps;
        }

        return normalizedDeps;
      }.bind(this));
    },

    /**
     * Used in internally. Should not be called directly. When a dependency
     * loads, checks to see if a whole dependency chain is loaded, and if so,
     * calls the factory functions based on the depOrder specified in the
     * factorySequence.
     * @param  {Array} factorySequence
     */
    factorySequenceDepComplete: function(factorySequence) {
      factorySequence.depCount -= 1;

      fslog(factorySequence, 'factorySequenceDepComplete: ' +
            factorySequence.depCount);

      if (factorySequence.depCount !== 0) {
        return;
      }

      // Sequences are now complete, execute factories for the dependency chain
      // in the right order, as according to depOrder.
      var order = factorySequence.depOrder;

      fslog(factorySequence, 'factorySequenceDepComplete order: ' + order);

      for (var i = 0; i < order.length; i++) {
        var depId = order[i],
            registeredEntry = this.getRegistered(depId);

        //registered may not exist, dependency could have already been handled
        //by a different factorySequence, and that is OK.
        if (!registeredEntry) {
          continue;
        }

        var registered = registeredEntry.registered;
        try {
          this.setModule(depId, this.instantiate(depId,
                                                 registered.deps,
                                                 registered.factory));
        this.removeRegistered(depId);
        this.removeWaiting(depId);
        } catch (e) {
          moduleError(depId, e);
        }
      }

      // Clean up.
      var index = this.factorySequences.indexOf(factorySequence);
      if (index !== -1) {
        this.factorySequences.splice(index, 1);
      }
    },

    // Implement this if you want to log when cycles occur. If this method
    // throws, it will put the loading into a failure state.
    cycleDetected: function(id, cycleOrder) {
    },

    normalize: function(id, refId) {
      // sync
      return id;
    },

    locate: function(normalizedId, suggestedExtension) {
      // sync
      return normalizedId +
             (suggestedExtension ? '.' + suggestedExtension : '');
    },

    fetch: function(normalizedId, location) {
      // async
      return Promise.resolve('');
    },

    translate: function(normalizedId, location, source) {
      // sync
      return source;
    },

    /**
     * Evaluates the source a of module. May not apply in some module
     * situations, like AMD modules loaded via script tags. Can be overridden if
     * execution should happen differently. For instance, in node, perhaps using
     * the vm module to execute the script. Or for loader plugins, making sure
     * the evaluated result gets converted to registry entries.
     *
     * The result of the execution should place result in a this.registry entry,
     * if the module has dependencies and wants to export a specific module
     * value.
     *
     * @param  {String} normalizedId
     * @param  {String} location
     * @param  {String} source
     */
    evaluate: function(normalizedId, location, source) {
      evaluate(this, normalizedId, location, source);
    },

    depend: function(normalizedId, deps) {
      // async. deps are not normalized yet.
      return Promise.resolve(deps);
    },

    instantiate: function(normalizedId, deps, factory) {
      // sync
      return factory(deps.map(function(dep) {
        return this.getModule(dep);
      }.bind(this)));
    }
  };
}());

module.exports = Lifecycle;
