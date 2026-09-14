import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: { firstName: 'Pat', lastName: 'Guardian', email: 'parent@example.com', password: 'password1' },
  errors: { value: { firstName: '', lastName: '', email: '', password: '' } },
  touched: { firstName: false, lastName: false, email: false, password: false },
  submitted: { value: false },
  setField: vi.fn(),
  touch: vi.fn(),
  validate: vi.fn(() => true),
  payload: {
    value: { firstName: 'Pat', lastName: 'Guardian', email: 'parent@example.com', password: 'password1' },
  },
  setLegalAccepted: vi.fn(),
  setFutureContactAllowed: vi.fn(),
  legalAccepted: { value: true },
  futureContactAllowed: { value: false },
  submit: vi.fn().mockResolvedValue(true),
  dismissStatus: vi.fn(),
  setVerificationToken: vi.fn(),
  isSubmitting: { value: false },
  errorMessage: { value: '' },
  isSuccess: { value: false },
  verificationToken: { value: 'verified' },
}));

vi.mock('vue-recaptcha', () => ({
  ChallengeV3: { name: 'ChallengeV3', template: '<div><slot /></div>' },
}));

vi.mock('./composables/useAccountOwnerForm', () => ({
  useAccountOwnerForm: () => ({
    values: mocks.values,
    errors: mocks.errors,
    touched: mocks.touched,
    submitted: mocks.submitted,
    setField: mocks.setField,
    touch: mocks.touch,
    validate: mocks.validate,
    payload: mocks.payload,
  }),
}));

vi.mock('./composables/useResearchConsent', () => ({
  useResearchConsent: () => ({
    setLegalAccepted: mocks.setLegalAccepted,
    setFutureContactAllowed: mocks.setFutureContactAllowed,
    legalAccepted: mocks.legalAccepted,
    futureContactAllowed: mocks.futureContactAllowed,
  }),
}));

vi.mock('./composables/useSelfRegistration', () => ({
  useSelfRegistration: () => ({
    submit: mocks.submit,
    dismissStatus: mocks.dismissStatus,
    setVerificationToken: mocks.setVerificationToken,
    isSubmitting: mocks.isSubmitting,
    errorMessage: mocks.errorMessage,
    isSuccess: mocks.isSuccess,
    verificationToken: mocks.verificationToken,
  }),
}));

import SelfRegistration from './SelfRegistration.vue';
import AccountOwnerForm from './components/AccountOwnerForm.vue';

function mountSelfRegistration() {
  return mount(SelfRegistration, {
    global: {
      stubs: {
        ROARLogoShort: true,
        RegistrationStatus: true,
        AccountOwnerForm: {
          name: 'AccountOwnerForm',
          emits: [
            'submit',
            'touch',
            'update:field',
            'update:legal-accepted',
            'update:future-contact-allowed',
            'verification',
          ],
          template: '<button data-testid="account-owner-form" @click="$emit(\'submit\')">Submit</button>',
        },
      },
    },
  });
}

describe('SelfRegistration.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockReturnValue(true);
    mocks.legalAccepted.value = true;
    mocks.verificationToken.value = 'verified';
    mocks.isSubmitting.value = false;
    mocks.errorMessage.value = '';
    mocks.isSuccess.value = false;
  });

  afterEach(() => document.body.classList.remove('page-register'));

  it('defines the route-level Vue component contract', () => {
    expect(SelfRegistration).toBeDefined();
    expect(SelfRegistration.setup).toBeTypeOf('function');
    expect(SelfRegistration.__file).toContain('SelfRegistration.vue');
  });

  it('connects presentation events to form, consent, and workflow owners', async () => {
    const wrapper = mountSelfRegistration();

    expect(document.body.classList.contains('page-register')).toBe(true);
    const accountOwnerForm = wrapper.findComponent({ name: 'AccountOwnerForm' });
    accountOwnerForm.vm.$emit('update:field', 'firstName', 'Taylor');
    accountOwnerForm.vm.$emit('touch', 'firstName');
    accountOwnerForm.vm.$emit('update:legal-accepted', true);
    accountOwnerForm.vm.$emit('update:future-contact-allowed', false);
    accountOwnerForm.vm.$emit('verification', 'new-token');
    await wrapper.get('[data-testid="account-owner-form"]').trigger('click');
    await flushPromises();

    expect(mocks.setField).toHaveBeenCalledWith('firstName', 'Taylor');
    expect(mocks.touch).toHaveBeenCalledWith('firstName');
    expect(mocks.setLegalAccepted).toHaveBeenCalledWith(true);
    expect(mocks.setFutureContactAllowed).toHaveBeenCalledWith(false);
    expect(mocks.setVerificationToken).toHaveBeenCalledWith('new-token');
    expect(mocks.submit).toHaveBeenCalledWith(mocks.payload.value);

    wrapper.unmount();
    expect(document.body.classList.contains('page-register')).toBe(false);
  });

  it('does not start registration when form validation fails', async () => {
    mocks.validate.mockReturnValue(false);
    const wrapper = mountSelfRegistration();

    await wrapper.get('[data-testid="account-owner-form"]').trigger('click');
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not start registration before required submission prerequisites are ready', async () => {
    mocks.legalAccepted.value = false;
    const wrapper = mountSelfRegistration();

    wrapper.findComponent({ name: 'AccountOwnerForm' }).vm.$emit('submit');
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

describe('AccountOwnerForm.vue', () => {
  it('renders the new controlled account fields and emits submit', async () => {
    const wrapper = mount(AccountOwnerForm, {
      props: {
        values: { firstName: '', lastName: '', email: '', password: '' },
        errors: { firstName: '', lastName: '', email: '', password: '' },
        touched: { firstName: false, lastName: false, email: false, password: false },
      },
      global: {
        stubs: {
          ChallengeV3: { template: '<div><slot /></div>' },
          PvInputText: true,
          PvPassword: true,
          PvCheckbox: true,
          PvButton: { props: ['label'], template: '<button>{{ label }}</button>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('First name');
    expect(wrapper.text()).toContain('Last name');
    expect(wrapper.text()).toContain('Email address');
    expect(wrapper.text()).toContain('Password');
    expect(wrapper.text()).toContain('Create account');
    expect(wrapper.text()).toContain('Sign in');

    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });
});
