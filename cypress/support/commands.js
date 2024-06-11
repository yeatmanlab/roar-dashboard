Cypress.Commands.add('login', (username, password) => {
  cy.session(
    [username, password],
    () => {
      cy.visit('/', { timeout: Cypress.env('timeout') });
      cy.get('[data-cy="input-username-email"]').type(username, { log: false, timeout: Cypress.env('timeout') });
      cy.get('[data-cy="input-password"]').type(password, { log: false, timeout: Cypress.env('timeout') });
      cy.get('button')
        .contains('Go!', { timeout: Cypress.env('timeout') })
        .click();
      cy.log('Login successful.').wait(3000);
    },
    {
      // validate: () => {
      //     cy.getCookie(Cypress.env('sessionCookieName')).should("exist")
      //     // Maybe a function to GET and VALIDATE the current cookie between tests?
      //     // cy.getCookie(Cypress.env('sessionCookieName')).should('have.property', 'value', Cypress.env('sessionCookieValue'))
      //     }
    },
  );
});

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

Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="button-sign-out"]', { timeout: Cypress.env('timeout') }).click();
  cy.get('h1', { timeout: Cypress.env('timeout') }).should('contain.text', 'Welcome to ROAR!');
  cy.url({ timeout: Cypress.env('timeout') }).should('eq', `${Cypress.env('baseUrl')}/signin`);
  cy.log('Logout successful.');
});

Cypress.Commands.add('navigateTo', (page, login = false) => {
  cy.log(`Navigating to \`${Cypress.env('baseUrl')}${page}`);
  cy.visit(page, { timeout: Cypress.env('timeout') });
  cy.url().should('eq', `${Cypress.env('baseUrl')}${page}`);
});

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

Cypress.Commands.add('activateAdminSidebar', () => {
  cy.get('[data-cy="button-admin-sidebar"]').click();
  cy.wait(1000);
});

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
      } else {
        cy.log('Administration not found, retrying...');
        selectAdministration(testAdministration, retries + 1);
      }
    });
});

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

Cypress.Commands.add('switchToOptionalAssessments', () => {
  cy.get("[data-cy='switch-show-optional-assessments']").click();
});

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

Cypress.Commands.add('playOptionalGame', (game, administration, optional) => {
  return cy.wrap(null).then(() => {
    return game?.testSpec(administration, optional);
  });
});

Cypress.Commands.add('loginByGoogleApi', () => {
  cy.log('Logging in to Google');
  cy.request({
    method: 'POST',
    url: 'https://www.googleapis.com/oauth2/v4/token',
    body: {
      grant_type: 'refresh_token',
      client_id: Cypress.env('googleClientId'),
      client_secret: Cypress.env('googleClientSecret'),
      refresh_token: Cypress.env('googleRefreshToken'),
    },
  }).then(({ body }) => {
    const { access_token, id_token } = body;

    cy.request({
      method: 'GET',
      url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      headers: { Authorization: `Bearer ${access_token}` },
    }).then(({ body }) => {
      cy.log(body);
      const userItem = {
        token: id_token,
        user: {
          googleId: body.sub,
          email: body.email,
          givenName: body.given_name,
          familyName: body.family_name,
          imageUrl: body.picture,
        },
      };

      window.localStorage.setItem('googleCypress', JSON.stringify(userItem));
      // cy.visit('https://localhost:5173/')
    });
  });
});
