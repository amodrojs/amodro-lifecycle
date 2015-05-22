require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

  define('plugin', ['module'], function(module) {
    return {
      fetch: function (loader, resourceId, location) {
        return loader.use(resourceId, module.id + '!' + resourceId)
        .then(function(moduleValue) {
          loader.setModule(module.id + '!' + resourceId, moduleValue);
        });
      }
    };
  });

  define('person', [], {
      name: 'person'
  });

  define('employee', ['plugin!person'], function(person) {
    return {
      name: 'employed ' + person.name
    };
  });

  define('application', ['person'], function(person) {
    return {
      name: 'application',
      person: person
    };
  });

  loader.config({
    map: {
      '*': {
        'person': 'employee'
      },
      'employee': {
        'person': 'person',
      },
      // NOTE THIS DIFFERENCE WITH REQUIREJS: loader plugin ID that references
      // person just wants person too.
      'plugin!person': {
        'person': 'person'
      }
    }
  });

  return loader(['application'], function (application) {
    assert.equal('application', application.name);
    assert.equal('employed person', application.person.name);
    done();
  });
});
