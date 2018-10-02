// FXI Grammar
// ===========

{
	const Node = (node_type, location, rest) => ({
		node_type,
		location,
		...rest
	});

	const Expression = (expression_type, location, obj) => Node('Expression', location, {
		expression_type: `${expression_type}Expression`,
		...obj,
	});

	const Type = (type_value, location, obj = {}) => Node('Type', location, {
		type_value,
		...obj,
	});
}

// Entry point
Program = _ function_declarations:(decl:FunctionDeclaration _ { return decl; })* {
	return Node('Program', location(), {
		function_declarations,
	});
}

// TODO: Add comments

// Optional whitespace
_ = [ \t\r\n]* { }

// Required whitespace
WS = [ \t\r\n]+ { }

// Declares a variable
VariableDeclaration
	= identifier:Identifier _ type_declaration:TypeDeclaration _ initial_value:("=" _ e:Expression { return e; })? _ ";" {
		return Node('VariableDeclaration', location(), {
			identifier,
			type_declaration,
			initial_value,
		});
	}
	/ identifier:Identifier _ type_declaration:TypeDeclaration? _ "=" _ initial_value:Expression _ ";" {
		return Node('VariableDeclaration', location(), {
			identifier,
			type_declaration,
			initial_value,
		});
	}

// Declares a function
FunctionDeclaration = name:Identifier _ lambda:Lambda {
	return Node('FunctionDeclaration', location(), {
		name,
		lambda,
	});
}

// Declares a type
TypeDeclaration = "<" _ type:Type _ ">" {
	return Node('TypeDeclaration', location(), {
		type,
	});
}

// Used for variables and function names
Identifier = [_a-zA-Z]+[_a-zA-Z0-9]* { 
	return Node('Identifier', location(), {
		identifier: text(),
	});
}

// An anonymous function
Lambda = "=>" _ "(" _ parameters:ParameterList? _ ")" _ body:Block {
	return Node('Lambda', location(), {
		parameters: parameters || [],
		body,
	});
}

// List of parameters for a function
ParameterList = first:Parameter _ rest:("," _ Parameter)* {
	return [first].concat(rest);
}

// A single parameter
Parameter = identifier:Identifier type_declaration:TypeDeclaration? {
	return Node('Parameter', location(), {
		identifier,
		type_declaration,
	});
}

// A block containing a sequence of statements
Block = "{" _ statements:(s:Statement _ { return s; })* "}" {
	return Node('Block', location(), {
		statements,
	});
}

// A single line of work
Statement 
	= block:Block {
		return block;
	}
	/ declaration:VariableDeclaration _ ";" {
		return declaration;
	}
	/ expression:Expression _ ";" {
		return expression;
	}
	/ "if" _ "(" _ condition:Expression _ ")" _ true_branch:Statement false_branch:(_ "else" _ branch:Statement _ { return branch; })? {
		return Node('IfStatement', location(), {
			condition,
			true_branch,
			false_branch,
		});
	}
	/ "while" _ "(" condition:Expression _ ")" _ body:Statement {
		return Node('WhileStatement', location(), {
			condition,
			body,
		});
	}
	/ "rtn" WS expression:Expression? _ ";" {
		return Node('ReturnStatement', location(), {
			expression,
		});
	}
	/ "write" WS expression:Expression _ ";" {
		return Node('WriteStatement', location(), {
			expression,
		});
	}
	/ "read" WS identifier:Identifier _ ";" {
		return Node('ReadStatement', location(), {
			identifier,
		});
	}


// Produces a value
Expression
	= "(" _ inner_expression:Expression _ ")" _ next:ExpressionZ? {
		return Expression('Parentheses', location(), {
			inner_expression,
			next,
		});
	}
	/ boolean:BooleanLiteral _ next:ExpressionZ? {
		return Expression('Boolean', location(), {
			boolean,
			next,
		});
	}
	/ integer:IntegerLiteral _ next:ExpressionZ? {
		return Expression('Integer', location(), {
			integer,
		});
	}
	/ character:CharacterLiteral _ next:ExpressionZ? {
		return Expression('Character', location(), {
			character,
			next,
		});
	}
	/ identifier:Identifier _ function_call:FunctionCall? _ next:ExpressionZ? {
		if (function_call) {
			return Expression('FunctionCall', location(), {
				identifier,
				function_call,
				next,
			});
		}
	}
	/ lambda:Lambda {
		return Expression('Lambda', location(), {
			lambda,
		});
	}

// Chains together different kinds of expressions, allowing for easier precedence
ExpressionZ
	= "=" _ value:Expression {
		return Expression('Assignment', location(), {
			value,
		});
	}
	/ "&&" _ value:Expression {
		return Expression('And', location(), {
			value,
		});
	}
	/ "||" _ value:Expression {
		return Expression('Or', location(), {
			value,
		});
	}
	/ "==" _ value:Expression {
		return Expression('Equals', location(), {
			value,
		});
	}
	/ "!=" _ value:Expression {
		return Expression('NotEquals', location(), {
			value,
		});
	}
	/ "<=" _ value:Expression {
		return Expression('LessThanOrEqual', location(), {
			value,
		});
	}
	/ ">=" _ value:Expression {
		return Expression('GreaterThanOrEqual', location(), {
			value,
		});
	}
	/ "<" _ value:Expression {
		return Expression('LessThan', location(), {
			value,
		});
	}
	/ ">" _ value:Expression {
		return Expression('GreaterThan', location(), {
			value,
		});
	}
	/ "+" _ value:Expression {
		return Expression('Add', location(), {
			value,
		});
	}
	/ "-" _ value:Expression {
		return Expression('Subtract', location(), {
			value,
		});
	}
	/ "*" _ value:Expression {
		return Expression('Multiply', location()), {
			value,
		};
	}
	/ "/" _ value:Expression {
		return Expression('Divide', location()), {
			value,
		};
	}

// When a function is called
FunctionCall = "(" _ args:ArgumentList? _ ")" {
	return Node('FunctionCall', location(), {
		arguments: args || [],
	});
}

// Arguments to a function
ArgumentList = first:Expression rest:(_ "," _ e:Expression { return e; })* {
	return [first].concat(rest);
}

// Any of the possible types
Type
	= "bool" {
		return Type('bool', location());
	}
	/ "int" {
		return Type('int', location());
	}
	/ "char" {
		return Type('char', location());
	}
	/ "void" {
		return Type('void', location());
	}
	/ "(" _ parameter_types:( Type (_ "," _ Type)*)? _ ")" _ "->" _ return_type:Type {
		return Type('function', location(), {
			parameter_types: parameter_types || [],
			return_type,
		});
	}

// Boolean values
BooleanLiteral = value:("true" / "false") {
	return Node('BooleanLiteral', location(), {
		value: (value === 'true'),
	});
}

// Number values
IntegerLiteral = sign:[+-]? int:Integer {
	sign = sign || '';
	return Node('IntegerLiteral', location(), {
		value: Number(sign + int),
	});
}

Integer
	= "0" { return '0'; }
	/ first:[123456789] rest:IntegerZ* {
		return [first].concat(rest);
	}

IntegerZ = int:[0123456789] {
	return int;
}

// Character values
CharacterLiteral = "'" value:Character "'" {
	return Node('CharacterLiteral', location(), {
		value,
	});
}
Character = "\\"? character:[^\r\n] {
	return character;
}