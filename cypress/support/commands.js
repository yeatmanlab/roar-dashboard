Cypress.Commands.add('login', (username, password) => {
    cy.session([username, password],
() => {
        cy.visit('/')
        cy.get('[data-cy="input-username-email"]').type(username, {log: false})
        cy.get('[data-cy="input-password"]').type(password, {log: false})
        cy.get("button").contains("Go!").click()
        cy.log("Login successful.").wait(3000)
    },
{
        validate: () => {
            cy.getCookie(Cypress.env('sessionCookieName')).should("exist")
            // Maybe a function to GET and VALIDATE the current cookie between tests?
            // cy.getCookie(Cypress.env('sessionCookieName')).should('have.property', 'value', Cypress.env('sessionCookieValue'))
            }
        }
    )
})

Cypress.Commands.add('navigateTo', (page, login = false) => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    cy.log(`Navigating to \`${Cypress.env('baseUrl')}${page}`)
    cy.visit(page)
})


Cypress.Commands.add('activateAdminSidebar', () => {
    cy.get('[data-cy="button-admin-sidebar"]').click().wait(1000)
})


Cypress.Commands.add('inputOrgDetails', (
    orgName,
    orgInitials,
    orgNcesId,
    orgAddress,
    orgGrade,
    orgTag ) => {

    cy.get('[data-cy="input-org-name"]').type(orgName)
    cy.get('[data-cy="input-org-initials"]').type(orgInitials)

    if (orgNcesId) {
        cy.get('[data-cy="input-nces-id"]').type(orgNcesId)
    }

    if (orgGrade) {
        cy.get('[data-cy="dropdown-grade"').click().get('li').contains(orgGrade).click()
    }

    if (orgAddress) {
        cy.get('[data-cy="input-address"]').type(`${orgAddress}`).wait(1000).type('{downarrow}{enter}').wait(1000)
        expect(cy.get('[data-cy="chip-address"]').should('contain.text', orgAddress))
    }

    cy.get('[data-cy="input-autocomplete"]').type(orgTag).wait(1000).type('{downarrow}{enter}')
    cy.get('[data-pc-section="dropdownbutton"]').click()
    cy.get('li').contains('test').click()
})

Cypress.Commands.add('loginByGoogleApi', () => {
    cy.log('Logging in to Google')
    cy.request({
        method: "POST",
        url: "https://www.googleapis.com/oauth2/v4/token",
        body: {
            grant_type: "refresh_token",
            client_id: Cypress.env("googleClientId"),
            client_secret: Cypress.env("googleClientSecret"),
            refresh_token: Cypress.env("googleRefreshToken"),
        },
    }).then(({ body }) => {
        const { access_token, id_token } = body;

        cy.request({
            method: "GET",
            url: "https://www.googleapis.com/oauth2/v3/userinfo",
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

            window.localStorage.setItem(
                "googleCypress",
                JSON.stringify(userItem)
            );
            // cy.visit('https://localhost:5173/')
        });
    });
});
