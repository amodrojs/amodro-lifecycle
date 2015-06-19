## todo:

* rename evaluate to parse?
* a getData(normalizedId) for property bags, and put it in amodro-base proxy object?

## Curiousities

1) define('a'), require(['a', 'b']), define('b'): the define('b') should be absorbed that that require loader. At least in requirejs test it is expected. So inline definitions should be treated as hoisted? Which is different than what is happening in requirejs, but related concept.

## Lifecycle API work

* Move the handleUseError capability into lifecycle instead of amd main? removeModule in lifecycle now, but there is some manual factoryTree.depIds and depCount management done in requirejs adapter part. That might be more of a special case though, for its older, clunkier API. If it is moved in to Lifecycle though, the API would need to communicate "this always resets some internal (factoryTree) state, so the .use err handler needs to do a .use() to properly balance the bookeeping".

## parent/child loaders

* Does it work?
* For addToRegistry: does local definition win over outer one?


# Event emitting

Considered, but hard to do in base lifecycle, since the steps are overridable,
and in the case of loader plugins, they can call the lifecycle methods without
necessarily triggering the events.

Best to place it at higher levels, where assumptions on overrides are more set.
So in a browser loader case, these interceptions have been useful:

* once locate is called, to add cache preserving/breaking info to URL.
  Do this in fetch overrides, where the URLs are actually used.

* once a module is instantiated. Some want general export mangling.
  This is onResourceLoad in requirejs. Do that in amodro instantiate override.

These more common cases are supported in amodro-base via 'after' config now.


Sketch for maybe a mixin addon:

add this.events to constructor, then:

    // Start event emitter API
    on: function(id, fn) {
      var listeners = this.events[id];
      if (!listeners) {
        listeners = this.events[id] = [];
      }
      if (listeners.indexOf(fn) === -1) {
        listeners.push(fn);
      }
    },

    removeListener: function(id, fn) {
      var i,
          listeners = this.events[id];
      if (listeners) {
        i = listeners.indexOf(fn);
        if (i !== -1) {
          listeners.splice(i, 1);
        }
        if (listeners.length === 0) {
          delete this.events[id];
        }
      }
    },

    emit: function(id, event) {
      if (this.top !== this) {
        this.top.emit(id, event);
      } else {
        var listeners = this.events[id];
        if (listeners) {
          listeners.forEach(function(fn) {
            try {
              fn.call(null, event);
            } catch (e) {
              // Throw at later turn so that other listeners
              // can complete. While this messes with the
              // stack for the error, continued operation is
              // valued more in this tradeoff.
              // This also means we do not need to .catch()
              // for the wrapping promise.
              setTimeout(function() {
                throw e;
              });
            }
          });
        }
      }
    },

    emitFn: function(fnName, args) {
      var value = this[fnName].apply(this, args);
      var evt = {
        result: value,
        args: args

      };
      this.emit(fnName, evt);
      return evt.result;
    },
    // End event emitter API

