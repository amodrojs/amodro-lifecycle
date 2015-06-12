define(['module'], function(module) {
  function parse(name) {
    var parts = name.split('?'),
      index = parseInt(parts[0], 10),
      choices = parts[1].split(':'),
      choice = choices[index];

    return {
      index: index,
      choices: choices,
      choice: choice
    };
  }

  return {
    normalize: function (loader, resourceId, refId) {
      var parsed = parse(resourceId),
        choices = parsed.choices;

      //Normalize each path choice.
      for (var i = 0; i < choices.length; i++) {
        choices[i] = loader.normalize(choices[i], refId);
      }

      return parsed.index + '?' + choices.join(':');
    },

    fetch: function (loader, resourceId, refId, location) {
      return loader.use(parse(resourceId).choice, module.id + '!' + resourceId)
      .then(function(moduleValue) {
        // Do not return a value here, want the "source" for this module to
        // be nothing, so that translate/execute is not done on it.
        loader.setModule(module.id + '!' + resourceId, moduleValue);
      });
    }
  };
});
