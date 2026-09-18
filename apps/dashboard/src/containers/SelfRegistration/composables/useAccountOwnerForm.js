import { computed, reactive, ref } from 'vue';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_NAMES = ['firstName', 'lastName', 'email', 'password'];

/**
 * Owns account-owner values and the normalized account-creation payload.
 * Presentation components update this state through the exposed field API and
 * never receive account-service dependencies.
 *
 * @returns {Object} Reactive field state, validation state, normalized payload,
 * and field mutation helpers.
 */
export function useAccountOwnerForm(options = {}) {
  const t = options.t ?? ((_key, fallback) => fallback);
  const values = reactive({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const touched = reactive(Object.fromEntries(FIELD_NAMES.map((field) => [field, false])));
  const submitted = ref(false);

  const errors = computed(() => {
    const email = values.email.trim();

    return {
      firstName: values.firstName.trim() ? '' : t('pageRegister.errors.firstName', 'Enter your first name.'),
      lastName: values.lastName.trim() ? '' : t('pageRegister.errors.lastName', 'Enter your last name.'),
      email: !email
        ? t('pageRegister.errors.emailRequired', 'Enter your email address.')
        : EMAIL_PATTERN.test(email)
          ? ''
          : t('pageRegister.errors.emailInvalid', 'Enter a valid email address, such as you@example.com.'),
      password: !values.password
        ? t('pageRegister.errors.passwordRequired', 'Create a password.')
        : values.password.length >= 8
          ? ''
          : t('pageRegister.errors.passwordLength', 'Use at least 8 characters for your password.'),
    };
  });
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
