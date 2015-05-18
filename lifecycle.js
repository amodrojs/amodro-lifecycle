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

  /*
  Values are: {
    deps: [],
    factory: function() {}
  }
   */
  this.registry = {};

  this.waiting = {};
  this.factorySequences = [];
}

(function() {
  'use strict';

  function exec(lifecycle, normalizedId, location, source) {
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

  function moduleError(id, err) {
    var newError = new Error(id + ' failed: ' + err);
    newError.originalError = err;
    throw newError;
  }

  Lifecycle.prototype = {
    getWaiting: function(normalizedId) {
      var waiting = getOwn(this.waiting, normalizedId);
      if (!waiting) {
        waiting = this.parent && this.parent.getWaiting(normalizedId);
      }
      return waiting || undefined;
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

    getModule: function(normalizedId) {
      var mod = getOwn(this.modules, normalizedId);
      if (!mod) {
        mod = this.parent && this.parent.getModule(normalizedId);
      }
      return mod || undefined;
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
    use: function(id, refId, factorySequence) {
      return new Promise(function(resolve, reject) {
        var normalizedId;
        try {
          normalizedId = this.top.normalize(id, refId);
        } catch (e) {
          moduleError(id + ', ' + refId, e);
        }

        // If already defined, just resturn the module.
        var moduleValue = this.getModule(normalizedId);
        if (moduleValue) {
          return resolve(moduleValue);
        }

        if (!factorySequence) {
          this.factorySequences.push(factorySequence = {
            desc: (refId || '[Top]') + ' asking for ' + id,
            depCount: 0,
            depOrder: [],
            depIds: {}
          });

          // Indicate refId as already being in the factorySequence, so
          // if it shows up in execution sequence later, it is considered a
          // cycle.
          if (refId) {
            factorySequence.depIds[refId] = true;
          }
        }

        if (!hasProp(factorySequence.depIds, normalizedId)) {
          factorySequence.depCount += 1;
          factorySequence.depOrder.unshift(normalizedId);
          factorySequence.depIds[normalizedId];
        }

        var oldRes = resolve;

        resolve = function(value) {
          this.factorySequenceDepComplete(factorySequence);
          oldRes(this.getModule(normalizedId));
        }.bind(this);

        var waiting;
        try {
          waiting = this.getWaiting(normalizedId);
        } catch (e) {
          moduleError(normalizedId, e);
        }

        if (waiting) {
          return waiting.then(resolve).catch(reject);
        }

        // No waiting record, but could have a registered entry from a bulk
        // module load, waiting for a top level dependency chain to activate
        // and trace dependencies.
        var record = this.getRegistered(normalizedId);
        if (record) {
          var registered = record.registered;
          var p = record.lifecycle.waiting[normalizedId] = registered.deps &&
            registered.deps.length ?
            this.top.depend(normalizedId, registered.deps) :
            Promise.resolve();

          return p.then(resolve).catch(reject);
        }

        var location = this.top.locate(normalizedId);

        this.top.load(normalizedId, location, factorySequence)
        .then(resolve).catch(reject);
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
      return (this.waiting[normalizedId] = this.fetch(location)
      .then(function(source) {
        try {
          source = this.translate(normalizedId, location, source);

          // Some cases, like script tag-based loading, do not have source to
          // evaluate, hidden by browser security restrictions from seeing the
          // source.
          if (source) {
            this.evaluate(normalizedId, location, source);
          }

          var registered = getOwn(this.registry, normalizedId);
          if (!registered || !registered.deps || !registered.deps.length) {
            // Could be a script with no formal dependencies or exports.
            return [];
          } else {
            // Dependencies should not be normalized yet. Allow an async step
            // here to allow mechanisms, like AMD loader plugins, to async load
            // plugins before absolute resolving the IDs.
            return this.depend(normalizedId, registered.deps);
          }
        } catch (e) {
          moduleError(normalizedId, e);
        }
      }.bind(this))
      .then(function (deps) {
        return new Promise.all(deps.map(function(depId) {
          return this.use(depId, normalizedId, factorySequence);
        }.bind(this)));
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
      }
    },

    /**
     * Used internally to evaluate the source a of module. May not apply in some
     * module situations, like AMD modules loaded via script tags. Can be
     * overridden if execution should happen differently. For instance, in node,
     * perhaps using the vm module to execute the script.
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
      exec(this, normalizedId, location, source);
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
      if (factorySequence.depCount !== 0) {
        return;
      }

      // Sequences are now complete, execute factories for the dependency chain
      // in the right order, as according to depOrder.
      var order = factorySequence.depOrder;
      for (var i = 0; i < order.length; i++) {
        var depId = order[i],
            registered = this.getRegistered(depId).registered;

        //registered may not exist, dependency could have already been handled
        //by a different factorySequence, and that is OK.
        if (!registered) {
          continue;
        }

        try {
          this.modules[depId] = this.instantiate(depId,
                                                 registered.deps,
                                                 registered.factory);
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

    normalize: function(id, refId) {
      // sync
      return id;
    },

    locate: function(id) {
      // sync
      return id + '.js';
    },

    fetch: function(location) {
      // async
      return Promise.resolve('');
    },

    translate: function(normalizedId, location, source) {
      // sync
      return source;
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
