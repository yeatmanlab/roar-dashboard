import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import * as VueQuery from "@tanstack/vue-query";
import HomeAdministrator from "@/pages/HomeAdministrator.vue";
import PrimeVue from "primevue/config";
import ConfirmService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import useAdministrationsListQuery from "@/composables/queries/useAdministrationsListQuery";

const mockAdministration = {
  id: "DlAhRnbOFDnCF5AwEkhB",
  name: "Newest assignment",
  publicName: "Newest assignment",
  dates: {
    start: "2025-01-13T23:36:25.121Z",
    end: "2025-01-16T07:59:59.999Z",
    created: "2025-04-14T23:49:03.756Z",
  },
  assessments: [
    {
      variantId: "DRjLxIQsFrgj4VJapHbz",
      variantName: "es-CO",
      taskId: "hearts-and-flowers",
      params: {
        storeItemId: false,
        maxTime: 8,
        sequentialStimulus: true,
        numberOfTrials: 21,
        keyHelpers: true,
        stimulusBlocks: 3,
        corpus: null,
        numOfPracticeTrials: 3,
        sequentialPractice: true,
        skipInstructions: true,
        taskName: "hearts-and-flowers",
        buttonLayout: "default",
        age: null,
        language: "es",
        maxIncorrect: 100,
      },
    },
    {
      variantId: "Z6Cbf1V6CFGR2pg2iJDA",
      variantName: "math-default",
      taskId: "egma-math",
      params: {
        sequentialStimulus: true,
        stimulusBlocks: 3,
        corpus: "math-item-bank",
        numOfPracticeTrials: 2,
        language: "en",
        sequentialPractice: true,
        skipInstructions: true,
        taskName: "egma-math",
        buttonLayout: "default",
        age: null,
        numberOfTrials: 200,
        maxIncorrect: 6,
        maxTime: 15,
        keyHelpers: false,
      },
      conditions: {
        assigned: {
          op: "AND",
          conditions: [
            {
              field: "userType",
              op: "EQUAL",
              value: "student",
            },
          ],
        },
      },
    },
  ],
  assignedOrgs: {
    districts: [],
    schools: [],
    classes: [],
    groups: [
      "CInb348Nz7LcPlylblKv",
      "6m00OVq4zEQIWOrmBqez",
      "flVb1sDVG5gTroczTi1m",
    ],
    families: [],
  },
  testData: false,
  stats: {
    total: {
      assignment: {
        started: 2,
        completed: 1,
        assigned: 597,
      },
      "hearts-and-flowers": {
        assigned: 592,
      },
      "egma-math": {
        started: 2,
        completed: 1,
        assigned: 219,
      },
    },
  },
};

