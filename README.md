# amodro-lifecycle

JS module loader lifecycle engine. Not a module system itself, but a building block used to construct a specific module system.

Feature set goals:

* Multiple loader instances.
* cycle detection and proper ordering of module execution.
* parent/child loaders for the possibility of nested modules, with a "top" loader used for fetches.
* Sticks with ES5 syntax and exposed internals on the Lifecycle prototype, to allow easier inspection and wider deployment to browsers in use today.
* Enough flexibility in the API so that it works in the browser and in node, even allowing legacy node modules to participate as dependencies for ES2015 modules.

TOC:

* [Usage](#usage)
* [Lifecycle](#lifecycle)
* [Design forces](#design-forces)


## Usage

The core of this project is lifecycle.js. It is implemented as a plain JavaScript constructor function with prototype. No hidden state. Since this is still under development, transparency into the operation is useful, as the design is shaped by implementation tests. That could change over time, where some APIs or state becomes hidden as it proven out in some module system experiments.

Use the lifecycle.js as the basis for the module loader. Wrap and extend it to provide specific module system APIs.

Example wrappings:

* [amodrojs/amodro-base](https://github.com/amodrojs/amodro-base): AMD loader in the browser. Includes loading ES2015 modules, loader plugin support, './' and '../' relative ID normalization to a module ID space, loader config for locations and module ID aliasing.
* [amodrojs/node-es-adapt](https://github.com/amodrojs/node-es-adapt): ES2015 module syntax in node, allowing ES modules to use traditional node modules as dependencies. Uses node's ID normalization and adds loader plugin support.

Also see those repos for most of the tests. While there is a test directory in this repo, the code is being primarily tested in the loader wrapper repos, as the goal of this project is to be wrapped by other code to complete a module system.

## Lifecycle

lifecycle.js defines a constructor function `Lifecycle`, and the prototype methods deal with handling the lifecycle of a module, from ID normalization all the way to instantiation.

It relies on the module system implementing some prototype methods that correspond to the main steps in a module lifecycle, and some methods for driving that lifecycle and seeding module values.

### Lifecycle steps

The core of what a module system implements on top of Lifecycle are implementations for the following lifecycle steps on Lifecycle's prototype, listed in the rough order they are used by Lifecycle:

* *String* **normalize** (*String* relativeId, *String* referenceId)
* *String* **locate** (*String* normalizedId, *String* suggestedExtension)
* *Promise* **fetch** (*String* normalizedId, *String* refId, *String* location)
* *String* **translate** (*String* normalizedId, *String* location, *String* source)
* **evaluate** (*String* normalizedId, *String* location, *String* source)
* *Promise* **depend** (*String* normalizedId, *Array* deps)
* *Object* **instantiate** (*String* normalizedId, *Array* deps, *Function* factory)

There are just two asynchronous steps, `fetch` and `depend`. More detail on each step:

#### normalize

> *String* **normalize** (*String* relativeId, *String* referenceId)

This allows a module 'a' (referenceId) that asks for a module './sub/b' (relativeId) to be resolved to 'a/sub/b', or some normalized name that is used for the key into the Lifecycle to store and reference the module value.

To simulate Node's module system, this step could decide to do synchronous file scans to find the right value.

For AMD-type, browser-based async systems, loader plugins that modify normalization behavior need to be loaded (in the `depend` step) so that normalize returns a value synchronously or throws if it cannot.

#### locate

> *String* **locate** (*String* normalizedId, *String* suggestedExtension)

Converts the normalized ID to a file path or URL. Synchronously returns a value. See the notes for [normalize](#normalize), same apply here. Node style systems could either choose to work here or just do it all in normalize.

The `suggestedExtension` is the type of file extension to add to the location, if the locate step does not determine another one or needs a hint.

This is useful for AMD-style loader plugin systems, which provide transpiler-type of capabilities asynchronously without a centralized configuration.

`suggestedExtension` can be ignored by the locate step. For example, if the ID maps to a `data:` URL or a Blob URL.

#### fetch

> *Promise* **fetch** (*String* normalizedId, *String* refId, *String* location)

Asynchronously fetches the text at the location. The promise resolves to the text value of the fetch.

For Node-style sync systems, it could decide to alter the running of the steps to skip this and directly call [evaluate](#evaluate) and [instantiate](#instantiate).

In browser-based async systems, if using script tag loading, [evaluate](#evaluate) could be called directly and the [translate](#translate) step skipped, if the source text is not available.

**refId** may be null or undefined. It is the normalized ID that first referred to the target normalizeId, and can be useful in some extensions like loader plugins that need to do other normalizations relative to that refId.

#### translate

> *String* **translate** (*String* normalizedId, *String* location, *String* source)

Allows translating the source. Useful for transpiled languages.

In browser systems, this may not be called for script tag-loaded resources.

#### evaluate

> **evaluate** (*String* normalizedId, *String* location, *String* source)

Evaluates the text, after [translate](#translate) is run (if it is run). The implementation could be something like `eval`, or in Node, a script run via the `vm` module.

The result of evaluate should be one or more entries in the registry, via calls to [addToRegistry](#addtoregistry), or set module values via [setModule](#setmodule).

#### depend

> *Promise* **depend** (*String* normalizedId, *Array* deps)

The `deps` array is an array of the **unnormalized**  dependencies that are found for the given normalizedId.

The Promise is resolved to the final list of **unnormalized** dependencies that will then be normalized by Lifecycle and placed in the `deps` property of the module's registry entry.

This step allows AMD loader plugins to work and still keep the rest of the steps, besides [fetch](#fetch), synchronous. A module system that supports loader plugins would find the loader plugin IDs in the unnormalized list, load those, then resolve the promise for the depend step.

#### instantiate

> *Object* **instantiate** (*String* normalizedId, *Array* deps, *Function* factory)

Called with the deps and factory from the registry entry (initial value set by the module system by calling [addToRegistry](#addToRegistry). Instantiate will be called in the correct order for the list of dependencies that were triggered via a [useUnnormalized](#useUnnormalized) or [use](#use) call.

`deps` is the list of dependencies, with IDs normalized. `factory` is the function to execute to produce the module value for the normalizedId.

The Object return value is used as the module value.

### Lifecycle management

These methods drive module loading and population of module values.

The source for Lifecycle defines more methods than the ones listed here, but some are considered semi-private, and still under consideration. These are the main public methods that are expected to be used so far, but other support methods, like `hasModule`, `getModule` and such are likely to show up here at some point.

#### useUnnormalized

> *Promise* **useUnnormalized** (*String* id, *String* refId)

Called by a loader when the unnormalized ID is wanted. It will run [depend](#depend), then [normalize](#normalize), then call [use](#use).

The Promise is resolved to the module value.

#### use

> *Promise* **use** (*String* normalizedId, *String* refId)

The main driver for the loading lifecycle.

The normalizedId should be an already normalized module ID. The refId is the module ID that triggered the use() call, and helps with tracing of dependencies and gives context for cycles. It is optional.

The Promise is resolved to the module value.

#### addToRegistry

> **addToRegistry** (*String* normalizedId, *Array* deps, *Function* factory)

Adds a module to the registry of modules that are known to Lifecycle, but do not yet exist as resolved module values.

Useful for module systems that allow bundling more than one module definition in a file. It allows those definitions to be registered but not traced or executed until they are part of a top level dependency chain.

For non-bundling cases, this method should be called as the result of one or more of these steps in the lifecycle:

* [fetch](#fetch)
* [translate](#translate)
* [evaluate](#evaluate)

The registry entries are what are passed to the [instantiate](#instantiate) step.

#### getData

> *Object* **getData** (*String* normalizedId)

Gets a mutable object that can be used to store data related to the normalizedId.

This is useful for allowing coordination of state between lifecycle steps.

#### setModule

> *Object* **setModule** (*String* normalizedId, *Object* value)

Sets the final module value for the normalized module ID. Returns the value that was passed to it.

## Design forces

It is inspired by previous sketches at a lifecycle definition for ES modules.

The core tension is bridging an asynchronous module system like AMD and a synchronous one like Node's module system.

A previous sketch of the ES module loader had most of the lifecycle steps as async, returning promises.

While experimenting with that approach in [module](https://github.com/jrburke/module), it started to become unwieldy. Modules in an AMD system like to have the equivalent of synchronous `normalize` and `locate` on their module meta objects, to provide IDs for use in DOM attributes for example, or for generating paths for things like IMG tags and CSS files that are relative to the module.

Additionally, Node's module system is synchronous, and traditionally has wanted `normalize` and `locate` to be synchronous, and it was hard to see bridging that module system with all the async hooks.

However, one of the drivers (for me) on all the async steps are AMD loader plugins. They are lazy-loaded extensions that work in an async loading system like the browser, and do not require top-level preloading or application knowledge to work. They can be loaded on demand as nested dependencies need them.

By introducing the async `depend` step in the lifecycle, I believe it resolves these competing tensions. The `depend` step gets a list of **unnormalized** dependencies that were found in the module but before the module's definition is fully processed and the module value is instantiated.

### AMD

For AMD-style loader plugins, the module system has a chance to parse the unnormalized dependencies, find the loader plugins, load them, then resolve the promise for the `depend` step to continue the normalization and resolution of the dependencies.

With the management APIs like `addToRegistry`, bundling multiple modules in a file works great, where the module definitions are held until they are part of a top level dependency chain.

See the [amodrojs/amodro-base repo](https://github.com/amodrojs/amodro-base) for working code along these lines.

### Node

For Node, if looking to integrate ES modules, Node's module system could be built on top of something like Lifecycle.

The combo of synchronous `normalize` and `locate` allows Node to synchronously file scan nested node_modules to find the module definition. It could choose to normalize IDs to paths internally if it wanted.

Top level application loads could use the full async fetch and depend steps, to allow ES modules and something like AMD loader plugins to work for ES modules that might use that kind of mechanism.

For `require(Expression)` type of dependencies, if it is for a module ID that is a legacy module, for the Lifecycle-style approach, normalization/locating/evaluating/setModule are all synchronous in that approach, so it could work out.

If the`require(Expression)` expression resolves to the ID for an ES module (or one of the nested dependencies do), I could see Node providing something like a `require.async()` for that case (for modules written in its traditional style).

This approach is working in the [node-es-adapt repo](https://github.com/amodrojs/node-es-adapt).

### ES module support in the browser

I can see an ES module loader defined for the browser using the general approach and lifecycle steps as defined here, and then provide the following special powers (only visible to itself, not something normal scripts could do):

1) Has a default fetch implementation, something that is analogous to script fetching, but: fetch/translate with CORS: If a fetch is done that does not allow access via CORS, then the ES loader treats this similar to the script tag type of loading: translate() gets called with an empty string, or maybe is not called at all, and the loader would evaluate the text in accordance with the boundaries set in item 2).

A new CORS property might be needed if there is a concern about intranets that allowed * origins for CORS and did not expect this type of use. In that case, the translate() step is only run with the real text if the property was set. Otherwise, translate is skipped but evaluate can be run on the original script, similar to how script tags operate today.

2) evaluate() would not fall under the CSP eval policies, but policies similar to the ones that govern how script tags can be used. A new CSP directive could be introduced for this case. The main point is that it is not "eval" but more like how scripts are evaluated, but with the translate step applying (if it qualified in item 1).

The goal with these items is to allow module loading of JS as it works today with script tags to continue to work with plain JS files in a module loader, and not require a new CORS property to get the equivalent of script tag fetching and execution.

