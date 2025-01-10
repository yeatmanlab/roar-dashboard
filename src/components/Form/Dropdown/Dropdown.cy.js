import Dropdown from './Dropdown.vue';

describe('<Dropdown />', () => {
  const mockData = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
    { label: 'Option 3', value: 'option3' },
  ];

  it('Renders the dropdown with default attributes', () => {
    cy.mount(Dropdown);
    cy.findByTestId('dropdown__input-wrapper').should('exist');
    cy.findByTestId('dropdown__input-wrapper').should('be.visible').click();
    cy.get('.p-select-empty-message').should('be.visible').and('contain.text', 'No available options');
  });

  it('Renders the label', () => {
    cy.mount(Dropdown, { props: { label: 'Select Option', data: mockData } });
    cy.findByTestId('dropdown__label').should('contain.text', 'Select Option');
  });

  it('Hides the label when labelHidden prop is true', () => {
    cy.mount(Dropdown, { props: { label: 'Select Option', labelHidden: true, data: mockData } });
    cy.findByTestId('dropdown__label').should('have.class', 'sr-only');
  });

  it('Renders the required asterisk when required prop is true', () => {
    cy.mount(Dropdown, { props: { label: 'Select Option', required: true, data: mockData } });
    cy.findByTestId('dropdown__label').should('contain.text', '*');
  });

  it('Hides the required asterisk when required prop is false', () => {
    cy.mount(Dropdown, { props: { label: 'Select Option', required: false, data: mockData } });
    cy.findByTestId('dropdown__label').should('not.contain.text', '*');
  });

  it('Renders the placeholder text', () => {
    cy.mount(Dropdown, { props: { placeholder: 'Choose an option', data: mockData } });
    cy.findByTestId('dropdown__input-wrapper').should('contain.text', 'Choose an option');
  });

  it('Renders the loading placeholder when loadingData prop is true', () => {
    cy.mount(Dropdown, { props: { loadingData: true, data: mockData } });
    cy.findByTestId('dropdown__input-wrapper').should('contain.text', 'Loading…');
  });

  it('Disables the dropdown when loadingData prop is true', () => {
    cy.mount(Dropdown, { props: { loadingData: true, data: mockData } });
    cy.findByTestId('dropdown__input-wrapper').should('have.css', 'pointer-events', 'none');

    cy.findByTestId('dropdown__input-wrapper').click({ force: true });
    cy.findAllByTestId('dropdown__item').should('not.exist');
  });

  it('Disables the dropdown when disabled prop is true', () => {
    cy.mount(Dropdown, { props: { disabled: true, data: mockData } });
    cy.findByTestId('dropdown__input-wrapper').should('have.css', 'pointer-events', 'none');

    cy.findByTestId('dropdown__input-wrapper').click({ force: true });
    cy.findAllByTestId('dropdown__item').should('not.exist');
  });

  it('Renders the dropdown options', () => {
    cy.mount(Dropdown, { props: { data: mockData } });
    cy.findByTestId('dropdown__input-wrapper').should('be.visible').click();
    cy.findAllByTestId('dropdown__item').should('have.length', mockData.length);
    cy.findAllByTestId('dropdown__item').each(($el, index) => {
      cy.wrap($el).should('contain.text', mockData[index].label).and('contain.text', mockData[index].value);
    });
  });

  it('Renders the dropdown options with custom label and value keys', () => {
    cy.mount(Dropdown, { props: { data: mockData, labelKey: 'label', valueKey: 'value' } });
    cy.findByTestId('dropdown__input-wrapper').should('be.visible').click();
    cy.findAllByTestId('dropdown__item').should('have.length', mockData.length);
    cy.findAllByTestId('dropdown__item').each(($el, index) => {
      cy.wrap($el).should('contain.text', mockData[index].label);
    });
  });

  it('Applies the invalid class when errors exist', () => {
    cy.mount(Dropdown, { props: { errors: [{ $message: 'Error message' }], data: mockData } });
    cy.findByTestId('dropdown__input-wrapper').should('have.class', 'p-invalid');
  });

  it('Renders error messages', () => {
    cy.mount(Dropdown, { props: { errors: [{ $message: 'Error 1' }, { $message: 'Error 2' }], data: mockData } });
    cy.findAllByTestId('dropdown__error-item').should('have.length', 2);
    cy.findAllByTestId('dropdown__error-item').eq(0).should('contain.text', 'Error 1');
    cy.findAllByTestId('dropdown__error-item').eq(1).should('contain.text', 'Error 2');
  });
});
