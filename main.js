'use strict';

var Scanner = require('./scanner.js'),
    Syntax = require('./syntax.js');

Scanner.init('test.fxi', function() {
  try {
    Syntax.checkSyntax();
  } catch(e) {
    var token = Scanner.currentToken;
    e.message = 'Line ' + token.lineNumber + ': ' + e.message;
    throw e;
  }
});
