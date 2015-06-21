var Func = function(args, symbol) {
  this.args = args;
  this.ID = symbol.ID;
  this.identifier = symbol.value;
  this.type = symbol.data.returnType;
  if (!symbol.data.returnType && symbol.data.type) {
    var matches = symbol.data.type.match(/<(.+)>/);
    if (matches) {
      this.type = matches[1];
    }
  }
  if (this.type && this.type.indexOf('<') === 0) {
    this.returnType = this.type.match(/<(.+)>/)[1];
  }
};

module.exports = Func;
