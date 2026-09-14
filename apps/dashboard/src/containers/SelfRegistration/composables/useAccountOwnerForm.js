import { computed, reactive, ref } from 'vue';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_NAMES = ['firstName', 'lastName', 'email', 'password'];

/**
 * Owns account-owner values and the normalized account-creation payload.
 * Presentation components update this state through the exposed field API and
 * never receive account-service dependencies.
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

  const errors = computed(() => ({
    firstName: values.firstName.trim() ? '' : 'Enter your first name.',
    lastName: values.lastName.trim() ? '' : 'Enter your last name.',
    email: EMAIL_PATTERN.test(values.email.trim()) ? '' : 'Enter a complete email address.',
    password: values.password.length >= 8 ? '' : 'Use at least 8 characters for your password.',
  }));
  const isValid = computed(() => FIELD_NAMES.every((field) => !errors.value[field]));
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
    if (FIELD_NAMES.includes(field)) touched[field] = true;
  }

  function validate() {
    submitted.value = true;
    FIELD_NAMES.forEach(touch);
    return isValid.value;
  }

  return { values, touched, submitted, errors, isValid, payload, setValues, setField, touch, validate };
}

export default useAccountOwnerForm;