describe("HomeAdministrator", () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    // not sure where this is a dependency but won't run without
    vi.mock("@bdelab/roar-utils", () => {
      return {
        default: {},
      };
    });

    vi.mock("@/store/auth", () => ({
      useAuthStore: vi.fn(() => ({
        $subscribe: vi.fn(),
        roarfirekit: ref({
          restConfig: true,
        }),
      })),
    }));

    vi.mock("@/helpers/query/utils", () => ({
      orderByDefault: [
        {
          field: { fieldPath: "name" },
          direction: "ASCENDING",
        },
      ],
    }));

    vi.mock("@/composables/queries/useUserClaimsQuery", () => ({
      default: vi.fn(() => ({
        data: ref({
          id: "zbTRSOS70cNGWyu2Ecc4T2aOU2y2",
          collectionValue: "userClaims",
          lastUpdated: 1741677423988,
          testData: false,
          claims: {
            // will evenutally want to mock both
            // super_admin view and admin view
            super_admin: true,
            minimalAdminOrgs: {
              groups: [],
              schools: [],
              districts: [],
              families: [],
              classes: [],
            },
            adminOrgs: {
              groups: [],
              schools: [],
              families: [],
              districts: [],
              classes: [],
            },
            roarUid: "zbTRSOS70cNGWyu2Ecc4T2aOU2y2",
            assessmentUid: "mlrlu8rqPYh3IeXKHT83UpVMtzE2",
            admin: true,
            adminUid: "zbTRSOS70cNGWyu2Ecc4T2aOU2y2",
          },
        }),
      })),
    }));

    // mocking PvChart since it is used within CardAdministration and throwing errors.
    // if we do want to test the chart's functionality we should revisit or test in
    // CardAdministration's unit test
    vi.mock("primevue/chart", () => ({
      default: {
        template: "<div />",
      },
    }));

    vi.mock("vue-router", () => ({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
      }),
    }));

    vi.mock("@/composables/queries/useAdministrationsListQuery", () => ({
      default: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders static elements before data loads and empty table", async () => {
    vi.mocked(useAdministrationsListQuery).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(HomeAdministrator, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
      },
    });

    await nextTick();
    const wrapperText = wrapper.text();
    expect(wrapperText).toContain("All Assignments");
    // Check for the first part of the description
    expect(wrapperText).toContain("This page lists all the assignments");
    expect(wrapperText).toContain("administered to your users");
    // Check for the second part of the description
    expect(wrapperText).toContain("You can view and monitor completion");
    expect(wrapperText).toContain(
      "bundles of tasks, surveys, and questionnaires",
    );
    expect(wrapperText).toContain("Search by name");
    expect(wrapperText).toContain("Sort by");
    expect(wrapperText).not.toContain("Fetching Assignments");
    expect(wrapperText).toContain("No Assignments Yet");
    expect(wrapperText).toContain(
      "Go create your first assignment to get started",
    );
  });

  it("renders loading state when data is loading", async () => {
    const mockedUseAdministrationsListQuery = vi.mocked(
      useAdministrationsListQuery,
    );

    mockedUseAdministrationsListQuery.mockReturnValue({
      data: ref([]),
      isLoading: ref(true),
      isFetching: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(HomeAdministrator, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
      },
    });

    await nextTick();

    expect(wrapper.find(".loading-container").exists()).toBe(true);
    expect(wrapper.find(".levante-spinner-container").exists()).toBe(true);
    expect(wrapper.text()).toContain("Fetching Assignments");
  });

  it("Data table renders with administrations data", async () => {
    vi.mocked(useAdministrationsListQuery).mockReturnValue({
      data: ref([mockAdministration]),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(HomeAdministrator, {
      global: {
        plugins: [
          VueQuery.VueQueryPlugin,
          PrimeVue,
          ConfirmService,
          ToastService,
        ],
        components: {
          "router-link": { template: "<a></a>" },
        },
        directives: {
          tooltip: {},
        },
      },
    });

    await nextTick();

    const card = wrapper.find('[data-cy="h2-card-admin-title"]');
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain("Newest assignment");
  });

  it("Data table search functionality", async () => {
    vi.mocked(useAdministrationsListQuery).mockReturnValue({
      data: ref([mockAdministration]),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(HomeAdministrator, {
      global: {
        plugins: [
          VueQuery.VueQueryPlugin,
          PrimeVue,
          ConfirmService,
          ToastService,
        ],
        components: {
          "router-link": { template: "<a></a>" },
        },
        directives: {
          tooltip: {},
        },
      },
    });

    await nextTick();

    const searchInput = wrapper.find('[data-cy="search-input"] input');
    expect(searchInput.exists()).toBe(true);

    await searchInput.setValue("New");
    await searchInput.trigger("keyup.enter");
    expect(wrapper.find('[data-cy="h2-card-admin-title"]').text()).toContain(
      "Newest assignment",
    );

    await searchInput.setValue("Fake");
    await searchInput.trigger("keyup.enter");
    expect(wrapper.find('[data-cy="h2-card-admin-title"]').exists()).toBe(
      false,
    );
  });

  it("Data table sort functionality", async () => {
    const mockData = [
      {
        ...mockAdministration,
        id: "1",
        name: "B Assignment",
        publicName: "B Assignment",
      },
      {
        ...mockAdministration,
        id: "2",
        name: "A Assignment",
        publicName: "A Assignment",
      },
    ];

    vi.mocked(useAdministrationsListQuery).mockReturnValue({
      data: ref(mockData),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(HomeAdministrator, {
      global: {
        plugins: [
          VueQuery.VueQueryPlugin,
          PrimeVue,
          ConfirmService,
          ToastService,
        ],
        components: {
          "router-link": { template: "<a></a>" },
        },
        directives: {
          tooltip: {},
        },
      },
    });

    await nextTick();

    const sortSelect = wrapper.findComponent(
      '[data-cy="dropdown-sort-administrations"]',
    );
    expect(sortSelect.exists()).toBe(true);

    // Test ascending sort
    await sortSelect.vm.$emit("change", {
      value: {
        label: "Name (ascending)",
        value: [
          {
            field: {
              fieldPath: "name",
            },
            direction: "ASCENDING",
          },
        ],
      },
    });

    const titlesAscend = wrapper.findAll('[data-cy="h2-card-admin-title"]');
    if (titlesAscend.length > 0) {
      expect(titlesAscend[0].text()).toContain("A Assignment");
      expect(titlesAscend[1].text()).toContain("B Assignment");
    }
    // Test descending sort
    await sortSelect.vm.$emit("change", {
      value: {
        label: "Name (descending)",
        value: [
          {
            field: {
              fieldPath: "name",
            },
            direction: "DESCENDING",
          },
        ],
      },
    });
    const titlesDesc = wrapper.findAll('[data-cy="h2-card-admin-title"]');
    expect(titlesDesc[0].text()).toContain("B Assignment");
    expect(titlesDesc[1].text()).toContain("A Assignment");
  });
});
