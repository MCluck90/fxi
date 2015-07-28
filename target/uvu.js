'use strict';

var SymbolTable = require('../symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    R = require('../register.js'),
    RFalse = R(0),
    RTrue = R(1),
    RSwap = R(6),
    RIO = R(7),
    _quads = [],
    _currentQuad = {},
    _previousQuad = {},
    _lastICodeLabel = '',
    _lastComment = '',
    _lastFreeRegister = 2,
    _freePointerQuad;

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

  // Increment the start of the heap
  if (!_freePointerQuad) {
    _freePointerQuad = _quads[0];
    _freePointerQuad[2] = parseInt(_freePointerQuad[2], 10);
  } else {
    _freePointerQuad[2] += (opts.instruction === '.BYT') ? 1 :
                           (opts.instruction === '.INT') ? 4 : 12;
  }
}

// Generates code for UVU ASM
var UVU = {
  compile: function(icode) {
    _quads = [];

    for (var i = 0, len = icode.length; i < len; i++) {
      _previousQuad = _currentQuad;
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

    if (SymbolTable.isLiteral(symbol)) {
      // Memory: Literals
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
   * @param {Register?} FP        Which register to treat as the FP
   * @param {bool?}     reference If true, will only load a reference
   * @returns {Register}
   */
  _loadValue: function(symbol, register, FP, reference) {
    FP = FP || R('FP');
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
    } else if (location.type === 'stack') {
      // Extract the value from the stack
      pushQuad({
        comment: comment,
        commentForce: true,
        instruction: 'MOV',
        args: [register, FP]
      });
      pushQuad({
        commentForce: true,
        instruction: 'ADI',
        args: [register, location.offset]
      });
      if (!reference) {
        pushQuad({
          commentForce: true,
          instruction: 'LDR',
          args: [register, register]
        });
      }
    } else {
      throw new Error('Memory type `' + location.type + '` not yet supported.');
    }

    // Mark this register as having this value
    register.clear(); // Only MOV will stack what's inside of a register
    if (!reference) {
      register.addValue(symbolID);
    }

    return register;
  },

  /**
   * Loads a value into any register
   * @param {string}  symbolID  Which symbol to load
   * @returns {Register}
   */
  loadValue: function(symbolID) {
    return this._loadValue(SymbolTable.getSymbol(symbolID), null);
  },

  /**
   * Loads a reference to the value to the register
   * @param {string}  symbolID  Which symbol to load
   * @returns {Register}
   */
  loadReference: function(symbolID) {
    return this._loadValue(SymbolTable.getSymbol(symbolID), null, null, true);
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
   * Loads a value using a frame pointer register
   * @param {string}    symbolID  Which symbol to load
   * @param {Register}  FP        Register which contains the frame pointer
   * @returns {Register}
   */
  loadValueWithFP: function(symbolID, FP) {
    return this._loadValue(SymbolTable.getSymbol(symbolID), null, FP);
  },

  /**
   * Saves the contents of a register
   * @param {Register}  register
   */
  saveRegister: function(register) {
    var FP = R('FP');

    register.getValues().forEach(function(symbolID) {
      var symbol = SymbolTable.getSymbol(symbolID),
          location = this.getLocation(symbol),
          comment = 'Save ' + symbol.value;
      if (location.type === 'memory') {
        // Don't bother saving back literals
        return;
      } else if (location.type === 'stack') {
        // Save the value back to the stack
        pushQuad({
          comment: comment,
          commentForce: true,
          instruction: 'MOV',
          args: [RSwap, FP]
        });
        pushQuad({
          commentForce: true,
          instruction: 'ADI',
          args: [RSwap, location.offset]
        });
        pushQuad({
          commentForce: true,
          instruction: 'STR',
          args: [register, RSwap]
        });
      } else {
        throw new Error('Memory type `' + location.type + '` not yet supported.');
      }
    }, this);

    register.clear();
  },

  /**
   * Saves any variables inside of registers to memory
   * then clears them out
   */
  saveAllRegisters: function() {
    if (_previousQuad.instruction === 'RTN' || _previousQuad.instruction === 'RETURN') {
      // Don't bother saving all of the registers directly after a function call
      return;
    }

    R.getLoadedRegisters().forEach(function(register) {
      this.saveRegister(register);
    }, this);

    R.clear();
  },

  /**
   * Returns the next free register
   * Saves the contents of a register if it must
   * @returns {Register}
   */
  getFreeRegister: function() {
    var startIndex = _lastFreeRegister,
        register = R(startIndex);
    if (register.isEmpty()) {
      _lastFreeRegister++;
      if (_lastFreeRegister > 5) {
        _lastFreeRegister = 2;
      }
      return register;
    }

    // Check all other possible free registers
    _lastFreeRegister++;
    while (_lastFreeRegister !== startIndex) {
      register = R(_lastFreeRegister);
      if (register.isEmpty()) {
        _lastFreeRegister++;
        if (_lastFreeRegister > 5) {
          _lastFreeRegister = 2;
        }
        return register;
      } else {
        _lastFreeRegister++;
        if (_lastFreeRegister > 5) {
          _lastFreeRegister = 2;
        }
      }
    }

    // No free register found, clear one out
    register = R(startIndex);
    this.saveRegister(register);
    _lastFreeRegister = startIndex + 1;
    if (_lastFreeRegister > 5) {
      _lastFreeRegister = 2;
    }
    return register;
  },

  /**
   * Initialize literals etc.
   */
  INIT: function() {
    // Prepare the heap pointer
    pushQuad({
      label: 'FREE',
      instruction: '.INT',
      args: [4]
    });

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
        comment: 'Closure for ' + symbol.value + symbol.data.type,
        label: symbol.ID + '_P',
        instruction: '.INT',
        args: [0]
      });
      pushQuad({
        instruction: '.INT',
        args: [symbol.innerScope.frameSize]
      });
    });

    // Calculate function pointers
    globalFunctions.forEach(function(symbol) {
      pushQuad({
        comment: 'Generate pointer for ' + symbol.value + symbol.data.type,
        instruction: 'LDA',
        args: [RSwap, symbol.ID]
      });
      pushQuad({
        instruction: 'STR',
        args: [RSwap, symbol.ID + '_P']
      });
    });

    // Preload true and false
    pushQuad({
      comment: 'Load false',
      instruction: 'CMP',
      args: [RFalse, RFalse]
    });
    pushQuad({
      comment: 'Load true',
      instruction: 'CMP',
      args: [RTrue, RTrue]
    });
    pushQuad({
      instruction: 'ADI',
      args: [RTrue, 1]
    });
  },

  /***************
   *  FUNCTIONS  *
   ***************/

  /**
   * Allocates a closure object
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Symbol ID
   * @param {number}  quad.arg2 Size of the closure
   */
  CLOSURE: function(quad) {
    var symbolID = quad.arg1,
        symbol = SymbolTable.getSymbol(symbolID),
        size = quad.arg2,
        result = this.loadReference(symbolID),
        frameSize = this.getFreeRegister();

    // Prepare the frame size
    pushQuad({
      comment: 'Prepare frame size value',
      instruction: 'MOV',
      args: [frameSize, RFalse]
    });
    pushQuad({
      instruction: 'ADI',
      args: [frameSize, symbol.innerScope.frameSize]
    });

    // Save the current free pointer
    pushQuad({
      instruction: 'LDR',
      args: [result, 'FREE']
    });
    pushQuad({
      instruction: 'STR',
      args: [RSwap, result]
    });

    // Save the frame size
    pushQuad({
      comment: 'Save frame size',
      instruction: 'ADI',
      args: [RSwap, 4]
    });
    pushQuad({
      instruction: 'STR',
      args: [RSwap, frameSize]
    });

    // Increment the free pointer
    pushQuad({
      instruction: 'ADI',
      args: [RSwap, size]
    });

    // Save the new free pointer
    pushQuad({
      instruction: 'STR',
      args: [RSwap, 'FREE']
    });
  },

  /**
   * Prepares a function call
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Function ID
   * @param {bool}    quad.arg2 If true, function is top level and the pointer must be loaded
   */
  FRAME: function(quad) {
    R.clear();
    var FP = R(3),
        funcID = quad.arg1,
        isTopLevel = quad.arg2,
        funcSymbol = SymbolTable.getSymbol(funcID),
        functionAddress = R(2),
        frameSize = R(4);

    if (isTopLevel) {
      pushQuad({
        comment: 'Find global function address',
        instruction: 'LDA',
        args: [functionAddress, funcID + '_P']
      });
    } else {
      functionAddress = this.loadValueToRegister(funcID, functionAddress);
    }

    pushQuad({
      comment: 'Prepare the frame size',
      instruction: 'MOV',
      args: [frameSize, functionAddress]
    });
    pushQuad({
      instruction: 'ADI',
      args: [frameSize, 4]
    });
    pushQuad({
      comment: 'Load frame size',
      instruction: 'LDR',
      args: [frameSize, frameSize]
    });
    functionAddress.clear();
    frameSize.clear();

    // Flip the size for comparison
    pushQuad({
      instruction: 'MOV',
      args: [RSwap, RFalse]
    });
    pushQuad({
      instruction: 'ADI',
      args: [RSwap, -1]
    });
    pushQuad({
      instruction: 'MUL',
      args: [frameSize, RSwap]
    });

    // Save the frame pointer in a register
    pushQuad({
      instruction: 'MOV',
      args: [FP, 'FP']
    });
    pushQuad({
      comment: 'Prepare to call ' + funcSymbol.value + funcSymbol.data.type
    });

    // Check for overflow
    pushQuad({
      comment: 'Test for overflow',
      instruction: 'MOV',
      args: [RSwap, 'SP']
    });

    // Determine if the stack will exceed the stack limit
    pushQuad({
      instruction: 'ADD',
      args: [RSwap, frameSize]
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
    var closureReg = RSwap;
    if (isTopLevel) {
      // Grab the generated pointer
      pushQuad({
        comment: 'Grab pointer for ' + funcID,
        instruction: 'LDA',
        args: [closureReg, funcID + '_P']
      });
    } else {
      // Load the variable from the stack
      this.loadValueToRegister(funcID, closureReg);
    }

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
      args: [FP, 'SP']
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
    var functionID = quad.arg1,
        funcSymbol = SymbolTable.getSymbol(functionID),
        isTopLevel = !funcSymbol.scope._parent,
        functionAddress = this.getFreeRegister();

    if (isTopLevel) {
      pushQuad({
        comment: 'Find global function address',
        instruction: 'LDA',
        args: [functionAddress, functionID + '_P']
      });
    } else {
      var location = this.getLocation(functionID);
      pushQuad({
        instruction: 'ADI',
        args: [R(3), location.offset]
      });
    }

    pushQuad({
      instruction: 'LDR',
      args: [functionAddress, functionAddress]
    });

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
      instruction: 'JMR',
      args: [functionAddress]
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
      args: ['SP', -funcSymbol.innerScope.frameSize]
    });
  },

  /**
   * Pushes a variable onto the stack
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Variable ID
   */
  PUSH: function(quad) {
    var valueID = quad.arg1,
        valueSymbol = SymbolTable.getSymbol(valueID),
        FP = R(3), // FP was saved in R3 during FRAME
        value = this.loadValueWithFP(valueID, FP);

    pushQuad({
      comment: 'Push ' + (valueSymbol.value || valueSymbol.ID),
      instruction: 'STR',
      args: [value, 'SP']
    });
    pushQuad({
      instruction: 'ADI',
      args: ['SP', -4]
    });

    // No reason to keep it in the register, we're about to jump
    value.clear();
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

  /**
   * Returns a value from a function
   * NOTE: Value will be stored in R2
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Value ID
   */
  RETURN: function(quad) {
    // Make sure any changes to the heap are saved
    this.saveAllRegisters();
    this.loadValueToRegister(quad.arg1, R(2));
    R(2).clear();
    this.RTN();
  },

  /**
   * Loads the return value from a function and saves it locally
   * NOTE: Return value is always stored in R2
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   */
  PEEK: function(quad) {
    var R2 = R(2);
    R2.addValue(quad.arg1);
    this.saveRegister(R2);
  },

  /***********************
   *  DATA MANIPULATION  *
   ***********************/
  /**
   * Saves a value from one variable into another
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Left hand side
   * @param {string}  quad.arg2 Right hand side
   */
  MOV: function(quad) {
    var leftID      = quad.arg1,
        rightID     = quad.arg2,
        left        = R.withValue(leftID) || this.getFreeRegister(),
        right       = this.loadValue(rightID),
        leftSymbol  = SymbolTable.getSymbol(leftID),
        rightSymbol = SymbolTable.getSymbol(rightID);

    pushQuad({
      comment: leftSymbol.value + ' = ' + rightSymbol.value,
      instruction: 'MOV',
      args: [left, right]
    });

    left.clear();
    right.clear();
    left.addValue(leftID);
    this.saveRegister(left);
  },

  /**
   * Converts a character to a number
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Character ID
   */
  ATOI: function(quad) {
    var resultID = quad.arg1,
        characterID = quad.arg2,
        result = this.getFreeRegister();

    // Load the character into the IO register
    this.loadValueToRegister(characterID, RIO);

    // Perform the conversion
    pushQuad({
      instruction: 'TRP',
      args: [10]
    });
    RIO.clear();

    // Move that value into the result
    pushQuad({
      instruction: 'MOV',
      args: [result, RIO]
    });
    result.addValue(resultID);
  },

  /**
   * Converts a character to a number
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Integer ID
   */
  ITOA: function(quad) {
    var resultID = quad.arg1,
        integerID = quad.arg2,
        result = this.getFreeRegister();

    // Load the character into the IO register
    this.loadValueToRegister(integerID, RIO);

    // Perform the conversion
    pushQuad({
      instruction: 'TRP',
      args: [11]
    });
    RIO.clear();

    // Move that value into the result
    pushQuad({
      instruction: 'MOV',
      args: [result, RIO]
    });
    result.addValue(resultID);
  },

  /****************
   *  ARITHMETIC  *
   ****************/

  /**
   * Adds together two variables and stores the result in a third
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  ADD: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'ADD',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Subtract two variables and store their result in a third
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  SUB: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'SUB',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Multiply two variables and store their result in a third
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  MUL: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'MUL',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Divide two variables and store their result in a third
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Numerator ID
   * @param {string}  quad.arg3 Divisor ID
   */
  DIV: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'DIV',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /*********
   *  I/O  *
   *********/

  /**
   * Writes an int or char to standard output
   * @param {QuadObj} quad
   * @param {number}  quad.arg1 Data type
   * @param {string}  quad.arg2 Variable ID
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

  /**
   * Reads in an int or char to standard input
   * @param {QuadObj} quad
   * @param {number}  quad.arg1 Data type
   * @param {string}  quad.arg2 Variable ID
   */
  READ: function(quad) {
    var trapCode = (quad.arg1 === 'int') ? 2 : 4,
        variableID = quad.arg2,
        freeRegister = this.getFreeRegister();

    pushQuad({
      instruction: 'TRP',
      args: [trapCode]
    });
    pushQuad({
      instruction: 'MOV',
      args: [freeRegister, RIO]
    });

    RIO.clear();
    freeRegister.addValue(variableID);
    this.saveRegister(freeRegister);
  },

  /***************
   *  BRANCHING  *
   ***************/

  /**
   * Branches if the given value is false
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Expression ID
   * @param {string}  quad.arg2 Label to jump to
   */
  BF: function(quad) {
    // In case we do jump, save all of the registers
    this.saveAllRegisters();
    var valueID = quad.arg1,
        jumpLabel = quad.arg2,
        value = this.loadValue(valueID);

    pushQuad({
      instruction: 'BRZ',
      args: [value, jumpLabel]
    });
    value.clear();
  },

  /**
   * Jumps straight to a label
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Label to jump to
   */
  JMP: function(quad) {
    this.saveAllRegisters();
    pushQuad({
      instruction: 'JMP',
      args: [quad.arg1]
    });
  },

  /*****************
   *  COMPARISONS  *
   *****************/

  /**
   * Compares if two elements are equal
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  EQ: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    // Compare the two elements
    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'CMP',
      args: [result, rightOp]
    });

    // Normalize to 0 or 1
    pushQuad({
      instruction: 'AND',
      args: [result, RTrue]
    });

    // Result will be -1 (true) or 0 (false)
    pushQuad({
      instruction: 'ADI',
      args: [result, -1]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Compares if one variable is less than another
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  LT: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        rightOp = this.loadValue(rightOpID),
        leftOp = this.loadValue(leftOpID),
        result = this.getFreeRegister();

    // Compare the two operands
    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'CMP',
      args: [result, rightOp]
    });

    // Put -1 into the swap register for checking
    pushQuad({
      comment: 'Prepare -1 for less than comparison',
      instruction: 'MOV',
      args: [RSwap, RFalse]
    });
    pushQuad({
      instruction: 'ADI',
      args: [RSwap, -1]
    });

    // Compare against -1, will be 0 if true, 1 for anything else
    pushQuad({
      instruction: 'CMP',
      args: [result, RSwap]
    });

    // Set to -1 for true and 0 for false
    pushQuad({
      comment: '-1 for true, 0 for false',
      instruction: 'ADI',
      args: [result, -1]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Determines if two values are less than or equal to each other
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  LE: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    // Compare the two values
    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });

    // Possible states: -1 for less than, 0 for equal, 1 for greater
    pushQuad({
      instruction: 'CMP',
      args: [result, rightOp]
    });

    // Will produce false only for greater than
    pushQuad({
      instruction: 'ADI',
      args: [result, -1]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Determines if one value is greater than the other
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  GT: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    // Compare the two operands
    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'CMP',
      args: [result, rightOp]
    });

    // Compare result against 1
    // Possible states -1 for less than or equal, 0 for greater than
    pushQuad({
      instruction: 'CMP',
      args: [result, RTrue]
    });

    // Switches to false for less than or equal
    pushQuad({
      instruction: 'ADI',
      args: [result, 1]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Determines if one value is greater than
   * or equal to another
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  GE: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    // Compare the two operands
    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });

    // Possible states -1 for less than, 0 for equal, 1 for greater
    pushQuad({
      instruction: 'CMP',
      args: [result, rightOp]
    });

    // Will produce false for less than
    pushQuad({
      instruction: 'ADI',
      args: [result, 1]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Determines if two variables are not equal
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  NE: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    // Compare the two elements
    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });

    // Will produce false when equal
    pushQuad({
      instruction: 'CMP',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /*********************
   *  LOGIC OPERATORS  *
   *********************/

  /**
   * Performs a logical or
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  OR: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'OR',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
  },

  /**
   * Performs a logical and
   * @param {QuadObj} quad
   * @param {string}  quad.arg1 Result ID
   * @param {string}  quad.arg2 Left operand ID
   * @param {string}  quad.arg3 Right operand ID
   */
  AND: function(quad) {
    var resultID = quad.arg1,
        leftOpID = quad.arg2,
        rightOpID = quad.arg3,
        leftOp = this.loadValue(leftOpID),
        rightOp = this.loadValue(rightOpID),
        result = this.getFreeRegister();

    pushQuad({
      instruction: 'MOV',
      args: [result, leftOp]
    });
    pushQuad({
      instruction: 'AND',
      args: [result, rightOp]
    });

    result.addValue(resultID);
    leftOp.clear();
    rightOp.clear();
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
        args: [RSwap, dataLabel]
      });
      pushQuad({
        label: routineLabel + '.print',
        instruction: 'LDB',
        args: [RIO, RSwap]
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
        args: [RSwap, 1]
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
