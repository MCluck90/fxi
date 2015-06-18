'use strict';

var Stack = {
  action: [],
  operator: [],
  scope: []
};

Stack.clear = function() {
  this.action = [];
  this.operator = [];
  this.scope = [];
};

Object.defineProperty(Array.prototype, 'top', {
  get: function() {
    console.log(this);
    return this[this.length - 1];
  }
});

module.exports = Stack;
