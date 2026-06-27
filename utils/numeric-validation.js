/**
 * Numeric range validation utility
 * Prevents balance exploits by ensuring numeric inputs are:
 * - Valid integers (not floats, NaN, Infinity)
 * - Within reasonable bounds (prevent overflow/underflow)
 * - Non-negative or positive as required
 */

// Maximum safe values to prevent integer overflow and resource abuse
const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER; // 2^53 - 1
const MAX_REASONABLE_AMOUNT = 1_000_000; // Practical upper limit for game operations
const MAX_ALLOCATION = 10_000_000; // General upper bound for allocations
const MAX_GOLD = MAX_REASONABLE_AMOUNT;
const MAX_TROOPS = MAX_REASONABLE_AMOUNT;
const MAX_RESEARCHERS = MAX_REASONABLE_AMOUNT;
const MAX_QUEUE_AMOUNT = 10_000; // Max building queue per type

/**
 * Validate that a value is a safe positive integer
 * @param {*} value - Value to validate
 * @param {number} min - Minimum value (default 1)
 * @param {number} max - Maximum value (default MAX_REASONABLE_AMOUNT)
 * @param {string} fieldName - Field name for error messages
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validatePositiveInteger(value, { min = 1, max = MAX_REASONABLE_AMOUNT, fieldName = 'value' } = {}) {
  // Check for null/undefined
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Convert to number
  const num = Number(value);

  // Check for NaN
  if (Number.isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number (got: ${value})` };
  }

  // Check for non-integer
  if (!Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer (got: ${value})` };
  }

  // Check for infinity
  if (!Number.isFinite(num)) {
    return { valid: false, error: `${fieldName} must be finite (got: ${value})` };
  }

  // Check minimum
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} (got: ${num})` };
  }

  // Check maximum
  if (num > max) {
    return { valid: false, error: `${fieldName} must be at most ${max.toLocaleString()} (got: ${num.toLocaleString()})` };
  }

  return { valid: true, value: num };
}

/**
 * Validate that a value is a non-negative integer (allows 0)
 * @param {*} value - Value to validate
 * @param {number} min - Minimum value (default 0)
 * @param {number} max - Maximum value (default MAX_ALLOCATION)
 * @param {string} fieldName - Field name for error messages
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validateNonNegativeInteger(value, { min = 0, max = MAX_ALLOCATION, fieldName = 'value' } = {}) {
  // Check for null/undefined
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Convert to number
  const num = Number(value);

  // Check for NaN
  if (Number.isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number (got: ${value})` };
  }

  // Check for non-integer
  if (!Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer (got: ${value})` };
  }

  // Check for infinity
  if (!Number.isFinite(num)) {
    return { valid: false, error: `${fieldName} must be finite (got: ${value})` };
  }

  // Check minimum
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} (got: ${num})` };
  }

  // Check maximum
  if (num > max) {
    return { valid: false, error: `${fieldName} must be at most ${max.toLocaleString()} (got: ${num.toLocaleString()})` };
  }

  return { valid: true, value: num };
}

/**
 * Validate troop amount for hiring
 * @param {*} amount - Amount to hire
 * @param {object} options - Validation options {fieldName, maxAmount}
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validateTroopAmount(amount, { fieldName = 'amount', maxAmount = MAX_TROOPS } = {}) {
  return validatePositiveInteger(amount, {
    min: 1,
    max: Math.min(maxAmount, MAX_TROOPS),
    fieldName,
  });
}

/**
 * Validate research amount
 * @param {*} amount - Amount to research with
 * @param {object} options - Validation options {fieldName, maxAmount}
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validateResearchAmount(amount, { fieldName = 'researchers', maxAmount = MAX_RESEARCHERS } = {}) {
  return validatePositiveInteger(amount, {
    min: 1,
    max: Math.min(maxAmount, MAX_RESEARCHERS),
    fieldName,
  });
}

/**
 * Validate building queue amount
 * @param {*} amount - Amount to queue
 * @param {object} options - Validation options {fieldName, maxAmount}
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validateQueueAmount(amount, { fieldName = 'amount', maxAmount = MAX_QUEUE_AMOUNT } = {}) {
  return validatePositiveInteger(amount, {
    min: 1,
    max: Math.min(maxAmount, MAX_QUEUE_AMOUNT),
    fieldName,
  });
}

/**
 * Validate allocation amount (for training, research allocation, etc.)
 * @param {*} amount - Amount to allocate
 * @param {object} options - Validation options {fieldName, maxAmount}
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validateAllocationAmount(amount, { fieldName = 'allocation', maxAmount = MAX_ALLOCATION } = {}) {
  return validateNonNegativeInteger(amount, {
    min: 0,
    max: Math.min(maxAmount, MAX_ALLOCATION),
    fieldName,
  });
}

/**
 * Validate gold amount
 * @param {*} amount - Amount to spend/check
 * @param {object} options - Validation options {fieldName, maxAmount}
 * @returns {object} {valid: boolean, value?: number, error?: string}
 */
