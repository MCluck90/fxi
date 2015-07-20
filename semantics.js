'use strict';

var ICode = require('./icode.js'),
    Stack = require('./semantic-stack.js'),
    SymbolTable = require('./symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    SAR = require('./sars/index.js'),
    TypeInference = require('./type-inference.js'),
    Semantics;

function throwSemanticError(message) {
  if (TypeInference.enabled) {
    return;
  }

  throw new Error(message);
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
      if (symbol.data.type === null) {
        throwSemanticError('Cannot determine type for ' + symbol.value);
      } else if (symbol.data.isFunction && symbol.data.returnType === null) {
        throwSemanticError('Cannot determine return type for ' + symbol.value);
      }
      Stack.action.push(new SAR.Identifier(symbol));
    } else {
      Stack.action.push(new SAR.Identifier(identifier));
    }
  },

  /**
   * Determine if the identifier exists in the current scope
   */
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
    TypeInference.addKnownType(symbol.ID, type);
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

    if (operator === ')') {
      // Evaluate current expression
      while (Stack.operator.top !== '(') {
        var op = Stack.operator.pop();
        if (!op) {
          throw new Error('Failed to find opening parenthesis');
        }
        Semantics[op]();
      }

      // Pop the matching '('
      Stack.operator.pop();
      return;
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

    Stack.action.push(Stack.scope.pop());
  },

  /**
   * Pushes a type on to the action stack
   * @param {string} type
   */
  tPush: function(type, returnType) {
    if (!this.enabled) {
      return;
    }

    var idSar = Stack.action.top;
    TypeInference.addKnownType(idSar.ID, type);
    if (returnType) {
      TypeInference.addKnownReturnType(idSar.ID, returnType);
    }
    Stack.action.push(new SAR.Type(type));
  },

  /***************
   *  FUNCTIONS  *
   ***************/

  /**
   * Add a parameter to the scope
   */
  param: function() {
    if (!this.enabled) {
      return;
    }

    var parameter;
    if (Stack.action.top instanceof SAR.Type) {
      // Type declaration, assign it to the variable
      var typeSar = Stack.action.pop();
      parameter = Stack.action.pop();
      TypeInference.addKnownType(parameter.ID, typeSar.type);
    } else {
      parameter = Stack.action.pop();
    }

    // Only add parameters on initial type pass
    if (TypeInference.enabled) {
      var fnSymbol = SymbolTable().symbol,
          parameterSymbol = SymbolTable.getSymbol(parameter.ID);
      fnSymbol.data.params = fnSymbol.data.params || [];
      fnSymbol.data.params.push(parameterSymbol);
      TypeInference.addExistingParameter(fnSymbol.ID, parameter.ID);
    }
  },

  /**
   * Marks the end of a parameters list
   * @param {string} funcID
   */
  endParameters: function(funcID) {
    if (!this.enabled) {
      return;
    }

    TypeInference.lockParameters(funcID);
  },

  /**
   * Mark the beginning of an argument list
   */
  BAL: function() {
    if (!this.enabled) {
      return;
    }

    Stack.action.push(new SAR.BAL());
  },

  /**
   * Add an argument to the current argument list
   */
  ',': function() {
    if (!this.enabled) {
      return;
    }

    this.EOE(false);
  },

  /**
   * Mark the end of an argument list
   */
  EAL: function() {
    if (!this.enabled) {
      return;
    }

    var argList = new SAR.ArgList();
    while (!(Stack.action.top instanceof SAR.BAL)) {
      argList.args.push(Stack.action.pop());
    }

    // Pop off the BAL
    Stack.action.pop();

    // Infer types for the parameters
    var funcSar = Stack.action.top,
        args = argList.args,
        numOfArgs = args.length,
        existingParams = SymbolTable.getSymbol(funcSar.ID).data.params || [],
        params = existingParams.slice().reverse();

    if (numOfArgs !== params.length) {
      throwSemanticError('Expected ' + params.length + ' arguments, got ' + numOfArgs);
    } else if (TypeInference.enabled) {
      for (var i = 0; i < numOfArgs; i++) {
        var arg = args[i];
        TypeInference.addParameterDependency(funcSar.ID, i, arg.ID);
      }
    } else {
      for (var i = 0; i < numOfArgs; i++) {
        var arg = args[i],
            param = params[i];
        if (param.data.type !== arg.type) {
          throwSemanticError(arg.value + ' must be of type ' + param.data.type);
        }
      }
    }

    Stack.action.push(argList);
  },

  /**
   * Finish a function call
   */
  func: function() {
    if (!this.enabled) {
      return;
    }

    var argList = Stack.action.pop(),
        identifier = Stack.action.pop(),
        fnSymbol = (identifier.ID) ? SymbolTable.getSymbol(identifier.ID) : null,
        func = (fnSymbol) ? new SAR.Func(argList.args, fnSymbol) : null;

    // Determine if this is a function
    if (func) {
      TypeInference.addReturnTypeDependency(identifier.ID, func.ID);
      if (TypeInference.enabled) {
        for (var i = 0, len = argList.args.length; i < len; i++) {
          TypeInference.addParameterDependency(identifier.ID, i, argList.args[i].ID);
        }
      }
    }
    if (!fnSymbol) {
      throwSemanticError(identifier.identifier + ' does not exist');
    } else if (!fnSymbol.data.returnType) {
      throwSemanticError('Cannot use ' + identifier.identifier + ' as a function');
    }
    Stack.action.push(func);
  },

  /******************
   *  FLOW CONTROL  *
   ******************/

  /**
   * Verify that an expression is a bool
   */
  if: function() {
    if (!this.enabled) {
      return;
    }

    this.EOE(false);
    var expression = Stack.action.pop();
    TypeInference.addKnownType(expression.ID, 'bool');
    if (expression.type !== 'bool') {
      throwSemanticError('Expression must be of type bool');
    }
  },

  /**
   * Verify that an expression is a bool
   */
  while: function() {
    if (!this.enabled) {
      return;
    }

    this.if();
  },

  /**
   * Evaluate the expression and
   * make sure it matches the return type of the function
   */
  rtn: function() {
    if (!this.enabled) {
      return;
    }

    // Evaluate the current expression
    this.EOE(false);
    var result = Stack.action.pop(),
        scope = Stack.scope.top;
    if (!result) {
      ICode.Rtn();
      result = { type: 'void' };
    } else {
      ICode.Return(result);
    }

    if (result.type) {
      if (!scope.returnType) {
        scope.returnType = result.type;
        TypeInference.addKnownReturnType(scope.ID, result.type);
      } else if (result.type !== scope.returnType) {
        throwSemanticError('Expected value of type ' + scope.returnType + ', found type ' + result.type);
      }
    } else {
      TypeInference.addReturnTypeDependency(scope.ID, result.ID);
    }
  },

  /********
   *  IO  *
   ********/

  /**
   * Write a value to standard out
   */
  write: function() {
    if (!this.enabled) {
      return;
    }

    this.EOE(false);
    var expression = Stack.action.pop();
    if (expression.type !== 'char' && expression.type !== 'int') {
      throwSemanticError('Cannot write out type ' + expression.type + '. Must be a char or an int');
    }
    ICode.Write(expression);
  },

  /**
   * Reads in a value from standard in
   */
  read: function() {
    if (!this.enabled) {
      return;
    }

    var expression = Stack.action.pop();
    if (expression.type !== 'char' && expression.type !== 'int') {
      throwSemanticError('Cannot read to type ' + expression.type + '. Must be a char or an int');
    }
    ICode.Read(expression);
  },

  /*****************
   *  CONVERSIONS  *
   *****************/

  /**
   * Verify an expression is a char
   */
  atoi: function() {
    if (!this.enabled) {
      return;
    }

    var expression = Stack.action.pop(),
        temp = new SAR.Temp('int');

    TypeInference.addKnownType(expression.ID, 'char');
    TypeInference.addKnownType(temp.ID, 'int');
    if (expression.type !== 'char') {
      throwSemanticError('Cannot convert ' + expression.type + ' to an int, must be a char');
    }

    Stack.action.push(temp);
  },

  /**
   * Verify an expression is an integer
   */
  itoa: function() {
    if (!this.enabled) {
      return;
    }

    var expression = Stack.action.pop(),
        temp = new SAR.Temp('char');

    TypeInference.addKnownType(expression.ID, 'int');
    TypeInference.addKnownType(temp.ID, 'char');
    if (expression.type !== 'int') {
      throwSemanticError('Cannot convert ' + expression.type + ' to a char, must be a int');
    }

    Stack.action.push(temp);
  },

  /***************
   *  OPERATORS  *
   ***************/

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

    while (Stack.operator.length && Stack.operator.top !== '(') {
      var op = Stack.operator.pop();
      Semantics[op]();
    }

    if (force) {
      while (Stack.action.length) {
        Stack.action.pop();
      }
    }
  },

  /**
   * Helper for performing what every
   * mathematical semantic action does
   */
  _mathOperation: function() {
    var a = Stack.action.pop(),
        b = Stack.action.pop(),
        temp = new SAR.Temp('int');

    TypeInference.addKnownType(a.ID, 'int');
    TypeInference.addKnownType(b.ID, 'int');
    TypeInference.addKnownType(temp.ID, 'int');

    if (a.type !== 'int' || b.type !== 'int') {
      var aSymbol = SymbolTable.getSymbol(a.ID),
          bSymbol = SymbolTable.getSymbol(b.ID),
          identifier;
      if (a.type !== 'int' && aSymbol.type !== SymbolTypes.Temp) {
        identifier = aSymbol.value;
      } else if (b.type !== 'int' && bSymbol.type !== SymbolTypes.Temp) {
        identifier = bSymbol.value;
      } else {
        identifier = 'Expression';
      }
      throwSemanticError(identifier + ' is not an integer');
    }
    Stack.action.push(temp);

    return {
      a: a,
      b: b,
      temp: temp
    };
  },

  /**
   * Addition
   */
  '+': function() {
    if (!this.enabled) {
      return;
    }

    var result = this._mathOperation();
    ICode.Add(result.b, result.a, result.temp);
  },

  /**
   * Subtraction
   */
  '-': function() {
    if (!this.enabled) {
      return;
    }

    var result = this._mathOperation();
    ICode.Subtract(result.b, result.a, result.temp);
  },

  /**
   * Multiplication
   */
  '*': function() {
    if (!this.enabled) {
      return;
    }

    var result = this._mathOperation();
    ICode.Multiply(result.b, result.a, result.temp);
  },

  /**
   * Division
   */
  '/': function() {
    if (!this.enabled) {
      return;
    }

    var result = this._mathOperation();
    ICode.Divide(result.b, result.a, result.temp);
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

    TypeInference.addTypeDependency(lhs.ID, rhs.ID);
    if (lhs.type !== rhs.type) {
      throwSemanticError(lhs.value + ' is of type ' + lhs.type + ', cannot assign a ' + rhs.type);
    }
  },

  /**********************
   * BOOLEAN OPERATORS  *
   **********************/

  /**
   * Verify both expressions are numbers
   */
  '<': function() {
    if (!this.enabled) {
      return;
    }

    var expressionA = Stack.action.pop(),
        expressionB = Stack.action.pop(),
        temp = new SAR.Temp('bool');

    TypeInference.addKnownType(expressionA.ID, 'int');
    TypeInference.addKnownType(expressionB.ID, 'int');
    TypeInference.addKnownType(temp.ID, 'bool');

    if (expressionA.type !== 'int' || expressionB.type !== 'int') {
      var aSymbol = SymbolTable.getSymbol(expressionA.ID),
          bSymbol = SymbolTable.getSymbol(expressionB.ID),
          identifier;
      if (expressionA.type !== 'int' && aSymbol.type !== SymbolTypes.Temp) {
        identifier = aSymbol.value;
      } else if (expressionB.type !== 'int' && bSymbol.type !== SymbolTypes.Temp) {
        identifier = bSymbol.value;
      } else {
        identifier = 'Expression';
      }
      throwSemanticError(identifier + ' must be an integer for comparisons');
    }

    Stack.action.push(temp);
  },

  /**
   * Verify both expressions are numbers
   */
  '>': function() {
    if (!this.enabled) {
      return;
    }

    this['<']();
  },

  /**
   * Verify both expressions are numbers
   */
  '<=': function() {
    if (!this.enabled) {
      return;
    }

    this['<']();
  },

  /**
   * Verify both expressions are numbers
   */
  '>=': function() {
    if (!this.enabled) {
      return;
    }

    this['<']();
  },

  /**
   * Verify both expressions are booleans
   */
  '&&': function() {
    if (!this.enabled) {
      return;
    }

    var expressionA = Stack.action.pop(),
        expressionB = Stack.action.pop(),
        temp = new SAR.Temp('bool');

    TypeInference.addKnownType(expressionA.ID, 'bool');
    TypeInference.addKnownType(expressionB.ID, 'bool');
    TypeInference.addKnownType(temp.ID, 'bool');

    if (expressionA.type !== 'bool' || expressionB.type !== 'bool') {
      var aSymbol = SymbolTable.getSymbol(expressionA.ID),
          bSymbol = SymbolTable.getSymbol(expressionB.ID),
          identifier;
      if (expressionA.type !== 'bool' && aSymbol.type !== SymbolTypes.Temp) {
        identifier = aSymbol.value;
      } else if (expressionB.type !== 'bool' && bSymbol.type !== SymbolTypes.Temp) {
        identifier = bSymbol.value;
      } else {
        identifier = 'Expression';
      }
      throwSemanticError(identifier + ' must be a bool.');
    }

    Stack.action.push(temp);
  },

  /**
   * Verify both expressions are booleans
   */
  '||': function() {
    if (!this.enabled) {
      return;
    }

    this['&&']();
  },

  /**
   * Verify both expressions are the same type
   */
  '==': function() {
    if (!this.enabled) {
      return;
    }

    var expressionA = Stack.action.pop(),
        expressionB = Stack.action.pop(),
        temp = new SAR.Temp('bool');

    TypeInference.addTypeDependency(expressionA.ID, expressionB.ID);
    TypeInference.addKnownType(temp.ID, 'bool');
    if (expressionA.type !== expressionB.type) {
      throwSemanticError('Cannot compare a ' + expressionA.type + ' with a ' + expressionB.type);
    }
    Stack.action.push(temp);
  },

  /**
   * Verify both expressions are the same type
   */
  '!=': function() {
    if (!this.enabled) {
      return;
    }

    this['==']();
  }
};

module.exports = Semantics;
