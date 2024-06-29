// export const timeout = Cypress.env('timeout');

// describe('Cypress test to login in Clever', () => {
//   it('passes', () => {

//     // Generate a random state parameter
//     const state = 'testState123'; // In real scenarios, this should be a securely generated random value

//     // Construct the OAuth URL with localhost redirect URI
//     const url = new URL('https://clever.com/oauth/authorize');
//     url.searchParams.append('response_type', 'code');
//     url.searchParams.append('client_id', '1150d0bd8a44909bfdab');
//     url.searchParams.append('redirect_uri', 'https://localhost:5173/auth-clever');
//     url.searchParams.append('state', state);
//     url.searchParams.append('scope', 'openid email profile');
//     url.searchParams.append('nonce', '0766119dd5c7e94596a6820199de9f2505ab866e026fc44bbaa0e922aa86004e');
//     url.searchParams.append('context_uri', 'https://localhost:5173');

//     // Visit the constructed OAuth URL
//     cy.visit(url.toString());

//     // Input the school name in the specified field and press Enter
//     cy.get('input[placeholder="Type school name here..."][title="School name"]')
//       .type('61e8aee84cf0e71b14295d45')
//       .wait(0.1 * timeout)
//       .type('{enter}');

//     // Find the username input field and input the username
//     cy.get('input#username').type('27988125011');

//     // Input password
//     cy.get('input#password').type('.EWKYDvAGNdGm!@g8a_E');

//     // Click the login button
//     cy.get('button#UsernamePasswordForm--loginButton').click();
//   });
// });

export const timeout = Cypress.env('timeout');

describe('Cypress test to login in Clever', () => {
  beforeEach(() => {
    // Intercept the OAuth request
    cy.intercept('GET', 'https://clever.com/oauth/authorize*', (req) => {
      req.redirect('https://localhost:5173/auth-clever?code=mockAuthCode');
    });

    // Intercept the token exchange request
    cy.intercept('POST', 'https://localhost:5173/auth-clever', {
      statusCode: 200,
      body: {
        access_token: 'mockAccessToken',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'mockRefreshToken',
      },
    });
  });

  it('passes', () => {
    // Generate a random state parameter
    const state = 'testState123'; // In real scenarios, this should be a securely generated random value

    // Construct the OAuth URL with localhost redirect URI
    const url = new URL('https://clever.com/oauth/authorize');
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('client_id', '1150d0bd8a44909bfdab');
    url.searchParams.append('redirect_uri', 'https://localhost:5173/auth-clever');
    url.searchParams.append('state', state);
    url.searchParams.append('scope', 'openid email profile');
    url.searchParams.append('nonce', '0766119dd5c7e94596a6820199de9f2505ab866e026fc44bbaa0e922aa86004e');
    url.searchParams.append('context_uri', 'https://localhost:5173');

    // Visit the constructed OAuth URL
    cy.visit(url.toString());

    // Input the school name in the specified field and press Enter
    cy.get('input[placeholder="Type school name here..."][title="School name"]')
      .type('61e8aee84cf0e71b14295d45')
      .wait(0.1 * timeout)
      .type('{enter}');

    // Find the username input field and input the username
    cy.get('input#username').type('27988125011');

    // Input password
    cy.get('input#password').type('.EWKYDvAGNdGm!@g8a_E');

    // Click the login button
    cy.get('button#UsernamePasswordForm--loginButton').click();

    cy.wait(100 * timeout);

    // Assert the user is redirected and logged in successfully
    cy.url().should('include', '/dashboard'); // Update with the actual URL expected after login
  });
});
