import RoarDataTable from '../../../src/components/RoarDataTable.vue';
import FilterBarSlot from '../../fixtures/component/roar-data-table/slots/FilterBarSlot.vue';
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
function mockFilterByCategory(task, category) {
  props.data = props.data.filter((object) => object.scores[task].tags.includes(category));
}

function mockFilterBySupportCategory(task, supportLevel) {
  props.data = props.data.filter((object) => object.scores[task].supportLevel === supportLevel);
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
  });
  it('Mounts with default data.', () => {
    cy.mount(RoarDataTable, { props: props, slots: slots });
  });
  it('Mocks filtering by school.', () => {
    const school = 'Maple Test School';
    const headers = ['School'];

    mockFilterBySchool(school);
    cy.mount(RoarDataTable, { props: props, slots: slots });

    cy.wait(0.1 * timeout);

    checkTableColumn(headers, [school]);
  });
  it('Mocks filtering by multiple schools.', () => {
    const headers = ['School'];
    const schools = ['Birch Test School', 'Oak Test School'];

    mockFilterBySchools(schools);

    cy.mount(RoarDataTable, { props: props, slots: slots });
    cy.wait(0.1 * timeout);

    checkTableColumn(headers, schools);
  });
  it('Mocks filtering by grade.', () => {
    const headers = ['Grade'];
    const grade = ['6'];

    mockFilterByGrade('6');

    cy.mount(RoarDataTable, { props: props, slots: slots });
    cy.wait(0.1 * timeout);

    checkTableColumn(headers, grade);
  });
  it('Mocks filtering by support level category', () => {
    const task = 'letter';
    const supportLevel = 'Achieved Skill';
    const headers = ['Username'];

    mockFilterBySupportCategory(task, supportLevel);

    // Get the list of users matching the mock filter
    const users = props.data.map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props, slots: slots });
    cy.wait(0.1 * timeout);

    // Check if the users are displayed in the table
    checkTableColumn(headers, users);
  });
  it('Mocks filtering by progress category.', () => {
    const task = 'morphology';
    const category = 'Assigned';
    const headers = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(category))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props, slots: slots });
    cy.wait(0.1 * timeout);

    checkTableColumn([headers], users);
  });
});
