export const generatedTestTemplate = ({ command = null, name = null, params = null } = {}) => `
describe('Test play through of variant: ${name}', () => {
  it('Plays the generated test spec.', () => {
    ${command}({
        variantParams: '${params}'
    });
  });
});
`;
