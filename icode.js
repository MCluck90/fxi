'use strict';

/**
 * Generates labels
 */
var Labels = {
    _ifID: 100,
    _elseID: 100,
    _whileID: 100,
    _endWhileID: 100,

    _ifStack: [],
    _elseStack: [],
    _whileStack: [],
    _nextLabel: [],

    /**
     * Creates a new if label
     * @returns {string}
     */
    createIf: function() {
      return 'SKIPIF' + this._ifID++;
    },

    /**
     * Pushes an if label on to the stack
     * @param {string}  [label] Will use given label or creates a new label for you
     * @returns {string}  The label that was pushed on
     */
    pushIf: function(label) {
      label = label || this.createIf();
      this._ifStack.push(label);
      return label;
    },

    /**
     * Pops an if off the stack
     * @returns {string}  The label popped off
     */
    popIf: function() {
      return this._ifStack.pop();
    },

    /**
     * Are there any if labels?
     * @returns {bool}
     */
    ifExists: function() {
      return this._ifStack.length > 0;
    },

    /**
     * Creates a new else label
     * @returns {string}
     */
    createElse: function() {
      return 'SKIPELSE' + this._elseID++;
    },

    /**
     * Pushes an else label on to the stack
     * @param {string}  [label] Will use given label or creates a new label for you
     * @returns {string}  The label that was pushed on
     */
    pushElse: function(label) {
      label = label || this.createElse();
      this._elseStack.push(label);
      return label;
    },

    /**
     * Pops an else off the stack
     * @returns {string}  The label popped off
     */
    popElse: function() {
      return this._elseStack.pop();
    },

    /**
     * Creates a new while label
     * @returns {string}
     */
    createWhile: function() {
      return 'WHILE' + this._whileID++;
    },

    /**
     * Creates a new end while label
     * @returns {string}
     */
    createEndWhile: function() {
      return '_WHILE' + this._endWhileID++;
    },

    /**
     * Pushes a while label on to the stack
     * @param {string}  [label] Will use given label or creates a new label for you
     * @returns {string}  The label that was pushed on
     */
    pushWhile: function(label) {
      label = label || this.createWhile();
      this._whileStack.push(label);
      return label;
    },

    /**
     * Pushes a end while label on to the stack
     * @param {string}  [label] Will use given label or creates a new label for you
     * @returns {string}  The label that was pushed on
     */
    pushEndWhile: function(label) {
      label = label || this.createEndWhile();
      this._whileStack.push(label);
      return label;
    },

    /**
     * Pops a while off the stack
     * @returns {string}  The label popped off
     */
    popWhile: function() {
      return this._whileStack.pop();
    },

    /**
     * Pops a end while off the stack
     * Created for clarity of reading
     * @returns {string}  The label popped off
     */
    popEndWhile: function() {
      return this._whileStack.pop();
    },

    /**
     * Pushes a next label on to the stack
     * @param {string}  [label] Will use given label or creates a new label for you
     * @returns {string}  The label that was pushed on
     */
    pushNextLabel: function(label) {
      this._nextLabel.push(label);
    },

    /**
     * Pops a next label off the stack
     * Created for clarity of reading
     * @returns {string}  The label popped off
     */
    popNextLabel: function() {
      return this._nextLabel.pop();
    },

    /**
     * Does a next label exist?
     * @returns {bool}
     */
    nextLabelExists: function() {
      return this._nextLabel.length > 0;
    }
  },
  SymbolTable = require('./symbol-table.js'),
  quadsStack = [],
  activeQuads = [],
  ICode;

/**
 * Replaces all instances of an old label with a new one
 * @param {string} oldLabel Label to replace
 * @param {string} newLabel Label which will replace oldLabel
 */
function backPatch(oldLabel, newLabel) {
  for (var i = 0, len = activeQuads.length; i < len; i++) {
    activeQuads[i] = activeQuads[i].map(function(attr) {
      if (attr.indexOf(oldLabel) >= 0) {
        attr = attr.replace(oldLabel, newLabel);
      }
      return attr;
    });
  }
}

