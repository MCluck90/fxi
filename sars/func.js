var Func = function(args, symbol) {
  this.args = args;
  this.ID = symbol.ID;
  this.identifier = symbol.value;
  this.type = symbol.data.returnType;
};

module.exports = Func;
