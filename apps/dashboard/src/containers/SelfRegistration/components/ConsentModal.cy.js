import ConsentModal from './ConsentModal.vue';

const PvDialogStub = {
  props: ['visible', 'header'],
  emits: ['update:visible'],
  template: `
    <section v-if="visible" role="dialog" :aria-label="header">
      <slot />
      <footer><slot name="footer" /></footer>
    </section>
  `,
};

function mountModal(document) {
  cy.mount(ConsentModal, {
    props: { visible: true, document },
    global: { stubs: { Dialog: PvDialogStub, PvDialog: PvDialogStub } },
  });
}

describe('<ConsentModal /> sanitization', () => {
  it('strips executable markup from the loaded legal document', () => {
    mountModal({
      id: 'consent-behavioral-eye-tracking',
      version: 'v1',
      text: [
        '# Approved consent',
        '<script>window.__unsafeConsentScript = true</script>',
        '<img src="invalid" onerror="window.__unsafeConsentImage = true">',
      ].join('\n\n'),
    });

    cy.get('.self-registration-consent-markdown').as('document');
    cy.get('@document').should('contain.text', 'Approved consent');
    cy.get('@document').find('script').should('not.exist');
    cy.get('@document').find('img').should('not.have.attr', 'onerror');
    cy.get('@document').invoke('html').should('not.contain', '__unsafeConsent');
    cy.window().should((window) => {
      expect(window.__unsafeConsentScript).to.be.undefined;
      expect(window.__unsafeConsentImage).to.be.undefined;
    });
  });
});
