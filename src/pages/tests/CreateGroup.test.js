import * as VueQuery from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import CreateGroup from "../groups/CreateGroup.vue";

const mockUpsertOrg = vi.fn();

vi.mock("@/composables/mutations/useUpsertOrgMutation", () => {
  return {
    default: () => ({
      mutate: mockUpsertOrg,
      isPending: false,
      error: null,
    }),
  };
});

vi.mock("primevue/usetoast", () => ({
  useToast: () => ({
    add: vi.fn(),
  }),
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: vi.fn(() => ({
    $subscribe: vi.fn(),
    roarfirekit: ref({
      restConfig: true,
    }),
  })),
}));

vi.mock("@/composables/queries/useUserClaimsQuery", () => ({
  default: vi.fn(() => ({
    data: ref({
      //
    }),
  })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("Create Group Page", () => {
  it("should render the page", () => {
    const wrapper = mount(CreateGroup, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it("should allow users to select any type of group", async () => {
    const wrapper = mount(CreateGroup, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
      },
    });

    const orgTypes = [
      { firestoreCollection: "districts", singular: "district", label: "Site" },
      { firestoreCollection: "schools", singular: "school", label: "School" },
      { firestoreCollection: "classes", singular: "class", label: "Class" },
      { firestoreCollection: "groups", singular: "group", label: "Cohort" },
    ];

    for (const type of orgTypes) {
      wrapper.vm.orgType = type;

      await wrapper.vm.$nextTick();

      expect(wrapper.vm.orgType.singular).toBe(type.singular);
      expect(wrapper.vm.orgType.firestoreCollection).toBe(
        type.firestoreCollection,
      );
    }
  });

  it("should show an error if a required field is not filled in", async () => {
    const wrapper = mount(CreateGroup, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
      },
    });

    wrapper.vm.orgType = {
      firestoreCollection: "districts",
      singular: "district",
      label: "Site",
    };

    wrapper.vm.submitted = true;

    await wrapper.vm.$nextTick();

    const errorMessage = wrapper.find(".p-error");

    expect(errorMessage.exists()).toBe(true);
    expect(errorMessage.text()).toContain("Please supply a name");
  });

  it("should submit the form if everything is ok", async () => {
    const wrapper = mount(CreateGroup, {
      global: {
        plugins: [VueQuery.VueQueryPlugin, PrimeVue],
      },
    });

    wrapper.vm.orgType = {
      firestoreCollection: "districts",
      singular: "district",
      label: "Site",
    };

    wrapper.vm.state.orgName = "Test Site";

    await wrapper.vm.submit();
    await wrapper.vm.$nextTick();

    const errorMessage = wrapper.find(".p-error");

    expect(errorMessage.exists()).toBe(false);
    expect(mockUpsertOrg).toHaveBeenCalled();
  });
});
