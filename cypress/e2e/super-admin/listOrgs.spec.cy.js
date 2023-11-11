describe('The admin user can list organizations ', () => {
  it('Activates the admin sidebar, clicks List Orgs, then clicks through the various tabs.', () => {
    const username = Cypress.env('superAdminUsername')
    const password = Cypress.env('superAdminPassword')
    const tabs = ['districts', 'schools', 'classes', 'groups']
    cy.login(username, password)
    // cy.visit("/list-orgs")
    cy.activateAdminSidebar()
    // for (let = 0; i < 4; i += 1)
    cy.wait(1000)
    cy.get("button").contains("List organizations").click()
    cy.wait(1000)
    cy.get("a").contains("Schools").click()
    cy.wait(1000)
    cy.get("a").contains("Classes").click()
    cy.wait(1000)
    cy.get("a").contains("Groups").click()
  })
})