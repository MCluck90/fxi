'use strict';

var fs = require('fs'),
    path = require('path'),
    argv = require('minimist')(process.argv.slice(2)),
    Scanner = require('./scanner.js'),
    Syntax = require('./syntax.js'),
    SymbolTable = require('./symbol-table.js'),
    filename = (argv._[0]) ? path.join(process.cwd(), argv._[0]) : null,
    _callbacks = [];

if (!filename || argv.h || argv.help) {
  var helpText = path.join(__dirname, 'help.txt');
  console.log(fs.readFileSync(helpText).toString());
  return;
}

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
  var ICode = require('./icode.js'),
      TCode = require('./target/uvu.js'),
      outputICode = argv.i || argv.icode,
      outputTCode = argv.o || argv.output,
      icode = '',
      targetCode = TCode.compile(ICode.quads);

  if (outputICode) {
    ICode.quads.forEach(function(quad) {
      icode += quad.join('\t');
    });

    if (typeof outputICode === 'string') {
      fs.writeFileSync(path.join(process.cwd(), outputICode), icode);
    } else {
      console.log(icode);
    }
  }

  if (outputTCode) {
    if (typeof outputTCode === 'string') {
      fs.writeFileSync(path.join(process.cwd(), outputTCode), targetCode);
    } else {
      console.log(targetCode);
    }
  }
});
