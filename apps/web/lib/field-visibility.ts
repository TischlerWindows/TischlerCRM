import { ConditionExpr } from './schema';

export interface RecordData {
  [fieldApiName: string]: any;
}

export interface VisibilityContext {
  currentUserId?: string;
}

/**
 * Evaluates whether a field should be visible based on visibility conditions
 * @param conditions - Array of condition expressions (AND logic - all must be true)
 * @param recordData - Current record field values
 * @param context - Optional context with current user info for user-based visibility
 * @returns true if field should be visible, false otherwise
 */
export function evaluateVisibility(conditions: ConditionExpr[] | undefined, recordData: RecordData, context?: VisibilityContext): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions = always visible
  }

  // All conditions must be true (AND logic)
  return conditions.every(condition => evaluateCondition(condition, recordData, context));
}

/**
 * Evaluates a single condition expression
 */
function evaluateCondition(condition: ConditionExpr, recordData: RecordData, context?: VisibilityContext): boolean {
  // Special: user-based visibility
  if (condition.left === '__currentUser__') {
    if (!context?.currentUserId) return true; // If no user context, show by default
    if (condition.op === 'IN' && Array.isArray(condition.right)) {
      return condition.right.includes(context.currentUserId);
    }
    return true;
  }

  const leftValue = recordData[condition.left];

  switch (condition.op) {
    case '==':
      if (Array.isArray(condition.right)) {
        return condition.right.includes(leftValue);
      }
      return leftValue === condition.right;
    
    case '!=':
      if (Array.isArray(condition.right)) {
        return !condition.right.includes(leftValue);
      }
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
      // For multi-select fields — check if the field's selected values
      // contain the target value.  Multi-select values can be stored as:
      //   - an array: ["A", "B"]
      //   - a semicolon-separated string: "A;B"
      //   - a comma-separated string: "A, B"
      // condition.right is the single value we're looking for.
      if (Array.isArray(leftValue)) {
        // leftValue is already an array — just check membership
        if (Array.isArray(condition.right)) {
          return leftValue.some(val => condition.right.includes(val));
        }
        return leftValue.includes(condition.right);
      }
      if (typeof leftValue === 'string' && leftValue.length > 0) {
        // Split on semicolons or commas (with optional surrounding whitespace)
        const parts = leftValue.split(/\s*[;,]\s*/);
        if (Array.isArray(condition.right)) {
          return parts.some(val => condition.right.includes(val));
        }
        return parts.includes(condition.right);
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
export function formatCondition(condition: ConditionExpr, fieldLabel: string, userNames?: Record<string, string>): string {
  // Special: user-based visibility
  if (condition.left === '__currentUser__') {
    if (Array.isArray(condition.right) && userNames) {
      const names = condition.right.map(id => userNames[id] || id).join(', ');
      return `Visible to: ${names}`;
    }
    return `Visible to specific users`;
  }

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
