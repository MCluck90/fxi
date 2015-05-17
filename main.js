'use strict';

var path = require('path'),
    argv = require('minimist')(process.argv.slice(2)),
    Scanner = require('./scanner.js'),
    Syntax = require('./syntax.js'),
    filename = argv._[0];

Scanner.init(path.join(process.cwd(), filename), function() {
  try {
    Syntax.checkSyntax();
  } catch(e) {
    var token = Scanner.currentToken;
    e.message = 'Line ' + token.lineNumber + ': ' + e.message;
    throw e;
  }
});
