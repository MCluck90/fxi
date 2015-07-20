'use strict';

var ICode = require('./icode.js'),
    Symbol = require('./symbol.js'),
    SymbolTable = require('./symbol-table.js'),
    SymbolTypes = SymbolTable.SymbolTypes,
    Semantics = require('./semantics.js'),
    Stack = require('./semantic-stack.js'),
    tokens = require('./scanner.js'),
    TokenTypes = tokens.TokenTypes,
    TypeInference = require('./type-inference.js'),

    // If set to a string, contains next functions name
    fnName = null;

/**
 * Verify that the current token matches the given lexeme
 * Moves to the next token after performing the check
 * @param {string}  lexeme
 * @param {strin[]} options Other possible options
 * @return {Token} The token that was checked
 */
function checkLexeme(lexeme, options) {
  if (tokens.currentToken.lexeme !== lexeme) {
    if (lexeme === '}' && tokens.currentToken.lexeme === undefined) {
      throw new Error('Missing ending curly brace');
    }

    var message = 'Expected \'' + lexeme + '\'';
    if (options && options.length) {
      for (var i = 0, len = options.length; i < len; i++) {
        var opt = options[i],
            hasSpace = opt.indexOf(' ') > -1;
        message += ', ';
        if (i === len - 1) {
          message += 'or ';
        }
        if (!hasSpace) {
          message += '\'';
        }
        message += opt;
        if (!hasSpace) {
          message += '\'';
        }
      }
    }

    throw new SyntaxError(message + ', found ' + tokens.currentToken.lexeme);
  }
  var prevToken = tokens.currentToken;
  tokens.nextToken();
  return prevToken;
}

/**
 * Verifies that the current token type matches the given type
 * Moves to the next token after performing the check
 * @param {TokenType} type
 * @return {Token} The token that was checked
 */
function checkTokenType(type) {
  if (tokens.currentToken.type !== type) {
    throw new SyntaxError(
      'Expected a ' + type.toLowerCase() +
      ', found ' + tokens.currentToken.lexeme
    );
  }
  var prevToken = tokens.currentToken;
  tokens.nextToken();
  return prevToken;
}

