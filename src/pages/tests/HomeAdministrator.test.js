// Mock the module before individual tests since vi.mock is hoisted to the top of the file
// closer to how code is actually executed
vi.mock('@/composables/queries/useAdministrationsListQuery', () => ({
  useAdministrationsListQuery: vi.fn().mockReturnValue({
    data: { value: [] },
    isLoading: true,
    isFetching: false,
    isError: false,
  }),
}));


import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import HomeAdministrator from '../HomeAdministrator.vue'
import PrimeVue from 'primevue/config';
import {useAdministrationsListQuery} from '@/composables/queries/useAdministrationsListQuery'; 
import {useUserClaimsQuery} from '../../composables/queries/useUserClaimsQuery';



const mockAdministration = {
    id: "DlAhRnbOFDnCF5AwEkhB",
    name: "Newest assignment",
    publicName: "Newest assignment",
    assessments: [
      { id: "assessment1", title: "Math Assessment" },
      { id: "assessment2", title: "Reading Assessment" },
    ],
    assignedOrgs: {
      districts: [],
      schools: [],
      classes: [],
      groups: ["group1", "group2", "group3"],
      families: [],
    },
    dates: {
      start: "2025-01-13T23:36:25.121Z",
      end: "2025-01-16T07:59:59.999Z",
      created: "2025-04-14T23:49:03.756Z",
    },
    stats: {
      total: {
        students: 120,
        completed: 90,
        pending: 30,
      },
    },
    testData: false,
  };

describe('HomeAdministrator', () => {
    beforeEach(() => {
      setActivePinia(createPinia());

      // not sure where this is a dependency but won't run without
      vi.mock('@bdelab/roar-utils', () => {
        return {
          default: {},
        };
      });

      vi.mock('@/store/auth', () => ({
          useAuthStore: vi.fn(() => ({
            $subscribe: vi.fn(),
            roarfirekit: {
              value: {
                restConfig: true
              }
            }
          })),
      }));
      

      vi.mock('@/helpers/query/utils', () => ({
        orderByDefault: [
          {
            field: { fieldPath: 'name' },
            direction: 'ASCENDING',
          },
        ],
      }));
      
      vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
        useUserClaimsQuery: vi.fn(() => ({
          data: {value: { user: 'mockedUser' }},
          error: null,
        })),
      }));
    });


    afterEach(() => {
        vi.resetAllMocks();
    });


    it('renders static elements before data loads', () => {
        vi.mocked(useAdministrationsListQuery).mockReturnValueOnce({
            data: { value: [] },
            isLoading: false,
            isFetching: false,
            isError: false,
        });

        const wrapper = mount(HomeAdministrator, { 
            global: { 
                plugins: [VueQuery.VueQueryPlugin, PrimeVue], 
                components: {
                    AppSpinner: { template: '<div class="mocked-spinner" />' },
                },
            },
            setup() {
                return {
                    sortOptions: ref([
                        {
                            label: 'Name (ascending)',
                            value: [
                                {
                                    field: { fieldPath: 'name' },
                                    direction: 'ASCENDING',
                                },
                            ],
                        }
                    ]),
                    sortKey: ref({ value: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }] }),
                    sortOrder: ref(1),
                    sortField: ref('name'),
                    dataViewKey: ref(0),
                    search: ref(''),
                    searchInput: ref(''),
                    filteredAdministrations: ref([mockAdministration]),
                    initialized: ref(true),
                    pageLimit: ref(10),
                    page: ref(0),
                    orderBy: ref([{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }]),
                    searchSuggestions: ref([]),
                    searchTokens: ref([]),
                    fetchTestAdministrations: ref(false)
                }
            }
        });

        expect(wrapper.text()).toContain('All Assignments');
        expect(wrapper.text()).toContain('Search by name');
        expect(wrapper.text()).toContain('Sort by');
    });

    it('renders loading state when data is loading', () => {
        // vi.mocked documentation https://vitest.dev/guide/mocking.html
        vi.mocked(useAdministrationsListQuery).mockReturnValueOnce({
            data: { value: [] },
            isLoading: true,
            isFetching: false,
            isError: false,
        });

        const wrapper = mount(HomeAdministrator, { 
            global: { 
                plugins: [VueQuery.VueQueryPlugin, PrimeVue], 
                components: {
                    AppSpinner: { template: '<div class="mocked-spinner" />' },
                },
            },
            setup() {
                return {
                    sortOptions: ref([
                        {
                            label: 'Name (ascending)',
                            value: [
                                {
                                    field: { fieldPath: 'name' },
                                    direction: 'ASCENDING',
                                },
                            ],
                        }
                    ]),
                    sortKey: ref({ value: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }] }),
                    sortOrder: ref(1),
                    sortField: ref('name'),
                    dataViewKey: ref(0),
                    search: ref(''),
                    searchInput: ref(''),
                    filteredAdministrations: ref([mockAdministration]),
                    initialized: ref(true),
                    pageLimit: ref(10),
                    page: ref(0),
                    orderBy: ref([{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }]),
                    searchSuggestions: ref([]),
                    searchTokens: ref([]),
                    fetchTestAdministrations: ref(false)
                }
            }
        });

        // Log the values to debug
        console.log('Checks', {
            '!initialized || isLoadingAdministrations': !wrapper.vm.initialized || wrapper.vm.isLoadingAdministrations,
            '!initialized': !wrapper.vm.initialized,
            'isLoadingAdministrations': wrapper.vm.isLoadingAdministrations,
            'isLoading': wrapper.vm.isLoading,
            'useUserClaimsQuery was called': vi.mocked(useUserClaimsQuery).mock.calls,
            'mock calls': vi.mocked(useAdministrationsListQuery).mock.calls,
            'mock results': vi.mocked(useAdministrationsListQuery).mock.results
        });
        
        expect(wrapper.find('.loading-container').exists()).toBe(true);
        expect(wrapper.find('.mocked-spinner').exists()).toBe(true);
        expect(wrapper.text()).toContain('Fetching Assignments');
    });
});

// Empty data table

// Data table with administrations data

// Search functionality

// Sort functionality
