// Safe expression parser and evaluator for validation rules, conditional visibility, and formulas
// This implementation avoids using eval() and provides a secure way to parse and evaluate expressions

export type ExpressionValue = string | number | boolean | null | undefined;
export type ExpressionContext = { [key: string]: ExpressionValue };

export interface ParsedExpression {
  type: 'literal' | 'field' | 'operator' | 'function';
  value: any;
  left?: ParsedExpression;
  right?: ParsedExpression;
  args?: ParsedExpression[];
}

// Supported operators
const OPERATORS = {
  '==': (a: any, b: any) => a === b,
  '!=': (a: any, b: any) => a !== b,
  '>': (a: number, b: number) => a > b,
  '<': (a: number, b: number) => a < b,
  '>=': (a: number, b: number) => a >= b,
  '<=': (a: number, b: number) => a <= b,
  '&&': (a: boolean, b: boolean) => a && b,
  '||': (a: boolean, b: boolean) => a || b,
  '+': (a: number, b: number) => a + b,
  '-': (a: number, b: number) => a - b,
  '*': (a: number, b: number) => a * b,
  '/': (a: number, b: number) => a / b,
  '%': (a: number, b: number) => a % b,
  'IN': (a: any, b: any[]) => Array.isArray(b) && b.includes(a),
  'INCLUDES': (a: any[], b: any) => Array.isArray(a) && a.includes(b),
  'CONTAINS': (a: string, b: string) => typeof a === 'string' && typeof b === 'string' && a.includes(b),
  'STARTS_WITH': (a: string, b: string) => typeof a === 'string' && typeof b === 'string' && a.startsWith(b)
};

// Supported functions
const FUNCTIONS = {
  'CONCAT': (...args: any[]) => args.map(arg => String(arg || '')).join(''),
  'LEN': (str: string) => String(str || '').length,
  'UPPER': (str: string) => String(str || '').toUpperCase(),
  'LOWER': (str: string) => String(str || '').toLowerCase(),
  'TRIM': (str: string) => String(str || '').trim(),
  'ABS': (num: number) => Math.abs(Number(num) || 0),
  'ROUND': (num: number, digits?: number) => Number((Number(num) || 0).toFixed(digits || 0)),
  'MAX': (...args: number[]) => Math.max(...args.map(n => Number(n) || 0)),
  'MIN': (...args: number[]) => Math.min(...args.map(n => Number(n) || 0)),
  'SUM': (...args: number[]) => args.reduce((sum, n) => sum + (Number(n) || 0), 0),
  'AVG': (...args: number[]) => {
    const nums = args.map(n => Number(n) || 0);
    return nums.length > 0 ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0;
  },
  'NOW': () => new Date(),
  'TODAY': () => new Date().toISOString().split('T')[0],
  'YEAR': (date: string | Date) => new Date(date).getFullYear(),
  'MONTH': (date: string | Date) => new Date(date).getMonth() + 1,
  'DAY': (date: string | Date) => new Date(date).getDate(),
  'ISNULL': (value: any) => value == null,
  'ISBLANK': (value: any) => value == null || String(value).trim() === '',
  'NOT': (value: boolean) => !value,
  'IF': (condition: boolean, trueValue: any, falseValue: any) => condition ? trueValue : falseValue
};

class ExpressionParser {
  private tokens: string[] = [];
  private position = 0;

  parse(expression: string): ParsedExpression {
    this.tokens = this.tokenize(expression);
    this.position = 0;
    return this.parseExpression();
  }

  private tokenize(expression: string): string[] {
    // Simple tokenizer that handles strings, numbers, operators, and identifiers
    const tokenRegex = /("([^"\\]|\\.)*")|(\d+\.?\d*)|([<>=!&|]+)|([\w_]+)|([()[\],])/g;
    const tokens: string[] = [];
    let match;

    while ((match = tokenRegex.exec(expression)) !== null) {
      const token = match[0].trim();
      if (token) {
        tokens.push(token);
      }
    }

