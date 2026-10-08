import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLegalDoc: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ getLegalDoc: mocks.getLegalDoc }),
}));

vi.mock('vue-recaptcha', () => ({
  ChallengeV3: { name: 'ChallengeV3', template: '<div><slot /></div>' },
}));

vi.mock('./composables/useSelfRegistration', () => ({
  useSelfRegistration: () => ({
    submit: mocks.submit,
    dismissStatus: vi.fn(),
    setVerificationToken: vi.fn(),
    isSubmitting: { value: false },
    errorMessage: { value: '' },
    isSuccess: { value: false },
    verificationToken: { value: 'verified' },
  }),
}));

import SelfRegistration from './SelfRegistration.vue';

const ConsentModalStub = {
  name: 'ConsentModal',
  props: ['visible', 'document', 'loading', 'loadFailed'],
  emits: ['cancel', 'confirm', 'retry'],
  template: `
    <section v-if="visible" data-testid="consent-modal">
      <p v-if="loading" role="status">Loading</p>
      <div v-else-if="loadFailed" role="alert">
        Consent unavailable
        <button data-testid="retry-consent" type="button" @click="$emit('retry')">Retry</button>
      </div>
      <p v-else data-testid="consent-document">{{ document?.text }}</p>
      <button data-testid="cancel-consent" type="button" @click="$emit('cancel')">Cancel</button>
      <button
        data-testid="confirm-consent"
        type="button"
        :disabled="loading || loadFailed || !document?.text"
        @click="$emit('confirm')"
      >
        Continue
      </button>
    </section>
  `,
};

function mountRegistration() {
  return mount(SelfRegistration, {
    attachTo: document.body,
    global: {
      stubs: {
        AuthPageFooter: true,
        ConsentModal: ConsentModalStub,
        ROARLogoShort: true,
        RegistrationStatus: true,
        RegistrationSuccess: true,
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  });
}

async function enterValidOwner(wrapper) {
  await wrapper.get('#account-owner-first-name').setValue('Emily');
  await wrapper.get('#account-owner-last-name').setValue('Guardian');
  await wrapper.get('#account-owner-email').setValue('emily@example.com');
  await wrapper.get('#account-owner-password').setValue('password1');
}

describe('SelfRegistration consent integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLegalDoc.mockResolvedValue({
      id: 'consent-behavioral-eye-tracking',
      version: '2026-09',
      text: 'Approved research consent',
    });
    mocks.submit.mockResolvedValue(true);
    document.body.classList.remove('page-register');
  });

  it('preserves owner data and blocks submission when consent is canceled', async () => {
    const wrapper = mountRegistration();
    await enterValidOwner(wrapper);

    await wrapper.get('[name="legalAcceptance"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="cancel-consent"]').trigger('click');

    expect(wrapper.find('[data-testid="consent-modal"]').exists()).toBe(false);
    expect(wrapper.get('[name="legalAcceptance"]').element.checked).toBe(false);
    expect(wrapper.get('#account-owner-first-name').element.value).toBe('Emily');
    expect(wrapper.get('#account-owner-last-name').element.value).toBe('Guardian');
    expect(wrapper.get('#account-owner-email').element.value).toBe('emily@example.com');
    expect(wrapper.get('#account-owner-password').element.value).toBe('password1');

    await wrapper.get('form').trigger('submit');
    expect(mocks.submit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('submits once after explicit consent while optional future contact remains unchecked', async () => {
    const wrapper = mountRegistration();
    await enterValidOwner(wrapper);

    expect(wrapper.get('[name="futureContact"]').element.checked).toBe(false);
    await wrapper.get('[name="legalAcceptance"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="confirm-consent"]').trigger('click');

    expect(wrapper.get('[name="legalAcceptance"]').element.checked).toBe(true);
    expect(wrapper.get('[name="futureContact"]').element.checked).toBe(false);

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({
      firstName: 'Emily',
      lastName: 'Guardian',
      email: 'emily@example.com',
      password: 'password1',
    });
    wrapper.unmount();
  });

  it('recovers from a consent-loading failure without recording acceptance', async () => {
    mocks.getLegalDoc.mockRejectedValueOnce(new Error('Consent service unavailable'));
    const wrapper = mountRegistration();

    await wrapper.get('[name="legalAcceptance"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Consent unavailable');
    expect(wrapper.get('[data-testid="confirm-consent"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[name="legalAcceptance"]').element.checked).toBe(false);

    await wrapper.get('[data-testid="retry-consent"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="consent-document"]').text()).toBe('Approved research consent');
    expect(wrapper.get('[name="legalAcceptance"]').element.checked).toBe(false);

    await wrapper.get('[data-testid="confirm-consent"]').trigger('click');
    expect(wrapper.get('[name="legalAcceptance"]').element.checked).toBe(true);
    wrapper.unmount();
  });
});
