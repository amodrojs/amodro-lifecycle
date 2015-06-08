node impl/amd/build.js log=true && find ./impl/amd/test -name '*test.js' | xargs node_modules/.bin/mocha -R spec