    return tokens;
  }

  private parseExpression(): ParsedExpression {
    return this.parseOrExpression();
  }

  private parseOrExpression(): ParsedExpression {
    let left = this.parseAndExpression();

    while (this.currentToken() === '||') {
      this.consume('||');
      const right = this.parseAndExpression();
      left = {
        type: 'operator',
        value: '||',
        left,
        right
      };
    }

    return left;
  }

  private parseAndExpression(): ParsedExpression {
    let left = this.parseEqualityExpression();

    while (this.currentToken() === '&&') {
      this.consume('&&');
      const right = this.parseEqualityExpression();
      left = {
        type: 'operator',
        value: '&&',
        left,
        right
      };
    }

    return left;
  }

  private parseEqualityExpression(): ParsedExpression {
    let left = this.parseRelationalExpression();

    while (this.currentToken() === '==' || this.currentToken() === '!=') {
      const operator = this.currentToken();
      this.advance();
      const right = this.parseRelationalExpression();
      left = {
        type: 'operator',
        value: operator,
        left,
        right
      };
    }

    return left;
  }

  private parseRelationalExpression(): ParsedExpression {
    let left = this.parseAdditiveExpression();

    while (['>', '<', '>=', '<=', 'IN', 'INCLUDES', 'CONTAINS', 'STARTS_WITH'].includes(this.currentToken())) {
      const operator = this.currentToken();
      this.advance();
      const right = this.parseAdditiveExpression();
      left = {
        type: 'operator',
        value: operator,
        left,
        right
      };
    }

    return left;
  }

  private parseAdditiveExpression(): ParsedExpression {
    let left = this.parseMultiplicativeExpression();

    while (this.currentToken() === '+' || this.currentToken() === '-') {
      const operator = this.currentToken();
      this.advance();
      const right = this.parseMultiplicativeExpression();
      left = {
        type: 'operator',
        value: operator,
        left,
        right
      };
    }

    return left;
  }

  private parseMultiplicativeExpression(): ParsedExpression {
    let left = this.parseUnaryExpression();

    while (['*', '/', '%'].includes(this.currentToken())) {
      const operator = this.currentToken();
      this.advance();
      const right = this.parseUnaryExpression();
      left = {
        type: 'operator',
        value: operator,
        left,
        right
      };
    }

    return left;
  }

  private parseUnaryExpression(): ParsedExpression {
    if (this.currentToken() === 'NOT') {
      this.consume('NOT');
      const operand = this.parseUnaryExpression();
      return {
        type: 'function',
        value: 'NOT',
        args: [operand]
      };
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): ParsedExpression {
    const token = this.currentToken();

    // Handle parentheses
    if (token === '(') {
      this.consume('(');
      const expr = this.parseExpression();
      this.consume(')');
      return expr;
    }

    // Handle arrays
    if (token === '[') {
      this.consume('[');
      const elements: ParsedExpression[] = [];
      
      while (this.currentToken() !== ']') {
        elements.push(this.parseExpression());
        if (this.currentToken() === ',') {
          this.consume(',');
        }
      }
      
      this.consume(']');
      return {
        type: 'literal',
        value: elements.map(el => this.evaluateExpression(el, {}))
      };
    }

    // Handle function calls
    if (this.isFunction(token)) {
      return this.parseFunctionCall();
    }

    // Handle literals
    if (this.isStringLiteral(token)) {
      this.advance();
      return {
        type: 'literal',
        value: token.slice(1, -1) // Remove quotes
      };
    }

    if (this.isNumberLiteral(token)) {
      this.advance();
      return {
        type: 'literal',
        value: Number(token)
      };
    }

    if (token === 'true' || token === 'false') {
      this.advance();
      return {
        type: 'literal',
        value: token === 'true'
      };
    }

    if (token === 'null') {
      this.advance();
      return {
        type: 'literal',
        value: null
      };
    }

    // Handle field references
    if (this.isIdentifier(token)) {
      this.advance();
      return {
        type: 'field',
        value: token
      };
    }

    throw new Error(`Unexpected token: ${token}`);
  }

  private parseFunctionCall(): ParsedExpression {
    const funcName = this.currentToken();
    this.advance();
    this.consume('(');

    const args: ParsedExpression[] = [];
    while (this.currentToken() !== ')') {
      args.push(this.parseExpression());
      if (this.currentToken() === ',') {
        this.consume(',');
      }
    }

    this.consume(')');

    return {
      type: 'function',
      value: funcName,
      args
    };
  }

  private currentToken(): string {
    return this.position < this.tokens.length ? this.tokens[this.position]! : '';
  }

  private advance(): void {
    this.position++;
  }

  private consume(expected: string): void {
    const current = this.currentToken();
    if (current !== expected) {
      throw new Error(`Expected '${expected}', got '${current}'`);
    }
    this.advance();
  }

  private isFunction(token: string): boolean {
    return Object.hasOwnProperty.call(FUNCTIONS, token);
  }

  private isStringLiteral(token: string): boolean {
    return token.startsWith('"') && token.endsWith('"');
  }

  private isNumberLiteral(token: string): boolean {
    return /^\d+\.?\d*$/.test(token);
  }

  private isIdentifier(token: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token);
  }

  evaluateExpression(expr: ParsedExpression, context: ExpressionContext): ExpressionValue {
    switch (expr.type) {
      case 'literal':
        return expr.value;

      case 'field':
        return context[expr.value];

      case 'operator':
        if (!expr.left || !expr.right) {
          throw new Error(`Invalid operator expression: ${expr.value}`);
        }

        const leftValue = this.evaluateExpression(expr.left, context);
        const rightValue = this.evaluateExpression(expr.right, context);
        
        const operator = OPERATORS[expr.value as keyof typeof OPERATORS];
        if (!operator) {
          throw new Error(`Unknown operator: ${expr.value}`);
        }

        return operator(leftValue, rightValue);

      case 'function':
        const func = FUNCTIONS[expr.value as keyof typeof FUNCTIONS];
        if (!func) {
          throw new Error(`Unknown function: ${expr.value}`);
        }

        const argValues = (expr.args || []).map(arg => this.evaluateExpression(arg, context));
        return (func as any)(...argValues);

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }
}

