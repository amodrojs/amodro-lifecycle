/*global Lifecycle, dotNormalize, normalizeAlias, define: true */
/*jshint strict: false */
var amodro, define;
(function(global) {
  //INSERT ../../../support/prim.js
  //INSERT prim-to-promise.js
  //INSERT ../../../lifecycle.js

  var slice = Array.prototype.slice,
      commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
      cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
      jsSuffixRegExp = /\.js$/,
      hasProp = Lifecycle.hasProp,
      getOwn = Lifecycle.getOwn;

  var specialDeps = {
    require: true,
    exports: true,
    module: true
  };

  function deepMix(dest, source) {
    Object.keys(source).forEach(function(prop) {
      var value = source[prop];
      if (typeof value === 'object' && value &&
        !Array.isArray(value) && (typeof value !== 'function') &&
        !(value instanceof RegExp)) {

        if (!dest[prop]) {
          dest[prop] = {};
        }
        deepMix(dest[prop], value);
      } else {
        dest[prop] = value;
      }
    });
    return dest;
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

      // Start off with an async promise resolution to pick up waiting define
      // calls that occcur directly after the require call. Addresses
      // define('a'), require(['a', 'b']), define('b'): the define('b') should
      // be absorbed that that require loader.
      var p = Promise.resolve()
      .then(function() {
        if (defineQueue.length) {
          instance.execCompleted();
        }

        return Promise.all(deps.map(function(dep) {
          // If a require([]) call asks for require, just give back this
          // function, since it is a context-specific dependency.
          if (dep === 'require') {
            return require;
          }
          return instance.useUnnormalized(dep, refId);
        }));
      });

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

    require.defined = function(relId) {
      var id = instance.top.normalize(relId, refId);
      return instance.hasModule(id);
    };

    require.specified = function(relId) {
      var id = instance.top.normalize(relId, refId);
      return instance.containsModule(id);
    };

    //INSERT requirejs-require-adapter.js

    return require;
  }

  // Basic ID normalization support, and alias support.
  //INSERT ../../../support/normalize-alias.js
  //INSERT ../../../support/normalize-dot.js

  // Optional parts that can further modify the lifecycle prototypes.
  var protoModifiers = [];
  //INSERT ../../../support/plugins.js
  //INSERT ../../../support/shim.js

  // Lifecycle overrides and additional methods
  var protoMethods = {
    // START lifecycle overrides
    isSpecialDep: function(normalizedId) {
      return hasProp(specialDeps, normalizedId);
    },

    cycleDetected: function(normalizedId, cycleOrder) {
      console.log('Cycle detected, \'' + normalizedId + '\' already in list: ' +
                  cycleOrder);
    },

    normalize: function(id, refId) {
      // sync
      if (this.config.nodeIdCompat) {
        id = id.replace(jsSuffixRegExp, '');
      }
      // dotNormalize comes from the normalize-alias.js provider.
      var idParts = dotNormalize(id, refId, true);
      if (this.config.alias && typeof normalizeAlias !== 'undefined') {
        return normalizeAlias(idParts, (refId ? refId.split('/') : []),
                              this.config);
      } else {
        return idParts.join('/');
      }
    },

    locate: function(normalizedId, suggestedExtension) {
      // sync
      var location,
          normalizedLocations = this.config._normalizedLocations,
          bundleId = getOwn(this.config._bundlesMap, normalizedId),
          segment = normalizedId,
          firstPass = true;

      if (bundleId && bundleId !== normalizedId) {
        return this.locate(bundleId, suggestedExtension);
      }

      while (segment) {
        // If not the first pass match, then look for id + '/' matches,
        // for location config that only matches children of a higher
        // level ID. So locations config for 'a/b/' should only match 'a/b/c'
        // and not 'a/b'.
        if (!firstPass) {
          var segmentPlusSlash = segment + '/';
          if (hasProp(normalizedLocations, segmentPlusSlash)) {
            location = normalizedLocations[segmentPlusSlash];
            location = normalizedId.replace(segmentPlusSlash, location + '/');
            break;
          }
        }
        if (hasProp(normalizedLocations, segment)) {
          location = normalizedId.replace(segment,
                                          normalizedLocations[segment]);
          break;
        }
        var slashIndex = segment.lastIndexOf('/');
        if (slashIndex === -1) {
          break;
        }
        firstPass = false;
        segment = segment.substring(0, slashIndex);
      }

      if (!location) {
        location = normalizedId;
      }

      location = (location.charAt(0) === '/' ||
                  location.match(/^[\w\+\.\-]+:/) ?
                  '' : this.config.baseUrl) + location;

      if (suggestedExtension && !/^data\:|\?/.test(location)) {
        location += '.' + suggestedExtension;
      }

      if (suggestedExtension === 'js') {
        this.isScriptLocation[location] = true;
      }

      return location;
    },

    fetch: function(normalizedId, refId, location) {
      // async
      if (hasProp(this.fetchedLocations, location)) {
        var value = this.fetchedLocations[location];
        if (value === true) {
          // Already fetched. Do not return a value in this case, as no new
          // work, like translate and such, should be done. No explicit promise
          // return here for optimiation reasons. Lifecycle ensures fetch
          // response is a promise and if not, provides one.
          this.execCompleted(normalizedId);
          return;
        } else {
          return this.fetchedLocations[location].then(function(value) {
            // Purposely do not return a value here as any translate work
            // should only be handled by the very first call to fetch.
            this.execCompleted(normalizedId);
          }.bind(this));
        }
      } else {
        return (this.fetchedLocations[location] =
                this.amodroFetch(normalizedId, refId, location)
                .then(function (value) {
                  // Clear the promise to release holding on to possibly large
                  // fetched values, but still indicate the fetch was done.
                  this.fetchedLocations[location] = true;
                  return value;
                }.bind(this)));
      }
    },

    translate: function(normalizedId, location, source) {
      // sync
      return source;
    },

    depend: function(normalizedId, deps) {
      // async. deps are not normalized yet.
      deps.forEach(function(dep) {
        if ((dep === 'exports' || dep === 'module')) {
          // If wanting exports or module (with its module.exports), seed the
          // module value in case it is needed for cycles.
          this.setModule(normalizedId, {}, true);
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
        // Favor module.exports over just exports, as it is common for node
        // modules to assign to module.exports over using the default created
        // exports object.
        if (localModule) {
          return this.registry[normalizedId].module.exports;
        } else if (localExports) {
          return this.modules[normalizedId];
        }
      } else if (ret) {
        return ret;
      }
    },
    // END lifecycle overrides

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
      var config = this.config;

      Object.keys(cfg).forEach(function(key) {
        var value = cfg[key];

        if (key === 'locations') {
          // Look for a package
          var normalizedLocations = config._normalizedLocations;

          Object.keys(value).forEach(function(locKey) {
            var mainId,
                locValue = value[locKey];

            // locValues cannot end in a /, sanitize.
            if (locValue && typeof locValue === 'string' &&
                locValue.lastIndexOf('/') === locValue.length - 1) {
              locValue = locValue.substring(0, locValue.length - 1);
            }

            // Update public-matching config inside loader, then break it
            // apart for more efficient internal use.
            config.locations[locKey] = locValue;

            // Separate the main sub-ID for a package, if specified
            var keyParts = locKey.split('{');
            if (keyParts.length === 2) {
              locKey = keyParts[0];
              mainId = locKey + '/' +
                       keyParts[1].substring(0, keyParts[1].length - 1);
            }

            normalizedLocations[locKey] = locValue;
            if (mainId) {
              this.registry[locKey] = {
                deps: [mainId],
                factory: function(m) { return m; }
              };
            }
          }.bind(this));
        } else if (key === 'baseUrl') {
          var baseUrl = cfg.baseUrl;
          if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
            baseUrl += '/';
          }
          config.baseUrl = baseUrl;
        } else if (key === 'bundles') {
          Object.keys(cfg.bundles).forEach(function(key) {
            var values = cfg.bundles[key];
            this.config.bundles[key] = values;
            values.forEach(function(value) {
              this.config._bundlesMap[value] = key;
            }.bind(this));
          }.bind(this));
        } else if (key === 'after') {
          Object.keys(value).forEach(function(key) {
            var prevFn = this[key];
            this[key] = function() {
              var result = prevFn.apply(this, arguments);
              return value[key].apply(this, [result].concat(arguments));
            };
          }.bind(this));
        } else {
          if (typeof value === 'object' &&
            value && !Array.isArray(value) && (typeof value !== 'function') &&
            !(value instanceof RegExp)) {
            if(!hasProp(this.config, key)) {
              this.config[key] = {};
            }
            deepMix(this.config[key], cfg[key]);
          } else {
            this.config[key] = value;
          }
        }
      }.bind(this));
    }
  };

  var lcProto = Lifecycle.prototype;

  Object.keys(protoMethods).forEach(function(key) {
    lcProto[key] = protoMethods[key];
  });

  // Mix in other modifiers, like plugin support. Do this AFTER setting up
  // baseline lifecycle methods, these modifieres will want to delegate to those
  // captured methods after detecting if plugins should be used.
  protoModifiers.forEach(function(modify) {
    modify(lcProto);
  });


  // Override the .use to provide error retry capability.
  var oldUse =lcProto.use;
  lcProto.use = function(normalizedId, refId, factoryTree) {
    return oldUse.apply(this, arguments).catch(function (err) {
      if (this.handleUseError) {
        return this.handleUseError(err, normalizedId, refId, factoryTree);
      }
      throw err;
    }.bind(this));
  };

  // Override removeModule to also clear waiting define queue of a matching
  // module.
  var oldRemoveModule = lcProto.removeModule;
  lcProto.removeModule = function(normalizedId) {
    oldRemoveModule.apply(this, arguments);
    defineQueue.some(function(item, i) {
      if (item[0] === normalizedId) {
        defineQueue.splice(i, 1);
        return true;
      }
    });
  };

  var loaderInstanceCounter = 0;

  function LoaderLifecyle(id) {
    Lifecycle.call(this);
    this.instanceId = id || 'id' + (loaderInstanceCounter++);
    this.config = {
      baseUrl: './',
      config: {},
      bundles: {},
      locations: {},
      _normalizedLocations: {},
      _bundlesMap: {}
    };

    // Tracks if a script tag should be used for a given location. This is only
    // needed because of the traditional script rules in the browser and wanting
    // to avoid issues with CORS and CSP. In a browser-native module loader,
    // this would not be needed as it should have better solutions for those
    // cases.
    this.isScriptLocation = {};

    // Stores promises for fetches already in progress, keyed by location.
    this.fetchedLocations = {};

    // Seed entries for special dependencies so they are not requested by
    // lifecycle.
    this.setModule('require', {});
    this.setModule('exports', {});
    this.setModule('module', {});
  }

  LoaderLifecyle.prototype = lcProto;

  // Allow other modifications to the LoaderLifecycle prototype based on build
  // and environment needs.
  var llProtoModifiers = [];
  //INSERT fetch.js
  llProtoModifiers.forEach(function(modify) {
    modify(LoaderLifecyle.prototype);
  });

  // Set up define() infrastructure. It just holds on to define calls until a
  // loader instance claims them via execCompleted.
  if (typeof define === 'undefined') {
    var defineQueue = [];
    define = function() {
      defineQueue.push(slice.call(arguments));
    };
    define.amd = {
      jQuery: true
    };
  }

  function createLoader(config, id) {
    var lifecycle = new LoaderLifecyle(id);
    var loader = makeRequire(lifecycle);

    lifecycle.require = loader;

    // Make it visible just for debugging purposes.
    loader._lifecycle = lifecycle;

    loader.config = function(cfg) {
      lifecycle.configure(cfg);
    };

    if (config) {
      loader.config(config);
    }

    return loader;
  }

  // Set up default loader under amodro name, but only if it is not already
  // defined.
  if (typeof amodro !== 'function') {
    // If a value assume a starting config.
    var startConfig;
    if (amodro) {
      startConfig = amodro;
    }

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

    //INSERT requirejs-to-amodro.js

    if (startConfig) {
      amodro.config(startConfig);
    }

    //INSERT script-attr-loading.js
  }


}(this));

// Done outside the closure to limit eval seeing closure contents.
if (!amodro.evaluate) {
  amodro.evaluate = function(t) {
    /*jshint evil: true */
    eval(t);
  };
}

//INSERT suffix.js