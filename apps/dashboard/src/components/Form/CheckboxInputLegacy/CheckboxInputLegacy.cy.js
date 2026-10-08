import CheckboxInputLegacy from './CheckboxInputLegacy.vue';

describe('<CheckboxInputLegacy />', () => {
  it('Renders the label', () => {
    cy.mount(CheckboxInputLegacy, { props: { label: 'Accept Terms' } });
    cy.findByTestId('checkboxinput__label').should('contain.text', 'Accept Terms');
  });

  it('Renders the label from the default slot', () => {
    cy.mount(CheckboxInputLegacy, {
      slots: {
        default: 'Accept Terms and Conditions',
      },
    });
    cy.findByTestId('checkboxinput__label').should('contain.text', 'Accept Terms and Conditions');
  });

  it('Renders the checkbox', () => {
    cy.mount(CheckboxInputLegacy, { props: { label: 'Accept Terms' } });
    cy.findByTestId('checkboxinput').should('exist');
  });

  it('Checks the checkbox when modelValue is true', () => {
    cy.mount(CheckboxInputLegacy, { props: { label: 'Accept Terms', modelValue: true } });
    cy.findByTestId('checkboxinput__input-wrapper').get('input').should('have.attr', 'checked', 'checked');
  });

  it('Unchecks the checkbox when modelValue is false', () => {
    cy.mount(CheckboxInputLegacy, { props: { label: 'Accept Terms', modelValue: false } });
    cy.findByTestId('checkboxinput__input-wrapper').get('input').should('not.have.attr', 'checked');
  });

  it('Toggles the checkbox when clicked', () => {
    cy.mount(CheckboxInputLegacy);
    cy.findByTestId('checkboxinput').should('be.visible').click();
    cy.findByTestId('checkboxinput__input-wrapper').get('input').should('have.attr', 'checked', 'checked');
    cy.findByTestId('checkboxinput').should('be.visible').click();
    cy.findByTestId('checkboxinput__input-wrapper').get('input').should('not.have.attr', 'checked');
  });
});
