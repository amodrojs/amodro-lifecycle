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
  this.factoryTrees = [];
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

  function trace(instance, id, order, found, cycleDetected) {
    var registeredEntry = instance.getRegistered(id);

    // May already be defined, no longer in registry and that is OK. Another
    // factoryTree took care of it.
    if (!registeredEntry) {
      return;
    }

    var deps = registeredEntry.registered.deps;
    deps.forEach(function(depId) {
      if (instance.isSpecialDep(depId)) {
        return;
      }

      if (hasProp(found, depId)) {
        if (!hasProp(cycleDetected, depId)) {
          cycleDetected[depId] = true;
          instance.cycleDetected(depId, order);
        }
      } else {
        // A separate found map for each dependency, so that trees like this
        // do not end up with baz executing before bar:
        // foo -> bar, baz
        // baz -> bar
        // If the found map is shared, can end up with execution order:
        // [baz, bar, foo], where bar should be before baz.
        var depFound = {};
        depFound[depId] = true;
        Object.keys(found).forEach(function(key) {
          depFound[key] = true;
        });
        order.unshift(depId);
        trace(instance, depId, order, depFound, cycleDetected);
      }
    });
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

    /**
     * Returns true if the loader contains a module for the module ID. It may
     * not actually be defined yet though, may still in process of loading, so
     * to get a handle on it, use async APIs to get to it.
     * @param  {String}  normalizedId
     * @return {Boolean}
     */
    containsModule: function(normalizedId) {
      return hasProp(this.modules, normalizedId) ||
        hasProp(this.registry, normalizedId) ||
        (this.parent && this.parent.containsModule(normalizedId));
    },

    /**
     * Returns true if there is a module value for the given ID. The value may
     * not be fully defined yet, for a module in a cycle.
     * @param  {String} normalizedId
     * @return {Boolean}
     */
    hasModule: function(normalizedId) {
      return hasProp(this.modules, normalizedId) ||
             (this.parent && this.parent.hasModule(normalizedId));
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

    removeModule: function(normalizedId) {
      if (hasProp(this.modules, normalizedId) ||
          hasProp(this.waiting, normalizedId) ||
          hasProp(this.registry, normalizedId)) {
        this.removeRegistered(normalizedId);
        this.removeWaiting(normalizedId);
        delete this.modules[normalizedId];
        delete this.instantiated[normalizedId];
      } else if (this.parent) {
        return this.parent.removeModule(normalizedId);
      }
    },

    /**
     * Triggers loading and resolution of modules. Outside callers of this
     * function should only pass id and refId. factoryTree is used
     * internally to track recursive tracing of modules and proper cycle
     * breaking.
     * @param  {String} id              The string ID of the module
     * @param  {String} refId           A reference module ID, used to normalize
     * the id value to an absolute ID.
     * @param  {Array} [factoryTree] Used internally to track execution
     * order based on dependency tree.
     * @return {Promise}                 Promise, resolves to module ID value.
     */
    useUnnormalized: function(id, refId, factoryTree) {
      var normalizedId;

      fslog(factoryTree, 'useUnnormalized: ' + id + ', ' + refId);
      // Top level use calls may be loader plugin resources, so ask for depend
      // hooks to determine if there are any other dependencies for the id
      // before proceeding.
      return ensurePromise(this.top.depend(refId, [id]))
      .then(function() {
        fslog(factoryTree, 'useUnnormalized.then: ' + id + ', ' + refId);
        try {
          normalizedId = this.top.normalize(id, refId);
        } catch (e) {
          moduleError(id + ', ' + refId, e);
        }
        return this.use(normalizedId, refId, factoryTree);
      }.bind(this));
    },

    /**
     * Triggers loading and resolution of modules after an ID has been
     * normalized. Outside callers of this function should only pass id and
     * refId. factoryTree is used internally to track recursive tracing of
     * modules and proper cycle breaking.
     * @param  {String} normalizedId    The normalized string ID of the module
     * @param  {String} refId           A reference module ID, used to relate
     * this use call to another module for cycle/dependency tracing.
     * @param  {Array} [factoryTree] Used internally to track execution
     * order based on dependency tree.
     * @return {Promise}                 Promise, resolves to module ID value.
     */
    use: function(normalizedId, refId, factoryTree) {
      var instantiated = false;

      return Promise.resolve().then(function() {
        fslog(factoryTree, 'use: ' + normalizedId + ', ' + refId);

        // If already defined, just resturn the module.
        if (hasProp(this.instantiated, normalizedId)) {
          fslog(factoryTree, 'use: ' + normalizedId +
                ' has module, returning');
          instantiated = true;
          return;
        }

        if (!factoryTree) {
          this.factoryTrees.push(factoryTree = {
            desc: (refId || '[Top]') + ' asking for ' + normalizedId +
                  ' (id' + (fsIdCounter++) + ')',
            depCount: 0,
            startRefId: refId,
            startId: normalizedId,
            depIds: {}
          });

          fslog(factoryTree, 'use: created factoryTree: ' +
                normalizedId + ': ' + refId);
        }

        if (hasProp(factoryTree.depIds, normalizedId)) {
          // Return from here, ID already known.
          instantiated = true;
          return;
        } else {
          factoryTree.depCount += 1;
          factoryTree.depIds[normalizedId] = true;
        }

        // If already waiting on the module, then just wait for it.
        var waiting;
        try {
          waiting = this.getWaiting(normalizedId);
        } catch (e) {
          moduleError(normalizedId, e);
        }

        if (waiting) {
          fslog(factoryTree, 'use: returning waiting: ' + normalizedId);
          return waiting;
        }

        // No waiting record, but could have a registered entry from a bulk
        // module load, waiting for a top level dependency chain to activate
        // and trace dependencies.
        var record = this.getRegistered(normalizedId);
        if (record) {
          var registered = record.registered;
          fslog(factoryTree, 'use: returning registered entry: ' +
                normalizedId);
          return (record.instance.waiting[normalizedId] =
            record.instance.callDepend(normalizedId,
                                       registered.deps,
                                       factoryTree));
        }

        // Not already waiting or in registry, needs to be fetched/loaded.
        var location = this.top.locate(normalizedId, 'js');
        fslog(factoryTree, 'use: calling load: ' + normalizedId +
              ', ' + location);
        return this.top.load(normalizedId, refId, location, factoryTree);
      }.bind(this))
      .then(function() {
        // If considered "instantiate" skip the dependency tracing for
        // factoryTree. Could really be instantiated or a cycle that should
        // be considered "instantiated" to resolve the cycle.
        if (instantiated) {
          return;
        }

        // Now that the module has had its deps normalized, use them all, and
        // track them on the factoryTree. Need this to happen for every
        // factoryTree that comes through to poperly get full dependency
        // chain. But only needs to be done if module is still in registry
        // waiting completion of full processing.
        var record = this.getRegistered(normalizedId);
        if (record) {
          var deps = record.registered.deps;
          if (!deps || !deps.length) {
            return;
          }

          return Promise.all(deps.map(function(depId) {
            return this.use(depId, normalizedId, factoryTree);
          }.bind(this)));
        }
      }.bind(this))
      .then(function() {
        fslog(factoryTree, 'use.then: ' + normalizedId);

        // If the ID was part of a factory sequence, indicate complete. It may
        // not be if the module was already in modules.
        if (factoryTree && !instantiated) {
          this.factoryTreeDepComplete(factoryTree);
        }
        var value = this.getModule(normalizedId);

        fslog(factoryTree, 'use.then returning module value: ' +
              normalizedId + ': ' + value);
        return value;
      }.bind(this));
    },

    /**
     * Used internally by lifecycle to complete the load of a resource. Results
     * in a waiting promise set for the normalizedId.
     * @param  {String} normalizedId
     * @param  {String} location
     * @param  {Array} factoryTree
     * @return {Promise}
     */
    load: function(normalizedId, refId, location, factoryTree) {
      fslog(factoryTree, 'load: calling fetch, setting waiting: ' +
            normalizedId);
      return (this.waiting[normalizedId] =
      ensurePromise(this.fetch(normalizedId, refId, location))
      .then(function(source) {
        fslog(factoryTree, 'load.fetch.then, source for: ' + normalizedId);
        log(source);

        try {
          // Protect against fetch promise results being something like a
          // module value, in the case of plugins.
          if (typeof source === 'string' && source) {
            source = this.translate(normalizedId, location, source);
            fslog(factoryTree, 'load.fetch.then called translate: ' +
                  normalizedId);
            log(source);
          }

          // Some cases, like script tag-based loading, do not have source to
          // evaluate, hidden by browser security restrictions from seeing the
          // source.
          if (typeof source === 'string' && source) {
            fslog(factoryTree, 'load.fetch.then calling evaluate: ' +
                  normalizedId);
            this.evaluate(normalizedId, location, source);
          }

          var registered = getOwn(this.registry, normalizedId);

          fslog(factoryTree, 'load.fetch.then calling ' +
                'callDepend: ' + normalizedId + ': ' + registered);

          return this.top.callDepend(normalizedId,
                                     registered.deps,
                                     factoryTree);
        } catch (e) {
          moduleError(normalizedId, e);
        }
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
    callDepend: function(normalizedId, deps, factoryTree) {
      fslog(factoryTree, 'callDepend: ' + normalizedId + ', ' + deps);

      if (!deps || !deps.length) {
        return Promise.resolve([]);
      }

      return ensurePromise(this.depend(normalizedId, deps))
      .then(function(deps) {
        fslog(factoryTree, 'callDepend.then: ' + normalizedId +
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
     * Used internally. Should not be called directly. When a dependency
     * loads, checks to see if a whole dependency chain is loaded, and if so,
     * calls the factory functions based on the dependency order specified by
     * tracing the dependencies for the ID that started the factoryTree.
     * @param  {Array} factoryTree
     */
    factoryTreeDepComplete: function(factoryTree) {
      factoryTree.depCount -= 1;

      fslog(factoryTree, 'factoryTreeDepComplete: ' +
            factoryTree.depCount);

      if (factoryTree.depCount !== 0) {
        return;
      }

      // Sequences are now complete, execute factories for the dependency chain
      // in the right order. Trace the dep tree to find the right order.
      var startId = factoryTree.startId,
          order = [startId],
          found = {};

      found[startId] = true;

      // If a starting refId, could be something like a loader plugin that asked
      // for a dynamic load of dependencies, which in turn could depend on the
      // loader plugin resource. Allow breaking that chain here.
//todo: create test case to exercise this code.
      if (factoryTree.startRefId) {
        found[factoryTree.startRefId] = true;
      }

      trace(this, startId, order, found, {});

      fslog(factoryTree, 'factoryTreeDepComplete order: ' + order);

      for (var i = 0; i < order.length; i++) {
        var depId = order[i],
            registeredEntry = this.getRegistered(depId);

        //registered may not exist, dependency could have already been handled
        //by a different factoryTree, and that is OK.
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
      var index = this.factoryTrees.indexOf(factoryTree);
      if (index !== -1) {
        this.factoryTrees.splice(index, 1);
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

    fetch: function(normalizedId, refId, location) {
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
    },

    /**
     * Some module systems have special dependencies, like the require,
     * exports, module ones in AMD modules. That kind of loader can implement
     * this method to avoid some of the noise with module logging and tracing.
     */
    isSpecialDep: function(normalizedId) {
      return false;
    }
  };
}());
