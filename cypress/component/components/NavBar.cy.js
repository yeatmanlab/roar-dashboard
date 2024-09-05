import NavBar from '../../../src/components/NavBar.vue';

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
    cy.intercept(
      'GET',
      'https://firestore.googleapis.com/v1/projects/gse-roar-admin-dev/databases/(default)/documents/userClaims/**/*',
      (req) => {
        req.reply({
          statusCode: 200,
          body: staticResponse,
          delay: 1000,
        });
      },
    ).as('userClaims');
  });

  it('mounts using default Cypress viewport', () => {
    cy.mount(NavBar);

    // Await the intercepted request to check that it was successful
    cy.wait('@userClaims').then((interception) => {
      if (interception?.response?.statusCode === 200) {
        expect(interception?.response.body).to.deep.equal(staticResponse);
        cy.log('Interception successful', interception?.response);
      }
    });

    // Check that the component is mounted and the expected elements are present
    cy.get('nav').should('exist');
    cy.get('[data-cy=button-sign-out]').should('exist');
    cy.get('[data-cy=button-profile-info]').should('exist');
  });

  it('mounts using a desktop viewport', () => {
    cy.viewport(1920, 1080);
    cy.mount(NavBar);
    cy.get('[data-cy=button-sign-out]').should('contain.text', 'Sign Out');

    cy.get('@authStore').then((authStore) => {
      // Check that the user's first name is displayed in the profile button
      const userFirstName = authStore?.userData.name.first;
      cy.get('[data-cy=user-display-name]').should('contain.text', userFirstName);
    });
  });
});
