function clickOrgTabs() {
  const tabs = ['Districts', 'Schools', 'Classes', 'Groups', 'Families'];
  for (let i = 0; i < tabs.length; i++) {
    cy.get('span.p-tabview-title', { timeout: 1000 }).should('contain.text', tabs[i]).click({ multiple: true });
    cy.log('Tab ' + tabs[i] + ' found.');
  }
}

describe(
  'The admin user can navigate to the list organizations page, ' +
    'and can see which they organizations they are associated with',
  () => {
    it('Activates the admin sidebar, clicks List Orgs, then clicks through the various tabs.', () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/list-orgs');
      clickOrgTabs();
    });
  },
);
