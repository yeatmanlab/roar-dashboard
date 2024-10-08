import { createMockStore } from './utils.js';

/**
 * Logs in a user using the provided username and password.
 * Utilizes Cypress sessions to persist login state across tests.
 *
 * @param {string} username - The username to log in with.
 * @param {string} password - The password to log in with.
 */
Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('/', { timeout: Cypress.env('timeout') });
    cy.get('[data-cy="input-username-email"]').type(username, { log: false, timeout: Cypress.env('timeout') });
    cy.get('[data-cy="input-password"]').type(password, { log: false, timeout: Cypress.env('timeout') });
    cy.get('button')
      .contains('Go!', { timeout: Cypress.env('timeout') })
      .click();
    cy.log('Login successful.');
    cy.wait(3000);
  });
});

/**
 * Logs in a user using email-based authentication flow.
 * Handles different sign-in methods including email/password and magic link.
 *
 * @param {string} username - The email to log in with.
 * @param {string} password - The password to log in with.
 */
Cypress.Commands.add('loginWithEmail', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('/', { timeout: Cypress.env('timeout') });
    // Set username to email, check for existence of 'sign in using password' button)
    cy.get('[data-cy="input-username-email"]').type(username, { log: false, timeout: Cypress.env('timeout') });
    cy.contains('Sign-in using password');

    // Click button to switch to email / password sign in
    cy.get('[data-cy="sign-in-with-password"]').click();

    // Click button to switch to email magic link sign in
    cy.get('[data-cy="sign-in-with-email-link"]').click();

    // Click button to switch to email / password sign in and log in
    cy.get('[data-cy="sign-in-with-password"]').click();
    cy.get('[data-cy="input-password"]').type(password, { log: false, timeout: Cypress.env('timeout') });
    cy.get('button')
      .contains('Go!', { timeout: Cypress.env('timeout') })
      .click();
    cy.log('Login successful.').wait(3000);
  });
});

/**
 * Logs out the current user and verifies redirection to the sign-in page.
 */
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="button-sign-out"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('h1', { timeout: Cypress.env('timeout') }).should('contain.text', 'Welcome to ROAR!');
  cy.url({ timeout: Cypress.env('timeout') }).should('eq', `${Cypress.env('baseUrl')}/signin`);
  cy.log('Logout successful.');
});

/**
 * Navigates to a specified page, optionally logging in first.
 *
 * @param {string} page - The path to navigate to.
 * @param {boolean} [login=false] - Whether to log in before navigating.
 */
Cypress.Commands.add('navigateTo', (page) => {
  cy.log(`Navigating to \`${Cypress.env('baseUrl')}${page}`);
  cy.visit(page, { timeout: Cypress.env('timeout') });
  cy.url().should('eq', `${Cypress.env('baseUrl')}${page}`);
});

/**
 * Selects a test district, school, class, and group within a multi-level dropdown.
 *
 * @param {string} [testDistrictName=Cypress.env('testDistrictName')] - Name of the district to select.
 * @param {string} [testSchoolName=Cypress.env('testSchoolName')] - Name of the school to select.
 * @param {string} [testClassName=Cypress.env('testClassName')] - Name of the class to select.
 * @param {string} [testGroupName=Cypress.env('testGroupName')] - Name of the group to select.
 */
Cypress.Commands.add(
  'selectTestOrgs',
  (
    testDistrictName = Cypress.env('testDistrictName'),
    testSchoolName = Cypress.env('testSchoolName'),
    testClassName = Cypress.env('testClassName'),
    testGroupName = Cypress.env('testGroupName'),
  ) => {
    cy.get('span').contains('District').click();
    cy.get('ul > li').contains(testDistrictName).click({ animationDistanceThreshold: 20 });

    cy.get('span').contains('Schools').click();
    cy.get('[data-cy="dropdown-selected-district"]')
      .click()
      .get('li')
      .contains(testDistrictName)
      .click({ animationDistanceThreshold: 20 });
    cy.get('ul > li').contains(testSchoolName).click({ animationDistanceThreshold: 20 });

    cy.get('span').contains('Classes').click();
    cy.get('[data-cy="dropdown-selected-district"]')
      .click()
      .get('li')
      .contains(testDistrictName)
      .click({ animationDistanceThreshold: 20 });
    cy.get('[data-cy="dropdown-selected-school"]')
      .click()
      .get('ul > li')
      .contains(testSchoolName)
      .click({ animationDistanceThreshold: 20 });
    cy.get('ul > li').contains(testClassName).click({ animationDistanceThreshold: 20 });

    cy.get('span').contains('Groups').click();
    cy.get('ul > li').contains(testGroupName).click({ animationDistanceThreshold: 20 });
  },
);

