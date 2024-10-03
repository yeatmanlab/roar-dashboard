import RoarDataTable from '../../../src/components/RoarDataTable.vue';
import FilterBarSlot from '../../../src/components/slots/FilterBar.vue';
import columns from '../../fixtures/component/roar-data-table/props/columns.js';
import dataRandomized from '../../fixtures/component/roar-data-table/props/dataRandomized.js';

const props = {
  columns: columns,
  data: dataRandomized,
  allowExport: true,
  exportFileName: 'datatable-export',
  pageLimit: 10,
  totalRecords: 57,
  loading: false,
  lazy: false,
  isInsideListOrgs: false,
  groupheaders: true,
};

const slots = {
  filterbar: FilterBarSlot,
};

const timeout = Cypress.env('timeout');
const tableHeaderOffset = 4;

// Use this data to compare against the data being filtered by the component
let mockFilteredData;

function resetData() {
  mockFilteredData = JSON.parse(JSON.stringify(props.data));
  props.data = dataRandomized;
}

function mockFilterBySchool(school) {
  mockFilteredData = mockFilteredData.filter((object) => object.user.schoolName === school);
}

function mockFilterBySchools(schools = []) {
  mockFilteredData = mockFilteredData.filter((object) => schools.includes(object.user.schoolName));
}

function mockFilterByGrade(grade) {
  mockFilteredData = mockFilteredData.filter((object) => object.user.grade === grade);
}

function mockFilterByCategory(task, category) {
  mockFilteredData = mockFilteredData.filter((object) => object.scores[task].tags.includes(category));
}

function mockFilterBySupportLevelCategory(task, supportLevel) {
  mockFilteredData = mockFilteredData.filter((object) => object.scores[task].supportLevel === supportLevel);
}
function setFilterBySchool(school) {
  cy.get('[data-cy="filter-by-school"]', { timeout: timeout }).click();
  cy.get('ul > li', { timeout: timeout }).contains(school).click();
  cy.wait(0.05 * timeout);
}

function setFilterByCategory(header, category) {
  cy.contains('div.p-column-header-content', header).find('button').click();
  cy.get('[data-cy="score-filter-dropdown"]', { timeout: timeout }).click();
  cy.get('ul > li', { timeout: timeout }).contains(category).click();
  cy.get('button').contains('Apply').click();
  cy.wait(0.05 * timeout);
}

function checkTableColumn(headers, values = []) {
  cy.get('thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    headers.forEach((header) => {
      const headerIndex = tableHeaders.indexOf(header);

      if (headerIndex !== -1) {
        cy.get('tbody tr ').each(($row) => {
          cy.wrap($row)
            .find('td')
            .eq(headerIndex - tableHeaderOffset)
            .then(($cell) => {
              const cellText = $cell.text();
              cy.wrap(cellText).should('be.oneOf', values);
            });
        });
      }
    });
  });
}

describe('<RoarDataTable />', () => {
  beforeEach(() => {
    cy.log('Resetting data.');
    resetData();
    cy.viewport(1920, 1080);
  });
  it('Mounts with default data.', () => {
    cy.mount(RoarDataTable, { props: props, slots: slots });
  });
  // it('Mocks filtering by school.', () => {
  //   const school = 'Maple Test School';
  //   const headers = ['School'];
  //
  //   mockFilterBySchool(school);
  //   cy.log('Filtered data:', mockFilteredData);
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   setFilterBySchool(school);
  //   cy.wait(0.1 * timeout);
  //
  //   // checkTableColumn(headers, [school]);
  // });
  // it('Mocks filtering by multiple schools.', () => {
  //   const headers = ['School'];
  //   const schools = ['Birch Test School', 'Oak Test School'];
  //
  //   mockFilterBySchools(schools);
  //
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   cy.wait(0.1 * timeout);
  //
  //   checkTableColumn(headers, schools);
  // });
  // it('Mocks filtering by grade.', () => {
  //   const headers = ['Grade'];
  //   const grade = ['6'];
  //
  //   mockFilterByGrade('6');
  //
  //   cy.mount(RoarDataTable, { props: props, slots: slots });
  //   cy.wait(0.1 * timeout);
  //
  //   checkTableColumn(headers, grade);
  // });
  it('Mocks filtering by support level category', () => {
    const task = 'letter';
    const tag = 'Achieved Skill';
    const assessment = 'ROAR - Letter';
    const category = 'Green';
    const column = ['Username'];

    // Filter the mock data by the support level category
    mockFilterBySupportLevelCategory(task, tag);

    // Get the list of users matching the mock filter
    const users = mockFilteredData.map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props, slots: slots });
    cy.wait(0.1 * timeout);

    // Filter the prop data by the support level category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment progress category.', () => {
    const task = 'morphology';
    const tag = 'Assigned';
    const assessment = 'ROAR - Morphology';
    const category = 'assigned';
    const column = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(tag))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props, slots: slots });
    cy.wait(0.1 * timeout);

    setFilterByCategory(assessment, category);

    checkTableColumn(column, users);
  });
});
