'use strict';

var IndexByName = {
    PC: 8,
    SL: 9,
    SP: 10,
    FP: 11,
    SB: 12
  },
  NameByIndex = {
    8:  'PC',
    9:  'SL',
    10: 'SP',
    11: 'FP',
    12: 'SB'
  },
  MAX_REGISTERS = 13,
  RESERVED = [
    0,  // Holds 0/false
    1,  // Holds 1/true
    6,  // Used in swapping
    7,  // IO
    8,  // PC
    9,  // Stack limit
    10, // Stack pointer
    11, // Frame pointer
    12  // Stack base
  ],
  registers = new Array(MAX_REGISTERS);

/**
 * Trakcs the state of a Register
 * @param {number|string} index   Index of the register or the name
 */
var Register = function(index) {
  index = IndexByName[index] || index;
  this.index = index;
  this.name = NameByIndex[index] || 'R' + index;
  this.values = {};
};

Register.prototype = {
  /**
   * Adds a value to the register
   * @param {string|Symbol} symID   Value to save in the register
   */
  addValue: function(symID) {
    if (typeof symID !== 'string') {
      symID = symID.ID;
    }

    // Find any other registers that contain this value and remove it
    for (var i = 0; i < MAX_REGISTERS; i++) {
      var register = registers[i];
      if (!register || register === this) {
        continue;
      }
      if (register.hasValue(symID)) {
        register.values[symID] = false;
      }
    }

    this.values[symID] = true;
  },

  /**
   * Returns all values currently loaded
   * @returns {string[]}  Set of symbol IDs
   */
  getValues: function() {
    return Object.keys(this.values).filter(function(key) {
      return this.values[key];
    }, this);
  },

  /**
   * Determines if a given value is in the register
   * @param {string|Symbol} symID   Value to search for
   * @returns {bool}
   */
  hasValue: function(symID) {
    if (symID.ID) {
      symID = symID.ID;
    }
    return !!this.values[symID];
  },

  /**
   * Returns true if no values or references are stored in the register
   * @returns {bool}
   */
  isEmpty: function() {
    for (var key in this.values) {
      if (this.values[key]) {
        return false;
      }
    }
    return true;
  },

  /**
   * Returns true if the register is reserved
   * @returns {bool}
   */
  isReserved: function() {
    return RESERVED.indexOf(this.index) > -1;
  },

  /**
   * Removes all values
   */
  clear: function() {
    this.values = {};
  },

  /**
   * Overrides to return the name of the register
   * i.e. R1, R6, PC, etc.
   * @returns {string}
   */
  toString: function() {
    return this.name;
  }
};

/**
 * Simple function for getting the instance of a given register
 * @param {number|string} index   Index of a register or name (PC, SP, etc.)
 * @returns {Register}
 */
var R = function(index) {
  var trueIndex = IndexByName[index] || index;
  if (registers[trueIndex]) {
    return registers[trueIndex];
  }
  registers[trueIndex] = new Register(index);
  return registers[trueIndex];
};

/**
 * Finds a register with the given value
 * @param {string|Symbol} symID   Symbol ID or symbol to search for
 * @returns {Register?}
 */
R.withValue = function(symID) {
  for (var i = 0; i < MAX_REGISTERS; i++) {
    var register = registers[i];
    if (register && register.hasValue(symID)) {
      return register;
    }
  }
  return null;
};

/**
 * Determines if the given string matches a register
 * @returns {bool}
 */
R.isRegister = function(registerID) {
  if (registerID instanceof Register) {
    return true;
  } else if (typeof registerID !== 'string') {
    return false;
  } else {
    return (registerID.length === 2 && registerID[0] === 'R') ||
           (!!IndexByName[registerID]);
  }
};

/**
 * Clears all registers
 */
R.clear = function() {
  for (var i = 0; i < MAX_REGISTERS; i++) {
    var register = registers[i];
    if (register) {
      register.clear();
    }
  }
};

/**
 * Finds the first empty register
 * @returns {Register?}
 */
R.getFreeRegister = function() {
  for (var i = 0; i < MAX_REGISTERS; i++) {
    if (RESERVED.indexOf(i) > -1) {
      continue;
    }

    var register = registers[i];
    if (!register) {
      registers[i] = new Register(i);
      return registers[i];
    } else if (register.isEmpty()) {
      return register;
    }
  }

  return null;
};

/**
 * Returns all registers containing values
 * @returns {Register[]}
 */
R.getLoadedRegisters = function() {
  return registers.filter(function(register) {
    return register && Object.keys(register.values).reduce(function(soFar, key) {
      return soFar || !!register.values[key];
    }, false);
  });
};

module.exports = R;
