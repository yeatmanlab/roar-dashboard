import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AddUsers from '../../pages/LEVANTE/addUsers.vue';

describe('Add Users Page', () => {
  it('should render the add users page', () => {
    const wrapper = mount(AddUsers);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
