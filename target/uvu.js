'use strict';

var SymbolTable = require('../symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    R = require('../register.js'),
    RSwap = R(6),
    RIO = R(7),
    _quads = [],
    _currentQuad = {},
    _lastICodeLabel = '',
    _lastComment = '';

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

function pushQuad(opts) {
  opts.args = opts.args || [];
  if (opts.args[0] !== undefined && opts.args[0] !== null) {
    opts.args[0] = opts.args[0].toString();
  }
  if (opts.args[1] !== undefined && opts.args[0] !== null) {
    opts.args[1] = opts.args[1].toString();
  }

  // Automatically use labels from icode
  if (!opts.label && _currentQuad.label !== _lastICodeLabel) {
    opts.label = _currentQuad.label;
    opts.comment = _currentQuad.comment || opts.comment;
    _lastICodeLabel = _currentQuad.label;
  }
  if (_currentQuad.comment !== _lastComment && !opts.commentForce) {
    opts.comment = _currentQuad.comment;
    _lastComment = opts.comment;
  }

  _quads.push([
    opts.label        || '',
    opts.instruction  || '',
    opts.args[0]      || '',
    opts.args[1]      || '',
    opts.comment      || ''
  ]);
}

// Generates code for UVU ASM
var UVU = {
  compile: function(icode) {
    _quads = [];

    for (var i = 0, len = icode.length; i < len; i++) {
      var quad = icodeToObject(icode[i]);
      _currentQuad = quad;

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

    return _quads.map(function(quad) {
      if (!quad[1]) {
        // No instruction? Must be only a comment
        return '\t\t; ' + quad[quad.length - 1];
      }
      var result = '';
      for (var i = 0, len = quad.length; i < len; i++) {
        var attr = quad[i];
        if (i === 1) {
          result += '\t';
        }
        if (i >= 1) {
          result += '\t';
        }
        if (i === len - 1 && attr.length) {
          result += '; ';
        }

        result += attr;
        // Put commas between arguments
        if (i > 1 && i < 3 && attr.length && quad[i + 1].length) {
          result += ',';
        }
      }
      return result;
    }).join('\n');
  },

  /*************************
   *  REGISTER MANAGEMENT  *
   *************************/

  /**
   * Returns information about a symbol's
   * location in memory
   * @param {Symbol|string} string  Symbol or symbol ID
   * @returns {object}
   */
  getLocation: function(symbol) {
    if (typeof symbol === 'string') {
      symbol = SymbolTable.getSymbol(symbol);
    }

    var load, store;
    if (symbol.data.type === 'char') {
      load = 'LDB';
      store = 'STB';
    } else {
      load = 'LDR';
      store = 'STR';
    }

    // Memory: Literals
    if (SymbolTable.isLiteral(symbol)) {
      return {
        type: 'memory',
        label: symbol.ID,
        load: load,
        store: store
      };
    } else if (symbol.type === SymbolTypes.FreeVar) {
      // Heap: Free variables
      return {
        type: 'heap',
        offset: symbol.data.offset,
        load: load,
        store: store
      };
    } else if (symbol.type === SymbolTypes.Fn && !symbol.scope._parent) {
      // Global "closure"
      return {
        type: 'memory',
        label: symbol.ID + '_P',
        load: load,
        store: store
      };
    } else {
      // Stack: Everything else
      return {
        type: 'stack',
        offset: symbol.data.offset,
        load: load,
        store: store
      };
    }
  },

  /**
   * Loads in a value to a register
   * @param {Symbol}    symbol    Which symbol to load
   * @param {Register?} register  Which register to load the value into
   * @returns {Register}
   */
  _loadValue: function(symbol, register) {
    var symbolID = symbol.ID;

    // Find out if the symbol has already been loaded
    if (register) {
      if (register.hasValue(symbolID)) {
        return register;
      }
    } else {
      // No register was specified
      register = R.withValue(symbolID);
      if (register) {
        return register;
      }

      // Load up a free register
      // TODO: Save contents of register first if needed
      register = R.getFreeRegister();
    }

    // Figure out how to load up the variable
    var location = this.getLocation(symbol),
        comment = 'Load ' + symbol.value + ' in to ' + register;
    if (location.type === 'memory') {
      // Load the value directly from memory
      pushQuad({
        comment: comment,
        commentForce: true,
        instruction: location.load,
        args: [register, location.label]
      });
    } else {
      throw new Error('Memory type `' + location.type + '` not yet supported.');
    }

    // Mark this register as having this value
    register.clear(); // Only MOV will stack what's inside of a register
    register.addValue(symbolID);

    return register;
  },

  /**
   * Loads a value into a specific register
   * @param {string}    symbolID  Which symbol to load
   * @param {Register}  register  Which register to load it into
   * @returns {Register}
   */
  loadValueToRegister: function(symbolID, register) {
    return this._loadValue(SymbolTable.getSymbol(symbolID), register);
  },

  /**
   * Initialize literals etc.
   */
  INIT: function() {
    // Generate literal values
    SymbolTable.getLiterals().forEach(function(symbol) {
      var dataType = symbol.data.type;
      if (dataType === 'char' || dataType === 'int') {
        pushQuad({
          label: symbol.ID,
          instruction: (dataType === 'char') ? '.BYT' : '.INT',
          args: [symbol.value]
        });
      } else if (dataType === 'bool') {
        pushQuad({
          label: symbol.ID,
          instruction: '.INT',
          args: [ (symbol.value === 'true') ? 1 : 0 ]
        });
      } else {
        throw new Error('Unknown literal type: ' + dataType);
      }
    });

    // Generate error strings
    ['Stack overflow', 'Stack underflow'].forEach(function(message) {
      pushQuad({
        label: message.replace(' ', '_'),
        instruction: '.BYT',
        args: ['\'S\'']
      });
      message.substr(1).split('').forEach(function(letter) {
        pushQuad({
          instruction: '.BYT',
          args: ['\'' + letter + '\'']
        });
      });
      pushQuad({
        instruction: '.BYT',
        args: [0]
      });
    });

    // Generate global function pointers to simulate closure objects
    var globalFunctions = SymbolTable.getGlobalFunctions();
    globalFunctions.forEach(function(symbol) {
      pushQuad({
        label: symbol.ID + '_P',
        instruction: '.INT',
        args: [0]
      });
    });

    // Calculate function pointers
    globalFunctions.forEach(function(symbol) {
      pushQuad({
        comment: 'Generate pointer for ' + symbol.value + symbol.data.type,
        instruction: 'LDA',
        args: ['R0', symbol.ID]
      });
      pushQuad({
        instruction: 'STR',
        args: ['R0', symbol.ID + '_P']
      });
    });
  },

  /***************
   *  FUNCTIONS  *
   ***************/

  /**
   * Prepares a function call
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Function ID
   * @param {bool}    quad.arg2 If true, function is top level and the pointer must be loaded
   */
  FRAME: function(quad) {
    var funcID = quad.arg1,
        isTopLevel = quad.arg2,
        funcSymbol = SymbolTable.getSymbol(funcID),
        frameSize = funcSymbol.scope.byteSize + 12; // return address, this, and previous frame pointer

    // Check for overflow
    pushQuad({
      comment: 'Test for overflow',
      instruction: 'MOV',
      args: [RSwap, 'SP']
    });

    // Determine if the stack will exceed the stack limit
    pushQuad({
      instruction: 'ADI',
      args: [RSwap, -frameSize]
    });
    pushQuad({
      instruction: 'CMP',
      args: [RSwap, 'SL']
    });
    pushQuad({
      comment: 'Will the stack overflow?',
      instruction: 'BLT',
      args: [RSwap, 'OVERFLOW']
    });

    // Load the closure context
    var closureReg = R(0);
    if (isTopLevel) {
      // Grab the generated pointer
      pushQuad({
        comment: 'Grab pointer for ' + funcID,
        instruction: 'LDA',
        args: [closureReg, funcID + '_P']
      });
      // jscs:disable
    } else {

      // TODO: Figure out how to handle non-top-level functions
      // Load the variable from the stack

    }
    // jscs:enable

    // Prepare the next frame pointer
    pushQuad({
      comment: 'Prepare the next frame pointer',
      instruction: 'MOV',
      args: ['FP', 'SP']
    });

    // Adjust for the return address
    pushQuad({
      comment: 'Make space for return address',
      instruction: 'ADI',
      args: ['SP', -4]
    });

    // Store the previous frame pointer
    pushQuad({
      comment: 'Store the PFP',
      instruction: 'STR',
      args: ['FP', 'SP']
    });
    pushQuad({
      instruction: 'ADI',
      args: ['SP', -4]
    });

    // Push closure context
    pushQuad({
      comment: 'Push closure context',
      instruction: 'STR',
      args: [closureReg, 'SP']
    });
    pushQuad({
      instruction: 'ADI',
      args: ['SP', -4]
    });
  },

  /**
   * Performs a function call
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Function ID
   */
  CALL: function(quad) {
    // TODO: Will probably need to be fixed for non-top-level functions
    var functionID = quad.arg1;

    // Load the PC
    pushQuad({
      comment: 'Compute return address',
      instruction: 'MOV',
      args: [RSwap, 'PC']
    });

    // Compute the return address
    pushQuad({
      instruction: 'ADI',
      args: [RSwap, 36]
    });

    // Store the return address
    pushQuad({
      instruction: 'STR',
      args: [RSwap, 'FP']
    });

    // Start the function call
    pushQuad({
      comment: 'Call ' + functionID,
      instruction: 'JMP',
      args: [functionID]
    });
  },

  /**
   * Initializes a function
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Function ID
   */
  FUNC: function(quad) {
    var funcID = quad.arg1,
        funcSymbol = SymbolTable.getSymbol(funcID);
    pushQuad({
      label: funcID,
      comment: quad.comment,
      instruction: 'ADI',
      args: ['SP', -funcSymbol.scope.byteSize]
    });
  },

  /**
   * Returns from a function
   */
  RTN: function() {
    // Deallocate the activation record
    pushQuad({
      comment: 'Begin return',
      instruction: 'MOV',
      args: ['SP', 'FP']
    });

    // Check for underflow
    pushQuad({
      comment: 'Test for underflow',
      instruction: 'MOV',
      args: [RSwap, 'SP']
    });
    pushQuad({
      instruction: 'CMP',
      args: [RSwap, 'SB']
    });
    pushQuad({
      instruction: 'BGT',
      args: [RSwap, 'UNDERFLOW']
    });

    // Set the previous frame to the current frame and return
    var prevFP = R(5);
    pushQuad({
      comment: 'Load the PFP',
      instruction: 'LDR',
      args: [RSwap, 'FP']
    });
    pushQuad({
      instruction: 'MOV',
      args: [prevFP, 'FP']
    });
    pushQuad({
      instruction: 'ADI',
      args: [prevFP, -4]
    });
    pushQuad({
      comment: 'Previous frame pointer loaded',
      instruction: 'LDR',
      args: ['FP', prevFP]
    });
    pushQuad({
      comment: 'Return from function',
      instruction: 'JMR',
      args: [RSwap]
    });
  },

  /*********
   *  I/O  *
   *********/
  /**
   * Writes a value to stdout
   */
  WRITE: function(quad) {
    var dataType = quad.arg1,
        argID = quad.arg2,
        instruction,
        trapCode;

    if (dataType === 'char') {
      instruction = 'LDB';
      trapCode = 3;
    } else {
      instruction = 'LDR';
      trapCode = 1;
    }

    this.loadValueToRegister(argID, RIO);
    pushQuad({
      instruction: 'TRP',
      args: [trapCode]
    });
    RIO.clear();
  },

  EXIT: function() {
    pushQuad({
      comment: 'Exit program',
      instruction: 'TRP',
      args: [0]
    });
  },

  /**
   * Generates any required code at the end of the program
   */
  END: function() {
    // Generate code for reporting errors
    ['Stack overflow', 'Stack underflow'].forEach(function(message) {
      var dataLabel = message.replace(' ', '_'),
          typeOfError = message.split(' ')[1],
          routineLabel = typeOfError.toUpperCase();
      pushQuad({
        label: routineLabel,
        comment: 'Print in case of ' + typeOfError,
        instruction: 'LDA',
        args: ['R0', dataLabel]
      });
      pushQuad({
        label: routineLabel + '.print',
        instruction: 'LDB',
        args: [RIO, 'R0']
      });
      pushQuad({
        instruction: 'BRZ',
        args: [RIO, routineLabel + '.end']
      });
      pushQuad({
        instruction: 'TRP',
        args: [3]
      });
      pushQuad({
        instruction: 'ADI',
        args: ['R0', 1]
      });
      pushQuad({
        instruction: 'JMP',
        args: [routineLabel + '.print']
      });
      pushQuad({
        label: routineLabel + '.end',
        instruction: 'TRP',
        args: [0]
      });
    });
  }
};

module.exports = UVU;
