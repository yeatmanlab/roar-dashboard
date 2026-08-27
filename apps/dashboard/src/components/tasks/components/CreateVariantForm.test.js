import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

// ---------------------------------------------------------------------------
// Mocks
//
// The form drives task selection and the create call off two composables, and
// reports outcomes through PrimeVue's toast service. All three are mocked so the
// upload flow can be exercised without a backend or a permission system:
//   - useTasksQuery              → the task dropdown's options.
//   - useAddTaskVariantMutation  → the POST under assertion (not exercised here).
//   - usePermissions             → submit stays enabled.
//   - useToast                   → captures the success/error feedback.
// ---------------------------------------------------------------------------

const toastCalls = [];
const mockAddVariant = vi.fn();
const mockAddVariantAsync = vi.fn();

vi.mock('@/composables/queries/useTasksQuery', () => ({
  default: () => ({
    isFetching: ref(false),
    data: ref([{ id: 'task-1', name: 'ROAR Word' }]),
  }),
}));

vi.mock('@/composables/mutations/useAddTaskVariantMutation', () => ({
  default: () => ({ mutate: mockAddVariant, mutateAsync: mockAddVariantAsync }),
}));

vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    userCan: () => true,
    Permissions: { Tasks: { CREATE: 'tasks.create' } },
    UserRoles: {},
  }),
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: (payload) => toastCalls.push(payload) }),
}));

const CreateVariantForm = (await import('./CreateVariantForm.vue')).default;

// ---------------------------------------------------------------------------
// Test doubles for child components
//
// Each renders just enough to read state back out: the name input echoes its
// bound value, the configurator reports its row names, and Dropdown becomes a
// native select keyed by its label so the three instances stay distinguishable.
// ---------------------------------------------------------------------------

