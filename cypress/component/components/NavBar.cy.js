import NavBar from '../../../src/components/NavBar.vue';
import { useAuthStore } from '../../../src/store/auth.js';

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
  beforeEach(() => {
    cy.setAuthStore();
    // const authStore = useAuthStore();
    //
    // authStore.$patch({
    //   firebaseUser: {
    //     adminFirebaseUser: {
    //       uid: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
    //       email: '123',
    //       isUserAuthedAdmin: true,
    //       isUserAuthedApp: true,
    //       isAuthenticated: true,
    //     },
    //     appFirebaseUser: {
    //       uid: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
    //       email: '123',
    //       isUserAuthedAdmin: true,
    //       isUserAuthedApp: true,
    //       isAuthenticated: true,
    //     },
    //   },
    //   roarfirekit: {
    //     initialized: true,
    //     restConfig: {
    //       admin: {
    //         // headers: { Authorization: `Bearer ${this._idTokens.admin}` },
    //         baseURL: `https://firestore.googleapis.com/v1/projects/gse-roar-admin-dev/databases/(default)/documents`,
    //       },
    //       app: {
    //         // headers: { Authorization: `Bearer ${this._idTokens.app}` },
    //         baseURL: `https://firestore.googleapis.com/v1/projects/gse-roar-assessment-dev/databases/(default)/documents`,
    //       },
    //     },
    //   },
    //   userData: {
    //     uid: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
    //     email: '123',
    //     username: 'Test User',
    //     name: {
    //       first: 'Test',
    //       last: 'User',
    //     },
    //   },
    // });
    //
    // cy.wrap(authStore.$state).as('authStore');
  });

  it('mounts and uses intercepted userClaims data', () => {
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

    // Mount the NavBar component
    cy.mount(NavBar);

    // Wait for the intercepted request and check that it was successful
    cy.wait('@userClaims').then((interception) => {
      cy.log('Intercepted request:', interception);
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.deep.equal(staticResponse);
    });
  });
});
