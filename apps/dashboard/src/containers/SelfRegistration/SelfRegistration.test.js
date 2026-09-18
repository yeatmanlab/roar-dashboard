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
  consentDocument: { value: { id: 'consent-v1', version: 'v1', text: 'Approved consent' } },
  consentLoading: { value: false },
  consentLoadError: { value: null },
  consentModalOpen: { value: false },
  futureContactAllowed: { value: false },
  submit: vi.fn().mockResolvedValue(true),
  dismissError: vi.fn(),
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
    dismissError: mocks.dismissError,
    setVerificationToken: mocks.setVerificationToken,
    isSubmitting: mocks.isSubmitting,
    errorMessage: mocks.errorMessage,
    isSuccess: mocks.isSuccess,
    verificationToken: mocks.verificationToken,
  }),
}));

import SelfRegistration from './SelfRegistration.vue';
function mountSelfRegistration() {
  return mount(SelfRegistration, {
    global: {
      stubs: {
        AuthPageFooter: true,
        ROARLogoShort: true,
        Button: {
          name: 'Button',
          props: ['label'],
          template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
        },
        Dialog: {
          name: 'Dialog',
          props: ['visible'],
          emits: ['update:visible'],
          template: '<div v-if="visible" data-testid="registration-error"><slot /></div>',
        },
        RegistrationSuccess: {
          name: 'RegistrationSuccess',
          props: ['firstName'],
          template: '<div id="self-registration-success-heading">{{ firstName }}</div>',
        },
        ConsentModal: {
          name: 'ConsentModal',
          props: ['visible'],
          emits: ['cancel', 'confirm', 'retry'],
          template: '<div data-testid="consent-modal" />',
        },
        AccountOwnerForm: {
          name: 'AccountOwnerForm',
          props: ['disabled', 'submitting'],
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
    mocks.acceptResearchConsent.mockReturnValue(true);
    mocks.legalAccepted.value = true;
    mocks.researchConsentAccepted.value = true;
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

  it('connects presentation events to form, consent, and workflow owners', async () => {
    const wrapper = mountSelfRegistration();

    expect(document.body.classList.contains('page-register')).toBe(true);
    const accountOwnerForm = wrapper.findComponent({ name: 'AccountOwnerForm' });
    accountOwnerForm.vm.$emit('update:field', 'firstName', 'Taylor');
    accountOwnerForm.vm.$emit('touch', 'firstName');
    accountOwnerForm.vm.$emit('update:future-contact-allowed', false);
    accountOwnerForm.vm.$emit('verification', 'new-token');
    await wrapper.get('[data-testid="account-owner-form"]').trigger('click');
    await flushPromises();

    expect(mocks.setField).toHaveBeenCalledWith('firstName', 'Taylor');
    expect(mocks.touch).toHaveBeenCalledWith('firstName');
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

  it('opens research consent without checking legal acceptance prematurely', async () => {
    mocks.legalAccepted.value = false;
    mocks.researchConsentAccepted.value = false;
    mocks.consentDocument.value = null;
    const wrapper = mountSelfRegistration();
    const accountOwnerForm = wrapper.findComponent({ name: 'AccountOwnerForm' });

    accountOwnerForm.vm.$emit('update:legal-accepted', true);
    await flushPromises();

    expect(mocks.setLegalAccepted).not.toHaveBeenCalled();
    expect(mocks.openConsentModal).toHaveBeenCalledOnce();
    expect(mocks.acceptResearchConsent).not.toHaveBeenCalled();
    expect(mocks.loadConsent).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('checks legal acceptance only when Continue confirms the loaded consent', () => {
    mocks.legalAccepted.value = false;
    mocks.researchConsentAccepted.value = false;
    const wrapper = mountSelfRegistration();
    const consentModal = wrapper.findComponent({ name: 'ConsentModal' });

    consentModal.vm.$emit('cancel');
    expect(mocks.closeConsentModal).toHaveBeenCalledOnce();
    expect(mocks.setLegalAccepted).not.toHaveBeenCalled();
    expect(mocks.acceptResearchConsent).not.toHaveBeenCalled();

    consentModal.vm.$emit('confirm');
    expect(mocks.acceptResearchConsent).toHaveBeenCalledOnce();
    expect(mocks.setLegalAccepted).toHaveBeenCalledWith(true);
    wrapper.unmount();
  });

  it('keeps the form mounted and disabled while submitting, then shows the explicit success state', () => {
    mocks.isSubmitting.value = true;
    const submittingWrapper = mountSelfRegistration();

    expect(submittingWrapper.get('#self-registration-heading').text()).toBe('Create your account');
    expect(submittingWrapper.get('#register').attributes('aria-labelledby')).toBe('self-registration-heading');
    expect(submittingWrapper.findComponent({ name: 'AccountOwnerForm' }).exists()).toBe(true);
    expect(submittingWrapper.findComponent({ name: 'AccountOwnerForm' }).props()).toMatchObject({
      disabled: true,
      submitting: true,
    });
    submittingWrapper.unmount();

    mocks.isSubmitting.value = false;
    mocks.isSuccess.value = true;
    const successWrapper = mountSelfRegistration();

    expect(successWrapper.find('#self-registration-heading').exists()).toBe(false);
    expect(successWrapper.get('#register').attributes('aria-labelledby')).toBe('self-registration-success-heading');
    expect(successWrapper.findComponent({ name: 'AccountOwnerForm' }).exists()).toBe(false);
    expect(successWrapper.findComponent({ name: 'RegistrationSuccess' }).props('firstName')).toBe('Pat');

    successWrapper.unmount();
  });

  it('does not block submission when the verification token is unavailable', async () => {
    mocks.verificationToken.value = '';
    const wrapper = mountSelfRegistration();

    expect(wrapper.findComponent({ name: 'AccountOwnerForm' }).props('disabled')).toBe(false);
    wrapper.findComponent({ name: 'AccountOwnerForm' }).vm.$emit('submit');
    await flushPromises();

    expect(mocks.submit).toHaveBeenCalledWith(mocks.payload.value);
    wrapper.unmount();
  });

  it('keeps submission available so an unchecked legal acknowledgement can show its error', async () => {
    mocks.legalAccepted.value = false;
    const wrapper = mountSelfRegistration();

    expect(wrapper.findComponent({ name: 'AccountOwnerForm' }).props('disabled')).toBe(false);
    wrapper.findComponent({ name: 'AccountOwnerForm' }).vm.$emit('submit');
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('keeps the form visible while presenting and dismissing a registration error', async () => {
    mocks.errorMessage.value = 'Unable to create an account.';
    const wrapper = mountSelfRegistration();

    expect(wrapper.findComponent({ name: 'AccountOwnerForm' }).exists()).toBe(true);
    expect(wrapper.get('[data-testid="registration-error"]').text()).toContain('Unable to create an account.');

    await wrapper.get('[data-testid="registration-error"] button').trigger('click');
    expect(mocks.dismissError).toHaveBeenCalled();
    wrapper.unmount();
  });
});
