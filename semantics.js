'use strict';

var Stack = require('./semantic-stack.js'),
    SymbolTable = require('./symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    SAR = require('./sars/index.js');

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
        Semantics[op]();
      }

      Stack.operator.push(operator);
    }
  }
};

module.exports = Semantics;
