import { ref } from 'vue';
import TaskParametersConfiguratorRow from './TaskParametersConfiguratorRow.vue';
import { TASK_PARAMETER_DEFAULT_SHAPE } from '@/constants/tasks';

describe('<TaskParametersConfiguratorRow />', () => {
  let mockEmptyModel, mockModel, mockModelWithoutName, mockModelWithoutValue, mockModelWithTwoRows;

  beforeEach(() => {
    mockEmptyModel = ref([TASK_PARAMETER_DEFAULT_SHAPE]);
    mockModel = ref([
      {
        name: 'mock-name',
        type: 'string',
        value: 'mock-value',
      },
    ]);
    mockModelWithoutName = ref([
      {
        name: '',
        type: 'string',
        value: 'mock-value',
      },
    ]);
    mockModelWithoutValue = ref([
      {
        name: '',
        type: 'string',
        value: '',
      },
    ]);
    mockModelWithTwoRows = ref([
      {
        name: 'mock-name-1',
        type: 'string',
        value: 'mock-value-1',
      },
      {
        name: 'mock-name-2',
        type: 'string',
        value: 'mock-value-2',
      },
    ]);
  });

  it('Renders the row with default attributes', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockEmptyModel.value,
        rowIndex: 0,
      },
    });
    cy.findByTestId('task-parameters-row').should('be.visible');
    cy.findByTestId('task-parameters-row__name').should('be.visible');
    cy.findByTestId('task-parameters-row__type').should('be.visible');
    cy.findByTestId('task-parameters-row__value-string').should('be.visible');
  });

  it('Renders the row with pre-defined model value', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModel.value,
        rowIndex: 0,
      },
    });

    cy.findByTestId('task-parameters-row__name').find('input').should('have.value', 'mock-name');
    cy.findByTestId('task-parameters-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'string');
    cy.findByTestId('task-parameters-row__value-string').find('input').should('have.value', 'mock-value');
  });

  it('Renders the correct row model value', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModelWithTwoRows.value,
        rowIndex: 1,
      },
    });

    cy.findByTestId('task-parameters-row__name').find('input').should('have.value', 'mock-name-2');
    cy.findByTestId('task-parameters-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'string');
    cy.findByTestId('task-parameters-row__value-string').find('input').should('have.value', 'mock-value-2');
  });

  it('Lets users select the desired parameter type', () => {
    cy.mount(TaskParametersConfiguratorRow, {
      props: {
        modelValue: mockModelWithoutValue.value,
        rowIndex: 0,
      },
    });

    cy.findByTestId('task-parameters-row__type').findByTestId('dropdown__input-wrapper').click();
    cy.findAllByTestId('dropdown__item').should('be.visible').and('have.length', 3);

    // Select boolean type
    cy.findAllByTestId('dropdown__item').filter(':contains("boolean")').first().click({ force: true });
    cy.findByTestId('task-parameters-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'boolean');
    cy.findByTestId('task-parameters-row__value-bool').should('be.visible');
    cy.findByTestId('task-parameters-row__value-string').should('not.exist');
    cy.findByTestId('task-parameters-row__value-number').should('not.exist');

    // Select number type
    cy.findByTestId('task-parameters-row__type').findByTestId('dropdown__input-wrapper').click();
    cy.findAllByTestId('dropdown__item').filter(':contains("number")').first().click({ force: true });
    cy.findByTestId('task-parameters-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'number');
    cy.findByTestId('task-parameters-row__value-number').should('be.visible');
    cy.findByTestId('task-parameters-row__value-string').should('not.exist');
    cy.findByTestId('task-parameters-row__value-bool').should('not.exist');

    // Select string type
    cy.findByTestId('task-parameters-row__type').findByTestId('dropdown__input-wrapper').click();
    cy.findAllByTestId('dropdown__item').filter(':contains("string")').first().click({ force: true });
    cy.findByTestId('task-parameters-row__type')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'string');
    cy.findByTestId('task-parameters-row__value-string').should('be.visible');
    cy.findByTestId('task-parameters-row__value-number').should('not.exist');
    cy.findByTestId('task-parameters-row__value-bool').should('not.exist');
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

    cy.findByTestId('task-parameters-row__delete-button').click();
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

      cy.findByTestId('task-parameters-row__name').find('input').should('be.disabled');
      cy.findByTestId('task-parameters-row__type')
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
          modelValue: mockModelWithoutName.value,
          rowIndex: 0,
        },
      });

      cy.findByTestId('task-parameters-row__name').type('mock-name').type('{selectAll}').type('{backspace}');
      cy.findByTestId('task-parameters-row__name')
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

      cy.findByTestId('task-parameters-row__value-string').type('{selectAll}').type('{backspace}');
      cy.findByTestId('task-parameters-row__value-string')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');
    });

    it('Automatically clears error messages', () => {
      cy.mount(TaskParametersConfiguratorRow, {
        props: {
          modelValue: mockModel.value,
          rowIndex: 0,
        },
      });

      cy.findByTestId('task-parameters-row__name').type('{selectAll}').type('{backspace}');
      cy.findByTestId('task-parameters-row__name')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');

      cy.findByTestId('task-parameters-row__name').type('mock-name');
      cy.findByTestId('task-parameters-row__name').siblings('[data-testid="textinput__errors"]').should('not.exist');

      cy.findByTestId('task-parameters-row__value-string').type('{selectAll}').type('{backspace}');
      cy.findByTestId('task-parameters-row__value-string')
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Value is required');

      cy.findByTestId('task-parameters-row__value-string').type('mock-name');
      cy.findByTestId('task-parameters-row__value-string')
        .siblings('[data-testid="textinput__errors"]')
        .should('not.exist');
    });
  });
});
