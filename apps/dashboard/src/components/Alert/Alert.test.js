import { it, describe, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Alert, AlertTitle, AlertDescription, ALERT_VARIANTS } from '.';

describe('Alert Component', () => {
  it('renders the default variant', () => {
    const renderedComponent = mount(Alert, {
      slots: {
        default: [
          mount(AlertTitle, {
            slots: {
              default: 'Error Alert',
            },
          }),
          mount(AlertDescription, {
            slots: {
              default: "Whoops, well that wasn't great, now was it?",
            },
          }),
        ],
      },
    });

    expect(renderedComponent.html()).toMatchSnapshot();
  });

  it('renders the error variant', () => {
    const renderedComponent = mount(Alert, {
      props: {
        variant: ALERT_VARIANTS.DESTRUCTIVE,
      },
      slots: {
        default: [
          mount(AlertTitle, {
            slots: {
              default: 'Error Alert',
            },
          }),
          mount(AlertDescription, {
            slots: {
              default: "Whoops, well that wasn't great, now was it?",
            },
          }),
        ],
      },
    });

    expect(renderedComponent.html()).toMatchSnapshot();
  });
});
