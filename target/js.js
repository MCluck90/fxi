'use strict';

var SymbolTable = require('../symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    _previousQuad = {},
    _currentQuad = {},
    _functionStarted = false,
    _lines = [];

/**
 * Turns an ICode quad into an object
 * @param {string[]}  quad  Array of strings containing an ICode instruction
 * @returns {QuadObj}
 */
function icodeToObject(quad) {
  return {
    label: quad[0],
    instruction: quad[1],
    arg1: quad[2],
    arg2: quad[3],
    arg3: quad[4],
    comment: quad[5]
  };
}

var JS = {
  compile: function(icode) {
    _lines = [];

    for (var i = 0, len = icode.length; i < len; i++) {
      _previousQuad = _currentQuad;
      var quad = icodeToObject(icode[i]);
      _currentQuad = quad;

      // Make sure every function terminates correctly
      if (_functionStarted && (quad.label.indexOf('FN') === 0
                           ||  quad.label.indexOf('LA') === 0)) {
        _lines.push('}');
        _functionStarted = false;
      }

      try {
        this[quad.instruction](quad);
      } catch(e) {
        if (!this[quad.instruction]) {
          if (GLOBAL.DEBUG) {
            e.message = quad.instruction + ' not yet implemented';
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    var indent = '';
    return _lines.map(function(line) {
      var temp = indent + line;
      if (line[line.length - 1] === '{') {
        indent += '  ';
        temp += '\n';
      } else if (line[line.length - 1] === '}') {
        indent = indent.slice(0, -2);
        temp = indent + line;
        temp += '\n';
      }
      return temp;
    }).join('').replace(/;/g, ';\n');
  },

  /**
   * Generate all of the global literals
   */
  INIT: function() {
    SymbolTable.getLiterals().forEach(function(symbol) {
      _lines.push('var ' + symbol.ID + ' = ' + symbol.value + ';');
    });
  },

  /**
   * Initialize a function
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 ID of the function to initialize
   */
  FUNC: function(quad) {
    var funcID = quad.arg1,
        funcSymbol = SymbolTable.getSymbol(funcID),
        params = funcSymbol.data.params,
        declaration = 'function ' + funcID + '(';
    _functionStarted = true;
    params.forEach(function(param, index) {
      if (index > 0) {
        declaration += ', ';
      }
      declaration += param.ID;
    });
    declaration += ') {';
    _lines.push(declaration);
  },

  /**
   * Begin a function call
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 ID of the function to call
   */
  FRAME: function(quad) {
    _lines.push(quad.arg1 + '(');
  },

  /**
   * Calls a function
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 ID of the function to call
   */
  CALL: function(quad) {
    _lines.push(');');
  },

  /**
   * Do an undefined return
   */
  RTN: function() {
    _lines.push('return;');
  },

  /**
   * Exits the program
   */
  EXIT: function() {
    _lines.push('process.exit(0);');
  },

  /**
   * Wrap up any function wrapping
   */
  END: function() {
    if (_functionStarted) {
      _lines.push('}');
    }
  }
};

module.exports = JS;
