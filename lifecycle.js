/*
Assumes the JS environment has these capabilities:
- Promise
- Function.prototype.bind
*/

function Lifecycle(parent) {
  'use strict';
  this.parent = parent;
  this.top = parent;
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

  Lifecycle.prototype = {
    getWaiting: function(normalizedId) {
      var waiting = getOwn(this.waiting, normalizedId);
      if (!waiting) {
        waiting = this.parent && this.parent.getWaiting(normalizedId);
      }
      return waiting || undefined;
    },

    getRegistered: function(normalizedId) {
      var registered = getOwn(this.registry, normalizedId);
      if (!registered) {
        registered = this.parent && this.parent.getRegistered(normalizedId);
      }
      return registered || undefined;
    },

    getModule: function(normalizedId) {
      var mod = getOwn(this.modules, normalizedId);
      if (!mod) {
        mod = this.parent && this.parent.getModule(normalizedId);
      }
      return mod || undefined;
    },

// use to bootstrap loading. The promise return from this does not
// return anything. At the end of resolution, use this.getModule(normalizedId)
// to get the final module value(?)
    use: function(id, refId, factorySequence) {
      return new Promise(function(resolve, reject) {
        var normalizedId = this.normalize(id, refId);

        // If already defined, just resturn the module.
        if (hasProp(this.modules, normalizedId)) {
          return resolve(this.modules[normalizedId]);
        }

        if (!factorySequence) {
          this.factorySequences.push(factorySequence = {
            desc: (refId || '[Top]') + ' asking for ' + id,
            depCount: 0,
            depOrder: [],
            depIds: {},
            errors: []
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

        var oldRes = resolve,
            oldRej = reject;

        resolve = function(value) {
          this.factorySequenceDepComplete(factorySequence);
          oldRes(value);
        }.bind(this);

        reject = function (err) {
          factorySequence.errors.push({
            desc: (refId || '[Top]') + ' asking for ' + id,
            error: err
          });
          this.factorySequenceDepComplete(factorySequence);

          oldRej(err);
        }.bind(this);

        var waiting = this.getWaiting(normalizedId);
        if (waiting) {
          return waiting.then(resolve, reject);
        }

        var location = this.locate(normalizedId);

        (this.parent || this).load(normalizedId, location, factorySequence)
        .then(resolve, reject);
      }.bind(this));
    },

    load: function(normalizedId, location, factorySequence) {
      var loaded = this.fetch(location)
      .then(function(source) {
        source = this.translate(normalizedId, location, source);

// The evaluate step should make sure to insert an entry in
// this.registry.
        // Some cases, like script tag-based loading, do not have source to
        // evaluate, hidden by browser security restrictions from seeing the
        // source.
        if (source) {
          this.evaluate(normalizedId, location, source);
        }

        var registered = getOwn(this.registry, normalizedId);
        if (!registered) {
          // Could be a script with no formal dependencies or exports.
          return [];
        }

        // Dependencies should not be normalized yet. Allow an async step here
        // to allow mechanisms, like AMD loader plugins, to async load plugins
        // before absolute resolving the IDs.
        if (registered.deps) {
          return this.depend(normalizedId, registered.deps);
        }
      }.bind(this))
      .then(function (deps) {
        return new Promise.all(deps.map(function(depId) {
          return this.use(depId, normalizedId, factorySequence);
        }.bind(this)));
      }.bind(this));

      this.waiting[normalizedId] = new Promise(function(resolve, reject) {
        loaded.then(resolve, reject);
      });

      return this.waiting[normalizedId];
    },

    evaluate: function(normalizedId, location, source) {
      exec(this, normalizedId, location, source);
    },

    factorySequenceDepComplete: function(factorySequence) {
      factorySequence.depCount -= 1;
      if (factorySequence.depCount !== 0) {
        return;
      }

//todo: check that this error pathway works out.
      if (factorySequence.errors.length) {
        var error = new Error('Errors in module resolution. ' +
                             'Check factorySequence.error property for detail');
        error.factorySequence = factorySequence;
      }

      // Sequences are now complete, execute factories for the dependency chain
      // in the right order, as according to depOrder.
      var order = factorySequence.depOrder;
      for (var i = 0; i < order.length; i++) {
        var depId = order[i],
            registered = this.getRegistered(depId);

        //registered may not exist, dependency could have already been handled
        //by a different factorySequence, and that is OK.
        if (!registered) {
          continue;
        }

//todo: confirm that a throw in here is bubbled up correctly. Is there a way
//to reset/retry? Maybe not for now.
        this.modules[depId] = this.instantiate(depId,
                                               registered.deps,
                                               registered.factory);
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
