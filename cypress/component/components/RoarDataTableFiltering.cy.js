import RoarDataTable from '../../../src/components/RoarDataTable.vue';
import FilterBarSlot from '../../fixtures/component/roar-data-table/slots/FilterBarSlot.vue';
import columns from '../../fixtures/component/roar-data-table/props/columns.js';
import dataRandomized from '../../fixtures/component/roar-data-table/props/dataRandomized.js';
import lazyPreSorting from '../../fixtures/component/roar-data-table/props/lazyPreSorting';

const props = {
  columns: columns,
  data: dataRandomized,
  allowExport: true,
  exportFileName: 'datatable-export',
  pageLimit: 10,
  totalRecords: 57,
  loading: false,
  lazy: false,
  lazyPreSorting: lazyPreSorting,
  isInsideListOrgs: false,
  groupheaders: true,
};

const slots = {
  filterbar: FilterBarSlot,
};

const timeout = Cypress.env('timeout');

function resetData() {
  props.data = dataRandomized;
}

function mockFilterBySchool(school) {
  props.data = props.data.filter((object) => object.user.schoolName === school);
}

function mockFilterBySchools(schools = []) {
  props.data = props.data.filter((object) => schools.includes(object.user.schoolName));
}

function mockFilterByGrade(grade) {
  props.data = props.data.filter((object) => object.user.grade === grade);
}
function mockFilterByProgressCategory(header, category) {
  cy.log(`Checking ${header} for ${category}`);
  props.data = props.data.filter((object) => object.scores[header].tags.includes(category));
  cy.log(props.data);
}

function mockFilterByScoreCategory(header, category) {}

function mockFIltersByScoreCategory(header, category) {}

// function setFilterByGrade(grade) {
//   cy.get('[data-cy="filter-by-grade"]', { timeout: timeout }).click();
//   cy.get('ul > li', { timeout: timeout }).contains(grade).click();
//   cy.wait(0.05 * timeout);
// }

function setFilterByProgressCategory(header, category) {
  cy.contains('div.p-column-header-content', header).find('button').click();
  cy.get('[data-cy="score-filter-dropdown"]', { timeout: timeout }).click();
  cy.get('ul>li').find('.p-tag-value', { timeout: timeout }).contains(category).click();
  cy.get('button').contains('Apply').click();
  cy.wait(0.05 * timeout);
}

function setFilterByScoreCategory(header, category) {
  cy.contains('div.p-column-header-content', header).find('button').click();
  cy.get('[data-cy="score-filter-dropdown"]', { timeout: timeout }).click();
  cy.get('ul > li', { timeout: timeout }).contains(category).click();
  cy.get('button').contains('Apply').click();
  cy.wait(0.05 * timeout);
}

function checkTableColumn(headers, value) {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    headers.forEach((header) => {
      const headerIndex = tableHeaders.indexOf(header);

      if (headerIndex !== -1) {
        cy.get('[data-cy="roar-data-table"] tbody').each(($row) => {
          cy.wrap($row).find('tr').should('contain', value);
        });
      }
    });
  });
}

describe('<RoarDataTable />', () => {
  before(() => {
    cy.setAuthStore().as('authStore');
    // Set the viewport to a desktop screen
    cy.viewport(1920, 1080);
    // Mount the component with the props
  });
  it('Mounts with default data.', () => {
    cy.mount(RoarDataTable, { props: props, slots: slots });
  });
  // it('Mocks filtering by school.', () => {
  //   mockFilterBySchool('Maple Test School');
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   cy.wait(0.5 * timeout)
  // });
  //   it('Mocks filtering by multiple schools.', () => {
  //     resetData()
  //   mockFilterBySchools(['Birch Test School', 'Oak Test School']);
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   cy.wait(0.5 * timeout)
  // });
  // it('Mocks filtering by grade.', () => {
  //   resetData();
  //   mockFilterByGrade('6');
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   cy.wait(0.5 * timeout);
  // });
  // it('Mocks filtering by progress category.', () => {
  //   resetData();
  //   mockFilterByProgressCategory('letter', 'Assigned');
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   cy.wait(0.5 * timeout);
  // })
});
