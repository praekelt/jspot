#!/bin/bash -e
./node_modules/.bin/jshint `find lib/ test/ -not -path "test/fixtures/extract/wrong/*" -name "*.js"`
./node_modules/.bin/mocha `find "$@" -name "*.test.js"`
