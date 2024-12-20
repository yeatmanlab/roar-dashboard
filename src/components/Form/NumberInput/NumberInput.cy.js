import NumberInput from './NumberInput.vue';

describe('<NumberInput />', () => {
  it('Renders the input with default attributes', () => {
    cy.mount(NumberInput);
    cy.findByTestId('numberinput__input-wrapper').should('exist');
    cy.findByTestId('numberinput__input-wrapper').get('input').should('have.attr', 'placeholder', '');
    cy.findByTestId('numberinput__input-wrapper').get('input').should('not.be.disabled');
  });

  it('Renders the input with pre-defined model value', () => {
    cy.mount(NumberInput, { props: { modelValue: 1 } });
    cy.findByTestId('numberinput__input-wrapper').get('input').should('have.value', 1);
  });

  it('Renders typed value', () => {
    cy.mount(NumberInput);
    cy.findByTestId('numberinput__input-wrapper').get('input').type(2);
    cy.findByTestId('numberinput__input-wrapper').get('input').should('have.value', 2);
  });

  it('Prevents typing non-numeric characters', () => {
    cy.mount(NumberInput);
    cy.findByTestId('numberinput__input-wrapper').get('input').type('Nope');
    cy.findByTestId('numberinput__input-wrapper').get('input').should('have.value', '');
  });

  it('Renders the label', () => {
    cy.mount(NumberInput, { props: { label: 'Age' } });
    cy.get('label').should('contain.text', 'Age');
  });

  it('Hides the label when labelHidden prop is true', () => {
    cy.mount(NumberInput, { props: { label: 'Age', labelHidden: true } });
    cy.get('label').should('have.class', 'sr-only');
  });

  it('Renders the required asterisk when required prop is true', () => {
    cy.mount(NumberInput, { props: { label: 'Age', required: true } });
    cy.get('label span').should('contain.text', '*');
  });

  it('Hides the required asterisk when required prop is false', () => {
    cy.mount(NumberInput, { props: { label: 'Age', required: false } });
    cy.get('label span').should('not.exist');
  });

  it('Renders the placeholder text', () => {
    cy.mount(NumberInput, { props: { placeholder: 'Enter your age' } });
    cy.findByTestId('numberinput__input-wrapper').get('input').should('have.attr', 'placeholder', 'Enter your age');
  });

  it('Applies the invalid class when isInvalid is true', () => {
    cy.mount(NumberInput, { props: { isInvalid: true } });
    cy.findByTestId('numberinput__input-wrapper').should('have.class', 'p-invalid');
    cy.findByTestId('numberinput__input-wrapper').should('have.class', 'border-red-500');
  });

  it('Applies the invalid class when errors exist', () => {
    cy.mount(NumberInput, { props: { errors: [{ $message: 'Error message' }] } });
    cy.findByTestId('numberinput__input-wrapper').should('have.class', 'p-invalid');
    cy.findByTestId('numberinput__input-wrapper').should('have.class', 'border-red-500');
  });

  it('Renders error messages', () => {
    cy.mount(NumberInput, { props: { errors: [{ $message: 'Error 1' }, { $message: 'Error 2' }] } });
    cy.findAllByTestId('numberinput__error-item').should('have.length', 2);
    cy.findAllByTestId('numberinput__error-item').eq(0).should('contain.text', 'Error 1');
    cy.findAllByTestId('numberinput__error-item').eq(1).should('contain.text', 'Error 2');
  });

  it('Disables the input when disabled is true', () => {
    cy.mount(NumberInput, { props: { disabled: true } });
    cy.findByTestId('numberinput__input-wrapper').get('input').should('be.disabled');
  });
});
