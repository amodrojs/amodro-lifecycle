/*jshint strict: false */
/*global Lifecycle, dotNormalize, normalizeAlias, define: true */
var amodro, define;
(function() {
  //INSERT ../../../support/prim.js
  //INSERT prim-to-promise.js
  //INSERT ../../../lifecycle.js
  //INSERT ../../../support/normalize-alias.js
  //INSERT ../../../support/normalize-dot.js


  var slice = Array.prototype.slice,
      commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
      cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g;

  function makeRequire(instance, refId) {
    function require(deps, callback, errback) {
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
          foundId = false;

      defineQueue = [];

      queue.forEach(function(def) {
        var id, deps, vary, fn;

        // Normalize define call to id, deps, factory.
        if (def.length === 1) {
          vary = def[0];
        } else if (def.length === 2) {
          if (def[0] === 'string') {
            // either id, vary or id, deps
            id = def[0];
            if (typeof def[1] === 'function') {
              vary = def[1];
            } else {
              deps = def[1];
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
          if (id === normalizedId) {
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

  function Loader(id) {
    Lifecycle.call(this);
    this.instanceId = id || 'id' + (loaderInstanceCounter++);
    this.config = {
      baseUrl: './'
    };

    // Seed entries for special dependencies so they are not requested by
    // lifecycle.
    this.modules.require = this.modules.exports = this.modules.module = {};
  }

  Loader.prototype = Lifecycle.prototype;

  // Set up define() infrastructure. It just holds on to define calls until a
  // loader instance claims them via execCompleted.
  if (typeof define === 'undefined') {
    var defineQueue = [];
    define = function() {
      defineQueue.push(slice.call(arguments));
    };
  }

  // Set up default loader under amodro name.
  if (typeof amodro === 'undefined') {
    var loaderInstance = new Loader();
    amodro = makeRequire(loaderInstance);
    amodro.Loader = Loader;

    amodro.config = function(cfg) {
      loaderInstance.configure(cfg);
    };

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
if (!amodro.exec) {
  amodro.exec = function(t) {
    /*jshint evil: true */
    eval(t);
  };
}

//INSERT suffix.js