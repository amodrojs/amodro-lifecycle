define(function () {
  return {
    locateExtension: 'refine',
    /*
    // Other option is:
    locate: function(loader, normalizedId, suggestedExtension) {
      return loader.locate(normalizedId, 'refine');
    },
    */
    translate: function(loader, normalizedId, location, source) {
      source = source.replace(/refine\s*\(/g, 'define(');

      //Add in helpful debug line
      source += '\r\n//@ sourceURL=' + location;
      return source;
    }
  };
});
