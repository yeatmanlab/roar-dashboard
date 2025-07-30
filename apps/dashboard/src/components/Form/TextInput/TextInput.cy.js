import TextInput from './TextInput.vue';

describe('<TextInput />', () => {
  it('Renders the input with default attributes', () => {
    cy.mount(TextInput);
    cy.findByTestId('textinput__input-wrapper').get('input').should('exist');
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.attr', 'type', 'text');
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.attr', 'placeholder', '');
    cy.findByTestId('textinput__input-wrapper').get('input').should('not.be.disabled');
  });

  it('Renders the input with pre-defined model value', () => {
    cy.mount(TextInput, { props: { modelValue: 'mock-default-value' } });
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.value', 'mock-default-value');
  });

  it('Renders typed value', () => {
    cy.mount(TextInput);
    cy.findByTestId('textinput__input-wrapper').get('input').type('Hello there');
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.value', 'Hello there');
  });

  it('Renders the label', () => {
    cy.mount(TextInput, { props: { label: 'Name' } });
    cy.findByTestId('textinput__label').should('contain.text', 'Name');
  });

  it('Hides the label when labelHidden prop is true', () => {
    cy.mount(TextInput, { props: { label: 'Name', labelHidden: true } });
    cy.findByTestId('textinput__label').should('have.class', 'sr-only');
  });

  it('Renders the required asterisk when required prop is true', () => {
    cy.mount(TextInput, { props: { label: 'Name', required: true } });
    cy.findByTestId('textinput__label').should('contain.text', '*');
  });

  it('Hides the required asterisk when required prop is false', () => {
    cy.mount(TextInput, { props: { label: 'Name', required: false } });
    cy.findByTestId('textinput__label').should('not.contain.text', '*');
  });

  it('Renders the placeholder text', () => {
    cy.mount(TextInput, { props: { placeholder: 'Enter your name' } });
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.attr', 'placeholder', 'Enter your name');
  });

  it('Sets the input type', () => {
    cy.mount(TextInput, { props: { type: 'url' } });
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.attr', 'type', 'url');
  });

  it('Applies the invalid class when isInvalid is true', () => {
    cy.mount(TextInput, { props: { isInvalid: true } });
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.class', 'p-invalid');
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.class', 'border-red-500');
  });

  it('Applies the invalid class when errors exist', () => {
    cy.mount(TextInput, { props: { errors: [{ $message: 'Error message' }] } });
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.class', 'p-invalid');
    cy.findByTestId('textinput__input-wrapper').get('input').should('have.class', 'border-red-500');
  });

  it('Renders error messages', () => {
    cy.mount(TextInput, { props: { errors: [{ $message: 'Error 1' }, { $message: 'Error 2' }] } });
    cy.findAllByTestId('textinput__error-item').should('have.length', 2);
    cy.findAllByTestId('textinput__error-item').eq(0).should('contain.text', 'Error 1');
    cy.findAllByTestId('textinput__error-item').eq(1).should('contain.text', 'Error 2');
  });

  it('Disables the input when disabled is true', () => {
    cy.mount(TextInput, { props: { disabled: true } });
    cy.findByTestId('textinput__input-wrapper').get('input').should('be.disabled');
  });
});
