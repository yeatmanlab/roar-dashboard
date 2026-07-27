import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';

// The picker builds its client via the SDK's createApiClient; mock it so we can
// drive listTaskVariants responses without a backend.
const listTaskVariants = vi.fn();
vi.mock('@roar-platform/assessment-sdk', () => ({
  createApiClient: vi.fn(() => ({ tasks: { listTaskVariants } })),
}));

// Imported after vi.mock so the mocked SDK is in place.
const { mountVariantPicker } = await import('./variantPicker.js');

const PICKER_ID = 'roar-variant-picker';
const SELECT_ID = 'roar-variant-picker-select';

const baseArgs = { baseUrl: '/v1', auth: { getToken: vi.fn() }, taskId: 'pa' };

/** Build a 200 listTaskVariants envelope for the given variant items. */
function okResponse(items, totalPages = 1) {
  return { status: StatusCodes.OK, body: { data: { items, pagination: { totalPages } } } };
}

function getSelect() {
  return document.getElementById(SELECT_ID);
}

describe('mountVariantPicker', () => {
  let warnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    document.getElementById(PICKER_ID)?.remove();
    document.body.innerHTML = '';
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('requests only published variants, sorted by name', async () => {
    listTaskVariants.mockResolvedValue(okResponse([{ id: 'v1', name: 'English' }]));

    await mountVariantPicker({ ...baseArgs, currentVariantId: 'v1' });

    expect(listTaskVariants).toHaveBeenCalledWith({
      params: { taskId: 'pa' },
      query: { status: 'published', perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('renders one option per variant and pre-selects the current one', async () => {
    listTaskVariants.mockResolvedValue(
      okResponse([
        { id: 'v1', name: 'English' },
        { id: 'v2', name: 'Spanish' },
      ]),
    );

    await mountVariantPicker({ ...baseArgs, currentVariantId: 'v2' });

    const select = getSelect();
    expect(select).not.toBeNull();
    expect([...select.options].map((o) => o.value)).toEqual(['v1', 'v2']);
    expect([...select.options].map((o) => o.textContent)).toEqual(['English', 'Spanish']);
    expect(select.value).toBe('v2');
  });

  it('labels an unnamed variant with a short id prefix', async () => {
    listTaskVariants.mockResolvedValue(okResponse([{ id: 'abcdef1234-5678', name: null }]));

    await mountVariantPicker({ ...baseArgs });

    expect(document.querySelector(`#${SELECT_ID} option`).textContent).toBe('variant abcdef12');
  });

  it('surfaces the active variant as "(current)" when it is not in the published set', async () => {
    listTaskVariants.mockResolvedValue(okResponse([{ id: 'v1', name: 'English' }]));

    await mountVariantPicker({ ...baseArgs, currentVariantId: 'draft-x' });

    const options = [...getSelect().options];
    expect(options[0].value).toBe('draft-x');
    expect(options[0].textContent).toBe('(current)');
    expect(getSelect().value).toBe('draft-x');
  });

  it('warns (but still renders) when the results span more than one page', async () => {
    listTaskVariants.mockResolvedValue(okResponse([{ id: 'v1', name: 'English' }], 3));

    await mountVariantPicker({ ...baseArgs, currentVariantId: 'v1' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pages total'));
    expect(getSelect()).not.toBeNull();
  });

  it('navigates to the chosen variant, preserving other query params', async () => {
    const assign = vi.fn();
    const original = window.location;
    delete window.location;
    window.location = { href: 'http://localhost/?task=pa', assign };

    listTaskVariants.mockResolvedValue(
      okResponse([
        { id: 'v1', name: 'English' },
        { id: 'v2', name: 'Spanish' },
      ]),
    );
    await mountVariantPicker({ ...baseArgs, currentVariantId: 'v1' });

    const select = getSelect();
    select.value = 'v2';
    select.dispatchEvent(new Event('change'));

    expect(assign).toHaveBeenCalledTimes(1);
    const navigatedTo = new URL(assign.mock.calls[0][0]);
    expect(navigatedTo.searchParams.get('variantId')).toBe('v2');
    expect(navigatedTo.searchParams.get('task')).toBe('pa');

    window.location = original;
  });

  it('renders nothing when there are no published variants', async () => {
    listTaskVariants.mockResolvedValue(okResponse([]));

    await mountVariantPicker({ ...baseArgs });

    expect(document.getElementById(PICKER_ID)).toBeNull();
  });

  it('renders nothing and does not throw on a non-200 response', async () => {
    listTaskVariants.mockResolvedValue({ status: StatusCodes.FORBIDDEN, body: {} });

    await expect(mountVariantPicker({ ...baseArgs })).resolves.toBeUndefined();
    expect(document.getElementById(PICKER_ID)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('swallows request errors so the picker never breaks the assessment', async () => {
    listTaskVariants.mockRejectedValue(new Error('network'));

    await expect(mountVariantPicker({ ...baseArgs })).resolves.toBeUndefined();
    expect(document.getElementById(PICKER_ID)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('mounts on <html> so a jsPsych document.body reset does not remove it', async () => {
    listTaskVariants.mockResolvedValue(okResponse([{ id: 'v1', name: 'English' }]));

    await mountVariantPicker({ ...baseArgs, currentVariantId: 'v1' });
    expect(document.getElementById(PICKER_ID).parentElement).toBe(document.documentElement);

    // jsPsych wipes document.body.innerHTML when the experiment starts.
    document.body.innerHTML = '';

    expect(document.getElementById(PICKER_ID)).not.toBeNull();
  });
});