function validateGoldAmount(amount, { fieldName = 'gold', maxAmount = MAX_GOLD, allowZero = false } = {}) {
  return allowZero
    ? validateNonNegativeInteger(amount, { min: 0, max: Math.min(maxAmount, MAX_GOLD), fieldName })
    : validatePositiveInteger(amount, { min: 1, max: Math.min(maxAmount, MAX_GOLD), fieldName });
}

/**
 * Batch validate multiple allocation amounts (for training_allocation, research_allocation, etc.)
 * Validates that all amounts are non-negative integers and sum is within capacity
 * @param {object} allocation - Map of {unit/type: amount}
 * @param {object} options - Validation options {maxPerItem, maxTotal, validKeys, fieldName}
 * @returns {object} {valid: boolean, values?: object, error?: string}
 */
function validateAllocationObject(allocation, {
  maxPerItem = MAX_ALLOCATION,
  maxTotal = MAX_ALLOCATION,
  validKeys = null, // If provided, array of allowed keys
  fieldName = 'allocation',
} = {}) {
  // Check object type
  if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) {
    return { valid: false, error: `${fieldName} must be an object` };
  }

  const result = {};
  let total = 0;

  for (const [key, value] of Object.entries(allocation)) {
    // Whitelist validation if validKeys provided
    if (validKeys && !validKeys.includes(key)) {
      return { valid: false, error: `Invalid ${fieldName} key: ${key}` };
    }

    // Validate amount
    const numVal = Number(value);
    if (!Number.isInteger(numVal) || numVal < 0) {
      return { valid: false, error: `${fieldName}.${key} must be non-negative integer (got: ${value})` };
    }

    // Check per-item maximum
    if (numVal > maxPerItem) {
      return {
        valid: false,
        error: `${fieldName}.${key} exceeds maximum of ${maxPerItem.toLocaleString()} (got: ${numVal.toLocaleString()})`,
      };
    }

    total += numVal;
    if (numVal > 0) result[key] = numVal;
  }

  // Check total maximum
  if (total > maxTotal) {
    return {
      valid: false,
      error: `${fieldName} total exceeds maximum of ${maxTotal.toLocaleString()} (got: ${total.toLocaleString()})`,
    };
  }

  return { valid: true, values: result, total };
}

module.exports = {
  // Constants
  MAX_SAFE_VALUE,
  MAX_REASONABLE_AMOUNT,
  MAX_ALLOCATION,
  MAX_GOLD,
  MAX_TROOPS,
  MAX_RESEARCHERS,
  MAX_QUEUE_AMOUNT,

  // Validators
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateTroopAmount,
  validateResearchAmount,
  validateQueueAmount,
  validateAllocationAmount,
  validateGoldAmount,
  validateAllocationObject,
};
