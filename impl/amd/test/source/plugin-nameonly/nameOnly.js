define(['module'], function(module) {
  return {
    fetch: function (loader, resourceId, location) {
      loader.setModule(module.id + '!' + resourceId, {
        name: 'nameOnly'
      });
    }
  };
});