const TextInputStub = {
  props: ['modelValue', 'id'],
  emits: ['update:modelValue'],
  template: `<input :data-testid="'text-' + id" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
};

const ConfiguratorStub = {
  props: ['modelValue'],
  template: `<div data-testid="params">{{ (modelValue ?? []).map((r) => r.name + '=' + r.value).join(',') }}</div>`,
};

const DropdownStub = {
  props: ['modelValue', 'data', 'label', 'labelKey', 'valueKey'],
  emits: ['update:modelValue'],
  template: `
    <select
      :data-testid="'dropdown-' + label"
      :value="modelValue ?? ''"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="">--</option>
      <option v-for="opt in (data ?? [])" :key="opt[valueKey] ?? opt" :value="opt[valueKey] ?? opt">
        {{ opt[labelKey] ?? opt }}
      </option>
    </select>`,
};

/**
 * Mount the form with a task already selected, since the parameter fieldset only
 * renders once a task is chosen.
 *
 * @returns {import('@vue/test-utils').VueWrapper} The mounted wrapper.
 */
function mountForm() {
  return mount(CreateVariantForm, {
    props: { selectedTaskId: 'task-1' },
    global: {
      stubs: {
        TextInput: TextInputStub,
        TaskParametersConfigurator: ConfiguratorStub,
        Dropdown: DropdownStub,
        PvButton: { template: '<button><slot /></button>' },
      },
    },
  });
}

/**
 * Simulate selecting a file whose contents are `text`.
 *
 * `handleParamsFileUpload` reads `event.target.files[0]` and then reads it through
 * a `FileReader`, so both are stubbed: `files` is defined on the input element and
 * `FileReader` resolves synchronously with the supplied text.
 *
 * @param {import('@vue/test-utils').VueWrapper} wrapper - Mounted form
 * @param {string} text - File contents to deliver
 * @returns {Promise<void>}
 */
async function uploadFile(wrapper, text) {
  const input = wrapper.find('[data-testid="create-variant-form__params-file"]');
  Object.defineProperty(input.element, 'files', {
    value: [new Blob([text], { type: 'application/json' })],
    configurable: true,
  });

  await input.trigger('change');
  await nextTick();
  await nextTick();
}

/** Let queued promises settle — the batch awaits one mutation per definition. */
async function flushAsync() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}

/**
 * Submit the form and invoke the mutation's success callback, as a 201 would.
 *
 * @param {import('@vue/test-utils').VueWrapper} wrapper - Mounted form
 * @returns {Promise<void>}
 */
async function submitAndSucceed(wrapper) {
  await wrapper.find('form').trigger('submit');
  await flushAsync();
  const lastCall = mockAddVariant.mock.calls.at(-1);
  if (!lastCall) throw new Error('addVariant was not called — the form did not submit.');
  lastCall[1].onSuccess();
  await nextTick();
}

/** Reads the configurator stub's rendered `name=value` summary. */
const paramsText = (wrapper) => wrapper.find('[data-testid="params"]').text();

/** Reads the variant-name input's current value. */
const nameValue = (wrapper) => wrapper.find('[data-testid="text-variantName"]').element.value;

/** Reads the status dropdown's current selection. */
const statusValue = (wrapper) => wrapper.find('[data-testid="dropdown-Status"]').element.value;

const SAME_TASK_THREE = JSON.stringify([
  { variantName: 'One', params: { lng: 'en', n: 1 } },
  { variantName: 'Two', params: { lng: 'en', n: 2 } },
  { variantName: 'Three', params: { lng: 'en', n: 3 } },
]);

const SAME_TASK_MULTI = JSON.stringify([
  { variantName: 'English-Fixed-v3', params: { lng: 'en', userMode: 'fixed' } },
  { variantName: 'English-Adaptive-v5', params: { lng: 'en', userMode: 'adaptive' } },
]);

const SINGLE = JSON.stringify([{ variantName: 'English-v7', params: { language: 'en', scoringVersion: 7 } }]);

const SINGLE_PUBLISHED = JSON.stringify([
  { variantName: 'English-v7', status: 'published', params: { language: 'en' } },
]);

const MIXED_STATUSES = JSON.stringify([
  { variantName: 'Live', status: 'published', params: { lng: 'en' } },
  { variantName: 'Unstated', params: { lng: 'en' } },
  { variantName: 'Retired', status: 'deprecated', params: { lng: 'en' } },
]);

beforeEach(() => {
  vi.clearAllMocks();
  toastCalls.length = 0;
  mockAddVariantAsync.mockResolvedValue({ id: 'new-variant' });

  // Deliver file contents synchronously so the upload handler's async read
  // completes within the test's `nextTick` flushes.
  class SyncFileReader {
    readAsText(blob) {
      blob
        .text()
        .then((text) => {
          this.result = text;
          this.onload?.();
        })
        .catch(() => this.onerror?.());
    }
  }
  vi.stubGlobal('FileReader', SyncFileReader);
});

describe('CreateVariantForm — variant definition upload', () => {
  it('applies an uploaded variant, filling the name and the rows', async () => {
    const wrapper = mountForm();

    await uploadFile(wrapper, SINGLE);

    expect(nameValue(wrapper)).toBe('English-v7');
    expect(paramsText(wrapper)).toBe('language=en,scoringVersion=7');
    expect(toastCalls.at(-1)).toMatchObject({ summary: 'Variant loaded' });
  });

  it('accepts a one-element array as well as a bare object', async () => {
    const wrapper = mountForm();

    await uploadFile(wrapper, JSON.stringify([{ variantName: 'Wrapped', params: { a: 1 } }]));

    expect(nameValue(wrapper)).toBe('Wrapped');
    expect(paramsText(wrapper)).toBe('a=1');
  });

  it('infers the type of each parameter from its value', async () => {
    const wrapper = mountForm();

    await uploadFile(wrapper, JSON.stringify({ variantName: 'Typed', params: { s: 'txt', n: 42, b: false } }));

    // The configurator stub renders name=value; the row types are asserted via the
    // parser's own unit tests, but this pins the wiring end to end.
    expect(paramsText(wrapper)).toBe('s=txt,n=42,b=false');
  });

  it('rejects a cross-task file and leaves the form untouched', async () => {
    const wrapper = mountForm();

    await uploadFile(
      wrapper,
      JSON.stringify([
        { variantName: 'English-v7', params: { lng: 'en' } },
        { variantName: 'Spanish-v1', params: { lng: 'es' } },
      ]),
    );

    expect(toastCalls.at(-1)).toMatchObject({ summary: 'Invalid variant definitions' });
    expect(toastCalls.at(-1).detail).toMatch(/different tasks/);
    expect(nameValue(wrapper)).toBe('');
    expect(paramsText(wrapper)).toBe('');
  });

  it('offers a picker for a same-task file with several variants, applying none yet', async () => {
    const wrapper = mountForm();

    await uploadFile(wrapper, SAME_TASK_MULTI);

    expect(wrapper.find('[data-testid="create-variant-form__uploaded-variant-picker"]').exists()).toBe(true);
    expect(nameValue(wrapper)).toBe('');
    expect(paramsText(wrapper)).toBe('');
    expect(toastCalls.at(-1)).toMatchObject({ summary: 'Select a variant' });
  });

  it('applies the chosen variant from the picker', async () => {
    const wrapper = mountForm();
    await uploadFile(wrapper, SAME_TASK_MULTI);

    const picker = wrapper.find('[data-testid="dropdown-Variant to create"]');
    picker.element.value = 'English-Adaptive-v5';
    await picker.trigger('change');
    await nextTick();

    expect(nameValue(wrapper)).toBe('English-Adaptive-v5');
    expect(paramsText(wrapper)).toBe('lng=en,userMode=adaptive');
  });

  it('surfaces errors with a life long enough to read', async () => {
    const wrapper = mountForm();

    await uploadFile(wrapper, JSON.stringify({ variantName: 'English (v7)', params: {} }));

    // The 3s default is not enough to read a sentence and act on it.
    expect(toastCalls.at(-1).life).toBeGreaterThan(3000);
  });

  it('reports a name the API would reject and leaves the form untouched', async () => {
    const wrapper = mountForm();

    await uploadFile(wrapper, JSON.stringify({ variantName: 'English (v7)', params: { language: 'en' } }));

    expect(toastCalls.at(-1)).toMatchObject({ summary: 'Invalid variant definitions' });
    expect(toastCalls.at(-1).detail).toMatch(/must start with a letter/);
    expect(nameValue(wrapper)).toBe('');
    expect(paramsText(wrapper)).toBe('');
  });

  it('drops null params and empty containers when applying', async () => {
    const wrapper = mountForm();

    await uploadFile(
      wrapper,
      JSON.stringify({ variantName: 'Sparse', params: { keep: 1, dropNull: null, dropEmpty: {} } }),
    );

    expect(paramsText(wrapper)).toBe('keep=1');
  });

  it('clears the applied rows when the selected task changes', async () => {
    const wrapper = mountForm();
    await uploadFile(wrapper, SINGLE);
    expect(paramsText(wrapper)).not.toBe('');

    await wrapper.setProps({ selectedTaskId: 'task-2' });
    await nextTick();

    // Parameters are task-specific, so an upload for one task must not carry over.
    expect(paramsText(wrapper)).toBe('');
  });

  describe('create all', () => {
    /** Reads the option labels currently offered by the picker. */
    const options = (wrapper) => wrapper.find('[data-testid="dropdown-Variant to create"]').text();

    it('creates every remaining definition in order, using the file name and params', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SAME_TASK_THREE);

      await wrapper.find('[data-testid="create-variant-form__create-all"]').trigger('click');
      await flushAsync();

      expect(mockAddVariantAsync).toHaveBeenCalledTimes(3);
      expect(mockAddVariantAsync.mock.calls.map(([payload]) => payload.body.name)).toEqual(['One', 'Two', 'Three']);
      // Parameters come from each definition, not from whatever is in the form.
      expect(mockAddVariantAsync.mock.calls[1][0].body.parameters).toEqual([
        { name: 'lng', value: 'en' },
        { name: 'n', value: 2 },
      ]);
      expect(toastCalls.at(-1)).toMatchObject({ summary: 'Variants created' });
    });

    it('continues past a failure and reports which ones did not land', async () => {
      // A definition that already exists comes back as a 409; that must not abandon the rest.
      mockAddVariantAsync
        .mockResolvedValueOnce({ id: 'a' })
        .mockRejectedValueOnce({ body: { error: { message: 'The requested resource already exists' } } })
        .mockResolvedValueOnce({ id: 'c' });

      const wrapper = mountForm();
      await uploadFile(wrapper, SAME_TASK_THREE);

      await wrapper.find('[data-testid="create-variant-form__create-all"]').trigger('click');
      await flushAsync();

      expect(mockAddVariantAsync).toHaveBeenCalledTimes(3);
      expect(toastCalls.at(-1)).toMatchObject({ summary: 'Created 2 of 3' });
      expect(toastCalls.at(-1).detail).toMatch(/Two: The requested resource already exists/);
      // The failed one is still offered; the two that landed are gone.
      expect(options(wrapper)).toContain('Two');
      expect(options(wrapper)).not.toContain('One');
    });

    it('is not offered when only one definition remains', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SAME_TASK_MULTI);

      // Two loaded: create one via the picker + submit, leaving a single one.
      const picker = wrapper.find('[data-testid="dropdown-Variant to create"]');
      picker.element.value = 'English-Fixed-v3';
      await picker.trigger('change');
      await nextTick();
      await submitAndSucceed(wrapper);

      expect(wrapper.find('[data-testid="create-variant-form__create-all"]').exists()).toBe(false);
      expect(options(wrapper)).not.toContain('English-Fixed-v3');
    });
  });

  describe('parameter names the API would reject', () => {
    it('reports the bad key and leaves the form untouched, instead of loading and failing at submit', async () => {
      // Before this check the upload reported success and submit went through, so the failure
      // arrived as an opaque backend 400 — and in a batch, mixed into the summary alongside
      // genuine 409 conflicts.
      const wrapper = mountForm();
      await uploadFile(wrapper, JSON.stringify([{ variantName: 'X', params: { 'scoring-version': 1 } }]));

      expect(nameValue(wrapper)).toBe('');
      expect(paramsText(wrapper)).toBe('');
      expect(toastCalls.at(-1)).toMatchObject({
        summary: 'Invalid variant definitions',
        detail: expect.stringMatching(/parameter name "scoring-version" must start with a letter/),
      });
    });

    it('never sends the invalid parameter, even if the form is submitted afterwards', async () => {
      // Submitting the (now empty) form is still permitted — `name` is optional in the contract
      // and an empty parameter list is valid — so the guarantee worth asserting is that the
      // rejected key cannot reach the API, not that submit is blocked.
      const wrapper = mountForm();
      await uploadFile(wrapper, JSON.stringify([{ variantName: 'X', params: { 'scoring-version': 1 } }]));

      await wrapper.find('form').trigger('submit');
      await flushAsync();

      const sent = mockAddVariant.mock.calls.flatMap(([payload]) => payload.body.parameters ?? []);
      expect(sent).toEqual([]);
    });
  });

  describe('duplicate names in one file', () => {
    const DUPLICATES = JSON.stringify([
      { variantName: 'English-v7', params: { lng: 'en', n: 1 } },
      { variantName: 'English-v7', params: { lng: 'en', n: 2 } },
    ]);

    it('is rejected at upload, so the picker can never silently lose the second entry', async () => {
      // The picker tracks created names case-insensitively, so without this rejection creating
      // the first entry would drop both from the picker and the second would never be attempted.
      const wrapper = mountForm();
      await uploadFile(wrapper, DUPLICATES);

      expect(nameValue(wrapper)).toBe('');
      expect(paramsText(wrapper)).toBe('');
      expect(toastCalls.at(-1)).toMatchObject({
        summary: 'Invalid variant definitions',
        detail: expect.stringMatching(/2 variants named "English-v7"/),
      });
    });

    it('offers no picker options for a rejected file', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, DUPLICATES);

      expect(wrapper.find('[data-testid="dropdown-Variant to create"]').exists()).toBe(false);
    });
  });

  describe('status', () => {
    it('submits the status the definition declares, not the default', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SINGLE_PUBLISHED);
      await submitAndSucceed(wrapper);

      expect(mockAddVariant.mock.calls.at(-1)[0].body.status).toBe('published');
    });

    it('moves the visible dropdown, so the declared status can be seen and overridden', async () => {
      // Applying it only at submit time would publish a variant with the form still reading
      // "draft" — the researcher would have no way to notice before pressing create.
      const wrapper = mountForm();
      expect(statusValue(wrapper)).toBe('draft');

      await uploadFile(wrapper, SINGLE_PUBLISHED);

      expect(statusValue(wrapper)).toBe('published');
    });

    it('leaves the dropdown alone when the definition declares no status', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SINGLE);

      expect(statusValue(wrapper)).toBe('draft');
    });

    it('falls back to the form selection when the definition declares none', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SINGLE);
      await submitAndSucceed(wrapper);

      expect(mockAddVariant.mock.calls.at(-1)[0].body.status).toBe('draft');
    });

    it('gives each definition in a batch its own status, falling back per definition', async () => {
      // One dropdown cannot express a batch that publishes some and drafts others.
      const wrapper = mountForm();
      await uploadFile(wrapper, MIXED_STATUSES);

      await wrapper.find('[data-testid="create-variant-form__create-all"]').trigger('click');
      await flushAsync();

      expect(mockAddVariantAsync.mock.calls.map(([payload]) => [payload.body.name, payload.body.status])).toEqual([
        ['Live', 'published'],
        ['Unstated', 'draft'],
        ['Retired', 'deprecated'],
      ]);
    });

    it('reports an invalid status and leaves the form untouched', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, JSON.stringify([{ variantName: 'X', status: 'live', params: { a: 1 } }]));

      expect(nameValue(wrapper)).toBe('');
      expect(paramsText(wrapper)).toBe('');
      expect(toastCalls.at(-1)).toMatchObject({
        summary: 'Invalid variant definitions',
        detail: expect.stringMatching(/"status" must be one of/),
      });
    });
  });

  describe('created definitions drop out of the picker', () => {
    it('removes a definition after a successful single create', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SAME_TASK_THREE);

      const picker = wrapper.find('[data-testid="dropdown-Variant to create"]');
      picker.element.value = 'Two';
      await picker.trigger('change');
      await nextTick();
      await submitAndSucceed(wrapper);

      const remaining = wrapper.find('[data-testid="dropdown-Variant to create"]').text();
      expect(remaining).not.toContain('Two');
      expect(remaining).toContain('One');
      expect(remaining).toContain('Three');
    });

    it('releases the upload entirely once every definition is created', async () => {
      const wrapper = mountForm();
      await uploadFile(wrapper, SAME_TASK_THREE);

      await wrapper.find('[data-testid="create-variant-form__create-all"]').trigger('click');
      await flushAsync();

      expect(wrapper.find('[data-testid="create-variant-form__uploaded-variant-picker"]').exists()).toBe(false);
    });
  });
});
