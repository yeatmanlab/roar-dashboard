import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { describe, expect, it, vi } from 'vitest';
import RoarDataTable from '../RoarDataTable.vue';

vi.mock('@bdelab/roar-utils', () => ({
  default: {
    //
  },
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    //
  }),
}));

const columns = [
  { field: 'col_1', header: 'Col 1', dataType: 'string', pinned: true, sort: true },
  { field: 'col_2', header: 'Col 2', dataType: 'string', pinned: false, sort: true },
  { field: 'col_3', header: 'Col 3', dataType: 'string', pinned: false, sort: false },
];

const data = Array.from({ length: 50 }).map((_, idx) => ({
  col_1: `Col 1 - Row ${idx + 1}`,
  col_2: `Col 2 - Row ${idx + 1}`,
  col_3: `Col 3 - Row ${idx + 1}`,
}));

const mountOptions = {
  global: {
    directives: {
      tooltip: {},
    },
    plugins: [PrimeVue],
    stubs: {
      'router-link': {
        template: '<a></a>',
      },
    },
  },
  props: {
    allowColumnSelection: true,
    allowExport: true,
    allowFiltering: true,
    columns,
    data,
    showOptionsControl: true,
    totalRecords: 100,
  },
};

describe('RoarDataTable.vue', () => {
  it('should render the component WITH content', () => {
    const wrapper = mount(RoarDataTable, mountOptions);
    const headers = wrapper.findAll('th');
    const rows = wrapper.findAll('tr');
    const optionsControlBtn = wrapper.find('[data-testid="options-control"]');
    const paginationBtns = wrapper.findAll('.p-paginator-page');
    const paginationPrevBtn = wrapper.findAll('.p-paginator-prev');
    const paginationNextBtn = wrapper.findAll('.p-paginator-next');

    // We have 3 columns + the select column
    expect(headers.length).toBe(4);
    // By default we display 15 rows + the header row
    expect(rows.length).toBe(16);
    expect(optionsControlBtn.exists()).toBe(true);
    // We have 50 rows divided into groups of 15 each by default
    expect(paginationBtns.length).toBe(8);
    // There are prev and next buttons on the top and the bottom of the table
    expect(paginationPrevBtn.length).toBe(2);
    expect(paginationNextBtn.length).toBe(2);
  });

  it('should render the component WITHOUT content (empty state)', () => {
    const wrapper = mount(RoarDataTable, {
      ...mountOptions,
      props: {
        ...mountOptions.props,
        data: [],
      },
    });
    const rows = wrapper.findAll('tr');
    const emptyMessage = wrapper.find('.p-datatable-empty-message');

    // The header and the single row with the empty state
    expect(rows.length).toBe(2);
    expect(emptyMessage.exists()).toBe(true);
  });

  it('should allow users to navigate through the pagination', async () => {
    const wrapper = mount(RoarDataTable, mountOptions);
    const rows = wrapper.findAll('tr');
    const paginationPrevBtn = wrapper.findAll('.p-paginator-prev');
    const paginationNextBtn = wrapper.findAll('.p-paginator-next');

    expect(rows[1].html()).toContain('Col 1 - Row 1');

    await paginationNextBtn[1].trigger('click');
    expect(rows[1].html()).toContain('Col 1 - Row 16');

    await paginationPrevBtn[1].trigger('click');
    expect(rows[1].html()).toContain('Col 1 - Row 1');
  });

  it('should show table options after clicking Show Options button', async () => {
    const wrapper = mount(RoarDataTable, mountOptions);
    const optionsControlBtn = wrapper.find('[data-testid="options-control"]');
    let tableOptions = wrapper.findAll('.p-multiselect');

    expect(tableOptions.length).toBe(0);

    await optionsControlBtn.trigger('click');
    tableOptions = wrapper.findAll('.p-multiselect');
    expect(tableOptions.length).toBe(2);
  });

  it('should change the displayed columns', async () => {
    const wrapper = mount(RoarDataTable, mountOptions);
    // We expect to have 3 columns by default
    expect(wrapper.vm.selectedColumns.length).toBe(3);
    // Then we keep only 2 selected
    wrapper.vm.onColumnToggle([columns[0], columns[1]]);
    expect(wrapper.vm.selectedColumns.length).toBe(2);
  });
});
