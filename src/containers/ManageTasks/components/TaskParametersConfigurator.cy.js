import { ref } from 'vue';
import TaskParametersConfigurator from './TaskParametersConfigurator.vue';

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

describe('<TaskParametersConfigurator />', () => {
  let mockModel;

  beforeEach(() => {
    mockModel = ref(structuredClone(mockData));
  });

  it('Renders the configurator with default attributes', () => {
    mockModel = ref([mockData[0]]);

    cy.mount(TaskParametersConfigurator, {
      props: {
        modelValue: mockModel.value,
      },
    });

    cy.findAllByTestId('task-configurator-row').should('be.visible');
    cy.findAllByTestId('task-configurator-row').should('have.length', 1);
  });

  it('Renders the configurator with pre-defined model value', () => {
    cy.mount(TaskParametersConfigurator, {
      props: {
        modelValue: mockModel.value,
      },
    });

    cy.findAllByTestId('task-configurator-row').should('be.visible');
    cy.findAllByTestId('task-configurator-row').should('have.length', 3);

    cy.findByTestId('task-configurator-row__value-string').find('input').should('have.value', 'mock-value');
    cy.findByTestId('task-configurator-row__value-bool')
      .findByTestId('dropdown__input-wrapper')
      .should('contain.text', 'false');
    cy.findByTestId('task-configurator-row__value-number').find('input').should('have.value', '5');
  });

  it('Lets the user add and delete rows', () => {
    cy.mount(TaskParametersConfigurator, {
      props: {
        modelValue: mockModel.value,
      },
    });

    cy.findAllByTestId('task-configurator-row').should('be.visible');
    cy.findAllByTestId('task-configurator-row').should('have.length', 3);

    cy.findByTestId('task-configurator__add-row-btn').click();
    cy.findAllByTestId('task-configurator-row').should('have.length', 4);

    cy.findAllByTestId('task-configurator-row__delete-btn').eq(3).click();
    cy.findAllByTestId('task-configurator-row').should('have.length', 3);
  });

  describe('Edit mode', () => {
    it('Passes the edit mode flag to the row component', () => {
      mockModel = ref([mockData[0]]);

      cy.mount(TaskParametersConfigurator, {
        props: {
          modelValue: mockModel.value,
          editMode: true,
        },
      });

      cy.findAllByTestId('task-configurator-row').should('be.visible');
      cy.findAllByTestId('task-configurator-row').should('have.length', 1);

      cy.findByTestId('task-configurator-row__name').find('input').should('be.disabled');
      cy.findByTestId('task-configurator-row__type')
        .findByTestId('dropdown__input-wrapper')
        .should('have.css', 'pointer-events', 'none')
        .click({ force: true });
      cy.findAllByTestId('dropdown__item').should('not.exist');
    });

    it('Passes the row deletion flag to the component', () => {
      cy.mount(TaskParametersConfigurator, {
        props: {
          modelValue: mockModel.value,
          editMode: true,
          disableDeletingExistingRows: true,
        },
      });

      cy.findAllByTestId('task-configurator-row__delete-btn').should('be.disabled');

      cy.findByTestId('task-configurator__add-row-btn').click();
      cy.findAllByTestId('task-configurator-row__delete-btn').eq(3).should('not.be.disabled');
    });
  });

  describe('Form Validation', () => {
    it('Passes the key blacklist to the row component', () => {
      cy.mount(TaskParametersConfigurator, {
        props: {
          modelValue: mockModel.value,
          validationKeyBlacklist: ['reserved-param'],
        },
      });

      cy.findAllByTestId('task-configurator-row').should('be.visible');
      cy.findAllByTestId('task-configurator-row').should('have.length', 3);

      cy.findByTestId('task-configurator__add-row-btn').click();
      cy.findAllByTestId('task-configurator-row').should('have.length', 4);

      cy.findAllByTestId('task-configurator-row__name').eq(3).find('input').type('reserved-param');
      cy.findAllByTestId('task-configurator-row__name')
        .eq(3)
        .siblings('[data-testid="textinput__errors"]')
        .eq(0)
        .should('be.visible')
        .and('contain.text', 'Parameter name is reserved');

      cy.findAllByTestId('task-configurator-row__name').eq(3).find('input').type('-2');

      cy.findAllByTestId('task-configurator-row__name')
        .eq(3)
        .siblings('[data-testid="textinput__errors"]')
        .should('not.exist');
    });
  });
});
