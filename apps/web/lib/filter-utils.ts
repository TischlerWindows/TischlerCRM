import { FilterCondition } from '@/components/advanced-filters';

/**
 * Evaluate a single filter condition against a record
 */
export function evaluateCondition(
  record: Record<string, any>,
  condition: FilterCondition
): boolean {
  const fieldValue = record[condition.field];
  const conditionValue = condition.value;

  // Handle empty/not empty operators
  if (condition.operator === 'is_empty') {
    return fieldValue === null || fieldValue === undefined || fieldValue === '';
  }
  if (condition.operator === 'is_not_empty') {
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
  }

  // Handle boolean operators
  if (condition.operator === 'is_true') {
    return fieldValue === true || fieldValue === 'true' || fieldValue === 1;
  }
  if (condition.operator === 'is_false') {
    return fieldValue === false || fieldValue === 'false' || fieldValue === 0;
  }

  // Convert values to strings for comparison
  const fieldStr = String(fieldValue || '').toLowerCase();
  const conditionStr = String(conditionValue || '').toLowerCase();

  // Text operators
  switch (condition.operator) {
    case 'equals':
      return fieldStr === conditionStr;
    case 'not_equals':
      return fieldStr !== conditionStr;
    case 'contains':
      return fieldStr.includes(conditionStr);
    case 'not_contains':
      return !fieldStr.includes(conditionStr);
    case 'starts_with':
      return fieldStr.startsWith(conditionStr);
    case 'ends_with':
      return fieldStr.endsWith(conditionStr);
  }

  // Number operators
  const fieldNum = parseFloat(fieldValue);
  const conditionNum = parseFloat(conditionValue);
  
  if (!isNaN(fieldNum) && !isNaN(conditionNum)) {
    switch (condition.operator) {
      case 'greater_than':
        return fieldNum > conditionNum;
      case 'less_than':
        return fieldNum < conditionNum;
      case 'greater_or_equal':
        return fieldNum >= conditionNum;
      case 'less_or_equal':
        return fieldNum <= conditionNum;
    }
  }

  // Date operators
  const fieldDate = new Date(fieldValue);
  const conditionDate = new Date(conditionValue);
  
  if (!isNaN(fieldDate.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (condition.operator) {
      case 'before':
        return !isNaN(conditionDate.getTime()) && fieldDate < conditionDate;
      case 'after':
        return !isNaN(conditionDate.getTime()) && fieldDate > conditionDate;
      case 'today':
        return fieldDate.toDateString() === today.toDateString();
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return fieldDate.toDateString() === yesterday.toDateString();
      case 'this_week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return fieldDate >= startOfWeek && fieldDate <= endOfWeek;
      case 'last_week':
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return fieldDate >= startOfLastWeek && fieldDate <= endOfLastWeek;
      case 'this_month':
        return fieldDate.getMonth() === today.getMonth() && 
               fieldDate.getFullYear() === today.getFullYear();
      case 'last_month':
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        return fieldDate.getMonth() === lastMonth.getMonth() && 
               fieldDate.getFullYear() === lastMonth.getFullYear();
    }
  }

  return false;
}

/**
 * Apply multiple filter conditions to a dataset
 */
export function applyFilters<T extends Record<string, any>>(
  records: T[],
  conditions: FilterCondition[]
): T[] {
  if (conditions.length === 0) {
    return records;
  }

  return records.filter(record => {
    // Evaluate each condition
    const results = conditions.map(condition => ({
      result: evaluateCondition(record, condition),
      logicOperator: condition.logicOperator,
    }));

    if (results.length === 0) return true;

    // Start with the first condition's result
    const firstResult = results[0];
    if (!firstResult) return true;
    
    let finalResult = firstResult.result;

    // Apply logic operators sequentially
    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      if (!current) continue;
      
      if (current.logicOperator === 'OR') {
        finalResult = finalResult || current.result;
      } else {
        // Default to AND
        finalResult = finalResult && current.result;
      }
    }

    return finalResult;
  });
}

/**
 * Get a human-readable description of a filter condition
 */
export function describeCondition(
  condition: FilterCondition,
  fields: Array<{ id: string; label: string }>
): string {
  const field = fields.find(f => f.id === condition.field);
  const fieldLabel = field?.label || condition.field;

  const operatorLabels: Record<string, string> = {
    equals: 'equals',
    not_equals: 'does not equal',
    contains: 'contains',
    not_contains: 'does not contain',
    starts_with: 'starts with',
    ends_with: 'ends with',
    greater_than: 'is greater than',
    less_than: 'is less than',
    greater_or_equal: 'is greater than or equal to',
    less_or_equal: 'is less than or equal to',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    before: 'is before',
    after: 'is after',
    today: 'is today',
    yesterday: 'is yesterday',
    this_week: 'is this week',
    last_week: 'is last week',
    this_month: 'is this month',
    last_month: 'is last month',
    is_true: 'is true',
    is_false: 'is false',
  };

  const operatorLabel = operatorLabels[condition.operator] || condition.operator;

  if (['is_empty', 'is_not_empty', 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'is_true', 'is_false'].includes(condition.operator)) {
    return `${fieldLabel} ${operatorLabel}`;
  }

  return `${fieldLabel} ${operatorLabel} "${condition.value}"`;
}
