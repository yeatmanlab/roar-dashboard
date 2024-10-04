// cypress/component/FilterBar.cy.js
import FilterBar from '@/components/slots/FilterBar.vue';
import { ref } from 'vue';

// Mock data
const schools = ref([{ name: 'School A' }, { name: 'School B' }]);
const grades = ref([
  { label: '1st Grade', value: '1' },
  { label: '2nd Grade', value: '2' },
]);

const schoolArgs = ['School A', 'School B'];
const gradeArgs = ['1', '2'];

describe('<FilterBar />', () => {
  it('filters data by school and grade, checking that the prop function receives the correct arguments.', () => {
    const props = {
      schools: schools.value,
      grades: grades.value,
      updateFilters: cy.stub(),
    };

    cy.mount(FilterBar, {
      props: props,
    });

    // Select the schools and grades filters
    cy.get('[data-cy="filter-by-school"]').click();
    cy.get('.p-multiselect-item').contains('School A').click();
    cy.get('.p-multiselect-item').contains('School B').click();
    cy.get('body').click();

    cy.get('[data-cy="filter-by-grade"]').click();
    cy.get('.p-multiselect-item').contains('1st Grade').click();
    cy.get('.p-multiselect-item').contains('2nd Grade').click();

    // Verify the filters are applied to the function call
    cy.wrap(props.updateFilters).should('have.been.calledWith', schoolArgs, gradeArgs);
  });
});
