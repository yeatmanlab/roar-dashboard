import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConsentModal from './ConsentModal.vue';

const PvDialogStub = {
  props: ['visible', 'header'],
  emits: ['update:visible'],
  template: `
    <section v-if="visible" role="dialog" :aria-label="header">
      <button type="button" aria-label="Close" @click="$emit('update:visible', false)">Close</button>
      <slot />
      <footer><slot name="footer" /></footer>
    </section>
  `,
};

function mountModal(props = {}) {
  return mount(ConsentModal, {
    attachTo: document.body,
    props: {
      visible: true,
      document: {
        id: 'consent-behavioral-eye-tracking',
        version: 'v1',
        text: '# STANFORD UNIVERSITY CONSENT FORM\n\nResearch consent body.',
      },
      ...props,
    },
    global: { stubs: { Dialog: PvDialogStub, PvDialog: PvDialogStub } },
  });
}

describe('ConsentModal.vue', () => {
  it('renders the actual loaded document and uses Continue as explicit confirmation', async () => {
    const wrapper = mountModal();
    const continueButton = wrapper.get('.self-registration-consent-primary');

    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Consent');
    expect(wrapper.text()).toContain('STANFORD UNIVERSITY CONSENT FORM');
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(continueButton.attributes('disabled')).toBeUndefined();
    await continueButton.trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    wrapper.unmount();
  });

  it('shows progress and a recoverable loading failure', async () => {
    const loadingWrapper = mountModal({ document: null, loading: true });
    expect(loadingWrapper.get('[role="status"]').text()).toContain('Loading the research consent');
    expect(loadingWrapper.get('.self-registration-consent-primary').attributes('disabled')).toBeDefined();
    loadingWrapper.unmount();

    const errorWrapper = mountModal({ document: null, loadFailed: true });
    expect(errorWrapper.get('[role="alert"]').text()).toContain('could not load');
    await errorWrapper.get('[role="alert"] button').trigger('click');
    expect(errorWrapper.emitted('retry')).toHaveLength(1);
    errorWrapper.unmount();
  });

  it('treats the close control and Cancel as cancellation', async () => {
    const wrapper = mountModal();

    await wrapper.get('[aria-label="Close"]').trigger('click');
    await wrapper.get('.self-registration-consent-secondary').trigger('click');

    expect(wrapper.emitted('cancel')).toHaveLength(2);
    expect(wrapper.emitted('confirm')).toBeUndefined();
    wrapper.unmount();
  });
});
