// Assumptions: wants a getOwn() function in scope.
function normalizeAlias(nameParts, refParts, config) {
  var i, j, nameSegment, aliasValue, foundAlias, foundI, foundStarAlias,
      starI;

  var alias = config.alias;

  //Apply alias config if appropriate.
  var starAlias = alias && alias['*'];

  if (alias && (refParts || starAlias)) {
    outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
    nameSegment = nameParts.slice(0, i).join('/');

    // alias config is keyed off the refereName, so use its parts to
    // find a refName-specific config.
    if (refParts) {
      //Find the longest refName segment match in the config.
      //So, do joins on the biggest to smallest lengths of refParts.
      for (j = refParts.length; j > 0; j -= 1) {
      aliasValue = getOwn(alias, refParts.slice(0, j).join('/'));

      //refName segment has config, find if it has one for
      //this name.
      if (aliasValue) {
        aliasValue = getOwn(aliasValue, nameSegment);
        if (aliasValue) {
        //Match, update name to the new value.
        foundAlias = aliasValue;
        foundI = i;
        break outerLoop;
        }
      }
      }
    }

    //Check for a star map match, but just hold on to it,
    //if there is a shorter segment match later in a matching
    //config, then favor over this star map.
    if (!foundStarAlias && starAlias &&
      getOwn(starAlias, nameSegment)) {
      foundStarAlias = getOwn(starAlias, nameSegment);
      starI = i;
    }
    }

    if (!foundAlias && foundStarAlias) {
    foundAlias = foundStarAlias;
    foundI = starI;
    }

    if (foundAlias) {
    nameParts.splice(0, foundI, foundAlias);
    }
  }

  return nameParts.join('/');
}