/**
 * Generates a new quad
 * @param {object}    opts
 * @param {string?}   opts.label
 * @param {string}    opts.instruction
 * @param {string[]}  opts.args
 * @param {string}    opts.comment
 */
function pushQuad(opts) {
  opts = opts || {};
  opts.args = opts.args || [];
  // Convert them to strings
  opts.args = opts.args.map(function(item) {
    return (item) ? item.toString() : '';
  });

  // Back-patching
  var currentLabel = opts.label;
  if (Labels.nextLabelExists()) {
    currentLabel = Labels.popNextLabel();
    var oldLabels = [];
    while (Labels.nextLabelExists()) {
      oldLabels.push(Labels.popNextLabel());
    }
    oldLabels.forEach(function(label) {
      backPatch(label, currentLabel);
    });
  }

  activeQuads.push([
    currentLabel      || '',
    opts.instruction  || '',
    opts.args[0]      || '',
    opts.args[1]      || '',
    opts.args[2]      || '',
    opts.comment      || ''
  ]);
}

ICode = {
  enabled: false,
  quads: [],

  /**
   * Generates the intermediate code from the run statements
   * @return {string}
   */
  createCode: function() {
    return this.quads.map(function(quad) {
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
          result += '// ';
        }

        result += attr;
        // Put commas between arguments
        if (i > 1 && i < 4 && attr.length && quad[i + 1].length) {
          result += ',';
        }
      }
      return result;
    }).join('\n');
  },

  /**
   * Provide a spot for initialization code
   */
  Init: function(mainFunc) {
    if (!this.enabled) {
      return;
    }

    // Make sure it appears first
    this.startFunction();
    pushQuad({
      instruction: 'INIT'
    });
    pushQuad({
      instruction: 'FRAME',
      args: [mainFunc.ID, null]
    });
    pushQuad({
      instruction: 'CALL',
      args: [mainFunc.ID],
      comment: 'Start main()->void'
    });
    pushQuad({
      instruction: 'EXIT',
      comment: 'End program'
    });
    this.endFunction();
  },

  /****************
   *  ARITHMETIC  *
   ****************/

  /**
   * Add two elements together and store them in another variable
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  Add: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'ADD',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' + ' + y.identifier
    });
  },

  /**
   * Subtracts two elements together and store them in another variable
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  Subtract: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'SUB',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' - ' + y.identifier
    });
  },

  /**
   * Multiplies two elements together and store them in another variable
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  Multiply: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'MUL',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' * ' + y.identifier
    });
  },

  /**
   * Divide two elements together and store them in another variable
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  Divide: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'DIV',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' / ' + y.identifier
    });
  },

  /**************************
   *  RELATIONAL OPERATORS  *
   **************************/

  /**
   * Compares if one variable is less than another
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  LessThan: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'LT',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' < ' + y.identifier
    });
  },

  /**
   * Compares if one variable is less than or equal to another
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  LessThanEqual: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'LE',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' <= ' + y.identifier
    });
  },

  /**
   * Compares if one variable is greater than another
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  GreaterThan: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'GT',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' > ' + y.identifier
    });
  },

  /**
   * Compares if one variable is greater than or equal to another
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  GreaterThanEqual: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'GE',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' >= ' + y.identifier
    });
  },

  /***********************
   *  BOOLEAN OPERATORS  *
   ***********************/

  /**
   * Compares if both variables are true
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  And: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'AND',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' && ' + y.identifier
    });
  },

  /**
   * Compares if either variable is true
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  Or: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'OR',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' || ' + y.identifier
    });
  },

  /**
   * Compares two values and stores result in z
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  NotEqual: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'NE',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' != ' + y.identifier
    });
  },

  /**
   * Compares two values and stores result in z
   * @param {SAR} x
   * @param {SAR} y
   * @param {SAR} z
   */
  Equal: function(x, y, z) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'EQ',
      args: [z.ID, x.ID, y.ID],
      comment: z.identifier + ' = ' + x.identifier + ' == ' + y.identifier
    });
  },

  /***************
   *  BRANCHING  *
   ***************/

  /**
   * Performs a branch
   * @param {SAR} expression  If true, will execute block
   */
  If: function(expression) {
    if (!this.enabled) {
      return;
    }

    var label = Labels.pushIf();
    pushQuad({
      instruction: 'BF',
      args: [expression.ID, label],
      comment: 'if (!' + expression.identifier + ') branch ' + label
    });
  },

  /**
   * Closes an if statement
   */
  EndIf: function() {
    if (!this.enabled) {
      return;
    }

    if (Labels.ifExists()) {
      Labels.pushNextLabel(Labels.popIf());
    }
  },

  /**
   * Opens an else clause
   */
  Else: function() {
    if (!this.enabled) {
      return;
    }

    var label = Labels.pushElse();
    pushQuad({
      instruction: 'JMP',
      args: [label],
      comment: 'Else'
    });
  },

  /**
   * Closes an else clause
   */
  EndElse: function() {
    if (!this.enabled) {
      return;
    }

    Labels.pushNextLabel(Labels.popElse());
  },

  /**
   * Starts a while loop
   * @param {SAR} expression  While true, execute block
   */
  While: function(expression) {
    if (!this.enabled) {
      return;
    }

    var label = Labels.pushWhile(),
        endLabel = Labels.pushEndWhile(),
        numOfQuads = activeQuads.length,
        latestQuad = activeQuads[numOfQuads - 1],
        previousLabel = (latestQuad) ? latestQuad[0] : '';

    // Attach label to previous quad if expression was not a single bool
    if (expression.identifier[0] === '$') {
      // Attach label to previous comparison and backpatch as needed
      if (previousLabel) {
        backPatch(previousLabel, label);
      }
      latestQuad[0] = label;
      pushQuad({
        instruction: 'BF',
        args: [expression.ID, endLabel],
        comment: 'Exit while at ' + endLabel
      });
    } else {
      // Attach the label to the current instruction
      Labels.pushNextLabel(label);
      pushQuad({
        instruction: 'BF',
        args: [expression.ID, endLabel],
        comment: 'Exit while at ' + endLabel
      });
    }
  },

  /**
   * Closes a while loop
   */
  EndWhile: function() {
    if (!this.enabled) {
      return;
    }

    var endWhileLabel = Labels.popEndWhile(),
        whileLabel = Labels.popWhile();
    pushQuad({
      instruction: 'JMP',
      args: [whileLabel]
    });
    Labels.pushNextLabel(endWhileLabel);
  },

  /*********
   *  I/O  *
   *********/

  /**
   * Reads from standard in
   * @param {SAR} expression
   */
  Read: function(expression) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      comment: 'read ' + (expression.identifier || expression.ID),
      instruction: 'READ',
      args: [expression.type, expression.ID],
    });
  },

  /**
   * Write to standard output
   * @param {SAR} expression
   */
  Write: function(expression) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      comment: 'write ' + (expression.identifier || expression.ID),
      instruction: 'WRITE',
      args: [expression.type, expression.ID],
    });
  },

  /*****************
   *  CONVERSIONS  *
   *****************/
  /**
   * Converts a character to an integer
   * @param {SAR} character Character to convert
   * @param {SAR} result    Where to store the new integer
   */
  atoi: function(character, result) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'ATOI',
      args: [result.ID, character.ID],
      comment: (result.identifier || result.ID) + ' = atoi(' + (character.value || character.ID) + ')'
    });
  },

  /**
   * Converts an integer to a character
   * @param {SAR} integer Integer to convert
   * @param {SAR} result  Where to store the new character
   */
  itoa: function(integer, result) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'ITOA',
      args: [result.ID, integer.ID],
      comment: (result.identifier || result.ID) + ' = itoa(' + (integer.value || integer.ID) + ')'
    });
  },

  /***************
   *  FUNCTIONS  *
   ***************/

  /**
   * Starts a new function scope so that functions
   * are automatically placed in their own blocks.
   */
  startFunction: function(symbol) {
    if (!this.enabled) {
      return;
    }

    if (activeQuads) {
      quadsStack.push(activeQuads);
    }
    activeQuads = [];

    if (symbol) {
      var comment = 'Initialize ' + symbol.value + '(';
      symbol.data.params.forEach(function(param, index) {
        if (index > 0) {
          comment += ', ';
        }
        comment += param.data.type;
      });
      comment += ') -> ' + symbol.data.returnType;

      // Initialize the function
      pushQuad({
        label: symbol.ID,
        instruction: 'FUNC',
        args: [symbol.ID],
        comment: comment
      });
    }
  },

  /**
   * Ends a function scope and returns to the previous one
   */
  endFunction: function() {
    if (!this.enabled) {
      return;
    }

    if (activeQuads) {
      ICode.quads = ICode.quads.concat(activeQuads);
    }
    activeQuads = quadsStack.pop();
  },

  /**
   * Generates a closure object
   * @param {string} symID
   */
  Closure: function(symID) {
    if (!this.enabled) {
      return;
    }

    var symbol = SymbolTable.getSymbol(symID),
        scope = symbol.innerScope,
        freeVars = scope.getFreeVars();

    // Don't generate closures for top-level functions
    if (!scope._parent._parent) {
      return;
    }

    pushQuad({
      instruction: 'CLOSURE',
      args: [symID, scope.closureSize]
    });

    // Sort by offset so that copying can be more easily optimized
    freeVars.sort(function(a, b) {
      if (a.data.offset < b.data.offset) {
        return -1;
      } else if (b.data.offset > a.data.offset) {
        return 1;
      } else {
        return 0;
      }
    }).forEach(function(freeVar) {
      pushQuad({
        comment: 'Copy ' + freeVar.value + ' to ' + symbol.value + symbol.data.type + ' closure',
        instruction: 'FREEVAR',
        args: [symID, freeVar.data.original.ID, freeVar.ID]
      });
    });
  },

  /**
   * Performs a function call
   * @param {Symbol}  closureObj  The closure object
   * @param {SAR[]}   args        Argument list
   */
  FunctionCall: function(closureObj, args) {
    if (!this.enabled) {
      return;
    }

    var isTopLevel = !closureObj.scope._parent;
    pushQuad({
      instruction: 'FRAME',
      args: [closureObj.ID, isTopLevel]
    });

    // Push on the args
    for (var i = 0, len = args.length; i < len; i++) {
      var arg = args[i];
      pushQuad({
        instruction: 'PUSH',
        args: [arg.ID],
        comment: 'Push ' + arg.identifier
      });
    }

    var argListComment = args.map(function(arg) {
      return arg.identifier;
    }).join(', ');

    // Call the function
    pushQuad({
      instruction: 'CALL',
      args: [closureObj.ID],
      comment: closureObj.value + '(' + argListComment + ')'
    });
  },

  /**
   * Returns void
   */
  Rtn: function() {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'RTN'
    });
  },

  /**
   * Returns a value from a function
   * @param {SAR} expression
   */
  Return: function(expression) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'RETURN',
      args: [expression.ID],
      comment: 'return ' + expression.identifier
    });
  },

  /*********************
   *  DATA OPERATIONS  *
   *********************/

  /**
   * Generate an assignment statement i.e. `x = y`
   * @param {SAR} x
   * @param {SAR} y
   */
  Assignment: function(x, y) {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'MOV',
      args: [x.ID, y.ID],
      comment: x.identifier + ' = ' + (y.identifier || y.ID)
    });
  },

  /**
   * Exits the program
   */
  Exit: function() {
    if (!this.enabled) {
      return;
    }

    pushQuad({
      instruction: 'EXIT'
    });
  },

  /**
   * Generate any post-program code
   */
  End: function() {
    if (!this.enabled) {
      return;
    }

    this.startFunction();
    pushQuad({
      instruction: 'END'
    });
    this.endFunction();
  }
};

module.exports = ICode;
