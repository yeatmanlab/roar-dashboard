Cypress.Commands.add("login", (username, password) => {
    cy.visit("/");
    cy.clearCookies()

    cy.get('[data-cy="input-username-email"]').type(username, { log: false });
    cy.get('[data-cy="input-password"]').type(password, { log: false });
    cy.get("button").contains("Go!").click();
});

Cypress.Commands.add("activateAdminSidebar", () => {
    cy.get('[data-cy="button-admin-sidebar"]').click();
});

Cypress.Commands.add('navigateToListOrgsPage', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    // Temporary workaround; waiting for adminSidebar component to properly show all the admin sidebar buttons.
    cy.wait(3000)
    cy.visit("/list-orgs")
    cy.wait(3000)

    // cy.activateAdminSidebar()
    // cy.get("button").contains("List organizations").click()
})

Cypress.Commands.add('navigateToCreateOrgsPage', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    // Temporary workaround; waiting for adminSidebar component to properly show all the admin sidebar buttons.
    cy.wait(3000)
    cy.visit("/create-orgs")
    cy.wait(3000)

    // cy.activateAdminSidebar()
    // cy.get("button").contains("Create organizations").click()
})

Cypress.Commands.add('navigateToRegisterStudentsPage', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    // Temporary workaround; waiting for adminSidebar component to properly show all the admin sidebar buttons.
    cy.wait(3000)
    cy.visit("/register-students")
    cy.wait(3000)

    // cy.activateAdminSidebar()
    // cy.get("button").contains("Create organizations").click()
})

Cypress.Commands.add('navigateToRegisterAdministratorPage', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    // Temporary workaround; waiting for adminSidebar component to properly show all the admin sidebar buttons.
    cy.wait(3000)
    cy.visit("/register-administrator")
    cy.wait(3000)

    // cy.activateAdminSidebar()
    // cy.get("button").contains("Create organizations").click()
})

Cypress.Commands.add('navigateToCreateAdministrationPage', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    // Temporary workaround; waiting for adminSidebar component to properly show all the admin sidebar buttons.
    cy.wait(3000)
    cy.visit("/create-administration")
    cy.wait(3000)

    // cy.activateAdminSidebar()
    // cy.get("button").contains("Create organizations").click()
})

Cypress.Commands.add('navigateToRegisterTaskPage', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'))
    // Temporary workaround; waiting for adminSidebar component to properly show all the admin sidebar buttons.
    cy.wait(3000)
    cy.visit("/register-game")
    cy.wait(3000)

    // cy.activateAdminSidebar()
    // cy.get("button").contains("Create organizations").click()
})

Cypress.Commands.add("loginByGoogleApi", () => {
    cy.log("Logging in to Google");
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
