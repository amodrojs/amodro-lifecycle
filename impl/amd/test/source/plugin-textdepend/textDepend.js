define(['text!test.txt', 'module'], function (text, module) {
  return {
    fetch: function (loader, resourceId, refId, location) {
      loader.setModule(module.id + '!' + resourceId, text);
    }
  };
});
