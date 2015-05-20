function addPluginSupport(Lifecycle) {
  'use strict';

  var slice = Array.prototype.slice,
      proto = Lifecycle.prototype,
      oldMethods = {},
      methods = ['normalize', 'locate', 'fetch',
                 'translate', 'depend', 'instantiate'];

debugger;
  function interceptMethod(methodName) {
    return function(normalizedId) {
      var args = slice.call(arguments);

      var pluginDesc = this.getPluginDesc(normalizedId);
      if (pluginDesc) {
        var plugin = pluginDesc.plugin;
        args[0] = pluginDesc.resourceId;
        if (plugin[methodName]) {
          args.unshift(this.getPluginProxy());
          return plugin[methodName].apply(this, args);
        }
      }

      return oldMethods[methodName].apply(this, args);
    };
  }

  methods.forEach(function(methodName) {
    oldMethods[methodName] = proto[methodName];
    // normalize is special since it normalizes IDs used by the other methods.
    if (methodName !== 'normalize') {
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
        return pluginId + '!' +
               plugin.normalize(this.getPluginProxy(), resourceId, refId);
      } else {
        return pluginId + '!' +
               oldMethods.normalize.call(this, resourceId, refId);
      }
    } else {
      return oldMethods.normalize.call(this, id, refId);
    }
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
    makeProxyMethod(proxy, 'use', instance);
    makeProxyMethod(proxy, 'setModule', instance);

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
