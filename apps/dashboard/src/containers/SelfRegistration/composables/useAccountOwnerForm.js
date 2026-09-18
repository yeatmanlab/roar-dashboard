import useVuelidate from '@vuelidate/core';
import { email, helpers, minLength, required } from '@vuelidate/validators';
import { computed, reactive, ref } from 'vue';

const FIELD_NAMES = ['firstName', 'lastName', 'email', 'password'];
const PASSWORD_MIN_LENGTH = 8;

const validationRules = {
  firstName: {
    required: helpers.withMessage('Enter your first name.', required),
  },
  lastName: {
    required: helpers.withMessage('Enter your last name.', required),
  },
  email: {
    required: helpers.withMessage('Enter a complete email address.', required),
    email: helpers.withMessage('Enter a complete email address.', email),
  },
  password: {
    required: helpers.withMessage('Use at least 8 characters for your password.', required),
    minLength: helpers.withMessage('Use at least 8 characters for your password.', minLength(PASSWORD_MIN_LENGTH)),
  },
};

/**
 * Owns account-owner values and the normalized account-creation payload.
 * Presentation components update this state through the exposed field API and
 * never receive account-service dependencies.
 *
 * @returns {Object} Reactive field state, validation state, normalized payload,
 * and field mutation helpers.
 */
export function useAccountOwnerForm() {
  const values = reactive({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const touched = reactive(Object.fromEntries(FIELD_NAMES.map((field) => [field, false])));
  const submitted = ref(false);
  const validationValues = computed(() => ({
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    password: values.password,
  }));
  const v$ = useVuelidate(validationRules, validationValues);

  const errors = computed(() =>
    Object.fromEntries(
      FIELD_NAMES.map((field) => [field, v$.value[field].$silentErrors[0]?.$message?.toString() ?? '']),
    ),
  );
  const isValid = computed(() => !v$.value.$invalid);
  const payload = computed(() => ({
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    password: values.password,
  }));

  function setValues(nextValues = {}) {
    values.firstName = nextValues.firstName ?? '';
    values.lastName = nextValues.lastName ?? '';
    values.email = nextValues.email ?? '';
    values.password = nextValues.password ?? '';
  }

  function setField(field, value) {
    if (FIELD_NAMES.includes(field)) values[field] = value ?? '';
  }

  function touch(field) {
    if (FIELD_NAMES.includes(field)) {
      touched[field] = true;
      v$.value[field].$touch();
    }
  }

  function validate() {
    submitted.value = true;
    v$.value.$touch();
    FIELD_NAMES.forEach((field) => {
      touched[field] = true;
    });
    return isValid.value;
  }

  return { values, touched, submitted, errors, isValid, payload, setValues, setField, touch, validate };
}

export default useAccountOwnerForm;
