import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import AddUsers from '../../pages/LEVANTE/addUsers.vue';

describe('Add Users Page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render the add users page', () => {
    const wrapper = mount(AddUsers, {
      global: {
        plugins: [PrimeVue, ToastService]
      }
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
