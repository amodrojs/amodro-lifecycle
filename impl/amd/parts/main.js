/*global Lifecycle, dotNormalize, normalizeAlias, addPluginSupport,
         define: true */
/*jshint strict: false */
var amodro, define;
(function() {
  //INSERT ../../../support/prim.js
  //INSERT prim-to-promise.js
  //INSERT ../../../lifecycle.js
  //INSERT ../../../support/normalize-alias.js
  //INSERT ../../../support/normalize-dot.js
  //INSERT ../../../support/plugins.js


  var slice = Array.prototype.slice,
      commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
      cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g;

//todo: consider removing this duplication.
  var hasOwn = Object.prototype.hasOwnProperty;
  function hasProp(obj, prop) {
      return hasOwn.call(obj, prop);
  }
  function getOwn(obj, prop) {
      return hasProp(obj, prop) && obj[prop];
  }

  function makeRequire(instance, refId) {
    function require(deps, callback, errback) {
      // If waiting inline definitions, claim them for this instance.
      if (defineQueue.length) {
        instance.execCompleted();
      }

      if (typeof deps === 'string') {
        var normalizedDepId = instance.top.normalize(deps, refId);
        return instance.getDep(refId, normalizedDepId, true);
      }

      var p = Promise.all(deps.map(function(dep) {
        return instance.use(dep, refId);
      }));

      if (callback) {
        p = p.then(function(ary) {
          return callback.apply(undefined, ary);
        }.bind(this));
      }
      if (errback) {
        p = p.catch(errback);
      }
      return p;
    }

    require.normalize = function(relId) {
      return instance.top.normalize(relId, refId);
    };
    require.locate = function(relId, suggestedExtension) {
      var id = instance.top.normalize(relId, refId);
      return instance.top.locate(id, suggestedExtension);
    };

//todo: specified and defined?

    return require;
  }

  // Lifecycle overrides and additional methods
  var protoMethods = {
    // START overrides
    cycleDetected: function(id, cycleOrder) {
      console.log('Cycle detected: ' + id + ',' + cycleOrder);
    },

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

    locate: function(normalizedId, suggestedExtension) {
      // sync
//todo: locations config, bundles config?
      return this.config.baseUrl + normalizedId +
             (suggestedExtension ? '.' + suggestedExtension : '');
    },

    fetch: function(normalizedId, location) {
      // async
      return amodro.fetch(normalizedId, location, this);
    },

    translate: function(normalizedId, location, source) {
      // sync
      return source;
    },

    depend: function(normalizedId, deps) {
      // async. deps are not normalized yet.

      deps.forEach(function(dep) {
        if ((dep === 'exports' || dep === 'module') &&
                   !hasProp(this.modules, normalizedId)) {
          // If wanting exports or module (with its module.exports), seed the
          // module value in case it is needed for cycles.
          this.modules[normalizedId] = {};
        }
      }.bind(this));

      return Promise.resolve(deps);
    },

    evaluate: function(normalizedId, location, source) {
      var result = amodro.evaluate(source);

      // If evaluate is being called, then it means there was source input.
      // Need to call execComplete to bring in any define()'d modules into the
      // loader.
      this.execCompleted(normalizedId);

      return result;
    },

    instantiate: function(normalizedId, normalizedDeps, factory) {
      // sync
      var localExports, localModule;

      //Use exports as the factory apply context, to match node.
      var ret = factory.apply(this.modules[normalizedId],
                              normalizedDeps.map(function(dep) {
        var mod = this.getDep(normalizedId, dep);

        if (dep === 'exports') {
          localExports = dep;
        } else if (dep === 'module') {
          localModule = dep;
        }

        return mod;
      }.bind(this)));

      if (ret === undefined) {
        if (localExports) {
          return this.modules[normalizedId];
        } else if (localModule) {
          return localModule.exports;
        }
      } else if (ret) {
        return ret;
      }
    },
    // END overrides

    getDep: function(normalizedId, dep, throwOnMiss) {
      var reg = this.registry[normalizedId];
      if (dep === 'require') {
        return reg.require || (reg.require = makeRequire(this, normalizedId));
      } else if (dep === 'exports') {
        return this.modules[normalizedId];
      } else if (dep === 'module') {
        return reg.module || (reg.module = {
          id: normalizedId,
          uri: this.locate(normalizedId),
          exports: this.modules[normalizedId],
          config: function () {
            return getOwn(this.top.config.config, normalizedId) || {};
          }.bind(this)
        });
      } else {
        return this.getModule(dep, throwOnMiss);
      }
    },

    execCompleted: function(normalizedId) {
      var queue = defineQueue,
          anon = [],
          foundId = !normalizedId;

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

      if (cfg.config) {
//todo: merge this better.
        Object.keys(cfg.config).forEach(function(key) {
          this.config.config[key] = cfg.config[key];
        }.bind(this));
      }
//todo: finish this.
    }
  };

  Object.keys(protoMethods).forEach(function(key) {
    Lifecycle.prototype[key] = protoMethods[key];
  });

  // Mix in plugin support. Do this AFTER setting up baseline lifecycle methods,
  // since the plugin support will delegate to those captured methods after
  // detecting if plugins should be used.
  addPluginSupport(Lifecycle);

  var loaderInstanceCounter = 0;

  function LoaderLifecyle(id) {
    Lifecycle.call(this);
    this.instanceId = id || 'id' + (loaderInstanceCounter++);
    this.config = {
      baseUrl: './',
      config: {}
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

    //INSERT fetch.js
  }


}());

// Done outside the closure to limit eval seeing closure contents.
if (!amodro.evaluate) {
  amodro.evaluate = function(t) {
    /*jshint evil: true */
    eval(t);
  };
}

//INSERT suffix.js