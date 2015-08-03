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
   * Initializes the program
   */
  INIT: function() {
    // Prepare reading
    _lines.push('process.stdin.resume();');
    _lines.push('var fs = require(\'fs\');');
    _lines.push('function $__read(isInt) {');
    _lines.push('var response = fs.readSync(process.stdin.fd, 100, 0, \'utf8\');');
    _lines.push('process.stdin.pause();');
    _lines.push('if (!isInt) {');
    _lines.push('return response[0][0];');
    _lines.push('}');
    _lines.push('return parseInt(response[0], 10);');
    _lines.push('}');

    // Generates literals
    SymbolTable.getLiterals().forEach(function(symbol) {
      _lines.push('var ' + symbol.ID + ' = ' + symbol.value + ';');
    });
  },

  /**
   * Returns a string for accessing a variable
   */
  getValue: function(symbolID) {
    var symbol = SymbolTable.getSymbol(symbolID);
    if (symbol.data.isFreeVar) {
      return 'this.' + symbolID;
    } else {
      return symbolID;
    }
  },

  /***************
   *  FUNCTIONS  *
   ***************/

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

    // Generate local variables
    funcSymbol.innerScope.getLocalVariables().forEach(function(symbol) {
      _lines.push('var ' + symbol.ID + ';');
    });
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

  /*********
   *  I/O  *
   *********/

 /**
  * Reads in a value from stdin
  * @param {QuadObj}  quad
  * @param {string}   quad.arg1 Type of read
  * @param {string}   quad.arg2 ID of the variable to read to
  */
  READ: function(quad) {
    var isInt = (quad.arg1 === 'int') ? 'true' : 'false',
        value = this.getValue(quad.arg2);
    _lines.push(value + ' = $__read(' + isInt + ');');
  },

  /**
   * Writes out a value to stdout
   * @param {QuadObj} quad
   * @param {string}  quad.arg2 ID of the variable to print
   */
  WRITE: function(quad) {
    var value = this.getValue(quad.arg2);
    _lines.push('process.stdout.write(' + value + '.toString());');
  },

  /**********************
   * DATA MANIPULATION  *
   **********************/

  /**
   * Assigns a value to a variable
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Left hand side
   * @param {string}  quad.arg2 Right hand side
   */
  MOV: function(quad) {
    var lhs = this.getValue(quad.arg1),
        rhs = this.getValue(quad.arg2);
    _lines.push(lhs + ' = ' + rhs + ';');
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
