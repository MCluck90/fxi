'use strict';

var path = require('path'),
    argv = require('minimist')(process.argv.slice(2)),
    Scanner = require('./scanner.js'),
    Syntax = require('./syntax.js'),
    SymbolTable = require('./symbol-table.js'),
    filename = path.join(process.cwd(), argv._[0]),
    _callbacks = [];

/* jshint latedef: false */
function _then(cb) {
  if (!cb) {
    return {
      then: _then
    };
  }

  if (typeof cb === 'string') {
    _callbacks.push(runPass.bind(null, cb));
  } else {
    _callbacks.push(cb);
  }
  return {
    then: _then
  };
}

function runPass(passName) {
  Scanner.init(filename, function() {
    try {
      Syntax.pass(passName);
    } catch(e) {
      var token = Scanner.currentToken;
      e.message = '\nPass: ' + passName + '\nLine ' + token.lineNumber + ': ' + e.message;
      throw e;
    }

    if (_callbacks.length > 0) {
      _callbacks.shift()();
    }
  });

  return {
    then: _then
  };
}
/* jshint latedef: true */

runPass('syntax')
.then('type inference')
.then('semantics')
.then(function() {
  SymbolTable().print();
});
