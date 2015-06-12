/*jshint strict: false */
/*global amodro, requirejs, Lifecycle, jsSuffixRegExp */
var oldConfigure = Lifecycle.prototype.configure;

Lifecycle.prototype.configure = function(cfg) {
  if (cfg.paths) {
    cfg.locations = cfg.paths;
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
    if (requirejs.onError) {
      // Construct error object to match old requirejs style.
      error.requireModules = [normalizedId];
      return requirejs.onError(error);
    }
    throw error;
  };
};

