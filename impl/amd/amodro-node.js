/*jshint strict: false */
/*global Lifecycle, dotNormalize, normalizeAlias, define: true */
var amodro, define;
(function() {
  /**
 * prim 0.0.7 Copyright (c) 2012-2013, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/prim for details
 */

/*global setImmediate, process, setTimeout, define, module */
var prim;
(function () {
    'use strict';

    var waitingId, nextTick,
        waiting = [];

    function callWaiting() {
        waitingId = 0;
        var w = waiting;
        waiting = [];
        while (w.length) {
            w.shift()();
        }
    }

    function asyncTick(fn) {
        waiting.push(fn);
        if (!waitingId) {
            waitingId = setTimeout(callWaiting, 0);
        }
    }

    function syncTick(fn) {
        fn();
    }

    function isFunObj(x) {
        var type = typeof x;
        return type === 'object' || type === 'function';
    }

    //Use setImmediate.bind() because attaching it (or setTimeout directly
    //to prim will result in errors. Noticed first on IE10,
    //issue requirejs/alameda#2)
    nextTick = typeof setImmediate === 'function' ? setImmediate.bind() :
        (typeof process !== 'undefined' && process.nextTick ?
            process.nextTick : (typeof setTimeout !== 'undefined' ?
                asyncTick : syncTick));

    function notify(ary, value) {
        prim.nextTick(function () {
            ary.forEach(function (item) {
                item(value);
            });
        });
    }

    function callback(p, ok, yes) {
        if (p.hasOwnProperty('v')) {
            prim.nextTick(function () {
                yes(p.v);
            });
        } else {
            ok.push(yes);
        }
    }

    function errback(p, fail, no) {
        if (p.hasOwnProperty('e')) {
            prim.nextTick(function () {
                no(p.e);
            });
        } else {
            fail.push(no);
        }
    }

    prim = function prim(fn) {
        var promise, f,
            p = {},
            ok = [],
            fail = [];

        function makeFulfill() {
            var f, f2,
                called = false;

            function fulfill(v, prop, listeners) {
                if (called) {
                    return;
                }
                called = true;

                if (promise === v) {
                    called = false;
                    f.reject(new TypeError('value is same promise'));
                    return;
                }

                try {
                    var then = v && v.then;
                    if (isFunObj(v) && typeof then === 'function') {
                        f2 = makeFulfill();
                        then.call(v, f2.resolve, f2.reject);
                    } else {
                        p[prop] = v;
                        notify(listeners, v);
                    }
                } catch (e) {
                    called = false;
                    f.reject(e);
                }
            }

            f = {
                resolve: function (v) {
                    fulfill(v, 'v', ok);
                },
                reject: function(e) {
                    fulfill(e, 'e', fail);
                }
            };
            return f;
        }

        f = makeFulfill();

        promise = {
            then: function (yes, no) {
                var next = prim(function (nextResolve, nextReject) {

                    function finish(fn, nextFn, v) {
                        try {
                            if (fn && typeof fn === 'function') {
                                v = fn(v);
                                nextResolve(v);
                            } else {
                                nextFn(v);
                            }
                        } catch (e) {
                            nextReject(e);
                        }
                    }

                    callback(p, ok, finish.bind(undefined, yes, nextResolve));
                    errback(p, fail, finish.bind(undefined, no, nextReject));

                });
                return next;
            },

            catch: function (no) {
                return promise.then(null, no);
            }
        };

        try {
            fn(f.resolve, f.reject);
        } catch (e) {
            f.reject(e);
        }

        return promise;
    };

    prim.resolve = function (value) {
        return prim(function (yes) {
            yes(value);
        });
    };

    prim.reject = function (err) {
        return prim(function (yes, no) {
            no(err);
        });
    };

    prim.cast = function (x) {
        // A bit of a weak check, want "then" to be a function,
        // but also do not want to trigger a getter if accessing
        // it. Good enough for now.
        if (isFunObj(x) && 'then' in x) {
            return x;
        } else {
            return prim(function (yes, no) {
                if (x instanceof Error) {
                    no(x);
                } else {
                    yes(x);
                }
            });
        }
    };

    prim.all = function (ary) {
        return prim(function (yes, no) {
            var count = 0,
                length = ary.length,
                result = [];

            function resolved(i, v) {
                result[i] = v;
                count += 1;
                if (count === length) {
                    yes(result);
                }
            }

            if (!ary.length) {
                yes([]);
            } else {
                ary.forEach(function (item, i) {
                    prim.cast(item).then(function (v) {
                        resolved(i, v);
                    }, function (err) {
                        no(err);
                    });
                });
            }
        });
    };

    prim.nextTick = nextTick;

    if (typeof define === 'function' && define.amd) {
        define(function () { return prim; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = prim;
    }
}());

  if (typeof Promise === 'undefined') {
  var Promise = prim;
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
          var p = record.instance.waiting[normalizedId] = registered.deps &&
            registered.deps.length ?
            this.top.callDepend(normalizedId, registered.deps) :
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
      return (this.waiting[normalizedId] = this.fetch(normalizedId, location)
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
            return this.callDepend(normalizedId, registered.deps);
          }
        } catch (e) {
          moduleError(normalizedId, e);
        }
      }.bind(this))
      .then(function (deps) {
        if (!deps.length) {
          return;
        }

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
     * Calls the depend function, then normalizes the dependency IDs before
     * resolving.
     * @param  {String} normalizedId
     * @param  {Array} deps
     * @return {Promise}
     */
    callDepend: function(normalizedId, deps) {
      return this.depend(normalizedId, deps).then(function(deps) {
        var normalizedDeps = deps.map(function(depId) {
          return this.normalize(depId, normalizedId);
        }.bind(this));

        return (this.registry[normalizedId].deps = normalizedDeps);
      }.bind(this));
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

    fetch: function(id, location) {
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

  // Assumptions: wants a getOwn() function in scope.
function normalizeAlias(nameParts, refParts, config) {
  var i, j, nameSegment, aliasValue, foundAlias, foundI, foundStarAlias,
      starI;

  var alias = config.alias;

  //Apply alias config if appropriate.
  var starAlias = alias && alias['*'];

  if (alias && (refParts || starAlias)) {
    outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
      nameSegment = nameParts.slice(0, i).join('/');

      // alias config is keyed off the refereName, so use its parts to
      // find a refName-specific config.
      if (refParts) {
        //Find the longest refName segment match in the config.
        //So, do joins on the biggest to smallest lengths of refParts.
        for (j = refParts.length; j > 0; j -= 1) {
          aliasValue = getOwn(alias, refParts.slice(0, j).join('/'));

          //refName segment has config, find if it has one for
          //this name.
          if (aliasValue) {
            aliasValue = getOwn(aliasValue, nameSegment);
            if (aliasValue) {
            //Match, update name to the new value.
            foundAlias = aliasValue;
            foundI = i;
            break outerLoop;
            }
          }
        }
      }

      //Check for a star map match, but just hold on to it,
      //if there is a shorter segment match later in a matching
      //config, then favor over this star map.
      if (!foundStarAlias && starAlias &&
        getOwn(starAlias, nameSegment)) {
        foundStarAlias = getOwn(starAlias, nameSegment);
        starI = i;
      }
    }

    if (!foundAlias && foundStarAlias) {
    foundAlias = foundStarAlias;
    foundI = starI;
    }

    if (foundAlias) {
    nameParts.splice(0, foundI, foundAlias);
    }
  }

  return nameParts.join('/');
}
  function dotNormalize(id, refId, returnArray) {
  var idParts = id.split('/'),
      refParts = refId && refId.split('/');

  if (idParts[0].charAt(0) === '.') {
    if (refId) {
      //Convert refId to array, and lop off the last part,
      //so that . matches that 'directory' and not name of the
      // refId's module. For instance, refId of
      // 'one/two/three', maps to 'one/two/three.js', but we want the
      // directory, 'one/two' for this normalization.
      idParts = refParts.slice(0, refParts.length - 1)
                  .concat(idParts);
    } else if (id.indexOf('./') === 0) {
      // Just trim it off, already at the top of the module ID space.
      idParts[0] = idParts[0].substring(2);
    } else {
      throw new Error('Invalid ID, oustide of the module ID space: ' +
                      id);
    }
  }

  // Trim dots, and throw if the dot is outside the ID space.
  var i, part;
  for (i = 0; i < idParts.length; i++) {
    part = idParts[i];
    if (part === '.') {
      idParts.splice(i, 1);
      i -= 1;
    } else if (part === '..') {
      // If at the start, or previous value is still ..,
      // keep them so that when converted to a path it may
      // still work when converted to a path, even though
      // as an ID it is less than ideal. In larger point
      // releases, may be better to just kick out an error.
      if (i === 0) {
        throw new Error('Cannot resolve ID segment: ' +
                         idParts.join('/') +
                         ', .. is outside module ID space');
      } else if (i > 0) {
        idParts.splice(i - 1, 2);
        i -= 2;
      }
    }
  }

  return returnArray ? idParts: idParts.join('/');
}



  var slice = Array.prototype.slice,
      commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
      cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g;

  function makeRequire(instance, refId) {
    function require(deps, callback, errback) {
      // If waiting inline definitions, claim them for this instance.
      if (defineQueue.length) {
        instance.execCompleted();
      }

      if (typeof deps === 'string') {
        var normalizedDepId = instance.top.normalize(deps, refId);
        return instance.getModule(normalizedDepId, true);
      }

      var p = Promise.all(deps.map(function(dep) {
        return instance.use(dep, refId);
      }));

      if (callback) {
        p = p.then(function(ary) {
          return callback.apply(undefined, ary);
        });
      }
      if (errback) {
        p = p.catch(errback);
      }
      return p;
    }

    require.normalize = function(relId) {
      return instance.top.normalize(relId, refId);
    };
    require.locate = function(relId) {
      var id = instance.top.normalize(relId, refId);
      return instance.top.locate(id);
    };

//todo: specified and defined?

    return require;
  }

  // Lifecycle overrides and additional methods
  var protoMethods = {
    // START overrides
    normalize: function(id, refId) {
      // sync
      var idParts = dotNormalize(id, refId, true);
      if (this.config.alias) {
        return normalizeAlias(idParts, (refId ? refId.split('/') : []),
                              this.config);
      } else {
        return idParts.join('/');
      }
    },

    locate: function(id) {
      // sync
//todo: locations config, bundles config?
      return this.config.baseUrl + id + '.js';
    },

    fetch: function(id, location) {
      // async
      return amodro.fetch(id, location, this);
    },

    translate: function(normalizedId, location, source) {
      // sync
//todo: may need loader plugin calls in there.
      return source;
    },

    depend: function(normalizedId, deps) {
      // async. deps are not normalized yet.
//todo: loader plugin support
      return Promise.resolve(deps);
    },

    instantiate: function(normalizedId, normalizedDeps, factory) {
      // sync
      var usesExports = false,
          usesModule = false;

//todo: use exports as the call context, to match node
      var ret = factory.apply(undefined, normalizedDeps.map(function(dep) {
        if (dep === 'require') {
          return makeRequire(this, dep);
        } else if (dep === 'exports') {
          usesExports = true;
//todo: likely need to detect this in depend() and set up a module value for
//cycles.
        } else if (dep === 'module') {
          usesModule = true;
//todo: likely need to detect this in depend() and set up a module value for
//cycles.
        } else {
          return this.getModule(dep);
        }
      }.bind(this)));

      if (ret === undefined && (usesExports || usesModule)) {
        return this.modules[normalizedId];
      } else {
        return ret;
      }
    },
    // END overrides

    execCompleted: function(normalizedId) {
      var queue = defineQueue,
          anon = [],
          foundId = !normalizedId;
debugger;
      defineQueue = [];

      queue.forEach(function(def) {
        var id, deps, vary, fn;

        // Normalize define call to id, deps, factory.
        if (def.length === 1) {
          vary = def[0];
        } else if (def.length === 2) {
          if (typeof def[0] === 'string') {
            // either id, vary or id, deps
            id = def[0];
            if (Array.isArray(def[1])) {
              deps = def[1];
            } else {
              vary = def[1];
            }
          } else {
            // Other two arg combo is deps, fn, an anon call.
            deps = def[0];
            vary = def[1];
          }
        } else {
          id = def[0];
          deps = def[1];
          vary = def[2];
        }

        // If factory is not a function, wrap it in a function.
        if (typeof vary === 'function') {
          fn = vary;
        } else if (typeof vary === 'string' && !id) {
          // define('id');
          id = vary;
        } else {
          fn = function() {
            return vary;
          };
        }

        if (!deps) {
          // No deps, but a function with at least one argument length to it,
          // probably a cjs sugar syntax define.
          if(fn && fn.length) {
            deps = amodro.parseCjsFunction(fn);
          } else {
            deps = [];
          }
        }

        if (id) {
          if (normalizedId && id === normalizedId) {
            foundId = true;
          }
          this.addToRegistry(id, deps, fn);
        } else {
          anon.push([deps, fn]);
        }
      }.bind(this));

      if (anon.length) {
        for (var i = 0; i < anon.length; i++) {
          var anonEntry = anon[i];
          if (i === anon.length - 1 && !foundId) {
            this.addToRegistry(normalizedId, anonEntry[0], anonEntry[1]);
          } else {
            console.error('Mismatched define. Ignoring, but a sign of a ' +
                          'loading setup problem: ' + anonEntry);
          }
        }
      }
    },

    configure: function(cfg) {
      if (cfg.baseUrl) {
        var baseUrl = cfg.baseUrl;
        if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
          baseUrl += '/';
        }
        this.config.baseUrl = baseUrl;
      }
//todo: finish this.
    }
  };

  Object.keys(protoMethods).forEach(function(key) {
    Lifecycle.prototype[key] = protoMethods[key];
  });

  var loaderInstanceCounter = 0;

  function LoaderLifecyle(id) {
    Lifecycle.call(this);
    this.instanceId = id || 'id' + (loaderInstanceCounter++);
    this.config = {
      baseUrl: './'
    };

    // Seed entries for special dependencies so they are not requested by
    // lifecycle.
    this.modules.require = this.modules.exports = this.modules.module = {};
  }

  LoaderLifecyle.prototype = Lifecycle.prototype;

  // Set up define() infrastructure. It just holds on to define calls until a
  // loader instance claims them via execCompleted.
  if (typeof define === 'undefined') {
    var defineQueue = [];
    define = function() {
      defineQueue.push(slice.call(arguments));
    };
  }

  function createLoader(config, id) {
    var lifecyle = new LoaderLifecyle(id);
    var loader = makeRequire(lifecyle);
    loader.config = function(cfg) {
      lifecyle.configure(cfg);
    };

    if (config) {
      loader.config(config);
    }

    return loader;
  }

  // Set up default loader under amodro name.
  if (typeof amodro === 'undefined') {
    amodro = createLoader();
    amodro.createLoader = createLoader;

    // Finds require(StringLiteral) calls in a function.
    amodro.parseCjsFunction = function(fn) {
      var deps = [];
      fn
        .toString()
        .replace(commentRegExp, '')
        .replace(cjsRequireRegExp, function (match, dep) {
            deps.push(dep);
        });

      //May be a CommonJS thing even without require calls, but still
      //could use exports, and module. Avoid doing exports and module
      //work though if it just needs require.
      //REQUIRES the function to expect the CommonJS variables in the
      //order listed below.
      deps = (fn.length === 1 ?
              ['require'] :
              ['require', 'exports', 'module']).concat(deps);

      return deps;
    };

    amodro.fetch = function(normalizedId, location, lifecycle) {
    return new Promise(function(resolve, reject) {
      require('fs').readFile(location, 'utf8', function(err, text) {
        // Simulate browser evaluation on script load.
        amodro.exec(text);
        lifecycle.execCompleted(normalizedId);

        if (err) {
          reject(err);
        } else {
          // Do not return the text as it has already been handled.
          resolve('');
        }
      });
    });
};

  }


}());

// Done outside the closure to limit eval seeing closure contents.
if (!amodro.exec) {
  amodro.exec = function(t) {
    /*jshint evil: true */
    eval(t);
  };
}

amodro.define = define;
module.exports = amodro;
