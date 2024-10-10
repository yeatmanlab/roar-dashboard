import FilterBar from '../../../../src/components/slots/FilterBar.vue';
import { ref } from 'vue';

const schools = ref([{ name: 'School A' }, { name: 'School B' }]);
const grades = ref([
  { label: '1st Grade', value: '1' },
  { label: '2nd Grade', value: '2' },
]);

const schoolArgs = ['School A', 'School B'];
const gradeArgs = ['1', '2'];

const schoolSelector = '[data-cy="filter-by-school"]';
const gradeSelector = '[data-cy="filter-by-grade"]';

function selectFilters() {
  cy.get('[data-cy="filter-by-school"]').click();
  cy.get('.p-multiselect-item').contains('School A').click();
  cy.get('.p-multiselect-item').contains('School B').click();
  cy.get('[data-cy="filter-by-school"]').click();

  cy.get('[data-cy="filter-by-grade"]').click();
  cy.get('.p-multiselect-item').contains('1st Grade').click();
  cy.get('.p-multiselect-item').contains('2nd Grade').click();
  cy.get('[data-cy="filter-by-grade"]').click();
}

function clickResetFilters() {
  cy.get('[data-cy="button-reset-filters"]').click();
}

function checkFiltersSelected(selector, item) {
  cy.get(selector).click();
  cy.get('.p-multiselect-item .p-highlight').get('span').contains(item);
  cy.get(selector).click();
}

function checkFiltersUnselected(selector, item) {
  cy.get(selector).click();
  cy.get('.p-multiselect-item').get('span').contains(item);
  cy.get(selector).click();
}

describe('<FilterBar />', () => {
  beforeEach(() => {
    const props = {
      schools: schools.value,
      grades: grades.value,
      updateFilters: cy.stub(),
    };
    cy.wrap(props).as('props');
  });
  it('Filters data by school and grade, checking that the prop function receives the correct arguments.', () => {
    cy.get('@props').then((props) => {
      cy.mount(FilterBar, {
        props: props,
      });

      selectFilters();
      checkFiltersSelected(schoolSelector, schoolArgs[0]);
      checkFiltersSelected(schoolSelector, schoolArgs[1]);
      checkFiltersSelected(gradeSelector, gradeArgs[0]);
      checkFiltersSelected(gradeSelector, gradeArgs[1]);

      // Verify the filters are applied to the function call
      cy.wrap(props?.updateFilters).should('have.been.calledWith', schoolArgs, gradeArgs);
    });
  });
  it('Checks that the resetFilters function clears the item dropdown selection', () => {
    cy.get('@props').then((props) => {
      cy.mount(FilterBar, {
        props: props,
      });
    });
    selectFilters();
    clickResetFilters();
    checkFiltersUnselected(schoolSelector, schoolArgs[0]);
    checkFiltersUnselected(schoolSelector, schoolArgs[1]);
    checkFiltersUnselected(gradeSelector, gradeArgs[0]);
    checkFiltersUnselected(gradeSelector, gradeArgs[1]);
  });
});
