import { defineComponent, reactive } from 'vue';
import AccountOwnerForm from './AccountOwnerForm.vue';

const AccountOwnerFormHarness = defineComponent({
  components: { AccountOwnerForm },
  setup() {
    const values = reactive({ firstName: '', lastName: '', email: '', password: '' });

    function setField(field, value) {
      values[field] = value;
    }

    return { setField, values };
  },
  template: `
    <main data-testid="registration-shell" style="box-sizing: border-box; width: 100%; padding: 1rem;">
      <section
        data-testid="registration-card"
        style="box-sizing: border-box; width: 100%; max-width: 29rem; margin-inline: auto; padding: 1.25rem;"
      >
        <AccountOwnerForm
          :values="values"
          :errors="{ firstName: '', lastName: '', email: '', password: '' }"
          :touched="{ firstName: false, lastName: false, email: false, password: false }"
          verification-token="verified"
          @update:field="setField"
        />
      </section>
    </main>
  `,
});

const ChallengeV3Stub = { template: '<div><slot /></div>' };

function mountAt(width, height) {
  cy.viewport(width, height);
  cy.mount(AccountOwnerFormHarness, {
    global: { stubs: { ChallengeV3: ChallengeV3Stub } },
  });
}

describe('<AccountOwnerForm /> quality evidence', () => {
  [
    { label: 'desktop', width: 1280, height: 900, expectedColumns: 2 },
    { label: 'mobile', width: 320, height: 800, expectedColumns: 1 },
  ].forEach(({ label, width, height, expectedColumns }) => {
    it(`stays contained at the ${label} viewport`, () => {
      mountAt(width, height);

      cy.findByTestId('registration-card').then(($card) => {
        const card = $card[0];
        const bounds = card.getBoundingClientRect();

        expect(bounds.left).to.be.at.least(0);
        expect(bounds.right).to.be.at.most(width);
        expect(card.scrollWidth).to.be.at.most(card.clientWidth);
      });

      cy.get('.self-registration-name-fields').then(($fields) => {
        const columns = getComputedStyle($fields[0]).gridTemplateColumns.split(' ').filter(Boolean);
        expect(columns).to.have.length(expectedColumns);
      });

      cy.window().then((window) => {
        expect(window.document.documentElement.scrollWidth).to.be.at.most(window.innerWidth);
      });

      cy.findByTestId('registration-card').screenshot(`account-owner-form-${label}`);
    });
  });

  it('exposes persistent labels, field semantics, and password guidance', () => {
    mountAt(1280, 900);

    cy.get('label[for="account-owner-first-name"]').should('contain.text', 'First name');
    cy.get('#account-owner-first-name').should('have.attr', 'required').and('have.attr', 'autocomplete', 'given-name');
    cy.get('label[for="account-owner-last-name"]').should('contain.text', 'Last name');
    cy.get('#account-owner-last-name').should('have.attr', 'required').and('have.attr', 'autocomplete', 'family-name');
    cy.get('label[for="account-owner-email"]').should('contain.text', 'Email address');
    cy.get('#account-owner-email').should('have.attr', 'type', 'email').and('have.attr', 'autocomplete', 'email');
    cy.get('label[for="account-owner-password"]').should('contain.text', 'Password');
    cy.get('#account-owner-password')
      .should('have.attr', 'autocomplete', 'new-password')
      .and('have.attr', 'aria-describedby', 'account-owner-password-help');
    cy.get('#account-owner-password-help').should('contain.text', 'at least 8 characters');
  });
});
