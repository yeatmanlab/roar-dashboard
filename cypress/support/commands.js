import 'cypress-wait-until';
import '@testing-library/cypress/add-commands';
import { APP_ROUTES } from '../../src/constants/routes.js';

const baseUrl = Cypress.config().baseUrl;

/**
 * Logs in a user using the provided username and password.
 * Utilizes Cypress sessions to persist login state across tests.
 *
 * @param {string} username - The username to log in with.
 * @param {string} password - The password to log in with.
 */
Cypress.Commands.add('login', (username, password) => {
  cy.session(
    [username],
    () => {
      cy.visit(APP_ROUTES.HOME);

      cy.get('[data-cy="sign-in__username"]').type(username, { log: false });
      cy.get('[data-cy="sign-in__password"]').type(password, { log: false });

      cy.get('button').contains('Go!').click();

      cy.url().should('eq', `${baseUrl}/`);
      cy.log('Login successful.');
      cy.agreeToConsent();
    },
    {
      validate: () => {
        cy.window().then((win) => {
          const sessionStorageKeys = Object.keys(win.sessionStorage);

          const adminAuthUserKeyPattern = new RegExp('^firebase:authUser:.+:admin$');
          const appAuthUserKeyPattern = new RegExp('^firebase:authUser:.+:app$');

          const hasAdminAuthUserKey = sessionStorageKeys.some((key) => adminAuthUserKeyPattern.test(key));
          const hasAppAuthUserKey = sessionStorageKeys.some((key) => appAuthUserKeyPattern.test(key));

          expect(hasAdminAuthUserKey, 'Session storage should contain a firebase:authUser:{id}:admin key').to.be.true;
          expect(hasAppAuthUserKey, 'Session storage should contain a firebase:authUser:{id}:app key').to.be.true;
        });
      },
    },
  );

  cy.visit('/');
  cy.url().should('eq', `${baseUrl}/`);
});

/**
 * Logs in a user using Clever SSO.
 *
 * @param {string} schoolName - The name of the school to log in with.
 * @param {string} username - The username to log in with.
 * @param {string} password - The password to log in with.
 */
Cypress.Commands.add('loginWithClever', (schoolName, username, password) => {
  const CLEVER_SSO_URL = Cypress.env('cleverOAuthLink');

  cy.visit(APP_ROUTES.HOME);
  cy.url().should('eq', `${baseUrl}${APP_ROUTES.SIGN_IN}`);

  cy.get('[data-cy="sign-in__clever-sso"]').contains('Clever').click();

  cy.origin(
    CLEVER_SSO_URL,
    {
      args: {
        schoolName,
        username,
        password,
      },
    },
    ({ schoolName, username, password }) => {
      cy.get('input[title="School name"]').type(schoolName);
      cy.get('ul > li').contains(schoolName).click();

      cy.get('input#username').type(username);
      cy.get('input#password').type(password, { log: false });
      cy.wait(1000); // Add a delay to simulate user input, as Clever SSO is sensitive to rapid input.
      cy.get('button#UsernamePasswordForm--loginButton').click();
    },
  );

  cy.url().should('include', `${baseUrl}/`);

  cy.get('[data-cy="app-spinner"]').should('be.visible');

  cy.waitForParticipantHomepage();

  cy.url().should('eq', `${baseUrl}/`);

  cy.log('SSO login successful.');
  cy.agreeToConsent();
});

/**
 * Logs out the current user and verifies redirection to the sign-in page.
 */
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="navbar__signout-btn-desktop"]').click();
  cy.url().should('eq', `${baseUrl}/signin`);
  cy.get('h1').should('contain.text', 'Welcome to ROAR!');
  cy.log('Logout successful.');
});

/**
 * Navigates to a specified page.
 *
 * @param {string} page - The path to navigate to.
 */
Cypress.Commands.add('navigateTo', (page) => {
  cy.visit(page);
  cy.url().should('eq', `${baseUrl}${page}`);
});

/**
 * Waits for the administrations list to load.
 */
Cypress.Commands.add('waitForAdministrationsList', () => {
  // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
  // the whole list to be loaded and that can take a while, hence the long timeout.
  cy.waitUntil(
    () => {
      return Cypress.$('main [data-cy="administrations-list"] ').length;
    },
    {
      errorMsg: 'Failed to find the administrations list before timeout',
      timeout: 600000,
      interval: 1000,
    },
  );
});

