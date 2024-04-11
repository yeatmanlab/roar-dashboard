import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export function signInAsSuperAdmin(firebaseAuth) {
  const auth = getAuth(firebaseAuth);
  cy.then(() =>
    signInWithEmailAndPassword(auth, 'testsuperadmin1@roar-auth.com', Cypress.env('superAdminPassword')),
  ).then((userCredential) => {
    cy.log('User: ', userCredential.user);
  });
}

export function selectOrgFromDropdown(orgType) {
  cy.get('[data-cy="dropdown-org-type"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('li').contains(orgType).click();
}

export function checkOrgCreated(orgName, orgType, parentDistrict, parentSchool) {
  if (orgType === 'District') {
    cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', orgName);
  } else if (orgType === 'Group') {
    cy.get('a')
      .contains('Groups', { timeout: Cypress.env('timeout') })
      .click();
    cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', orgName);
  } else if (orgType === 'School') {
    cy.get('a')
      .contains('Schools', { timeout: Cypress.env('timeout') })
      .click();
    inputParentOrgDetails(orgType, parentDistrict);
    cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', orgName);
  } else if (orgType === 'Class') {
    cy.get('a')
      .contains('Classes', { timeout: Cypress.env('timeout') })
      .click();
    inputParentOrgDetails(orgType, parentDistrict, parentSchool);
    cy.get('div', { timeout: Cypress.env('timeout') }).should('contain.text', orgName);
  }
  cy.log(`${orgType} successfully created.`);
}

export function clickCreateOrg(orgType) {
  cy.get('.p-button-label', { timeout: Cypress.env('timeout') })
    .contains('Create ' + orgType)
    .click();
  cy.log('Create ' + orgType + ' clicked.');
}

export function inputParentOrgDetails(orgType, parentDistrict, parentSchool) {
  if (orgType === 'School' || orgType === 'Class') {
    cy.get('[data-cy="dropdown-parent-district"]', { timeout: Cypress.env('timeout') })
      .wait(1000)
      .click();
    cy.get('ul > li', { timeout: Cypress.env('timeout') })
      .contains(parentDistrict)
      .click();
  }
  if (orgType === 'Class') {
    cy.get('[data-cy="dropdown-parent-school"]', { timeout: Cypress.env('timeout') })
      .wait(1000)
      .click();
    cy.get('ul > li', { timeout: Cypress.env('timeout') })
      .contains(parentSchool)
      .click();
  }
}
