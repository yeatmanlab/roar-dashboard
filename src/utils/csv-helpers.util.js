import _forEach from 'lodash/forEach';
import _startCase from 'lodash/startCase';
import _isEmpty from 'lodash/isEmpty';
import { HEADER_OVERRIDES } from '@/constants/studentRegistration';

/**
 * Generates table columns from a raw JSON object
 *
 * @param {Object} rawJson - The raw JSON object to generate columns from
 * @returns {Array} Array of column objects with field, header, and dataType properties
 */
export function generateColumns(rawJson) {
  let columns = [];
  const columnValues = Object.keys(rawJson);
  _forEach(columnValues, (col) => {
    let dataType = typeof rawJson[col];
    if (col !== 'rowKey') {
      columns.push({
        field: col,
        header: HEADER_OVERRIDES[col] || _startCase(col),
        dataType: dataType,
      });
    }
  });
  return columns;
}

/**
 * Find the mapped column in mappings object
 *
 * @param {Object} mappings - The mappings object
 * @param {String} column - The column to find
 * @returns {String|null} The mapped column or null if not found
 */
export function findMappedColumn(mappings, column) {
  for (const category in mappings) {
    const csvColumn = mappings[category][column];
    if (csvColumn && Array.isArray(csvColumn)) return csvColumn.join(', ');
    if (csvColumn) return csvColumn;
  }
  return null;
}

/**
 * Validate email format
 *
 * @param {String} email - The email to validate
 * @returns {Boolean} Whether the email is valid
 */
export function isEmailValid(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password format
 *
 * @param {String} password - The password to validate
 * @returns {Boolean} Whether the password is valid
 */
export function isPasswordValid(password) {
  if (!password) return false;
  return password.length >= 6 && /[a-zA-Z]/.test(password);
}
