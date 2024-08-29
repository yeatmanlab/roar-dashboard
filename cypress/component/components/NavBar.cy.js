import NavBar from '../../../src/components/NavBar.vue';

const staticResponse = {
  // id: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
  // collection: 'userClaims',
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

describe('Mount and test the NavBar.vue component.', () => {
  // beforeEach(() => {
  //   cy.createMockStore()
  // });

  it('mounts using a mobile viewport', () => {
    cy.setViewport();

    // Intercept the network call and respond with mock data
    cy.intercept(
      'GET',
      'https://firestore.googleapis.com/v1/projects/gse-roar-admin-dev/databases/(default)/documents/userClaims/**/*',
      (req) => {
        req.reply({
          statusCode: 200,
          body: staticResponse,
          delay: 1000, // Optional: simulate network delay
        });
      },
    ).as('userClaims');

    cy.mount(NavBar);

    // Wait for the intercepted request and check that it was successful
    cy.wait('@userClaims').then((interception) => {
      cy.log('Intercepted request:', interception);
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.deep.equal(staticResponse);
    });
  });

  /*  it('mounts using a desktop viewport', () => {
    cy.setViewport('desktop');
    cy.mount(NavBar);
  });
  */
});
