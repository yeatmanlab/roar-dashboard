// converts fractions or 2-term fraction addition or subtraction problems into MathML
// e.g. accepts forms: single fractions "1/4", addition "3/4+1/4", or subtraction "4/5-1/2"
export function fractionToMathML(problem: string) {
  if (typeof problem === 'number' || !problem.includes('/')) return problem;
  // Identify the operation: addition or subtraction
  const operation = problem.includes('-') ? '-' : '+';

  // Split the problem into parts based on the operation
  const parts = problem.split(operation);

  // Function to create MathML for a single fraction
  const createFractionMathML = (fraction: string) => {
    const [numerator, denominator] = fraction.split('/');
    return `<mfrac><mrow><mn>${numerator}</mn></mrow><mrow><mn>${denominator}</mn></mrow></mfrac>`;
  };

  // Convert each fraction into MathML
  const fractionsMathML = parts.map((part) => createFractionMathML(part.trim()));

  // Combine everything into a single MathML expression, handling the case of single fractions as well
  const operatorMathML = parts.length > 1 ? `<mo>${operation}</mo>` : '';
  const resultMathML = `<math xmlns="http://www.w3.org/1998/Math/MathML">
        <mrow>
            ${fractionsMathML.join(operatorMathML)}
            ${parts.length > 1 ? '<mo>=</mo>' : ''}
        </mrow>
    </math>`;

  return resultMathML;
}
