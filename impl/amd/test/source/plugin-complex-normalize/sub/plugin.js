define(['module', 'sub/pluginDep'], function(module) {
  return {
    normalize: function(loader, id, refId) {
        // Add the string "Normalized" onto the end of the module name
        if (!/normalized/i.test(id)) { id += 'Normalized'; }
        return loader.normalize(id, refId);
    },

    fetch: function (loader, resourceId, refId, location) {
      loader.setModule(module.id + '!' + resourceId, resourceId);
    }
  };
});
