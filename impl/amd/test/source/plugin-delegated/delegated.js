define(['module'], function(module) {
  return {
    // For nested loader plugin refs, loader plugin needs to opt in to it.
    // normalize: function (loader, resourceId, refId) {
    //   return loader.normalize(resourceId, refId);
    // },

    depend: function(loader, normalizedId, deps) {
      // async. deps are not normalized yet.
console.log('GOT DEPEND: ' + normalizedId, deps);
      return Promise.resolve(deps);
    },

    fetch: function (loader, resourceId, refId, location) {
      return loader.use(resourceId, module.id + '!' + resourceId)
      .then(function(moduleValue) {
        loader.setModule(module.id + '!' + resourceId, moduleValue);
      });
    }
  };
});
