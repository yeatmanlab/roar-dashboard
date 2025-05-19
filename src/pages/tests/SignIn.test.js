import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import * as VueQuery from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import SignIn from '@/pages/SignIn.vue';
import PrimeVue from 'primevue/config';
import { useAuthStore } from '@/store/auth';

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: vi.fn()
}));

describe('SignIn', () => {
  let wrapper;
  let authStore;

  const i18n = createI18n({
    legacy: false,           
    globalInjection: true, 
    locale: 'en',
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    
    vi.mock('@/store/auth', () => ({
      useAuthStore: vi.fn(() => ({
        $subscribe: vi.fn(),
        logInWithEmailAndPassword: vi.fn().mockResolvedValue(),
        roarfirekit: ref({
          restConfig: true
        })
      }))
    }));

    vi.mock('vue-router', () => ({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn()
      })
    }));

    // Mock AudioContext
    vi.mock('@/helpers/audio', () => ({
      AudioContext: vi.fn().mockImplementation(() => ({
        createBufferSource: vi.fn(),
        decodeAudioData: vi.fn(),
        destination: {}
      })),
      BufferLoader: vi.fn()
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders sign in form with email and password fields', async () => {
    wrapper = mount(SignIn, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue, i18n],
        components: {
          'AppSpinner': { template: '<div></div>' },
        }
      }
    });

    await nextTick();

    expect(wrapper.find('[data-cy="input-username-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-cy="input-password"]').exists()).toBe(true);
    expect(wrapper.find('[data-cy="sign-in-with-email-link"]').exists()).toBe(true);
  });

  it('handles email/password sign in successfully', async () => {
    authStore = useAuthStore();

    wrapper = mount(SignIn, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue, i18n],
        components: {
          'AppSpinner': { template: '<div></div>' },
        }
      }
    });

    await nextTick();

    expect(wrapper.vm.isLevante).toBe(true);


    const authSpy = vi.spyOn(wrapper.vm, 'authWithEmail');

    // User inputs email and password 
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('test@example.com');
    await inputs[1].setValue('password123');

    // // Find and click the Go button
    const submitButton = wrapper.find('[data-cy="submit-sign-in-with-password"]');
    console.log('Submit button found:', submitButton.exists());
    console.log('Submit button HTML:', submitButton.html());
    
    expect(submitButton.exists()).toBe(true);
    
    // submit form either with user clicking button 
    await submitButton.trigger('click');


    // Find the form as an alternative way to submit

    // const form = wrapper.find('form');
    // console.log('Form found:', form.exists());
    // console.log('Form HTML:', form.html());

    //programatically submitting the form
    // await form.trigger('submit.prevent');

    // verify authWithEmail was called with correct credentials
    expect(authSpy).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });


    // Verify auth store was called with correct credentials
    expect(authStore.logInWithEmailAndPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });


  });

  it('shows error message for invalid username or password', async () => {

  });

  it('handles google sign in successfully', async () => {

  });

  it('errors out on google sign in when approriate', async () => {

  });
});
