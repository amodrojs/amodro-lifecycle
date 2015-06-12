define(['module'], function(module) {
  return {
    fetch: function (loader, resourceId, refId, location) {
      loader.setModule(module.id + '!' + resourceId, {
        name: 'nameOnly'
      });
    }
  };
});
