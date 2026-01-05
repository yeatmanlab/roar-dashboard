import { it, describe, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { AppMessageState, MESSAGE_STATE_TYPES } from '.';

describe('AppMessageState', () => {
  it('renders the empty type (default)', () => {
    const wrapper = mount(AppMessageState, {
      props: {
        title: 'No items found',
      },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });

  it('renders the error type', () => {
    const wrapper = mount(AppMessageState, {
      props: {
        title: 'Something went wrong',
        type: MESSAGE_STATE_TYPES.ERROR,
      },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });

  it('renders with a message', () => {
    const wrapper = mount(AppMessageState, {
      props: {
        title: 'Unable to load data',
        message: 'Please try again later.',
        type: MESSAGE_STATE_TYPES.ERROR,
      },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });

  it('renders with actions slot', () => {
    const wrapper = mount(AppMessageState, {
      props: {
        title: 'Session expired',
        message: 'Your session has expired.',
        type: MESSAGE_STATE_TYPES.ERROR,
      },
      slots: {
        actions: '<button>Sign In</button>',
      },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });
});
