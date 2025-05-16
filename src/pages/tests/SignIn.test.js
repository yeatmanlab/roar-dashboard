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

    const authSpy = vi.spyOn(wrapper.vm, 'authWithEmail');

    const innerSignIn = wrapper.findComponent({ name: 'SignIn' });
    await innerSignIn.vm.$emit('submit', {
      email: 'test@example.com',
      password: 'password123'
    });

    expect(authSpy).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });

    // expect(wrapper.vm.isLevante).toBe(true);
    
    // // Find the PrimeVue input components
    // const inputs = wrapper.findAll('input');
    // await inputs[0].setValue('test@example.com');
    // await inputs[1].setValue('password123');

    // // Find and click the Go button
    // const submitButton = wrapper.find('[data-cy="submit-sign-in-with-password"]');
    // console.log('Submit button found:', submitButton.exists());
    // console.log('Submit button HTML:', submitButton.html());
    
    // expect(submitButton.exists()).toBe(true);
    
    // // Find the form
    // const form = wrapper.find('form');
    // console.log('Form found:', form.exists());
    // console.log('Form HTML:', form.html());

    // await form.trigger('submit');
    // expect(wrapper.emitted('submit')).toBeTruthy();

    
    // // Wait for the next tick to allow async operations to complete
    // await nextTick();
    // console.log('After nextTick');

    // Verify auth store was called with correct credentials
    // expect(authStore.logInWithEmailAndPassword).toHaveBeenCalledWith({
    //   email: 'test@example.com',
    //   password: 'password123'
    // });

    // Verify fetchDocById was called with correct parameters
    // expect(fetchDocById).toHaveBeenCalledWith('userClaims', expect.any(String));
    // expect(fetchDocById).toHaveBeenCalledWith('users', expect.any(String));
  });

//     // Click the email link sign in option
//     const emailLinkButton = wrapper.find('[data-cy="sign-in-with-email-link"]');
//     await emailLinkButton.trigger('click');

//     const emailInput = wrapper.find('[data-cy="input-username-email"]');
//     await emailInput.setValue('test@example.com');

//     const form = wrapper.find('form');
//     await form.trigger('submit');

//     expect(authStore.initiateLoginWithEmailLink).toHaveBeenCalledWith({
//       email: 'test@example.com'
//     });
//     expect(router.push).toHaveBeenCalledWith({ name: 'AuthEmailSent' });
//   });

//   it('shows error message for invalid credentials', async () => {
//     authStore.logInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

//     wrapper = mount(SignIn, {
//       global: {
//         plugins: [VueQuery.VueQueryPlugin, PrimeVue],
//         stubs: {
//           'router-link': true,
//           'PvImage': true,
//           'LanguageSelector': true
//         }
//       }
//     });

//     await nextTick();

//     const emailInput = wrapper.find('[data-cy="input-username-email"]');
//     const passwordInput = wrapper.find('[data-cy="input-password"]');

//     await emailInput.setValue('test@example.com');
//     await passwordInput.setValue('wrongpassword');

//     const form = wrapper.find('form');
//     await form.trigger('submit');

//     expect(wrapper.find('.p-error').exists()).toBe(true);
//   });

//   it('handles Google sign in', async () => {
//     const mockUserClaims = { id: 'test-claims' };
//     const mockUserData = { id: 'test-user' };
    
//     authStore.signInWithGooglePopup.mockResolvedValue();
//     fetchDocById.mockImplementation((collection, id) => {
//       if (collection === 'userClaims') return mockUserClaims;
//       if (collection === 'users') return mockUserData;
//     });

//     wrapper = mount(SignIn, {
//       global: {
//         plugins: [VueQuery.VueQueryPlugin, PrimeVue],
//         stubs: {
//           'router-link': true,
//           'PvImage': true,
//           'LanguageSelector': true
//         }
//       }
//     });

//     await nextTick();

//     const googleButton = wrapper.find('button:contains("Sign in with Google")');
//     await googleButton.trigger('click');

//     expect(authStore.signInWithGooglePopup).toHaveBeenCalled();
//     expect(fetchDocById).toHaveBeenCalledWith('userClaims', expect.any(String));
//     expect(fetchDocById).toHaveBeenCalledWith('users', expect.any(String));
//   });
});
