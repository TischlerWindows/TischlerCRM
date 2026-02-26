import { ConditionExpr } from './schema';

export interface RecordData {
  [fieldApiName: string]: any;
}

/**
 * Evaluates whether a field should be visible based on visibility conditions
 * @param conditions - Array of condition expressions (AND logic - all must be true)
 * @param recordData - Current record field values
 * @returns true if field should be visible, false otherwise
 */
export function evaluateVisibility(conditions: ConditionExpr[] | undefined, recordData: RecordData): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions = always visible
  }

  // All conditions must be true (AND logic)
  return conditions.every(condition => evaluateCondition(condition, recordData));
}

/**
 * Evaluates a single condition expression
 */
function evaluateCondition(condition: ConditionExpr, recordData: RecordData): boolean {
  const leftValue = recordData[condition.left];

  switch (condition.op) {
    case '==':
      return leftValue === condition.right;
    
    case '!=':
      return leftValue !== condition.right;
    
    case '>':
      return Number(leftValue) > Number(condition.right);
    
    case '<':
      return Number(leftValue) < Number(condition.right);
    
    case '>=':
      return Number(leftValue) >= Number(condition.right);
    
    case '<=':
      return Number(leftValue) <= Number(condition.right);
    
    case 'IN':
      // Check if leftValue is in the array
      return Array.isArray(condition.right) && condition.right.includes(leftValue);
    
    case 'INCLUDES':
      // For multi-select fields - check if any value in leftValue array is in rightValue array
      if (Array.isArray(leftValue) && Array.isArray(condition.right)) {
        return leftValue.some(val => condition.right.includes(val));
      }
      return false;
    
    case 'CONTAINS':
      // String contains check
      return typeof leftValue === 'string' && leftValue.includes(condition.right);
    
    case 'STARTS_WITH':
      // String starts with check
      return typeof leftValue === 'string' && leftValue.startsWith(condition.right);
    
    default:
      return true;
  }
}

/**
 * Build a visibility condition expression for UI
 */
export function buildCondition(fieldApiName: string, operator: ConditionExpr['op'], value: any): ConditionExpr {
  return {
    left: fieldApiName,
    op: operator,
    right: value
  };
}

/**
 * Format condition for display
 */
export function formatCondition(condition: ConditionExpr, fieldLabel: string): string {
  const operatorLabels: Record<ConditionExpr['op'], string> = {
    '==': 'equals',
    '!=': 'not equals',
    '>': 'greater than',
    '<': 'less than',
    '>=': 'greater than or equal',
    '<=': 'less than or equal',
    'IN': 'is in',
    'INCLUDES': 'includes',
    'CONTAINS': 'contains',
    'STARTS_WITH': 'starts with'
  };

  const rightDisplay = Array.isArray(condition.right) 
    ? condition.right.join(', ')
    : condition.right;

  return `${fieldLabel} ${operatorLabels[condition.op]} ${rightDisplay}`;
}
