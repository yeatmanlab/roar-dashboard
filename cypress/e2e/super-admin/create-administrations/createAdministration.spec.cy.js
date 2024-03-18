const timeout = Cypress.env('timeout');
const today = new Date().getDate();
const variant = 'morphology-default';

function typeAdministrationName() {
  cy.get('[data-cy="input-administration-name"]', { timeout: Cypress.env('timeout') }).type(
    Cypress.env('testAdministrationName'),
  );
}

function selectDate() {
  cy.get('[data-cy="input-calendar"]')
    .click()
    .get('.p-datepicker-today > span')
    .contains(today)
    .click()
    .type('{rightarrow}{enter}{esc}');
}

// function refreshAssessments() {
//   cy.get('[data-cy="button-refresh-assessments"]', { timeout: Cypress.env('timeout') }).click();
// }

function dragVariantCard(variant, x, y) {
  cy.get('div')
    .contains(variant)
    .trigger('mousedown', { which: 1 })
    .trigger('mousemove', { clientX: 1200, clientY: 0 })
    .trigger('mouseup', { force: true });
  // // get draggable element, then
  //   cy.get("div").contains(variant).then(($el) => {
  //     cy.get("[data-cy='panel-droppable-zone']").then(($target) => {
  //
  //       // x and y positions of draggable object
  //       const dragX = $el[0].getBoundingClientRect().left
  //       const dragY = $el[0].getBoundingClientRect().top
  //
  //       // x and y positions of droppable object
  //       const dropX = $target[0].getBoundingClientRect().left
  //       const dropY = $target[0].getBoundingClientRect().top
  //
  //       cy.get("div").contains(variant).trigger("mousedown", { which: 0})
  //       cy.get("[data-cy='panel-droppable-zone']").trigger("mouseup")
  //     })
  //   })
  // //   get the droppable element, then
  // //   get the x and y positions of each element
  // //   wrap the draggable element, trigger mousedown
  // //   mousemove on the draggable element
  // //   mousemove to the droppable element
  // //   mouseup on the droppable element
}

function selectAndAssignAdministration(variant) {
  cy.get('[data-cy="input-variant-name"]', { timeout: Cypress.env('timeout') }).type(variant);
  cy.wait(0.3 * timeout);
  dragVariantCard(variant);
}

function checkAdministrationCreated() {
  cy.url({ timeout: 2 * Cypress.env('timeout') }).should('eq', `${Cypress.env('baseUrl')}/`);
  cy.get('[data-cy="dropdown-sort-administrations"]', { timeout: 2 * Cypress.env('timeout') }).click();
  cy.get('ul > li', { timeout: Cypress.env('timeout') })
    .contains('Name (descending)')
    .click();
  cy.get('[data-cy="h2-card-admin-title"', { timeout: 2 * Cypress.env('timeout') }).should(
    'contain.text',
    Cypress.env('testAdministrationName'),
  );
  cy.log('Administration successfully created.');
}

describe('The admin user can create an administration and assign it to a district.', () => {
  it(
    'Logs into the dashboard, navigates to the Create Administrations component,' +
      'creates a new administration, and assigns it to a test district.',
    () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/create-administration');

      typeAdministrationName();
      selectDate();
      cy.selectTestOrgs();
      selectAndAssignAdministration(variant);
      // checkAdministrationCreated();
    },
  );
});
