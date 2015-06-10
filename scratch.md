* plugin-delegated not working, wants to do delgated!r!a where r is aliased to refine. So, nested loader plugin use. Can this work?

## plugins:

* test loading a plugin that had a depending on the module wanting to use it in a dependency.
* how to support config? like isBuild? Is it needed?

## parent/child loaders

* Does it work?
* For addToRegistry: does local definition win over outer one?

## amodro code

* amodro.useXhr uses a simple extension test, but this might not work out for
  text!something.js requests?
* amodro = {} config support?
* data-serial data-parallel support?
* waitSeconds support? Maybe not, rely on error pathways from fetches to distinguish? Or make it 0 by default.

## Difference with requirejs:

* plugin API is different.


## API work

* on() events?
* undef?

# requirejs adapter

* use moduleData instead of config? For now, provide
  both on `module`
* shim config?
* amodro = {} and requirejs.config() and requirejs({}) support
* data-main: data-sequence and data-serial?
* scrub the other config options, like waitSeconds
* loader plugin API adapter?
* paths fallback: done in fetch() implementation.
