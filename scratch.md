* plugin-delegated not working, wants to do delgated!r!a where r is aliased to refine. So, nested loader plugin use. Can this work? See also requirejs plugins/pluginNormalize/pluginNormalize.html.
* mismatched define support in amd variation?
* Move the handleUseError capability into lifecycle instead of amd main?

## Curiousities

1) define('a'), require(['a', 'b']), define('b'): the define('b') should be absorbed that that require loader. At least in requirejs test it is expected. So inline definitions should be treated as hoisted? Which is different than what is happening in requirejs, but related concept.


## plugins:

* test loading a plugin that had a depending on the module wanting to use it in a dependency.
* alias config of 'c' asking for 'a' aliased to 'plugin!', but 'c' having a cycle with 'plugin!'.
* test text!something.js loading of the text, not executing it.
  Do not think the cycle can be broken in that case.
* how to support config? like isBuild? Is it needed?

## parent/child loaders

* Does it work?
* For addToRegistry: does local definition win over outer one?

## API work

* on() events?
* undef?

## amodro code

* amodro = {} config support?
* config to override loader proto methods.
* config for on() listeners.
* data-serial data-parallel support?
* waitSeconds support? Maybe not, rely on error pathways from fetches to distinguish? Or make it 0 by default.

## Difference with requirejs:

* plugin API is different.
* no requirejs.onError, use local promise error handling.
* the errback errors are structured differently.
* no direct URL loading support.

# requirejs adapter

* scrub the other config options, like waitSeconds


## Differences with requirejs tests:

TODO:
* secondLateConfigPlugin/secondLateConfigPlugin.html: need to figure out why
  it fails.
* plugins/pluginNormalize/pluginNormalize.html: the plugA!plugB! case?

Changes:

* edit simple.html to not ask for URLs and remove moreSimpleTests = true.
* toUrl-tests.js: no ../bower_components resolution because outside ID space.
* multiversion.html: change these deps since URLs not supported:
  * version1/gamma.js -> gamma
  * version2/epsilon.js -> epsilon
* comment out isBrowser/isBrowser.html in all.js, isBrowser on local require not
  supported any more.
* comment out onResourceLoad/nestedRequire.html, require.onResourceLoad not supported.
* paths/paths.html change data-requiremodule to data-amodromodule
* queryPath.html: change data-requiremodule to data-amodromodule
* plugins/pluginShim/pluginShim.html: disabled, since it is a loader plugin that uses define, but also has a shim config. Should not support, choose either one or the other: define or shim.
* jsonp.html: put in paths change for user: "https://api.github.com/users/jrburke?callback=define", no direct URL loading supported.
* Disable relative/outsideBaseUrl/a/outsideBaseUrl.html, outside module ID space.
* Disable remoteUrls/remoteUrls.html, module outside ID space.
* Disable undef/undefLocal.html, promise errbacks do not work that way.
* errorContinueLocal, comment out the if (err.requireModules part, then setTimeout works.
* Disable error/globalOnError.html, don't want to favor a global handler over local one.
* Disable error/requireErrback.html, callback/errback relation to calling different now.
For undef tests, the requirejs.onError needs to return a promise that will
resolve to new module value. Example from undef.html test:

    return new Promise(function(resolve, reject) {
        requirejs(['dep'], function (dep) {
            resolve(dep);
            doh.is("real", dep.name);
            done();
            return dep;
        }, function(err) {
            reject(err);
        });
    });
- do same in undefEnforceShim.html

* pluginErrorContinueLocal: remove the `err.requireModules && ` check.
* defineErrorLocal.html: comment out if (err.requireType === 'define') { and
  the doh.is("define", err.requireType); test.
