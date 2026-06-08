import { getRegisteredVariants } from '../support/query';
import { useFirebaseEmulator, signInAsSuperAdmin, mapVariantParameters } from '../support/utils';
import { generatedTestTemplate } from '../fixtures/generatedTestTemplate';
import { TIMEOUT, TASK, TEST_DIR_NAME, COMMAND } from '../support/constants';

const { auth, db } = useFirebaseEmulator('assessmentDev');

describe('Generating variant tests.', () => {
  before(() => {
    signInAsSuperAdmin(auth);
  });
  it('Creates a test spec for each variant.', () => {
    cy.wrap(getRegisteredVariants(db, TASK), { timeout: TIMEOUT }).then((docs) => {
      docs.forEach((variant) => {
        cy.log(`Found registered variant: ${variant.name} with params: ${JSON.stringify(variant.params)}`);

        const useParameterValidation = 'true';
        const variantParams = `${mapVariantParameters(variant.params)}&useParameterValidation=${useParameterValidation}`;

        // Create a test spec for each registered variant
        cy.writeFile(
          `${TEST_DIR_NAME}/${variant.name}.cy.js`,
          generatedTestTemplate({
            command: COMMAND,
            name: variant.name,
            params: variantParams,
          }),
        ).then(() => {
          cy.log('Successfully created test spec:', variant.name);
        });
      });
    });
  });
});