var Syntax = {
  pass: function(name) {
    Stack.clear();
    switch (name) {
      case 'syntax':
        SymbolTable().enabled = true;
        Semantics.enabled = false;
        TypeInference.enabled = false;
        ICode.enabled = false;
        break;

      case 'type inference':
        SymbolTable().enabled = false;
        Semantics.enabled = true;
        TypeInference.enabled = true;
        ICode.enabled = false;
        break;

      case 'semantics':
        SymbolTable().enabled = false;
        Semantics.enabled = true;
        TypeInference.enabled = false;
        ICode.enabled = true;
        ICode.quads = [];
        break;

      default:
        throw new Error('Unknown pass: ' + name);
    }

    this.program();
    if (TypeInference.enabled) {
      TypeInference.resolve();
    }
  },

  /**
   * { fn_declaration } "main" lambda
   */
  program: function() {
    if (ICode.enabled) {
      ICode.Init(SymbolTable().findSymbol('main'));
    }
    while (this.fn_declaration(true)) {
      this.fn_declaration();
    }

    fnName = 'main';
    checkLexeme('main');
    this.lambda();
    Semantics.EOE();
    ICode.End();
  },

  /**
   * "bool"
   * "char"
   * "int"
   * "(" type ")" "->" type
   */
  type: function(depthCheck, append) {
    if (depthCheck) {
      return tokens.currentToken.type   === TokenTypes.TYPE ||
             tokens.currentToken.type   === TokenTypes.TYPE_ARROW ||
             tokens.currentToken.lexeme === '(';
    }

    if (tokens.currentToken.type === TokenTypes.TYPE) {
      if (append) {
        var result = tokens.currentToken.lexeme;
        checkTokenType(TokenTypes.TYPE);
        return result;
      } else {
        Semantics.tPush(tokens.currentToken.lexeme);
        checkTokenType(TokenTypes.TYPE);
      }
    } else {
      checkLexeme('(');
      var result = '(';
      if (this.type(true)) {
        result += this.type(false, true);
      }
      if (result === '(' && tokens.currentToken.lexeme === ',') {
        checkTokenType(TokenTypes.TYPE);
      }
      while (tokens.currentToken.lexeme === ',') {
        checkLexeme(',');
        result += ',';
        result += this.type(false, true);
      }
      checkLexeme(')');
      result += ')';
      checkLexeme('->');
      result += '->';
      var returnType = this.type(false, true);
      result += returnType;
      if (append) {
        return result;
      } else {
        Semantics.tPush(result, returnType);
      }
    }
  },

  /**
   * identifier [ type_declaration ] "=" expression ";"
   * fn_declaration
   */
  variable_declaration: function(depthCheck) {
    var nextToken = tokens.peek(),
        isAssignmentOrType = (nextToken.lexeme === '=' || nextToken.lexeme === '<');
    if (depthCheck) {
      return (tokens.currentToken.type === TokenTypes.IDENTIFIER && isAssignmentOrType) ||
             this.fn_declaration(true);
    }

    if (isAssignmentOrType) {
      var variable = SymbolTable().addSymbol(new Symbol({
        type: SymbolTypes.LocalVar,
        value: tokens.currentToken.lexeme
      }));
      Semantics.iPush(variable.value);
      checkTokenType(TokenTypes.IDENTIFIER);
      if (this.type_declaration(true)) {
        this.type_declaration(false);
        if (tokens.currentToken.lexeme === ';') {
          checkLexeme(';');
          Semantics.EOE();
          return;
        }
      }
      checkLexeme('=');
      Semantics.oPush('=');
      this.expression();
      checkLexeme(';');
      Semantics.EOE();
    } else if (nextToken.type === TokenTypes.ARROW) {
      this.fn_declaration();
    } else {
      checkTokenType(TokenTypes.IDENTIFIER);
      throw new Error('Expected assignment or arrow, found ' + tokens.currentToken.lexeme);
    }
  },

  /**
   * identifier lambda
   */
  fn_declaration: function(depthCheck) {
    if (depthCheck) {
      var next = tokens.peek().lexeme;
      return tokens.currentToken.type === TokenTypes.IDENTIFIER && next === '=>';
    }

    fnName = tokens.currentToken.lexeme;
    checkTokenType(TokenTypes.IDENTIFIER);
    this.lambda();
    Semantics.EOE();
  },

  /**
   * "<" type ">"
   */
  type_declaration: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.lexeme === '<';
    }

    checkLexeme('<');
    this.type();
    checkLexeme('>');
  },

  /**
   * "=>" "(" [ parameter_list ] ")" "{" { statement } "}"
   */
  lambda: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.type === TokenTypes.ARROW;
    }

    var symbol = new Symbol({
      type: SymbolTypes.Lambda
    });
    if (fnName) {
      symbol.type = SymbolTypes.Fn;
      symbol.value = fnName;
      fnName = false;
    }

    symbol = SymbolTable().addSymbol(symbol);
    SymbolTable().setScope(symbol);
    Semantics.sPush(symbol);
    ICode.startFunction(symbol);
    checkLexeme('=>');
    checkLexeme('(');
    if (this.parameter_list(true)) {
      this.parameter_list();
    }
    SymbolTable().lockParameters();
    Semantics.endParameters(symbol.ID);
    checkLexeme(')');
    checkLexeme('{');
    while (this.statement(true)) {
      this.statement();
    }
    // statement
    checkLexeme('}');

    ICode.Rtn();
    ICode.endFunction();
    Semantics.sPop();
    SymbolTable().exitScope();
  },

  /**
   * parameter { "," parameter }
   */
  parameter_list: function(depthCheck) {
    if (depthCheck) {
      return this.parameter(true);
    }

    this.parameter();
    while (tokens.currentToken.lexeme === ',') {
      checkLexeme(',');
      this.parameter();
    }
  },

  /**
   * identifier [ type_declaration ]
   */
  parameter: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.type === TokenTypes.IDENTIFIER;
    }

    var param = SymbolTable().addSymbol(new Symbol({
      type: SymbolTypes.Param,
      value: tokens.currentToken.lexeme
    }));
    Semantics.iPush(param.value);
    checkTokenType(TokenTypes.IDENTIFIER);
    if (this.type_declaration(true)) {
      this.type_declaration(false);
    }
    Semantics.param();
  },

  /**
   * "{" { statement } "}"
   * variable_declaration
   * expression ";"
   * "if" "(" expression ")" statement [ "else" statement ]
   * "while" "(" expression ")" statement
   * "rtn" lambda
   * "rtn" [ expression ] ";"
   * "write" expression ";"
   * "read" expression ";"
   */
  statement: function(depthCheck) {
    var lexeme = tokens.currentToken.lexeme;
    if (depthCheck) {
      return lexeme === '{' ||
             this.variable_declaration(true) ||
             this.expression(true) ||
             lexeme === 'if' ||
             lexeme === 'while' ||
             lexeme === 'rtn' ||
             lexeme === 'write' ||
             lexeme === 'read';
    }

    if (lexeme === '{') {
      checkLexeme('{');
      while (this.statement(true)) {
        this.statement();
      }
      checkLexeme('}');
    } else if (this.variable_declaration(true)) {
      this.variable_declaration();
    } else if (this.expression(true)) {
      this.expression();
      Semantics.EOE();
      checkLexeme(';');
    } else if (lexeme === 'if') {
      checkLexeme('if');
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
      Semantics.if();
      this.statement();
      if (tokens.currentToken.lexeme === 'else') {
        checkLexeme('else');
        this.statement();
      }
    } else if (lexeme === 'while') {
      checkLexeme('while');
      checkLexeme('(');
      this.expression();
      checkLexeme(')');
      Semantics.while();
      this.statement();
    } else if (lexeme === 'rtn') {
      checkLexeme('rtn');
      if (this.lambda(true)) {
        this.lambda();
        Semantics.EOE(false);
      } else {
        if (this.expression(true)) {
          this.expression();
          Semantics.EOE(false);
        } else {
          Semantics.EOE();
        }
        checkLexeme(';');
      }
      Semantics.rtn();
    } else if (lexeme === 'write') {
      checkLexeme('write');
      this.expression();
      checkLexeme(';');
      Semantics.write();
    } else if (lexeme === 'read') {
      checkLexeme('read');
      Semantics.iPush(tokens.currentToken.lexeme);
      Semantics.iExist();
      checkTokenType(TokenTypes.IDENTIFIER);
      checkLexeme(';');
      Semantics.read();
    } else {
      throw new Error('Invalid statement');
    }
  },

  /**
   * "(" expression ")" [ exp_z ]
   * "true" [ exp_z ]
   * "false" [ exp_z ]
   * number_literal [ exp_z ]
   * character_literal [ exp_z ]
   * "atoi" "(" expression ")" [ exp_z ]
   * "itoa" "(" expression ")" [ exp_z ]
   * identifier [ fn_call ] [ exp_z ]
   */
  expression: function(depthCheck) {
    var token = tokens.currentToken,
        lexeme = token.lexeme;
    if (depthCheck) {
      return lexeme === '(' ||
             lexeme === 'true' ||
             lexeme === 'false' ||
             token.type === TokenTypes.NUMBER ||
             token.type === TokenTypes.CHARACTER ||
             lexeme === 'atoi' ||
             lexeme === 'itoa' ||
             token.type === TokenTypes.IDENTIFIER;
    }

    if (lexeme === '(') {
      checkLexeme('(');
      Semantics.oPush('(');
      this.expression();
      checkLexeme(')');
      Semantics.oPush(')');
    } else if (lexeme === 'true') {
      Semantics.lPush('bool', 'true');
      checkLexeme('true');
    } else if (lexeme === 'false') {
      Semantics.lPush('bool', 'false');
      checkLexeme('false');
    } else if (token.type === TokenTypes.NUMBER) {
      var number = new Symbol({
        type: SymbolTypes.NumberLiteral,
        value: tokens.currentToken.lexeme,
        data: {
          type: 'int'
        }
      });
      SymbolTable().addLiteral(number);
      Semantics.lPush('int', number.value);
      checkTokenType(TokenTypes.NUMBER);
    } else if (token.type === TokenTypes.CHARACTER) {
      var character = SymbolTable().addLiteral(new Symbol({
        type: SymbolTypes.CharacterLiteral,
        value: tokens.currentToken.lexeme,
        data: {
          type: 'char'
        }
      }));
      Semantics.lPush('char', character.value);
      checkTokenType(TokenTypes.CHARACTER);
    } else if (lexeme === 'atoi') {
      checkLexeme('atoi');
      checkLexeme('(');
      Semantics.oPush('(');
      this.expression();
      checkLexeme(')');
      Semantics.oPush(')');
      Semantics.atoi();
    } else if (lexeme === 'itoa') {
      checkLexeme('itoa');
      checkLexeme('(');
      Semantics.oPush('(');
      this.expression();
      checkLexeme(')');
      Semantics.oPush(')');
      Semantics.itoa();
    } else if (token.type === TokenTypes.IDENTIFIER) {
      // Look for a free variable
      var identifier = tokens.currentToken.lexeme;
      SymbolTable().addSymbol(new Symbol({
        type: SymbolTypes.FreeVar,
        value: identifier
      }));
      Semantics.iPush(identifier);
      Semantics.iExist();
      checkTokenType(TokenTypes.IDENTIFIER);
      if (this.fn_call(true)) {
        this.fn_call();
      }
    } else {
      throw new Error('Invalid expression');
    }

    if (this.exp_z(true)) {
      this.exp_z();
    }
  },

  /**
   * "=" expression
   * "&&" expression
   * "||" expression
   * "==" expression
   * "!=" expression
   * "<=" expression
   * ">=" expression
   * "<" expression
   * ">" expression
   * "+" expression
   * "-" expression
   * "*" expression
   * "/" expression
   */
  exp_z: function(depthCheck) {
    var type = tokens.currentToken.type,
        isCorrectType = type === TokenTypes.ASSIGNMENT ||
                        type === TokenTypes.BOOLEAN ||
                        type === TokenTypes.RELATIONAL ||
                        type === TokenTypes.MATH;
    if (depthCheck) {
      return isCorrectType;
    }

    if (isCorrectType) {
      Semantics.oPush(tokens.currentToken.lexeme);
      tokens.nextToken();
      this.expression();
    } else {
      throw new Error('Expected assignment, boolean expression, or math expression');
    }
  },

  /**
   * "(" [ arg_list ] ")"
   */
  fn_call: function(depthCheck) {
    if (depthCheck) {
      return tokens.currentToken.lexeme === '(';
    }

    checkLexeme('(');
    Semantics.oPush('(');
    Semantics.BAL();
    if (this.arg_list(true)) {
      this.arg_list();
    }
    checkLexeme(')');
    Semantics.oPush(')');
    Semantics.EAL();
    Semantics.func();
  },

  /**
   * argument { "," argument }
   */
  arg_list: function(depthCheck) {
    if (depthCheck) {
      return this.argument(true);
    }

    this.argument();
    while (tokens.currentToken.lexeme === ',') {
      checkLexeme(',');
      Semantics[',']();
      this.argument();
    }
  },

  /**
   * lambda
   * expression
   */
  argument: function(depthCheck) {
    if (depthCheck) {
      return this.lambda(true) || this.expression(true);
    }

    if (this.lambda(true)) {
      this.lambda();
    } else if (this.expression(true)) {
      this.expression();
    } else {
      throw new Error('Expected lambda or expression, found ' + tokens.currentToken.lexeme);
    }
  }
};

module.exports = Syntax;
