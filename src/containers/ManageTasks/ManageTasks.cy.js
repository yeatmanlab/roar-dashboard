import ManageTasks from './ManageTasks.vue';

describe('<ManageTasks />', () => {
  it('Renders the component', () => {
    cy.mount(ManageTasks, {
      global: {
        stubs: {
          CreateTaskForm: { template: '<div data-testId="create-task-form-stub">Create Form Stub</div>' },
          UpdateTaskForm: { template: '<div data-testId="update-task-form-stub">Update Form Stub</div>' },
        },
      },
    });

    cy.findByTestId('create-task-form-stub').should('exist').should('be.visible');
    cy.findByTestId('update-task-form-stub').should('exist').should('not.be.visible');
  });

  it('Lets the user switch between create and update forms', () => {
    cy.mount(ManageTasks, {
      global: {
        stubs: {
          CreateTaskForm: { template: '<div data-testId="create-task-form-stub">Create Form Stub</div>' },
          UpdateTaskForm: { template: '<div data-testId="update-task-form-stub">Update Form Stub</div>' },
        },
      },
    });

    cy.findByTestId('create-task-form-stub').should('exist').should('be.visible');
    cy.findByTestId('update-task-form-stub').should('exist').should('not.be.visible');

    cy.findByTestId('manage-tasks__view-select').findByText('Update Task').click();

    cy.findByTestId('create-task-form-stub').should('exist').should('not.be.visible');
    cy.findByTestId('update-task-form-stub').should('exist').should('be.visible');

    cy.findByTestId('manage-tasks__view-select').findByText('Create Task').click();

    cy.findByTestId('create-task-form-stub').should('exist').should('be.visible');
    cy.findByTestId('update-task-form-stub').should('exist').should('not.be.visible');
  });
});