/**
 * Waits for the student report button to load.
 */
Cypress.Commands.add('waitForStudentReportList', () => {
  // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
  // the whole list to be loaded and that can take a while, hence the long timeout.
  cy.waitUntil(
    () => {
      return Cypress.$('[data-cy="view-score-report-btn"] ').length;
    },
    {
      errorMsg: 'Failed to find the score report button before timeout',
    },
  );
});

/**
 * Waits for the launch student button to load.
 */
Cypress.Commands.add('waitForPlayAssessmentsBtn', () => {
  // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
  // the whole list to be loaded and that can take a while, hence the long timeout.
  cy.waitUntil(
    () => {
      return Cypress.$('[data-cy="play-assessments-btn"] ').length;
    },
    {
      errorMsg: 'Failed to find the play assessments button before timeout',
    },
  );
});

/**
 * Waits for the organisations list to load.
 */
Cypress.Commands.add('waitForOrganisationsList', () => {
  cy.waitUntil(
    () => {
      return Cypress.$('main [data-cy="orgs-list"] ').length;
    },
    {
      errorMsg: 'Failed to load the orgs list page before timeout',
    },
  );
});

/**
 * Wait for the participant homepage to load.
 */
Cypress.Commands.add('waitForParticipantHomepage', () => {
  // Note: Especially during SSO auth flows, the application takes a while to load. Until this is resolved, we need to
  // work with a slightly excessive timeout to ensure we allow the application to complete the auth flow.
  cy.waitUntil(
    () => {
      return Cypress.$('[data-cy="home-participant__administration"]').length > 0;
    },
    {
      errorMsg: 'Failed to load the participant home page before timeout',
      timeout: 60000,
      interval: 1000,
    },
  );
});

/**
 * Wait for the assessment to load.
 */
Cypress.Commands.add('waitForAssessmentReadyState', () => {
  cy.waitUntil(
    () => {
      return Cypress.$('.jspsych-btn').length > 0 || Cypress.$('.instructionCanvasNS').length > 0;
    },
    {
      errorMsg: 'Failed to load the assessment before timeout',
      timeout: 120000,
      interval: 1000,
    },
  );
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
  cy.get('[data-cy="dropdown-select-administration"]').click();
  cy.get('body')
    .invoke('text')
    .then((text) => {
      if (text.includes(testAdministration)) {
        cy.get('.p-select-list-container').find('li').contains(testAdministration).click();
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
  cy.get('[data-cy=search-input]').type(`${testAdministration}{enter}`);
  cy.get('[data-cy="administration-card"]')
    .filter((index, element) => {
      return Cypress.$(element).find('[data-cy="administration-card__title"]').text().includes(testAdministration);
    })
    .then(($cards) => {
      cy.wrap($cards).should('have.length.greaterThan', 0);

      cy.wrap($cards.get(0)).find('button').contains('Show details').click();
    });
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
  cy.get('[data-cy="roar-data-table"] tbody tr').each((row) => {
    cy.wrap(row)
      .find('td.p-datatable-frozen-column')
      .then((cell) => {
        // Clean the non-breaking space character and any whitespace from the cell text.
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
 * Retrieve activation code
 *
 * @TODO: Move this to a programmatic utility function for faster activation code retrieval.
 *
 * @param {string} orgType - The type of the organization.
 * @param {string} orgName - The name of the organization.
 * @returns {string} - The activation code.
 */
Cypress.Commands.add('getActivationCode', (orgType, orgName) => {
  cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));

  // Wait to ensure that the login is successful.
  // @NOTE: This is currently required as the app is not immediately ready to navigate to the orgs list page.
  // @TODO: Remove this arbitrary wait once the app initialisation has been refactored and is stable.
  cy.wait(2000);

  cy.visit(APP_ROUTES.ORGS_LIST);

  // Wait for the orgs list page to load.
  cy.waitForOrganisationsList();

  // Navigate to the org tab.
  cy.get('ul > li').contains(orgType, { matchCase: false }).click();

  // Invoke the activation code retrieval button for the given org.
  cy.contains('td', orgName).parents('tr').find('[data-cy="data-table__event-btn__show-activation-code"]').click();

  // Invoke the activation code input field to get and return the value.
  cy.get('[data-cy="activation-code__input"]')
    .invoke('attr', 'value')
    .then((value) => {
      expect(value).to.not.be.empty;
      return value;
    });
});