// Main API
export class ExpressionEngine {
  private parser = new ExpressionParser();
  private expressionCache = new Map<string, ParsedExpression>();

  /**
   * Parse an expression string into an AST
   */
  parse(expression: string): ParsedExpression {
    if (!this.expressionCache.has(expression)) {
      try {
        const parsed = this.parser.parse(expression);
        this.expressionCache.set(expression, parsed);
      } catch (error) {
        throw new Error(`Parse error in expression "${expression}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return this.expressionCache.get(expression)!;
  }

  /**
   * Evaluate an expression with the given context
   */
  evaluate(expression: string, context: ExpressionContext): ExpressionValue {
    const parsed = this.parse(expression);
    try {
      return this.parser.evaluateExpression(parsed, context);
    } catch (error) {
      throw new Error(`Evaluation error in expression "${expression}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate an expression syntax without evaluating
   */
  validate(expression: string): { isValid: boolean; error?: string } {
    try {
      this.parse(expression);
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Get list of field references in an expression
   */
  getFieldReferences(expression: string): string[] {
    try {
      const parsed = this.parse(expression);
      const fields = new Set<string>();
      
      const collectFields = (expr: ParsedExpression) => {
        if (expr.type === 'field') {
          fields.add(expr.value);
        }
        if (expr.left) collectFields(expr.left);
        if (expr.right) collectFields(expr.right);
        if (expr.args) expr.args.forEach(collectFields);
      };
      
      collectFields(parsed);
      return Array.from(fields);
    } catch {
      return [];
    }
  }

  /**
   * Clear the expression cache
   */
  clearCache(): void {
    this.expressionCache.clear();
  }
}

// Export singleton instance
export const expressionEngine = new ExpressionEngine();

// Utility functions for common use cases
export function evaluateValidationRule(
  condition: string, 
  record: ExpressionContext
): boolean {
  try {
    const result = expressionEngine.evaluate(condition, record);
    return Boolean(result);
  } catch (error) {
    console.error('Validation rule evaluation error:', error);
    return false; // Fail open for validation rules
  }
}

export function evaluateConditionalVisibility(
  conditions: { left: string; op: string; right: any }[], 
  record: ExpressionContext
): boolean {
  if (!conditions || conditions.length === 0) return true;

  try {
    // Convert condition objects to expression string
    const conditionStrings = conditions.map(cond => {
      let rightValue = cond.right;
      if (typeof rightValue === 'string') {
        rightValue = `"${rightValue}"`;
      } else if (Array.isArray(rightValue)) {
        rightValue = `[${rightValue.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`;
      }
      
      return `${cond.left} ${cond.op} ${rightValue}`;
    });

    const fullExpression = conditionStrings.join(' && ');
    const result = expressionEngine.evaluate(fullExpression, record);
    return Boolean(result);
  } catch (error) {
    console.error('Conditional visibility evaluation error:', error);
    return true; // Fail open for visibility rules
  }
}

export function evaluateFormula(
  formula: string, 
  record: ExpressionContext
): ExpressionValue {
  try {
    return expressionEngine.evaluate(formula, record);
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return null;
  }
}