# Semantic Actions

  * **SAR** - Semantic Action Record
  * **SAS** - Semantic Action Stack
  * **OS** - Operator Stack

### #iPush - Identifier Push

  * Push an Identifier SAR onto the SAS.

### #iExist - Identifier exists

  * Pop the top SAR from the SAS. Determine if the SAR exists in the current scope. Push the SAR back on to the SAS.

### #lPush - Literal Push

  * Push a Literal SAR for a number, character, or boolean value on to the SAS.

### #oPush - Operator Push

  * Push an operator on to the OS while following the rules for infix to postfix conversion.

### #sPush - Scope Push

  * Push a Scope SAR on to the Scope Stack.

### #sPop - Scope Pop

  * Pop a Scope SAR from the Scope Stack.

### #tPush - Type Push

  * Push a Type SAR on to the SAS.

### #param - Parameter

  * Added a parameter to the current scope.

### #BAL - Beginning of Argument List

  * Push a Beginning of Argument List SAR on to the SAS.

### #EAL - End of Argument List

  * While SAS.pop is not the Beginning of Argument List SAR, place each argument into an Argument List SAR. Push the Argument List SAR on to the SAS.

### #func - Function

  * Pop the Argument List and the Identifier from the SAS then use them to form a Function SAR. Push the Function SAR on to the SAS.

### #if - If

  * Pop an expression from the SAS and test if the type of the expression is boolean.

### #while - While

  * Pop an expression from the SAS and test if the type of the expression is boolean.

### #rtn - Return

  * Evaluate the expression, like in #EOE, then determine if the expression matches the return type of the current scope.

### #write - Write

  * Evaluate the expression, like in #EOE, then determine if the expression is a printable type.

### #read - Read

  * Pop the Identifier SAR from the SAS and determine if the value is a readable type.

### #atoi - ASCII to Integer

  * Pop an expression from the SAS, test that the type of the expression is a char. Push a SAR for the new integer on to the SAS.

### #itoa - Integer to ASCII

  * Pop an expression from the SAS, test the the type of the expression is an int. Push a SAR for the new char on to the SAS.

## Infix to Postfix Conversion Semantic Actions

### #) - Closing Parenthesis

  * Evaluate all other operators up until the first opening parenthesis. Pop off the opening parenthesis.

### #, - Argument

  * Basically the same as #) without popping off the opening parenthesis.

### #EOE - End of Expression

  * Ensure the entire expression is evaluated. While it is generally considered an error to leave anything on the SAS after an EOE this isn't always true. Using #EOE after a rtn, read, or write will leave a SAR on the SAS that must be checked later.

### #+ - Add Operator

  * Pop two expressions from the SAS. Verify that both expressions can be added together. Create a new Temp symbol and Temp SAR. Push the Temp SAR on to the SAS.

### #- - Subtract Operator

  * See: #+

### #* - Multiply Operator

  * See: #+

### #/ - Division Operator

  * See: #+

### #= - Assignment Operator

  * Pop expression2 and expression1 from the SAS. Test the expression1 can be assigned to expression2.

### #< - Less Than Operator

  * Pop two expressions from the SAS. Verify that both expressions can be compared using less than. Create a new Temp symbol and a Temp SAR. Push the Temp SAR on to the SAS.

### #> - Greater Than Operator

  * See: #<

### #<= - Less Than or Equal Operator

  * See: #<

### #>= - Greater Than or Equal Operator

  * See: #<

### #&& - And Operator

  * Pop two expressions from the SAS. Verify that both are booleans. Create a new Temp symbol and Temp SAR. Push the Temp SAR on to the SAS.

### #|| - Or Operator

  * See: #&&

### #== - Equal Operator

  * Pop two expressions. Verify they're the same type. Create a new Temp symbol and Temp SAR. Push the Temp SAR on to the SAS.

### #!= - Not Equal Operator

  * See: #==
