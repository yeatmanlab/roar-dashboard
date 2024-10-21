import NavBar from '../../../src/components/NavBar.vue';

// Fetch documents from this Firestore endpoint
const endPoint = 'userClaims/**/*';

// Mock data formatted the match the output of fetchDocById()
const staticResponse = {
  fields: {
    claims: {
      mapValue: {
        fields: {
          adminUid: { stringValue: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1' },
          assessmentUid: { stringValue: 'FW0G9oXYQjMpwPdyptVJOsbb6J42' },
          roarUid: { stringValue: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1' },
          someOtherField: { stringValue: 'someOtherValue' },
        },
      },
    },
  },
};

describe('<NavBar />', () => {
  beforeEach(() => {
    cy.setAuthStore().as('authStore');

    // Intercept network calls and respond with mock data
    cy.intercept('GET', `${Cypress.env('firestoreAdminUrl')}/${endPoint}`, (req) => {
      req.reply({
        statusCode: 200,
        body: staticResponse,
        delay: 1000,
      });
    }).as('userClaims');
  });

  it('mounts using default Cypress viewport', () => {
    cy.mount(NavBar);

    // Await the intercepted request to check that it was successful
    cy.wait('@userClaims').then((interception) => {
      if (interception?.response?.statusCode === 200) {
        expect(interception?.response.body).to.deep.equal(staticResponse);
      }
    });

    // Check that the component is mounted and the expected elements are present
    cy.get('nav').should('exist');
    cy.get('[data-cy=button-sign-out]').should('exist');
    // @NOTE the students not longer have button-profile-info
  });

  it('mounts using a desktop viewport', () => {
    cy.viewport(1920, 1080);
    cy.mount(NavBar);
    cy.get('[data-cy=button-sign-out]').should('contain.text', 'Sign Out');

    // Check that the user's first name is displayed in the profile button
    cy.get('@authStore').then((authStore) => {
      const userFirstName = authStore?.userData.name.first;
      cy.get('[data-cy=user-display-name]').should('contain.text', userFirstName);
    });
  });
});
