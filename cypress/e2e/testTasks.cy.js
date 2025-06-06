const dashboardUrl = "https://localhost:5173/signin";

// starts each task and checks that it has loaded (the 'OK' button is present)
function startTask(tasksRemaining) {
  cy.get("[data-pc-section=tablist]", {timeout: 30000}).children().then((taskTabs) => {
      
    cy.wrap(taskTabs.eq(tasksRemaining)).click(); 
    cy.scrollTo('bottomLeft');
    cy.contains("click to start", {matchCase: false}).click({force: true});

    cy.contains('OK', {timeout: 120000}).should('exist');

    cy.go('back');
    cy.get("[data-pc-section=tablist]", {timeout: 120000}).should('exist').then(() => {
      if (tasksRemaining === 0) {
        return; 
      } else {
        startTask(tasksRemaining - 1)
      }
    });
  });
}; 

describe('test core tasks from dashboard', () => {
  it('logs in to the dashboard and begins each task', () => {
    cy.intercept({ resourceType: /xhr|fetch/ }, { log: false });
    cy.visit(dashboardUrl);

    // input username
    cy.get("input").should("have.length", 2).then((inputs) => {
        cy.wrap(inputs[0]).type("57xpeiz2b4@levante.com");
    });

    // input password
    cy.get("input").should("have.length", 2).then((inputs) => {
        cy.wrap(inputs[1]).type("u31p03umu5");
    });

    // click go button
    cy.get("button").filter("[data-pc-name=button]").click();

    // check that each task loads
    cy.get("[data-pc-section=tablist]", {timeout: 120000}).children().then((children) => {
        const tasksToComplete = Array.from(children).length - 1; 
        startTask(tasksToComplete);
    }); 

    cy.contains("sign out", {matchCase: false}).click();
  });
});
