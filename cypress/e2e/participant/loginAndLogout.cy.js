describe("Cypress test to login and play picture vocab as participant", () => {
    it("passes", () => {
        // this is a user that has an assignment of roarVocab -- how can we create a user that can
        // ALWAYS play the game
        let test_login = "testingUser4";
        let test_pw = "password4";
        // how can we write some logic to reset the already played

        cy.login(test_login, test_pw);

        cy.wait(1000);
        cy.get("button").contains("Sign Out").click();

        // successfully back at Login page
        cy.contains("Welcome to ROAR!")
    });
});
