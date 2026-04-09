import RoarDataTable from './RoarDataTable.vue';
import columns from '../../../cypress/fixtures/component/roar-data-table/props/columns';
import dataRandomized from '../../../cypress/fixtures/component/roar-data-table/props/dataRandomized';

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
  taskScoringVersions: {},
};

// Use this data to compare against the data being filtered by the component
let mockFilteredData;

function resetData() {
  cy.log('Resetting data.');
  props.data = dataRandomized;
  mockFilteredData = JSON.parse(JSON.stringify(props.data));
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

function setFilterByCategory(header, category, forceClick = false) {
  cy.contains('[data-testid="column-header-cell"]', header).find('button').click();
  cy.get('[data-cy="data-table__score-filter-dropdown"]').click();
  cy.findByTestId('score__list').contains(category).click({ force: forceClick });
  cy.get('button').contains('Apply').click();
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
            .eq(headerIndex)
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
    resetData();
  });
  it('Mounts with default data.', () => {
    // Mount the component with the default data
    cy.mount(RoarDataTable, { props: props });
  });
  it('Mocks filtering by school.', () => {
    const school = 'Maple Test School';
    const headers = ['School'];

    // Filter the mock data by the school
    mockFilterBySchool(school);
    props.data = mockFilteredData;

    // Mount the component with the filtered data
    cy.mount(RoarDataTable, { props: props });

    // Check that the table column matches the mock data
    checkTableColumn(headers, [school]);
  });
  it('Mocks filtering by multiple schools.', () => {
    const headers = ['School'];
    const schools = ['Birch Test School', 'Oak Test School'];

    // Filter the mock data by the schools
    mockFilterBySchools(schools);
    props.data = mockFilteredData;

    // Mount the component with the filtered data
    cy.mount(RoarDataTable, { props: props });

    // Check that the table column matches the mock data
    checkTableColumn(headers, schools);
  });
  it('Mocks filtering by grade.', () => {
    const headers = ['Grade'];
    const grade = ['6'];

    // Filter the mock data by the grade
    mockFilterByGrade('6');
    props.data = mockFilteredData;

    // Mount the component with the filtered data
    cy.mount(RoarDataTable, { props: props });

    // Check that the table column matches the mock data
    checkTableColumn(headers, grade);
  });
  it('Mocks filtering by support level Green.', () => {
    const task = 'letter';
    const tag = 'Achieved Skill';
    const assessment = 'ROAR - Letter';
    const category = 'Green';
    const column = ['Username'];

    // Filter the mock data by the support level category
    mockFilterBySupportLevelCategory(task, tag);

    // Get the list of users matching the mock filter
    const users = mockFilteredData.map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by support level Yellow.', () => {
    const task = 'vocab';
    const tag = 'Developing Skill';
    const assessment = 'ROAR - Picture Vocab';
    const category = 'Yellow';
    const column = ['Username'];

    // Filter the mock data by the support level category
    mockFilterBySupportLevelCategory(task, tag);

    // Get the list of users matching the mock filter
    const users = mockFilteredData.map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by support level Pink.', () => {
    const task = 'trog';
    const tag = 'Needs Extra Support';
    const assessment = 'ROAR - Syntax';
    const category = 'Pink';
    const column = ['Username'];

    // Filter the mock data by the support level category
    mockFilterBySupportLevelCategory(task, tag);

    // Get the list of users matching the mock filter
    const users = mockFilteredData.map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment Assigned.', () => {
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

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment Started.', () => {
    const task = 'vocab';
    const tag = 'Started';
    const assessment = 'ROAR - Picture Vocab';
    const category = 'started';
    const column = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(tag))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI

    // @TODO: For some reason, Cypress believes that it cannot click the started
    // label span element. It claims that it is being covered by another
    // element. I cannot reproduce by hand. Following
    // https://docs.cypress.io/app/references/error-messages#cy-failed-because-the-element-cannot-be-interacted-with,
    // I tried `{waitForAnimations: false}` and `{animationDistanceThreshold:
    // 20}` but neither worked. So I added the `force` option. This should be
    // removed once we figure out how to convince Cypress that you actually can
    // click on this element.
    setFilterByCategory(assessment, category, true);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment Complete.', () => {
    const task = 'letter';
    const tag = 'Complete';
    const assessment = 'ROAR - Letter';
    const category = 'complete';
    const column = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(tag))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment Assessed.', () => {
    const task = 'swr';
    const tag = 'Assessed';
    const assessment = 'ROAR - Word';
    const category = 'Assessed';
    const column = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(tag))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment Unreliable.', () => {
    const task = 'sre';
    const tag = 'Unreliable';
    const assessment = 'ROAR - Sentence';
    const category = 'Unreliable';
    const column = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(tag))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
  it('Mocks filtering by assignment Optional.', () => {
    const task = 'pa';
    const tag = 'Optional';
    const assessment = 'ROAR - Phoneme';
    const category = 'Optional';
    const column = ['Username'];

    mockFilterByCategory(task, category);

    // Filter the data by the category, then map the usernames to an array
    const users = props.data
      .filter((object) => object.scores[task].tags.includes(tag))
      .map((object) => object.user.username);

    cy.mount(RoarDataTable, { props: props });

    // Filter the prop data by the category using the UI
    setFilterByCategory(assessment, category);

    // Check that the filtered prop data matches the mock data
    checkTableColumn(column, users);
  });
});