/**
 * Checks if a consent dialog is present, and if so, agrees to the consent.
 */
Cypress.Commands.add('agreeToConsent', () => {
  cy.wait(0.3 * Cypress.env('timeout'));
  cy.get('body').then(($body) => {
    if ($body.find('.p-dialog').length > 0) {
      cy.get('.p-dialog')
        .invoke('text')
        .then((text) => {
          if (
            text.toLowerCase().includes('consent') ||
            text.toLowerCase().includes('assent') ||
            text.toLowerCase().includes('tos')
          ) {
            cy.log('Consent required, agreeing...');
            cy.get('button').contains('Continue').click();
          }
        });
    } else {
      cy.log('Consent not required, continuing...');
    }
  });
});

/**
 * Selects a specific administration from a dropdown list, retrying if necessary.
 *
 * @param {string} testAdministration - The name of the administration to select.
 * @param {number} [retries=0] - The current number of retry attempts.
 */
Cypress.Commands.add('selectAdministration', function selectAdministration(testAdministration, retries = 0) {
  cy.log(`'Selecting administration: ${testAdministration}, attempt: ${retries + 1}`);
  if (retries > 3) {
    cy.log('Retries exceeded, administration not found, exiting test...');
    return;
  }
  cy.get('[data-cy="dropdown-select-administration"]', { timeout: 2 * Cypress.env('timeout') }).click();
  cy.get('body', { timeout: 2 * Cypress.env('timeout') })
    .invoke('text')
    .then((text) => {
      if (text.includes(testAdministration)) {
        cy.get('.p-dropdown-item', { timeout: 2 * Cypress.env('timeout') })
          .contains(testAdministration)
          .click();
        cy.log('Selected administration:', testAdministration);
        cy.agreeToConsent();
      } else {
        cy.log('Administration not found, retrying...');
        selectAdministration(testAdministration, retries + 1);
      }
    });
});

/**
 * Searches for and selects an administration card by its title.
 *
 * @param {string} testAdministration - The name of the administration to search for.
 */
Cypress.Commands.add('getAdministrationCard', (testAdministration) => {
  cy.get('[data-cy=search-input]', { timeout: Cypress.env('timeout') }).type(`${testAdministration}{enter}`);
  // cy.get('ul > li').contains(`Name (${sort})`).click();

  cy.get('[data-cy="h2-card-admin-title"]', { timeout: Cypress.env('timeout') })
    .filter((index, element) => {
      return Cypress.$(element).text().includes(testAdministration);
    })
    .should('have.length', 2)
    .find('button', { timeout: Cypress.env('timeout') })
    .contains('Show details')
    .click();
});

/**
 * Switches the view to show optional assessments.
 */
Cypress.Commands.add('switchToOptionalAssessments', () => {
  cy.wait(0.2 * Cypress.env('timeout'));
  cy.get("[data-cy='switch-show-optional-assessments']")
    .invoke('attr', 'class')
    .then((classes) => {
      if (classes.includes('p-inputswitch-checked')) {
        cy.log('Optional assessments already selected.');
      } else {
        cy.get("[data-cy='switch-show-optional-assessments']").click();
        cy.log('Optional assessments selected.');
      }
    });
});

/**
 * Switches the view to show required assessments.
 */
Cypress.Commands.add('switchToRequiredAssessments', () => {
  cy.wait(0.2 * Cypress.env('timeout'));
  cy.get("[data-cy='switch-show-optional-assessments']")
    .invoke('attr', 'class')
    .then((classes) => {
      if (classes.includes('p-inputswitch-checked')) {
        cy.log('Going to Required assessments.');
        cy.get("[data-cy='switch-show-optional-assessments']").click();
      } else {
        cy.log('required already selected');
      }
    });
});

/**
 * Inputs organization details into a form, including optional fields like NCES ID, address, grade, and tag.
 *
 * @param {string} orgName - The name of the organization.
 * @param {string} orgInitials - The initials of the organization.
 * @param {string} [orgNcesId=null] - The NCES ID of the organization.
 * @param {string} [orgAddress=null] - The address of the organization.
 * @param {string} [orgGrade=null] - The grade level of the organization.
 * @param {string} [orgTag=null] - The tag associated with the organization.
 */
