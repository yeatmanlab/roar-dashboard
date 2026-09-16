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
  openConsentModal: vi.fn(),
  closeConsentModal: vi.fn(),
  acceptResearchConsent: vi.fn(),
  loadConsent: vi.fn().mockResolvedValue(undefined),
  legalAccepted: { value: true },
  researchConsentAccepted: { value: true },
  requiredAcknowledgementsComplete: { value: true },
  consentDocument: { value: { id: 'consent-v1', version: 'v1', text: 'Approved consent' } },
  consentLoading: { value: false },
  consentLoadError: { value: null },
  consentModalOpen: { value: false },
  futureContactAllowed: { value: false },
  submit: vi.fn().mockResolvedValue(true),
  dismissStatus: vi.fn(),
  setVerificationToken: vi.fn(),
  isSubmitting: { value: false },
  errorMessage: { value: '' },
  isSuccess: { value: false },
  verificationToken: { value: 'verified' },
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ getLegalDoc: vi.fn().mockResolvedValue({ text: 'Approved consent' }) }),
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
    openModal: mocks.openConsentModal,
    closeModal: mocks.closeConsentModal,
    acceptResearchConsent: mocks.acceptResearchConsent,
    loadConsent: mocks.loadConsent,
    legalAccepted: mocks.legalAccepted,
    researchConsentAccepted: mocks.researchConsentAccepted,
    requiredAcknowledgementsComplete: mocks.requiredAcknowledgementsComplete,
    consentDocument: mocks.consentDocument,
    isLoading: mocks.consentLoading,
    loadError: mocks.consentLoadError,
    isModalOpen: mocks.consentModalOpen,
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
        AuthPageFooter: true,
        ROARLogoShort: true,
        RegistrationStatus: true,
        ConsentModal: {
          name: 'ConsentModal',
          props: ['visible'],
          emits: ['cancel', 'confirm', 'retry'],
          template: '<div data-testid="consent-modal" />',
        },
        AccountOwnerForm: {
          name: 'AccountOwnerForm',
          props: ['disabled'],
          emits: [
            'submit',
            'touch',
            'update:field',
            'update:legal-accepted',
            'update:future-contact-allowed',
            'review-research-consent',
            'retry-research-consent',
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
    mocks.researchConsentAccepted.value = true;
    mocks.requiredAcknowledgementsComplete.value = true;
    mocks.consentDocument.value = { id: 'consent-v1', version: 'v1', text: 'Approved consent' };
    mocks.consentLoading.value = false;
    mocks.consentLoadError.value = null;
    mocks.consentModalOpen.value = false;
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
    mocks.requiredAcknowledgementsComplete.value = false;
    const wrapper = mountSelfRegistration();

    wrapper.findComponent({ name: 'AccountOwnerForm' }).vm.$emit('submit');
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('opens the required research consent after legal acceptance without conflating the decisions', async () => {
    mocks.researchConsentAccepted.value = false;
    mocks.requiredAcknowledgementsComplete.value = false;
    mocks.consentDocument.value = null;
    const wrapper = mountSelfRegistration();
    const accountOwnerForm = wrapper.findComponent({ name: 'AccountOwnerForm' });

    accountOwnerForm.vm.$emit('update:legal-accepted', true);
    await flushPromises();

    expect(mocks.setLegalAccepted).toHaveBeenCalledWith(true);
    expect(mocks.openConsentModal).toHaveBeenCalledOnce();
    expect(mocks.acceptResearchConsent).not.toHaveBeenCalled();
    expect(mocks.loadConsent).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('keeps the heading and its accessible relationship while submitting and after success', async () => {
    mocks.isSubmitting.value = true;
    const submittingWrapper = mountSelfRegistration();

    expect(submittingWrapper.get('#self-registration-heading').text()).toBe('Create your account');
    expect(submittingWrapper.get('#register').attributes('aria-labelledby')).toBe('self-registration-heading');
    expect(submittingWrapper.findComponent({ name: 'AccountOwnerForm' }).exists()).toBe(false);
    submittingWrapper.unmount();

    mocks.isSubmitting.value = false;
    mocks.isSuccess.value = true;
    const successWrapper = mountSelfRegistration();

    expect(successWrapper.get('#self-registration-heading').text()).toBe('Create your account');
    expect(successWrapper.get('#register').attributes('aria-labelledby')).toBe('self-registration-heading');
    expect(successWrapper.findComponent({ name: 'AccountOwnerForm' }).exists()).toBe(false);

    successWrapper.unmount();
  });

  it('disables submission until verification is ready but not for an unchecked legal acknowledgement', () => {
    mocks.verificationToken.value = '';
    const pendingVerificationWrapper = mountSelfRegistration();

    expect(pendingVerificationWrapper.findComponent({ name: 'AccountOwnerForm' }).props('disabled')).toBe(true);
    pendingVerificationWrapper.unmount();

    mocks.verificationToken.value = 'verified';
    mocks.legalAccepted.value = false;
    const missingLegalAcceptanceWrapper = mountSelfRegistration();

    expect(missingLegalAcceptanceWrapper.findComponent({ name: 'AccountOwnerForm' }).props('disabled')).toBe(false);

    missingLegalAcceptanceWrapper.unmount();
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
