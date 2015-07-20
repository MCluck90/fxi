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

  if (opts.comment) {
    opts.comment = '; ' + opts.comment;
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
   * Starts a new function scope so that functions
   * are automatically placed in their own blocks
   */
  startFunction: function() {
    if (!this.enabled) {
      return;
    }

    if (activeQuads) {
      quadsStack.push(activeQuads);
    }
    activeQuads = [];
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
   * Provide a spot for initialization code
   */
  Init: function() {
    if (!this.enabled) {
      return;
    }

    // Make sure it appears first
    this.startFunction();
    pushQuad({
      instruction: 'INIT'
    });
    this.endFunction();
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
      args: [expression.type, expression.ID]
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
