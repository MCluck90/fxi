'use strict';

var Stack = {
  action: [],
  operator: []
};

Stack.clear = function() {
  while (this.action.length) {
    this.action.pop();
  }
  while (this.operator.length) {
    this.operator.pop();
  }
};

Object.defineProperty(Stack.action, 'top', {
  get: function() {
    return Stack.action[Stack.action.length - 1];
  }
});

Object.defineProperty(Stack.operator, 'top', {
  get: function() {
    return Stack.operator[Stack.operator.length - 1];
  }
});

module.exports = Stack;
