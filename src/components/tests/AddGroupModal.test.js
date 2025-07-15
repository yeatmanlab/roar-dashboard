import AddGroupModal from '@/components/modals/AddGroupModal.vue';
import * as VueQuery from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PvAutoComplete from 'primevue/autocomplete';
import PvButton from 'primevue/button';
import PrimeVue from 'primevue/config';
import PvDialog from 'primevue/dialog';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvSelect from 'primevue/select';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

const mockUseUpsertOrgMutation = vi.fn();
let mockOrgNameExists = false;

vi.mock('@/composables/mutations/useUpsertOrgMutation', () => ({
  default: vi.fn(() => ({
    mutate: mockUseUpsertOrgMutation,
    isPending: false,
    error: null,
  })),
}));

vi.mock('@/composables/queries/useOrgNameExistsQuery', () => ({
  default: vi.fn(() => ({
    refetch: vi.fn().mockResolvedValue({
      data: mockOrgNameExists,
    }),
  })),
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: () => vi.fn(),
  }),
}));

const mountOptions = {
  attachTo: document.body,
  global: {
    components: {
      PvDialog,
      PvFloatLabel,
      PvSelect,
      PvInputText,
      PvButton,
      PvAutoComplete,
    },
    plugins: [PrimeVue, VueQuery.VueQueryPlugin],
  },
  props: {
    isVisible: true,
  },
};

beforeEach(() => {
  mockOrgNameExists = false;
  setActivePinia(createPinia());
});

