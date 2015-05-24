'use strict';

var Stack = require('./semantic-stack.js'),
    SymbolTable = require('./symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    SAR = require('./sars/index.js');

/**
 * Performs a type check on the symbol and saves
 * the type of the symbol if one has not been set
 * @param {SAR}     sar   Semantic action record
 * @param {string}  type  Expected type
 */
function inferType(sar, type) {
  if (sar.type === type) {
    return;
  } else if (sar.type !== null) {
    throw new Error('Expected value of type ' + type + ', found ' + sar.type);
  } else if (!sar.ID) {
    console.error(sar);
    throw new Error('Cannot save inferred type');
  }

  sar.type = type;
  SymbolTable.getSymbol(sar.ID).data.type = type;
}

var Semantics = {
  enabled: false,

  /**
   * Pushes an identifier on to the action stack
   * @param {string} identifier
   */
  iPush: function(identifier) {
    if (!this.enabled) {
      return;
    }

    var symbol = SymbolTable().findSymbol(identifier);
    if (symbol) {
      Stack.action.push(new SAR.Identifier(symbol));
    } else {
      Stack.action.push(new SAR.Identifier(identifier));
    }
  },

  /**
   * Pushes a literal value on to the action stack
   * @param {string} type   Type of value
   * @param {string} value  Value of literal
   */
  lPush: function(type, value) {
    if (!this.enabled) {
      return;
    }

    var symbol = SymbolTable().findLiteral(value);
    if (symbol === null) {
      throw new Error('Unknown literal value: ' + type + ' ' + value);
    }
    Stack.action.push(new SAR.Literal(type, value, symbol.ID));
  },

  /**
   * Pushes an operator on to the stack
   * @param {string} operator
   */
  oPush: function(operator) {
    if (!this.enabled) {
      return;
    }

    var precedenceSet = [
      ['*',  '/',           ],
      ['+',  '-'            ],
      ['<',  '>', '<=', '>='],
      ['==', '!='           ],
      ['&&'                 ],
      ['||'                 ],
      ['='                  ]
    ];

    function findPrecedence(op) {
      var len = precedenceSet.length;
      for (var i = 0; i < len; i++) {
        if (precedenceSet[i].indexOf(op) > -1) {
          return i;
        }
      }
      return len + 1;
    }

    if (['(', '['].indexOf(operator) > -1) {
      Stack.operator.push(operator);
    } else {
      var precedence = findPrecedence(operator);
      while (Stack.operator.top && findPrecedence(Stack.operator.top) <= precedence) {
        var op = Stack.operator.pop();
        try {
          Semantics[op]();
        } catch(e) {
          if (e.message === 'undefined is not a function') {
            e.message = op + ' is not yet implemented';
          }
          throw e;
        }
      }

      Stack.operator.push(operator);
    }
  },

  /***************
   *  OPERATORS  *
   ***************/

  /**
   * Helper for performing what every
   * mathematical semantic action does
   */
  _mathOperation: function() {
    var a = Stack.action.pop(),
        b = Stack.action.pop();

    inferType(a, 'int');
    inferType(b, 'int');
    Stack.action.push(new SAR.Temp('int'));

    return {
      a: a,
      b: b
    };
  },

  /**
   * Addition
   */
  '+': function() {
    if (!this.enabled) {
      return;
    }

    this._mathOperation();
  },

  /**
   * Subtraction
   */
  '-': function() {
    if (!this.enabled) {
      return;
    }

    this._mathOperation();
  },

  /**
   * Multiplication
   */
  '*': function() {
    if (!this.enabled) {
      return;
    }

    this._mathOperation();
  },

  /**
   * Division
   */
  '/': function() {
    if (!this.enabled) {
      return;
    }

    this._mathOperation();
  },

  /**
   * Performs an assignment
   */
  '=': function() {
    if (!this.enabled) {
      return;
    }

    var rhs = Stack.action.pop(),
        lhs = Stack.action.pop();

    if (rhs.type !== null) {
      inferType(lhs, rhs.type);
    }
  },

  /**
   * End of expression
   * @param {bool} [force=true] If true, clear the action stack
   */
  EOE: function(force) {
    if (!this.enabled) {
      return;
    }

    if (force === undefined) {
      force = true;
    }

    while (Stack.operator.length) {
      var op = Stack.operator.pop();
      Semantics[op]();
    }

    if (force) {
      while (Stack.action.length) {
        Stack.action.pop();
      }
    }
  }
};

module.exports = Semantics;
