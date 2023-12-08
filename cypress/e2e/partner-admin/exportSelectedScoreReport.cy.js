const testDistrictId = "7jVdHAcyqf8XQ7wS2Fxr";
const testAdministrationId = "TnCqCLxjjeisUQrpPoBA";
const timeout = Cypress.env("timeout");
const baseUrl = Cypress.env("baseUrl");
const testPartnerAdministrationName = Cypress.env(
    "testPartnerAdministrationName"
);
const testPartnerAdminUsername = Cypress.env("partnerAdminUsername");
const testPartnerAdminPassword = Cypress.env("partnerAdminPassword");

function checkAdministrationCardTitle() {
    cy.get('[data-cy="h2-card-admin-title"]', { timeout: timeout }).should(
        "contain",
        testPartnerAdministrationName
    );
}

describe("The partner admin can select and export progress reports for a given administration.", () => {
    it("Selects an administration and views its progress report", () => {
        cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
        cy.navigateTo("/");
        checkAdministrationCardTitle();
        cy.get("button").contains("Show details").first().click();
        cy.get("button").contains("Score").first().click();

        // make a selection
        cy.get(".p-checkbox-box").first().click()

        cy.get("button").contains("Export Selected").click();
        cy.readFile(`${Cypress.env("cypressDownloads")}/roar-scores-selected.csv`)
    });
});
