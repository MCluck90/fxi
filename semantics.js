'use strict';

var ICode = require('./icode.js'),
    Stack = require('./semantic-stack.js'),
    SymbolTable = require('./symbol-table.js'),
    SAR = require('./sars/index.js'),
    Semantics;

function throwSemanticError(message) {
  if (Semantics.onlyTypeInference) {
    return;
  }

  throw new Error(message);
}

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
    throwSemanticError('Expected value of type ' + type + ', found ' + sar.type);
  } else if (!sar.ID) {
    console.error(sar);
    throw new Error('Cannot save inferred type');
  }

  sar.type = type;
  var symbol = SymbolTable().findSymbol(sar.ID);
  if (symbol) {
    symbol.data.type = type;
  }
}

/**
 * Assigns a type to a symbol/SAR
 * @param {SAR}     sar
 * @param {string}  type
 */
function assignType(sar, type) {
  sar.type = type;
  var symbol;
  if (sar.ID) {
    symbol = SymbolTable.getSymbol(sar.ID);
  } else {
    symbol = SymbolTable().findSymbol(sar.identifier || sar.value);
  }
  symbol.data.type = type;
}

Semantics = {
  enabled: false,

  /****************
   *  SAR PUSHES  *
   ****************/

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

  iExist: function() {
    if (!this.enabled) {
      return;
    }

    var identifier = Stack.action.top.identifier,
        symbol = SymbolTable().findSymbol(identifier);
    if (!symbol) {
      throwSemanticError(identifier + ' does not exist in current scope');
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
      throwSemanticError('Unknown literal value: ' + type + ' ' + value);
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
      ['*',  '/'            ],
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

  /**
   * Pushes a scope on to the scope stack
   * @param {Symbol} symbol
   */
  sPush: function(symbol) {
    if (!this.enabled) {
      return;
    }

    Stack.scope.push(new SAR.Scope(symbol));
  },

  /**
   * Pops off the most recent scope
   */
  sPop: function() {
    if (!this.enabled) {
      return;
    }

    var scope = Stack.scope.pop(),
        symbol = scope.symbol,
        returnType = scope.returnType,
        params = scope.params;

    if (!scope.type) {
      // Determine a type string from the scope
      var typeString = returnType + ' : (';
      for (var i = 0, len = params.length; i < len; i++) {
        if (i > 0) {
          typeString += ', ';
        }
        typeString += params[i].data.type;
      }
      symbol.data.type = typeString;
    }

    symbol.data.returnType = returnType;
    symbol.data.params = params;
  },

  /**
   * Pushes a type on to the action stack
   * @param {string} type
   */
  tPush: function(type) {
    if (!this.enabled) {
      return;
    }

    var idSar = Stack.action.top,
        symbol = SymbolTable.getSymbol(idSar.ID);
    if (!symbol.data.type) {
      symbol.data.type = type;
      idSar.type = type;
    } else if (symbol.data.type !== type) {
      throw new Error('Cannot redefine \'' + idSar.identifier + '\' as type \'' + type + '\'');
    }

    Stack.action.push(new SAR.Type(type));
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

    if (lhs.type !== null) {
      inferType(rhs, lhs.type);
    } else if (rhs.type !== null) {
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
  },

  /**********************
   *  VAR DECLARATIONS  *
   **********************/

  Parameter: function() {
    if (!this.enabled) {
      return;
    }

    var parameter;
    if (Stack.action.top instanceof SAR.Type) {
      // Type declaration, assign it to the variable
      var typeSar = Stack.action.pop();
      parameter = Stack.action.pop();
      assignType(parameter, typeSar.type);
    } else {
      parameter = Stack.action.pop();
    }

    // Only add parameters on initial type pass
    if (this.onlyTypeInference) {
      var fnSymbol = SymbolTable().symbol,
          parameterSymbol = SymbolTable.getSymbol(parameter.ID);
      fnSymbol.data.params = fnSymbol.data.params || [];
      fnSymbol.data.params.push(parameterSymbol);
    }
  },

  /********
   *  IO  *
   ********/

  /**
   * Write a value to standard out
   */
  Write: function() {
    if (!this.enabled) {
      return;
    }

    var expression = Stack.action.pop();
    if (!expression.type) {
      throwSemanticError(expression.identifier + ': Cannot write unknown type');
    }
    ICode.Write(expression);
  },

  /**
   * Reads in a value from standard in
   */
  Read: function() {
    if (!this.enabled) {
      return;
    }

    var expression = Stack.action.pop();
    if (!expression.type) {
      throwSemanticError(expression.identifier + ': Cannot read to unknown type');
    }
  }
};

module.exports = Semantics;
