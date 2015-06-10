/*global hasProp, getOwn, makeRequire */
function addPluginSupport(Lifecycle) {
  'use strict';

  var slice = Array.prototype.slice,
      proto = Lifecycle.prototype,
      oldMethods = {},
      methods = ['normalize', 'locate', 'fetch', 'translate',
                 'depend', 'instantiate'],
      customOverrides = {
        normalize: true,
        locate: true,
        depend: true
      },
      // For fetches, want the default method impl to get the ID without the
      // plugin name on it. For other hooks, that deal with data stored by
      // full ID, pass the full ID.
      useResourceId = {
        fetch: true
      };

  function interceptMethod(methodName) {
    return function(normalizedId) {
      var args = slice.call(arguments);

      var pluginDesc = this.getPluginDesc(normalizedId);
      if (pluginDesc) {
        var plugin = pluginDesc.plugin;
        if (plugin[methodName]) {
          args[0] = pluginDesc.resourceId;
          args.unshift(this.getPluginProxy());
          return plugin[methodName].apply(this, args);
        } else if (methodName === 'fetch' && plugin.load) {
          // Legacy loader plugin support.
          var p = new Promise(function(resolve, reject) {
            var onload = function(value) {
              // old load() was like fetch + setModule
              this.setModule(pluginDesc.id + '!' + pluginDesc.resourceId,
                             value);
              resolve();
            }.bind(this);
            onload.error = reject;

            plugin.load(pluginDesc.resourceId,
                        makeRequire(this, pluginDesc.id),
                        onload,
                        {});
          }.bind(this));
          return p;
        } else if (useResourceId[methodName]) {
          args[0] = pluginDesc.resourceId;
        }
      }

      return oldMethods[methodName].apply(this, args);
    };
  }

  methods.forEach(function(methodName) {
    oldMethods[methodName] = proto[methodName];
    if (!customOverrides[methodName]) {
      proto[methodName] = interceptMethod(methodName);
    }
  });

  proto.normalize = function(id, refId) {
    var index = id.indexOf('!');
    if (index > -1) {
      var pluginId = this.normalize(id.substring(0, index), refId),
          plugin = this.getModule(pluginId, true),
          resourceId = id.substring(index + 1);

      if (plugin.normalize) {
        if (plugin.load) {
          // Legacy plugin API.
          return pluginId + '!' + plugin.normalize(resourceId, function(id) {
            return this.normalize(id, refId);
          }.bind(this));
        } else {
          // Shiny new API.
          return pluginId + '!' +
                 plugin.normalize(this.getPluginProxy(), resourceId, refId);
        }
      } else {
        return pluginId + '!' +
               oldMethods.normalize.call(this, resourceId, refId);
      }
    } else {
      return oldMethods.normalize.call(this, id, refId);
    }
  };

  proto.depend = function(normalizedId, deps) {
    var plugins = [],
        definedPlugins = {};

    deps.forEach(function(id) {
      var index = id.indexOf('!');
      if (index !== -1) {
        var normalizedDep = this
                            .normalize(id.substring(0, index), normalizedId);

        // Do not do extra work if the plugin has already been loaded.
        if (!hasProp(definedPlugins, normalizedId)) {
          definedPlugins[normalizedDep] = !!this.getModule(normalizedDep) &&
                                          !this.getWaiting(normalizedDep);
        }

        if (!definedPlugins[normalizedDep] &&
            plugins.indexOf(normalizedDep) === -1) {
          plugins.push(normalizedDep);
        }
      }
    }.bind(this));

    if (plugins.length) {
      return Promise.all(plugins.map(function(pluginId) {
        return this.useUnnormalized(pluginId, normalizedId);
      }.bind(this))).then(function() {
        return oldMethods.depend.call(this, normalizedId, deps);
      }.bind(this));
    } else {
      return oldMethods.depend.call(this, normalizedId, deps);
    }
  };

  proto.locate = function(normalizedId, suggestedExtension) {
    var pluginDesc = this.getPluginDesc(normalizedId);
    if (pluginDesc) {
      // Allow for the full plugin ID to be in a bundle.
      var bundleId = this.config._bundlesMap &&
                     getOwn(this.config._bundlesMap, normalizedId);

      if (bundleId) {
        return oldMethods.locate.call(this, bundleId, suggestedExtension);
      }

      var plugin = pluginDesc.plugin,
          resourceId = pluginDesc.resourceId;
      if (plugin.locate) {
        return plugin.locate(this.getPluginProxy(),
                             normalizedId, suggestedExtension);
      } else if (hasProp(plugin, 'locateExtension')) {
        return oldMethods.locate.call(this,
                                      resourceId,
                                      plugin.locateExtension);
      } else if (plugin.locateDetectExtension) {
        var index = resourceId.lastIndexOf('.');
        if (index !== -1) {
          return oldMethods.locate.call(this,
                                        resourceId.substring(0, index),
                                        resourceId.substring(index + 1));
        }
      }
    }
    return oldMethods.locate.call(this, normalizedId, suggestedExtension);
  };

  function makeProxyMethod(proxy, methodName, instance) {
    proxy[methodName] = function() {
      var args = slice.call(arguments);
      return instance[methodName].apply(instance, args);
    };
  }

  function makeProxy(instance) {
    var proxy = {};
    methods.forEach(function(methodName) {
      makeProxyMethod(proxy, methodName, instance);
    });

    // Add some proxied methods for some loader pieces
    makeProxyMethod(proxy, 'useUnnormalized', instance);
    makeProxyMethod(proxy, 'use', instance);
    makeProxyMethod(proxy, 'setModule', instance);
    makeProxyMethod(proxy, 'evaluate', instance);

    return proxy;
  }

  var protoMethods = {
    getPluginDesc: function(normalizedId) {
      var index = normalizedId.indexOf('!');
      if (index > -1) {
        var plugId = normalizedId.substring(0, index);
        return {
          id: plugId,
          resourceId: normalizedId.substring(index + 1),
          plugin: this.getModule(plugId, true)
        };
      }
    },

    getPluginProxy: function() {
      return this.pluginProxy || (this.pluginProxy = makeProxy(this));
    }
  };

  Object.keys(protoMethods).forEach(function(key) {
    proto[key] = protoMethods[key];
  });
}
