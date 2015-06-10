#!/bin/bash
mkdir requirejstests
cd requirejstests
git clone --depth 1 git@github.com:jrburke/requirejs.git
git clone --depth 1 git@github.com:requirejs/domReady.git
git clone --depth 1 git@github.com:requirejs/text.git
git clone --depth 1 git@github.com:requirejs/i18n.git
mkdir tests-requirejs
cp -r ./requirejs/testBaseUrl.js ./tests-requirejs/testBaseUrl.js
cp -r ./requirejs/tests ./tests-requirejs