describe('AddGroupModal.vue', () => {
  it('should render the component (when visible)', async () => {
    const wrapper = mount(AddGroupModal, mountOptions);
    await nextTick();

    expect(wrapper.exists()).toBe(true);

    const modalTitle = document.querySelector('[data-testid="modalTitle"]');
    expect(modalTitle).not.toBeNull();
    expect(modalTitle.textContent).toContain('Add New Group');

    wrapper.unmount();
  });

  it('should NOT render the component (when NOT visible)', async () => {
    const wrapper = mount(AddGroupModal, {
      ...mountOptions,
      props: {
        isVisible: false,
      },
    });
    await nextTick();

    expect(wrapper.exists()).toBe(true);

    const modalTitle = document.querySelector('[data-testid="modalTitle"]');
    expect(modalTitle).toBeNull();

    wrapper.unmount();
  });

  it('should show an error if a required field is not filled in', async () => {
    const wrapper = mount(AddGroupModal, mountOptions);
    await nextTick();

    const submitBtn = document.querySelector('[data-testid="submitBtn"]');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toContain('Add Group');

    await submitBtn.click();

    const errorMessages = document.querySelectorAll('.p-error');
    // By default, we only have 2 required fields
    expect(errorMessages.length).toBe(2);

    wrapper.unmount();
  });

  it('should NOT allow users to create a 2 or more groups with the same name', async () => {
    mockOrgNameExists = true;

    const wrapper = mount(AddGroupModal, mountOptions);
    await nextTick();

    // First, we select the orgType dropdown
    const orgTypeDropdown = document.querySelector('[data-cy="dropdown-org-type"]');
    expect(orgTypeDropdown).not.toBeNull();
    // Then we click it
    await orgTypeDropdown.click();
    await nextTick();

    // Now, select the options to make sure the click action worked
    const orgTypeDropdownOptions = document.querySelectorAll('.p-select-option');
    // We must have 4 options: Site, School, Class and Cohort
    expect(orgTypeDropdownOptions.length).toBe(4);

    // Select the Site option and click on it
    const siteOption = orgTypeDropdownOptions.find((option) => option.textContent === 'Site');
    expect(siteOption).not.toBeNull();
    await siteOption.click();
    await nextTick();

    // Now we provide a site name
    const orgName = document.querySelector('[data-cy="input-org-name"]');
    expect(orgName).not.toBeNull();
    orgName.value = 'Test Site';
    orgName.dispatchEvent(new Event('input'));
    await nextTick();

    // Mocking the vuelidate
    wrapper.vm.v$.$validate = () => Promise.resolve(true);

    // After that, we select the submit button and check if it says "Add Site"
    const submitBtn = document.querySelector('[data-testid="submitBtn"]');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toContain('Add Site');

    await submitBtn.click();
    await flushPromises();

    // It should NOT call the upsertOrg mutation
    expect(mockUseUpsertOrgMutation).toHaveBeenCalledTimes(0);

    wrapper.unmount();
  });

  it('should submit the form if everything is ok', async () => {
    const wrapper = mount(AddGroupModal, mountOptions);
    await nextTick();

    // First, we select the orgType dropdown
    const orgTypeDropdown = document.querySelector('[data-cy="dropdown-org-type"]');
    expect(orgTypeDropdown).not.toBeNull();
    // Then we click it
    await orgTypeDropdown.click();
    await nextTick();

    // Now, select the options to make sure the click action worked
    const orgTypeDropdownOptions = document.querySelectorAll('.p-select-option');
    // We must have 4 options: Site, School, Class and Cohort
    expect(orgTypeDropdownOptions.length).toBe(4);

    // Select the Site option and click on it
    const siteOption = orgTypeDropdownOptions.find((option) => option.textContent === 'Site');
    expect(siteOption).not.toBeNull();
    await siteOption.click();
    await nextTick();

    // Now we provide a site name
    const orgName = document.querySelector('[data-cy="input-org-name"]');
    expect(orgName).not.toBeNull();
    orgName.value = 'Test Site';
    orgName.dispatchEvent(new Event('input'));
    await nextTick();

    // Mocking the vuelidate
    wrapper.vm.v$.$validate = () => Promise.resolve(true);

    // After that, we select the submit button and check if it says "Add Site"
    const submitBtn = document.querySelector('[data-testid="submitBtn"]');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toContain('Add Site');

    await submitBtn.click();
    await flushPromises();

    const errorMessages = document.querySelectorAll('.p-error');
    // We should NOT have any errors
    expect(errorMessages.length).toBe(0);

    expect(mockUseUpsertOrgMutation).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('should set submit btn as disabled after clicking it', async () => {
    const wrapper = mount(AddGroupModal, mountOptions);
    await nextTick();

    // First, we select the orgType dropdown
    const orgTypeDropdown = document.querySelector('[data-cy="dropdown-org-type"]');
    expect(orgTypeDropdown).not.toBeNull();
    // Then we click it
    await orgTypeDropdown.click();
    await nextTick();

    // Now, select the options to make sure the click action worked
    const orgTypeDropdownOptions = document.querySelectorAll('.p-select-option');
    // We must have 4 options: Site, School, Class and Cohort
    expect(orgTypeDropdownOptions.length).toBe(4);

    // Select the Site option and click on it
    const siteOption = orgTypeDropdownOptions.find((option) => option.textContent === 'Site');
    expect(siteOption).not.toBeNull();
    await siteOption.click();
    await nextTick();

    // Now we provide a site name
    const orgName = document.querySelector('[data-cy="input-org-name"]');
    expect(orgName).not.toBeNull();
    orgName.value = 'Test Site';
    orgName.dispatchEvent(new Event('input'));
    await nextTick();

    // Mocking the vuelidate
    wrapper.vm.v$.$validate = () => Promise.resolve(true);

    // After that, we select the submit button and check if it says "Add Site"
    const submitBtn = document.querySelector('[data-testid="submitBtn"]');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toContain('Add Site');

    await submitBtn.click();
    // The submit btn must be set as disabled to avoid multiple submissions at once
    expect(submitBtn.disabled).toBe(true);

    await flushPromises();

    const errorMessages = document.querySelectorAll('.p-error');
    // We should NOT have any errors
    expect(errorMessages.length).toBe(0);

    expect(mockUseUpsertOrgMutation).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
