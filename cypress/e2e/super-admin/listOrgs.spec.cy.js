const tabs = ['Districts', 'Schools', 'Classes', 'Groups']

describe('The admin user can navigate to the list organizations page, ' +
    'and can see which they organizations they are associated with', () => {
  it('Activates the admin sidebar, clicks List Orgs, then clicks through the various tabs.', () => {

    cy.navigateTo('/list-orgs')

    // cy.activateAdminSidebar()
    // cy.get("button").contains("List organizations").click()

    // Write a for-loop which loops through the tabs array, waits for 1 second, then clicks on each tab.
    for (let i = 0; i < tabs.length; i++) {
      cy.get('span.p-tabview-title', {timeout: 1000}).should('contain.text', tabs[i]).click({multiple: true})
      cy.log("Tab " + tabs[i] + " found.")
    }

  })
})