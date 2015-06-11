/*jshint strict: false */
/*global Lifecycle */
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
        locations[pkg] = pkg + '{main}';
      } else {
        locations[pkg.name] = (pkg.location || pkg.name) +
                              '{' + (pkg.main || 'main') + '}';
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
