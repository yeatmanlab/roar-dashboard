import ManageTasks from './ManageTasks.vue';

describe('<ManageTasks />', () => {
  it('Renders the component', () => {
    cy.mount(ManageTasks, {
      global: {
        stubs: {
          CreateTaskForm: { template: '<div data-test="create-task-form-stub">Create Form Stub</div>' },
          UpdateTaskForm: { template: '<div data-test="update-task-form-stub">Update Form Stub</div>' },
        },
      },
    });

    cy.get('[data-test="create-task-form-stub"]').should('exist').should('be.visible');
    cy.get('[data-test="update-task-form-stub"]').should('exist').should('not.be.visible');
  });

  it('Lets the user switch between create and update forms', () => {
    cy.mount(ManageTasks, {
      global: {
        stubs: {
          CreateTaskForm: { template: '<div data-test="create-task-form-stub">Create Form Stub</div>' },
          UpdateTaskForm: { template: '<div data-test="update-task-form-stub">Update Form Stub</div>' },
        },
      },
    });

    cy.get('[data-test="create-task-form-stub"]').should('exist').should('be.visible');
    cy.get('[data-test="update-task-form-stub"]').should('exist').should('not.be.visible');

    cy.findByTestId('manage-tasks__view-select').findByText('Update Task').click();

    cy.get('[data-test="create-task-form-stub"]').should('exist').should('not.be.visible');
    cy.get('[data-test="update-task-form-stub"]').should('exist').should('be.visible');

    cy.findByTestId('manage-tasks__view-select').findByText('Create Task').click();

    cy.get('[data-test="create-task-form-stub"]').should('exist').should('be.visible');
    cy.get('[data-test="update-task-form-stub"]').should('exist').should('not.be.visible');
  });
});
