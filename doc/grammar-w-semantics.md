# Grammar

```
// Comments can occur at any point in the code
comment ::= "//" anything
  | "/*" anything "*/"
  ;

keyword ::= "atoi"
  | "else"
  | "false"
  | "if"
  | "itoa"
  | "main"
  | "read"
  | "rtn"
  | "true"
  | "while"
  | "write"
  ;

character_literal ::= "\'" character "\'" #lPush
  ;

character ::= [ "\" ] printable_ascii
  ;

number_literal ::= [ "+" #oPush | "-" #oPush ] number #lPush
  ;

number ::= "0"
  | "1" { number_z }
  | "2" { number_z }
  | "3" { number_z }
  | "4" { number_z }
  | "5" { number_z }
  | "6" { number_z }
  | "7" { number_z }
  | "8" { number_z }
  | "9" { number_z }
  ;

number_z ::= "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  ;

type ::= "bool" #tPush
  | "int" #tPush
  | "char" #tPush
  | "void" #tPush
  | "(" [ type ] ")" "->" type
  ;
```

## Start

```
program ::= { fn_declaration } "main" lambda
  ;
```

## Declarations

```
variable_declaration ::= identifier #iPush [ type_declaration ] "=" #oPush expression ";" #EOE
  | fn_declaration
  ;

fn_declaration ::= identifier lambda
  ;

type_declaration ::= "<" type ">"
  ;

lambda ::= "=>" #sPush "(" [ parameter_list ] ")" "{" { statement } "}" #sPop
  ;

parameter_list ::= parameter { "," parameter }
  ;

parameter ::= identifier #iPush [ type_declaration ] #param
  ;
```

## Statement

```
statement ::= "{" { statement } "}"
  | variable_declaration
  | expression ";" #EOE
  | "if" "(" expression ")" #if statement [ "else" statement ]
  | "while" "(" #oPush expression ")" #oPush #while statement
  | "rtn" lambda #rtn
  | "rtn" [ expression ] ";" #rtn
  | "write" expression ";" #write
  | "read" identifier #iPush #iExist ";" #read
  ;
```

## Expression

```
expression ::= "(" expression ")" [ exp_z ]
  | "true" #lPush [ exp_z ]
  | "false" #lPush [ exp_z ]
  | number_literal [ exp_z ]
  | character_literal [ exp_z ]
  | "atoi" "(" #oPush expression ")" #oPush #atoi [ exp_z ]
  | "itoa" "(" #oPush expression ")" #oPush #itoa [ exp_z ]
  | identifier #iPush #iExist [ fn_call ] [ exp_z ]
  ;

exp_z ::= "=" #oPush expression
  | "&&" #oPush expression
  | "||" #oPush expression
  | "==" #oPush expression
  | "!=" #oPush expression
  | "<=" #oPush expression
  | ">=" #oPush expression
  | "<" #oPush expression
  | ">" #oPush expression
  | "+" #oPush expression
  | "-" #oPush expression
  | "*" #oPush expression
  | "/" #oPush expression
  ;

fn_call ::= "(" #BAL [ arg_list ] ")" #EAL #func
  ;

arg_list ::= argument { "," #, argument }
  ;

argument ::= lambda
  | expression
  ;
```
