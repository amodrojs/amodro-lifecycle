/*global protoModifiers, hasProp, getOwn, makeRequire */
protoModifiers.push(function (proto) {
  'use strict';

  var slice = Array.prototype.slice,
      oldMethods = {},
      methods = ['normalize', 'locate', 'fetch', 'translate',
                 'depend', 'instantiate'],
      customOverrides = {
        normalize: true,
        locate: true,
        fetch: true,
        depend: true
      };

  function interceptMethod(methodName) {
    return function(normalizedId) {
      var args = slice.call(arguments);

      var pluginDesc = this.getPluginDesc(normalizedId);
      if (pluginDesc) {
        var plugin = pluginDesc.plugin;
        if (plugin && plugin[methodName]) {
          args[0] = pluginDesc.resourceId;
          args.unshift(this.getPluginProxy());
          return plugin[methodName].apply(this, args);
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

    // If a '!something' ID, then just remove the ! and continue on.
    if (index === 0) {
       id = id.substring(1);
    }

    if (index > 0) {
      var pluginId = this.normalize(id.substring(0, index), refId),
          plugin = this.getModule(pluginId),
          resourceId = id.substring(index + 1);

      if (plugin && plugin.normalize) {
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

        if (!normalizedDep) {
          return;
        }

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
        return this.use(pluginId, normalizedId);
      }.bind(this))).then(function() {
        return oldMethods.depend.call(this, normalizedId, deps);
      }.bind(this));
    } else {
      return oldMethods.depend.call(this, normalizedId, deps);
    }
  };

  proto.locate = function(normalizedId, suggestedExtension) {
    var location,
        ignoreJsForScript = false,
        pluginDesc = this.getPluginDesc(normalizedId);

    if (pluginDesc) {
      if (!pluginDesc.id) {
        // The badly formed '!something' case.
        normalizedId = pluginDesc.resourceId;
      } else {
        // Allow for the full plugin ID to be in a bundle.
        var bundleId = this.config._bundlesMap &&
                       getOwn(this.config._bundlesMap, normalizedId);

        if (bundleId && bundleId !== normalizedId) {
          location = oldMethods.locate.call(this, bundleId, suggestedExtension);
        } else {
          var plugin = pluginDesc.plugin,
              resourceId = pluginDesc.resourceId;
          if (plugin) {
            if (plugin.locate) {
              location = plugin.locate(this.getPluginProxy(),
                                      normalizedId, suggestedExtension);
            } else if (hasProp(plugin, 'locateExtension')) {
              suggestedExtension = plugin.locateExtension;
              location = oldMethods.locate.call(this,
                                                resourceId,
                                                suggestedExtension);
            } else if (plugin.locateDetectExtension) {
              ignoreJsForScript = true;
              var index = resourceId.lastIndexOf('.');
              if (index !== -1) {
                location = oldMethods.locate.call(this,
                                              resourceId.substring(0, index),
                                              resourceId.substring(index + 1));
              }
            }
          }
        }
      }
    }

    if (!location) {
      location = oldMethods.locate.call(this, normalizedId, suggestedExtension);
    }

    if (suggestedExtension === 'js' && !ignoreJsForScript) {
      this.isScriptLocation[location] = true;
    }

    return location;
  };

  proto.fetch = function(normalizedId, refId, location) {
    var pluginDesc = this.getPluginDesc(normalizedId);
    if (pluginDesc) {
      if (!pluginDesc.id) {
        // The badly formed '!something' case.
        normalizedId = pluginDesc.resourceId;
      } else {

        // Allow for the full plugin ID to be in a bundle.
        var bundleId = this.config._bundlesMap &&
                       getOwn(this.config._bundlesMap, normalizedId);

        if (bundleId && bundleId !== normalizedId) {
          return oldMethods.fetch.call(this, bundleId, refId, location);
        }

        var plugin = pluginDesc.plugin,
            resourceId = pluginDesc.resourceId;

        if (plugin) {
          if (plugin.fetch) {
            return plugin.fetch(this.getPluginProxy(),
                                resourceId, refId, location);
          } else if (plugin.load) {
            // Legacy loader plugin support.
            return new Promise(function(resolve, reject) {
              var onload = function(value) {
                // old load() was like fetch + setModule
                this.setModule(pluginDesc.id + '!' + resourceId,
                               value);
                resolve();
              }.bind(this);
              onload.error = reject;
              onload.fromText = function(text, alt) {
                // Very old plugins passed in a name, but not supported in
                // the modern legacy format.
                if (alt !== undefined) {
                  text = alt;
                }

                // In this case want the text to participate in transform
                // and parsing.
                resolve(text);
              };

              plugin.load(resourceId,
                          makeRequire(this, refId),
                          onload,
                          {});
            }.bind(this));
          } else {
            return oldMethods.fetch.call(this, resourceId, refId, location);
          }
        } else {
          // Plugin not loaded yet. This could happen in the alias config case,
          // where the 'a' is mapped to 'plugin!resource'. Unfortunately in that
          // case cannot resolve a cycle if it exists between original module
          // with dependency on 'a' but has a cycle with 'plugin!resource'.
          return this.use(pluginDesc.id).then(function() {
            return this.fetch(normalizedId, refId, location);
          }.bind(this));
        }
      }
    }

    return oldMethods.fetch.call(this, normalizedId, refId, location);
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
          plugin: this.getModule(plugId)
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
});
