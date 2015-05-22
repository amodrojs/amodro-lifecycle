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

  return oldConfigure.call(this, cfg);
};
