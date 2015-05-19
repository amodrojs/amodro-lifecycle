require('./tester')(module.id, function (loader, define, assert, done) {
  'use strict';

  define('C',
    [
      'exports',
      './MyClass',
      './A',
      './B'
    ],

    function (exports, MyClass, A, B) {

      exports.name = 'C';

      exports.say = function(){
        return [MyClass.name, A.name, B.name, exports.name].join(',');
      };

    }

  );


  define('B',
    [
      'exports',
      './MyClass',
      './A',
      './C'
    ],

    function (exports, MyClass, A, C) {

      exports.name = 'B';

      exports.say = function(){
        return [MyClass.name, A.name, exports.name, C.name].join(',');
      };

    }

  );
  define('A',
    [
      'exports',
      './MyClass',
      './B',
      './C'
    ],

    function (exports, MyClass, B, C) {

      exports.name = 'A';

      exports.say = function(){
        return [MyClass.name, exports.name, B.name, C.name].join(',');
      };

    }

  );

  define('MyClass',
    [
      'exports',
      './A',
      './B',
      './C'
    ],

    function (exports, A, B, C) {

      exports.name = 'MyClass';

      exports.sayAll = function(){
        return [
          exports.say(),
          A.say(),
          B.say(),
          C.say()
        ].join(':');
      };

      exports.say = function(){
        return [exports.name, A.name, B.name, C.name].join(',');
      };

      return exports;

    }

  );

  return loader(['MyClass'], function(MyClass) {
      assert.equal('MyClass,A,B,C:MyClass,A,B,C:MyClass,A,B,C:MyClass,A,B,C',
                   MyClass.sayAll());
      done();
  });

});