Cypress.Commands.add(
  'inputOrgDetails',
  (orgName, orgInitials, orgNcesId = null, orgAddress = null, orgGrade = null, orgTag = null) => {
    // Require orgName and orgInitials
    cy.get('[data-cy="input-org-name"]').type(orgName);
    cy.get('[data-cy="input-org-initials"]').type(orgInitials);

    if (orgNcesId) {
      cy.get('[data-cy="input-nces-id"]').type(orgNcesId);
    }

    if (orgGrade) {
      cy.get('[data-cy="dropdown-grade"]').click().get('ul > li').contains(orgGrade).click();
    }

    if (orgAddress) {
      // cy.get('[data-cy="input-address"]').type(`${orgAddress}`).wait(1000).type('{downarrow}{enter}').wait(1000)
      cy.get('input[placeholder="Enter a location"]')
        .type(`${orgAddress}`)
        .wait(1000)
        .type('{downarrow}{enter}')
        .wait(1000);
      expect(cy.get('[data-cy="chip-address"]').should('contain.text', orgAddress));
    }

    if (orgTag) {
      cy.get('[data-cy="input-autocomplete"]').type(orgTag).wait(1000).type('{downarrow}{enter}');
    }

    // Always input test tag
    cy.get('[data-pc-section="dropdownbutton"]').click();
    cy.get('li').contains('test').click();
  },
);

/**
 * Verifies that all users in the provided list are present in the data table.
 *
 * @param {Array<string>} userList - The list of users to check.
 */
Cypress.Commands.add('checkUserList', (userList) => {
  cy.get('[data-cy="roar-data-table"] tbody tr', { timeout: Cypress.env('timeout') }).each((row) => {
    cy.wrap(row)
      .find('td.p-frozen-column')
      .then((cell) => {
        // The following cleans the non-breaking space character and any whitespace from the cell text
        const cellText = cell
          .text()
          .replace(/&nbsp;/g, '')
          .trim();
        expect(userList).to.include(cellText);
      });
  });
});

/**
 * Executes the test spec for an optional game based on the provided administration.
 *
 * @param {object} game - The game object containing the testSpec method.
 * @param {object} administration - The administration context to use.
 * @param {object} optional - Additional options or parameters for the game.
 * @returns {Cypress.Chainable} - The chainable Cypress object.
 */
Cypress.Commands.add('playOptionalGame', (game, administration, optional) => {
  return cy.wrap(null).then(() => {
    return game?.testSpec(administration, optional);
  });
});

/**
 * Custom command to check if a partner district exists in the organization list.
 *
 * This command performs the following actions:
 * 1. Locates and clicks on the 'Districts' option in a list.
 * 2. Verifies if the partner district name (retrieved from Cypress environment variables) exists in a specific `div` element.
 * 3. Logs a message confirming that the district exists.
 *
 * @param {number} [timeout=10000] - Optional timeout for each command, defaulting to 10 seconds.
 */
Cypress.Commands.add('checkOrgExists', (org, timeout = 10000) => {
  // Click on the 'Districts' item in the list
  cy.get('ul > li', { timeout }).contains(org.tabName, { timeout }).click();

  // Verify the partner district name is present in the div
  cy.get('div', { timeout }).should('contain.text', Cypress.env('testPartnerDistrictName'), {
    timeout,
  });

  // Log the district name exists
  cy.log(`${Cypress.env('testPartnerDistrictName')} exists.`);
});

/**
 * Create a mock store for the user type specified.
 * @param {string} userType - The type of user to create a mock store for. One of 'superAdmin', 'partnerAdmin', or 'participant'. Defaults to 'participant'.
 * @returns {void}
 */
Cypress.Commands.add('setAuthStore', (userType = 'participant') => {
  const authStore = createMockStore(userType);
  const serializedStore = JSON.stringify(authStore.$state);

  // Store the mock store in sessionStorage
  cy.window().then((window) => {
    window.sessionStorage.setItem('authStore', serializedStore);
  });

  cy.log('Created mock store for user type:', userType, ' with state:', authStore.$state);
  // Store the mock store in the Cypress context as an alias
  return cy.wrap(authStore.$state).as('authStore');
});
