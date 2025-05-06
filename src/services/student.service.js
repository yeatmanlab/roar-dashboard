import _isEmpty from 'lodash/isEmpty';
import _get from 'lodash/get';
import _set from 'lodash/set';
import { isEmailValid, isPasswordValid } from '@/utils/csv-helpers.util';

/**
 * Validate a student record
 *
 * @param {Object} student - The student record to validate
 * @param {Boolean} usingEmail - Whether using email for authentication
 * @param {Boolean} usingOrgPicker - Whether using organization picker
 * @returns {Object} Object with valid flag and errors array
 */
export function validateStudent(student, usingEmail, usingOrgPicker) {
  const errors = [];

  if (usingEmail) {
    if (!_get(student, 'email')) {
      errors.push('Email is required');
    } else if (!isEmailValid(student['email'])) {
      errors.push('Email is improperly formatted');
    }
  } else {
    if (!_get(student, 'username')) {
      errors.push('Username is required');
    }
  }

  if (!_get(student, 'grade')) {
    errors.push('Grade is required');
  }

  if (!_get(student, 'dob')) {
    errors.push('Date of Birth is required');
  }

  if (!isPasswordValid(student['password'])) {
    errors.push('Password must be at least 6 characters long and contain at least one letter');
  }

  if (!usingOrgPicker) {
    if (!(_get(student, 'districts') && _get(student, 'schools')) && !_get(student, 'groups')) {
      errors.push('District, School, or Group is required');
    }
  }

  return { valid: _isEmpty(errors), errors };
}

/**
 * Transform student data according to mappings
 *
 * @param {Object} rawStudent - The raw student data
 * @param {Object} mappedColumns - The column mappings
 * @param {Boolean} usingEmail - Whether using email for authentication
 * @param {Object} selectedOrgs - Selected organizations (if using org picker)
 * @param {Boolean} usingOrgPicker - Whether using organization picker
 * @param {Function} getOrgId - Function to get organization ID
 * @returns {Object} Transformed student data
 */
export async function transformStudentData(
  rawStudent,
  mappedColumns,
  usingEmail,
  selectedOrgs = {},
  usingOrgPicker = true,
  getOrgId = () => {},
) {
  const transformedStudent = {};

  Object.keys(mappedColumns.required).forEach((key) => {
    if (rawStudent[key]) {
      if (key === 'username') {
        _set(transformedStudent, 'email', `${rawStudent[key]}@roar-auth.com`);
      } else if (['email', 'password'].includes(key)) {
        _set(transformedStudent, key, rawStudent[key]);
      } else {
        _set(transformedStudent, `userData.${key}`, rawStudent[key]);
      }
    }
  });

  Object.keys(mappedColumns.names).forEach((key) => {
    if (rawStudent[key]) _set(transformedStudent, `userData.name.${key}`, rawStudent[key]);
  });

  Object.keys(mappedColumns.demographics).forEach((key) => {
    if (rawStudent[key] && key === 'race') {
      _set(transformedStudent, `userData.${key}`, rawStudent[key].split(', '));
    } else if (rawStudent[key]) {
      _set(transformedStudent, `userData.${key}`, rawStudent[key]);
    }
  });

  Object.keys(mappedColumns.optional).forEach((key) => {
    if (rawStudent[key]) {
      _set(transformedStudent, `userData.${key}`, rawStudent[key]);
    }
  });

  if (!usingOrgPicker) {
  } else {
    Object.keys(selectedOrgs).forEach((key) => {
      if (selectedOrgs[key].length) {
        _set(transformedStudent, `userData.${key}`, { id: selectedOrgs[key][0].id });
      }
    });
  }

  return transformedStudent;
}
