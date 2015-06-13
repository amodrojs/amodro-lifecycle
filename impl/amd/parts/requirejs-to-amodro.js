/*jshint strict: false */
/*global amodro, Lifecycle, jsSuffixRegExp, hasProp */
var oldConfigure = Lifecycle.prototype.configure;

Lifecycle.prototype.configure = function(cfg) {
  if (cfg.paths) {
    cfg.locations = {};

    // paths array fallback support.
    Object.keys(cfg.paths).forEach(function(prefix) {
      var value = cfg.paths[prefix];
      if (Array.isArray(value)) {
        var fallbacks = this._requirejsFallbacks ||
                        (this._requirejsFallbacks = {});
        fallbacks[prefix] = value;
        value = value.shift();
      }
      cfg.locations[prefix] = value;
    }.bind(this));
  }

  if (cfg.map) {
    cfg.alias = cfg.map;
  }
  if (cfg.packages) {
    var locations = cfg.locations || (cfg.locations = {});

    cfg.packages.forEach(function(pkg) {
      if (typeof pkg === 'string') {
        locations[pkg + '{main}'] = pkg;
      } else {
        var mainValue = '{' +
                        (pkg.main || 'main').replace(jsSuffixRegExp, '') +
                        '}';
        locations[pkg.name + mainValue] = (pkg.location || pkg.name);
      }
    });
  }

  var result = oldConfigure.call(this, cfg);

  if (cfg.deps) {
    this.require(cfg.deps, cfg.callback);
  }

  return result;
};

var oldLocate = Lifecycle.prototype.locate;
Lifecycle.prototype.locate = function(normalizedId, suggestedExtension) {
  var location = oldLocate.call(this, normalizedId, suggestedExtension);
  if (location.indexOf('data:') !== 0) {
    location = this.config.urlArgs ? location +
                                  ((location.indexOf('?') === -1 ? '?' : '&') +
                                   this.config.urlArgs) : location;
  }
  return location;
};


amodro._onRequirejsDefined = function(requirejs) {
  requirejs.undef = function(normalizedId) {
    amodro._lifecycle.removeModule(normalizedId);
  };

  var proto = Lifecycle.prototype;
  proto.handleUseError = function(error, normalizedId, refId, factoryTree) {
    var fallbacks = this._requirejsFallbacks;
    if (fallbacks && hasProp(fallbacks, normalizedId)) {
      var fallback = fallbacks[normalizedId];
      if (fallback.length) {
        var value = fallback.shift();

        this.removeModule(normalizedId);
        // Clear from the factoryTree depIds tracking of modules it has seen.
        // This means the reset is only for the .use() factoryTree that
        // triggered this error. Issues for other factoryTrees in play?
        // Done here because if requirejs.onError is taken, flow is different.
        // While this is somewhat OK for a temporary adapter, might want to
        // formalize something in main or lifecycle around doing this kind of
        // reset if handleUseError returns a promise? Does not quite work for
        // the requirejs.onError case though. Maybe just skip this backwards
        // compat attempt and just formalize a higher level error retry
        // mechanism.
        if (factoryTree && hasProp(factoryTree.depIds, normalizedId)) {
          delete factoryTree.depIds[normalizedId];
          factoryTree.depCount -= 1;
        }

        var cfg = {
          locations: {}
        };
        cfg.locations[normalizedId] = value;
        this.configure(cfg);

        return this.use(normalizedId, refId, factoryTree);
      }
    }

    if (requirejs.onError) {
      // Construct error object to match old requirejs style.
      error.requireModules = [normalizedId];
      return requirejs.onError(error);
    }

    throw error;
  };
};

