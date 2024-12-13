import { ref } from 'vue';
import TaskParametersConfiguratorRow from './TaskParametersConfiguratorRow.vue';
import { TASK_PARAMETER_DEFAULT_SHAPE } from '@/constants/tasks';

const mockData = [
  {
    name: 'mock-param',
    type: 'string',
    value: 'mock-value',
  },
  {
    name: 'mock-param-2',
    type: 'boolean',
    value: false,
  },
  {
    name: 'mock-param-3',
    type: 'number',
    value: 5,
  },
];

describe('<TaskParametersConfiguratorRow />', () => {
  let mockModel;

  beforeEach(() => {
    mockModel = ref(structuredClone(mockData));
  });

  it('Renders the row with default attributes', () => {
    mockModel = ref([TASK_PARAMETER_DEFAULT_SHAPE]);

    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModel.value,
        rowIndex: 0,
      },
    });
    cy.findByTestId('task-configurator-row').should('be.visible');
    cy.findByTestId('task-configurator-row__name').should('be.visible');
    cy.findByTestId('task-configurator-row__type').should('be.visible');
    cy.findByTestId('task-configurator-row__value-string').should('be.visible');
  });

  it('Renders the row with pre-defined model value', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModel.value,
        rowIndex: 0,
      },
    });

    cy.findByTestId('task-configurator-row__name').find('input').should('have.value', 'mock-param');
    cy.findByTestId('task-configurator-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'string');
    cy.findByTestId('task-configurator-row__value-string').find('input').should('have.value', 'mock-value');
  });

  it('Renders the correct row model value', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModel.value,
        rowIndex: 1,
      },
    });

    cy.findByTestId('task-configurator-row__name').find('input').should('have.value', 'mock-param-2');
    cy.findByTestId('task-configurator-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'boolean');
    cy.findByTestId('task-configurator-row__value-bool')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'false');
  });

  it('Lets users select the desired parameter type', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModel.value,
        rowIndex: 0,
      },
    });

    cy.findByTestId('task-configurator-row__type').findByTestId('dropdown__input-wrapper').click();
    cy.findAllByTestId('dropdown__item').should('be.visible').and('have.length', 3);

    // Select boolean type
    cy.findAllByTestId('dropdown__item').filter(':contains("boolean")').first().click({ force: true });
    cy.findByTestId('task-configurator-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'boolean');
    cy.findByTestId('task-configurator-row__value-bool').should('be.visible');
    cy.findByTestId('task-configurator-row__value-string').should('not.exist');
    cy.findByTestId('task-configurator-row__value-number').should('not.exist');

    // Select number type
    cy.findByTestId('task-configurator-row__type').findByTestId('dropdown__input-wrapper').click();
    cy.findAllByTestId('dropdown__item').filter(':contains("number")').first().click({ force: true });
    cy.findByTestId('task-configurator-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'number');
    cy.findByTestId('task-configurator-row__value-number').should('be.visible');
    cy.findByTestId('task-configurator-row__value-string').should('not.exist');
    cy.findByTestId('task-configurator-row__value-bool').should('not.exist');

    // Select string type
    cy.findByTestId('task-configurator-row__type').findByTestId('dropdown__input-wrapper').click();
    cy.findAllByTestId('dropdown__item').filter(':contains("string")').first().click({ force: true });
    cy.findByTestId('task-configurator-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'string');
    cy.findByTestId('task-configurator-row__value-string').should('be.visible');
    cy.findByTestId('task-configurator-row__value-number').should('not.exist');
    cy.findByTestId('task-configurator-row__value-bool').should('not.exist');
  });

  it('Emits delete event when delete button is clicked', () => {
    const removeRowSpy = cy.spy().as('removeRowSpy');

    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModel.value,
        rowIndex: 0,
        onRemoveRow: removeRowSpy,
      },
    });

    cy.findByTestId('task-configurator-row__delete-btn').click();
    cy.get('@removeRowSpy').should('have.been.calledOnce');
  });

  describe('Edit Mode', () => {
    it('Disables the parameter name and type inputs when in edit mode', () => {
      cy.mount(TaskParametersConfiguratorRow, {
        props: {
          modelValue: mockModel.value,
          rowIndex: 0,
          editMode: true,
        },
      });

      cy.findByTestId('task-configurator-row__name').find('input').should('be.disabled');
      cy.findByTestId('task-configurator-row__type')
        .findByTestId('dropdown__input-wrapper')
        .should('have.css', 'pointer-events', 'none')
        .click({ force: true });
      cy.findAllByTestId('dropdown__item').should('not.exist');
    });
  });

  describe('Form Validation', () => {
    it('Shows error message when name is empty', () => {
      cy.mount(TaskParametersConfiguratorRow, {
        props: {
          modelValue: mockModel.value,
          rowIndex: 0,
        },
      });

      cy.findByTestId('task-configurator-row__name').type('{selectAll}');
      cy.findByTestId('task-configurator-row__name').type('{backspace}');
      cy.findByTestId('task-configurator-row__name')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');
    });

    it('Shows error message when value is empty', () => {
      cy.mount(TaskParametersConfiguratorRow, {
        props: {
          modelValue: mockModel.value,
          rowIndex: 0,
        },
      });

      cy.findByTestId('task-configurator-row__value-string').type('{selectAll}');
      cy.findByTestId('task-configurator-row__value-string').type('{backspace}');
      cy.findByTestId('task-configurator-row__value-string')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');
    });

    it('Prevents using reserved parameter names', () => {
      cy.mount(TaskParametersConfiguratorRow, {
        props: {
          modelValue: mockModel.value,
          rowIndex: 0,
          validationKeyBlacklist: ['reserved-param'],
        },
      });

      cy.findByTestId('task-configurator-row__name').type('{selectAll}');
      cy.findByTestId('task-configurator-row__name').type('{backspace}');
      cy.findByTestId('task-configurator-row__name').type('reserved-param');
      cy.findByTestId('task-configurator-row__name')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Parameter name is reserved');
    });

    it('Automatically clears error messages', () => {
      mockModel = ref([...mockData]);

      cy.mount(TaskParametersConfiguratorRow, {
        props: {
          modelValue: mockModel.value,
          rowIndex: 0,
        },
      });

      cy.findByTestId('task-configurator-row__name').type('{selectAll}');
      cy.findByTestId('task-configurator-row__name').type('{backspace}');
      cy.findByTestId('task-configurator-row__name')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');

      cy.findByTestId('task-configurator-row__name').type('mock-param-name');
      cy.findByTestId('task-configurator-row__name').siblings('[data-testid="textinput__errors"]').should('not.exist');

      cy.findByTestId('task-configurator-row__value-string').type('{selectAll}');
      cy.findByTestId('task-configurator-row__value-string').type('{backspace}');
      cy.findByTestId('task-configurator-row__value-string')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');

      cy.findByTestId('task-configurator-row__value-string').type('mock-name');
      cy.findByTestId('task-configurator-row__value-string')
        .siblings('[data-testid="textinput__errors"]')
        .should('not.exist');
    });
  });
});
