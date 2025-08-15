import { helpers } from '@vuelidate/validators';

/**
 * Duplicate form key validator.
 *
 * Custom vuelidate validator to check for duplicate values in a collection. This is useful in components such as the
 * tasks parameter form where the user can add form fields dynamically and we need to ensure that the keys are unique.
 *
 * @param {Array} collection - The collection to check for duplicates.
 * @param {String} propertyName - The name of the property to check for duplicates.
 * @param {String} errorMessage - The error message to display if the value is not unique.
 * @returns {Function} A validator function that can be used with Vuelidate.
 */
export const hasNoDuplicates = (collection, propertyName, errorMessage) => {
  return helpers.withParams(
    { type: 'hasNoDuplicates', collection, propertyName, errorMessage },
    helpers.withMessage(errorMessage, function (value) {
      // Ignore empty values as other validators will handle this.
      if (value === '') return true;

      // Check for duplicates in the collection.
      const duplicates = collection.filter((item) => item[propertyName] === value);
      return duplicates.length <= 1;
    }),
  );
};

/**
 * Validator to check if a value is not present in a given array.
 *
 * @param {Array} blacklist - The array to check against.
 * @param {String} errorMessage - The error message to display if the value is present in the blacklist.
 * @returns {Function} A validator function that can be used with Vuelidate.
 */
export const notInBlacklist = (blacklist, errorMessage) => {
  return helpers.withParams(
    { type: 'notInBlacklist', blacklist, errorMessage },
    helpers.withMessage(errorMessage, (value) => {
      // Ignore empty values as other validators will handle this.
      if (value === '') return true;

      // Check if the value is present in the blacklist.
      return !blacklist.includes(value);
    }),
  );
};
