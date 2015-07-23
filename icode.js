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

    var symbol = SymbolTable.getSymbol(symID);
    pushQuad({
      instruction: 'CLOSURE',
      args: [symID, symbol.innerScope.closureSize]
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
