/*global protoModifiers, hasProp, global */
protoModifiers.push(function (Lifecycle) {
  var proto = Lifecycle.prototype;

  //Allow getting a global that expressed in
  //dot notation, like 'a.b.c'.
  function getGlobal(value) {
    if (!value) {
      return value;
    }
    var g = global;
    value.split('.').forEach(function (part) {
      g = g[part];
    });
    return g;
  }

  // If shim deps, fetch them before fetching the script.
  var oldFetch = proto.fetch;
  proto.fetch = function(normalizedId, location) {
    var shim = this.config.shim;
    if (shim && hasProp(shim, normalizedId)) {
      shim = shim[normalizedId];
      if (Array.isArray(shim)) {
        shim = {
          deps: shim
        };
      }
    }

    if (shim) {
      var p;
      if (shim.deps) {
        p = Promise.all(shim.deps.map(function(depId) {
          return this.use(depId, normalizedId);
        }.bind(this)));
      } else {
        p = Promise.resolve();
      }

      return p.then(function() {
        return oldFetch.call(this, normalizedId, location);
      }.bind(this))
      .then(function(value) {
        function factory() {
          var value;
          if (shim.init) {
            value = shim.init.apply(global, arguments);
          }
          if (value) {
            return value;
          } else if (shim.exports) {
            return getGlobal(shim.exports);
          }
        }

        this.addToRegistry(normalizedId, shim.deps || [], factory);
        return value;
      }.bind(this));
    }
    return oldFetch.call(this, normalizedId, location);
  };
});
