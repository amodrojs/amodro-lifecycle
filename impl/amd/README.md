## AMD sample implementation

`parts/main.js` is the main implementation file. It is built using `build.js` and results in an `amodro-node.js` file that can be used for the tests.

For a browser based implementation, the plan is to expand the build.js to swap in alternative versions of some of the files, like a different `parts/fetch.js`.

Not well documented: the goal right now is to port of as many requirejs/alameda tests that make sense to prove out the operation of Lifecycle, then extract this to the amodro repo.
