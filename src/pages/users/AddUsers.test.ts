import * as Papa from 'papaparse';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { usersRepository } from '@/firebase/repositories/UsersRepository';
import { fetchOrgByName } from '@/helpers/query/orgs';
import { useAuthStore } from '@/store/auth';
import AddUsers from './AddUsers.vue';

// ─── Router ──────────────────────────────────────────────────────────────────

const mockRouter = {
  push: vi.fn(),
};

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}));

// ─── Firebase / repositories ──────────────────────────────────────────────────

vi.mock('@/firebase/repositories/UsersRepository', () => ({
  usersRepository: {
    createUsers: vi.fn(),
  },
}));

// ─── Org query helper ─────────────────────────────────────────────────────────

vi.mock('@/helpers/query/orgs', () => ({
  fetchOrgByName: vi.fn(),
}));

// ─── Logger ───────────────────────────────────────────────────────────────────
//
// The real logger pulls in PostHog and Sentry, which fail to initialise in
// JSDOM. Stubbing the surface used by submitUsers' catch block keeps the
// test environment quiet.

vi.mock('@/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Stores ───────────────────────────────────────────────────────────────────
//
// Mocked stores return real Vue refs so that Pinia's storeToRefs() can
// recognise them and pass them through unchanged. Without real refs,
// storeToRefs returns an empty object and all destructured values are
// undefined, causing a crash during component setup.

vi.mock('@/store/auth', async () => {
  const { ref } = await import('vue');
  return {
    useAuthStore: vi.fn(() => ({
      currentSite: ref('site-id-123'),
      currentSiteName: ref('site-id-123'),
    })),
  };
});

// Hoisted so the spy can be referenced both inside the factory below and
// from within individual tests via the imported store mock.
const { setShouldUserConfirmMock } = vi.hoisted(() => ({
  setShouldUserConfirmMock: vi.fn(),
}));

vi.mock('@/store/levante', () => ({
  useLevanteStore: vi.fn(() => ({
    setShouldUserConfirm: setShouldUserConfirmMock,
  })),
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

const createMockFile = (content: string, filename = 'test.csv', type = 'text/csv') => {
  return new File([content], filename, { type });
};

const mockFileUploadEvent = (content: string) => ({
  files: [createMockFile(content)],
});

// ─── Mount helper ─────────────────────────────────────────────────────────────

const mountAddUsers = () =>
  mount(AddUsers, {
    global: {
      plugins: [
        PrimeVue,
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
      directives: { tooltip: Tooltip },
      stubs: {
        AddUsersInfo: true,
        CsvUploader: true,
        CsvTable: true,
        AppSpinner: true,
        PvDivider: true,
        // PrimeVue's dialog component is registered as "Dialog"; stub key must match
        // or the real Dialog+Portal mount and can throw during updates in JSDOM.
        Dialog: true,
        PvMessage: true,
      },
    },
  });

// ─── Shared CSV fixtures ──────────────────────────────────────────────────────

const VALID_CSV = [
  'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
  '1,child,5,2018,,,"Test School","Class A",',
  '2,caregiver,,,,,"Test School","Class A",',
].join('\n');

const MISSING_HEADERS_CSV = ['id,month,year', '1,5,2018'].join('\n');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddUsers Page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockRouter.push.mockReset();
    setShouldUserConfirmMock.mockReset();
  });

  describe('onFileUpload', () => {
    it('handles a valid CSV upload', async () => {
      const vm = mountAddUsers().vm as any;

      await vm.onFileUpload(mockFileUploadEvent(VALID_CSV));

      // No validation errors should be present
      expect(vm.validationErrors).toBeNull();

      // validatedData should be populated with two rows
      expect(vm.validatedData).not.toBeNull();
      expect(vm.validatedData).toHaveLength(2);

      // Zod coerces month/year to numbers and splits org fields into arrays
      const [child, caregiver] = vm.validatedData;

      expect(child.userType).toBe('child');
      expect(child.id).toBe('1');
      expect(child.month).toBe(5);
      expect(child.year).toBe(2018);
      expect(child.school).toEqual(['Test School']);
      expect(child['class']).toEqual(['Class A']);
      expect(child.cohort).toEqual([]);

      expect(caregiver.userType).toBe('caregiver');
      expect(caregiver.id).toBe('2');
      expect(caregiver.school).toEqual(['Test School']);
      expect(caregiver['class']).toEqual(['Class A']);

      expect(vm.status).toEqual({
        message: 'File successfully uploaded. See table for summary of users to be added.',
        severity: 'success',
      });
    });

    it('resets component state at the start of each upload', async () => {
      const vm = mountAddUsers().vm as any;

      // Upload 1: valid CSV — sets validatedData, leaves validationErrors null.
      await vm.onFileUpload(mockFileUploadEvent(VALID_CSV));
      expect(vm.validatedData).not.toBeNull();
      expect(vm.validationErrors).toBeNull();

      // Upload 2: CSV missing the required 'userType' header.
      // resetUserProgress() is called synchronously at the very start of
      // onFileUpload, so by the time the second call resolves both validatedData
      // and validationErrors reflect only this upload's outcome.
      await vm.onFileUpload(mockFileUploadEvent(MISSING_HEADERS_CSV));

      // The first upload's validatedData must be gone.
      expect(vm.validatedData).toBeNull();

      // The second upload's header error must be present and correct.
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.rows).toEqual(
        expect.arrayContaining([
          { message: 'userType: Missing required header' },
          { message: 'school: Missing required header' },
          { message: 'class: Missing required header' },
          { message: 'cohort: Missing required header' },
        ]),
      );
    });

    it('handles validation errors when no file is provided', async () => {
      const vm = mountAddUsers().vm as any;

      await vm.onFileUpload({ files: [] });

      expect(vm.status).toEqual({ message: 'No file uploaded.', severity: 'error' });

      // No data or errors should be set when the upload event carries no file.
      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).toBeNull();
    });

    it('handles validation errors when the file is empty', async () => {
      const vm = mountAddUsers().vm as any;

      // A header-only CSV parses without errors but produces zero data rows,
      // hitting the _parsedData.length === 0 guard in onFileUpload.
      const HEADER_ONLY_CSV = 'id,userType,month,year,caregiverId,teacherId,school,class,cohort';
      await vm.onFileUpload(mockFileUploadEvent(HEADER_ONLY_CSV));

      expect(vm.status).toEqual({
        message: 'The uploaded file contains no users. Please add at least one user and upload again.',
        severity: 'error',
      });
      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).toBeNull();
    });

    it('handles validation errors when required headers are missing', async () => {
      const vm = mountAddUsers().vm as any;

      // Only 'id', 'month', and 'year' are present.
      // Missing: 'userType', 'school', 'class', 'cohort'.
      await vm.onFileUpload(mockFileUploadEvent(MISSING_HEADERS_CSV));

      expect(vm.status).toEqual({
        message: 'The uploaded file is invalid. See table for details.',
        severity: 'error',
      });

      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).not.toBeNull();

      // Header-level errors never need a downloadable CSV, so the flag is false.
      expect(vm.validationErrors.showDownloadButton).toBe(false);

      // One row per missing required header, each with the column name that
      // AddUserCsvHeaderSchema places in the issue path.
      expect(vm.validationErrors.rows).toEqual(
        expect.arrayContaining([
          { message: 'userType: Missing required header' },
          { message: 'school: Missing required header' },
          { message: 'class: Missing required header' },
          { message: 'cohort: Missing required header' },
        ]),
      );
      expect(vm.validationErrors.rows).toHaveLength(4);
    });

    it('handles validation errors for site', async () => {
      const vm = mountAddUsers().vm as any;

      // When the CSV includes a 'site' column, each non-empty value must match
      // the currently selected site ('site-id-123' per the auth store mock).
      // The mismatch produces a custom Zod issue at path [0, 'site'] which
      // combineUserCsvIssues formats as:
      //   'site: Must match the selected site'
      const CSV_WRONG_SITE = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,site',
        '1,child,5,2018,,,"Test School","Class A",,wrong-site',
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(CSV_WRONG_SITE));

      expect(vm.status).toEqual({
        message: 'The uploaded file is invalid. See table for details.',
        severity: 'error',
      });
      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.showDownloadButton).toBe(true);
      expect(vm.validationErrors.rows).toEqual([{ message: 'site: Must match the selected site', rowNums: [2] }]);
    });

    it('groups site validation errors across multiple rows', async () => {
      const vm = mountAddUsers().vm as any;

      // Rows 1 and 3 (CSV rows 2 and 4) have a mismatched site.
      // Row 2 (CSV row 3) matches currentSite and must not appear in rowNums.
      // Identical site errors are grouped into a single entry with a sorted
      // rowNums array, mirroring the behaviour asserted for 'id' errors above.
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,site',
        '1,child,5,2018,,,"Test School","Class A",,wrong-site',
        '2,child,5,2018,,,"Test School","Class A",,site-id-123',
        '3,child,5,2018,,,"Test School","Class A",,another-wrong-site',
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(csv));

      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.rows).toEqual([{ message: 'site: Must match the selected site', rowNums: [2, 4] }]);
    });

    it('accepts rows whose site column matches or is empty', async () => {
      const vm = mountAddUsers().vm as any;

      // row.site is only checked when truthy, so an empty cell is allowed.
      // A populated cell that matches currentSite ('site-id-123') passes too,
      // and the whole file validates successfully.
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,site',
        '1,child,5,2018,,,"Test School","Class A",,site-id-123',
        '2,caregiver,,,,,"Test School","Class A",,',
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(csv));

      expect(vm.validationErrors).toBeNull();
      expect(vm.validatedData).toHaveLength(2);
      expect(vm.status).toEqual({
        message: 'File successfully uploaded. See table for summary of users to be added.',
        severity: 'success',
      });
    });

    it('skips site validation when the site column is absent', async () => {
      const vm = mountAddUsers().vm as any;

      // VALID_CSV has no 'site' header, so the site-column branch is skipped
      // entirely: no custom issues are appended regardless of currentSite.
      await vm.onFileUpload(mockFileUploadEvent(VALID_CSV));

      expect(vm.validationErrors).toBeNull();
      expect(vm.validatedData).toHaveLength(2);
    });

    it('compares site values case-, whitespace-, and diacritic-insensitively', async () => {
      // currentSiteName is overridden with mixed casing and surrounding
      // whitespace so the comparison can't pass via raw equality.
      // normalizeToLowercase (used on both sides) trims, lowercases, and
      // strips combining diacritics, so every row below should match.
      vi.mocked(useAuthStore).mockReturnValueOnce({
        currentSite: ref('site-id-123'),
        currentSiteName: ref('  My Sïte  '),
      } as any);

      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,site',
        '1,child,5,2018,,,"Test School","Class A",,my site',
        '2,child,6,2019,,,"Test School","Class A",,MY SITE',
        '3,child,7,2020,,,"Test School","Class A",,My Site',
        '4,child,8,2021,,,"Test School","Class A",,My Sïte',
      ].join('\n');

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(csv));

      expect(vm.validationErrors).toBeNull();
      expect(vm.validatedData).toHaveLength(4);
      expect(vm.status).toEqual({
        message: 'File successfully uploaded. See table for summary of users to be added.',
        severity: 'success',
      });
    });

    // Per-field validation rules (empty userType, month/year bounds, XOR
    // between school+class and cohort, etc.) are covered by levante-zod's
    // own unit tests against UserCsvSchema. This suite only verifies that
    // any row-level issue raised by the schema flows through onFileUpload
    // into validationErrors with the correct shape — see 'handles
    // validation error' and 'shows correct row numbers'.

    it('handles validation error', async () => {
      const vm = mountAddUsers().vm as any;

      // Empty id fails NonEmptyString() in UserCsvRowBase → Zod issue at
      // path [0, 'id']. combineUserCsvIssues formats this as 'id: Required'
      // and offsets the row index by 2 (header row + 1-indexing).
      const CSV_EMPTY_ID = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
        ',child,5,2018,,,"Test School","Class A",',
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(CSV_EMPTY_ID));

      expect(vm.status).toEqual({
        message: 'The uploaded file is invalid. See table for details.',
        severity: 'error',
      });

      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).not.toBeNull();

      // Row-level errors (unlike header errors) offer a downloadable CSV so
      // users can fix them in bulk.
      expect(vm.validationErrors.showDownloadButton).toBe(true);

      expect(vm.validationErrors.rows).toEqual([{ message: 'id: Required', rowNums: [2] }]);
    });

    it('shows correct row numbers in validation errors', async () => {
      const vm = mountAddUsers().vm as any;

      // Rows 1 and 3 (CSV rows 2 and 4) both have an empty id.
      // Row 2 (CSV row 3) is valid and must not appear in rowNums.
      // combineUserCsvIssues groups identical errors and applies a +2 offset
      // (header row + 1-indexing), so rowNums should be [2, 4].
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
        ',child,5,2018,,,"Test School","Class A",', // index 0 → CSV row 2, empty id
        '2,child,5,2018,,,"Test School","Class A",', // index 1 → CSV row 3, valid
        ',child,5,2018,,,"Test School","Class A",', // index 2 → CSV row 4, empty id
      ].join('\n');

      await vm.onFileUpload(mockFileUploadEvent(csv));

      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.rows).toEqual([{ message: 'id: Required', rowNums: [2, 4] }]);
    });

    it('handles validation errors when the file is malformed', async () => {
      const vm = mountAddUsers().vm as any;

      // An unterminated quoted field makes Papa emit parse errors, so
      // parseCsvFile resolves to null and onFileUpload bails out via the
      // `if (!_parsedData)` branch — the only status string in the function
      // not exercised by any other test.
      const MALFORMED_CSV = ['id,userType', '1,"child'].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(MALFORMED_CSV));

      expect(vm.status).toEqual({
        message:
          'The uploaded file could not be read. If you used a spreadsheet app, please "Save as" or "Export" to CSV and upload again.',
        severity: 'error',
      });
      expect(vm.validatedData).toBeNull();
      expect(vm.validationErrors).toBeNull();
    });

    it('strips errors column before validating', async () => {
      const vm = mountAddUsers().vm as any;

      // A downloaded errors file carries extra column that the schema
      // would otherwise reject. parseCsvFile is configured with
      // omitColumns so onFileUpload should validate the row as if the
      // column was never there.
      const csv = [
        `id,userType,month,year,caregiverId,teacherId,school,class,cohort,errors`,
        `1,child,5,2018,,,"Test School","Class A",,id: Required`,
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(csv));

      expect(vm.validationErrors).toBeNull();
      expect(vm.validatedData).toHaveLength(1);
      expect(vm.validatedData[0]).not.toHaveProperty('errors');
    });

    it('normalizes header casing via NORMALIZED_USER_CSV_HEADERS', async () => {
      const vm = mountAddUsers().vm as any;

      // parseCsvFile lowercases each incoming header before looking it up
      // in NORMALIZED_USER_CSV_HEADERS, which maps every supported header
      // back to the canonical casing the schema expects. As a result, a
      // CSV whose headers arrive in any casing — uppercase, lowercase, or
      // mixed — must validate identically to a canonically-cased file.
      const csv = [
        'ID,USERTYPE,Month,year,CaregiverId,TEACHERid,School,CLASS,cohort',
        '1,child,5,2018,,,"Test School","Class A",',
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(csv));

      expect(vm.validationErrors).toBeNull();
      expect(vm.validatedData).toHaveLength(1);

      // Each value lands on the canonical key the schema produces, proving
      // every header variant was normalized rather than passed through.
      const [user] = vm.validatedData;
      expect(user.id).toBe('1');
      expect(user.userType).toBe('child');
      expect(user.month).toBe(5);
      expect(user.year).toBe(2018);
      expect(user.school).toEqual(['Test School']);
      expect(user['class']).toEqual(['Class A']);
    });

    describe('setShouldUserConfirm', () => {
      // setShouldUserConfirm(true) gates the site selector while the user is
      // mid-upload. It must only be called once the file is fully validated
      // and there is something to add — otherwise an invalid or empty upload
      // would lock the user out of switching sites for no reason.
      //
      // resetUserProgress() at the top of every onFileUpload call invokes
      // setShouldUserConfirm(false), so the negative cases assert on the
      // (true) call specifically rather than on the spy as a whole.

      const wasCalledWithTrue = () => setShouldUserConfirmMock.mock.calls.some(([value]) => value === true);

      it('is called with true after a successful upload', async () => {
        const vm = mountAddUsers().vm as any;

        await vm.onFileUpload(mockFileUploadEvent(VALID_CSV));

        expect(vm.validatedData).not.toBeNull();
        expect(wasCalledWithTrue()).toBe(true);
      });

      it('is not called with true when no file is provided', async () => {
        const vm = mountAddUsers().vm as any;

        await vm.onFileUpload({ files: [] });

        expect(wasCalledWithTrue()).toBe(false);
      });

      it('is not called with true when the file is malformed', async () => {
        const vm = mountAddUsers().vm as any;

        const MALFORMED_CSV = ['id,userType', '1,"child'].join('\n');
        await vm.onFileUpload(mockFileUploadEvent(MALFORMED_CSV));

        expect(wasCalledWithTrue()).toBe(false);
      });

      it('is not called with true when the file is header-only (no data rows)', async () => {
        const vm = mountAddUsers().vm as any;

        const HEADER_ONLY_CSV = 'id,userType,month,year,caregiverId,teacherId,school,class,cohort';
        await vm.onFileUpload(mockFileUploadEvent(HEADER_ONLY_CSV));

        expect(wasCalledWithTrue()).toBe(false);
      });

      it('is not called with true when required headers are missing', async () => {
        const vm = mountAddUsers().vm as any;

        await vm.onFileUpload(mockFileUploadEvent(MISSING_HEADERS_CSV));

        expect(wasCalledWithTrue()).toBe(false);
      });

      it('is not called with true when row-level zod validation fails', async () => {
        const vm = mountAddUsers().vm as any;

        const CSV_EMPTY_ID = [
          'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
          ',child,5,2018,,,"Test School","Class A",',
        ].join('\n');
        await vm.onFileUpload(mockFileUploadEvent(CSV_EMPTY_ID));

        expect(wasCalledWithTrue()).toBe(false);
      });

      it('is not called with true when site validation fails', async () => {
        const vm = mountAddUsers().vm as any;

        const CSV_WRONG_SITE = [
          'id,userType,month,year,caregiverId,teacherId,school,class,cohort,site',
          '1,child,5,2018,,,"Test School","Class A",,wrong-site',
        ].join('\n');
        await vm.onFileUpload(mockFileUploadEvent(CSV_WRONG_SITE));

        expect(wasCalledWithTrue()).toBe(false);
      });

      it('is not called with true when every uploaded user already has a uid', async () => {
        // No new users to add → no reason to gate the site selector.
        const csv = [
          'id,userType,month,year,caregiverId,teacherId,school,class,cohort,uid',
          '1,child,5,2018,,,"Test School","Class A",,existing-uid',
        ].join('\n');

        const vm = mountAddUsers().vm as any;
        await vm.onFileUpload(mockFileUploadEvent(csv));

        expect(wasCalledWithTrue()).toBe(false);
      });
    });
  });

  describe('downloadErrors', () => {
    it('does nothing when parsedData or validationErrors are absent', async () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL');

      const vm = mountAddUsers().vm as any;

      // Case 1: fresh mount — parsedData and validationErrors are both null.
      vm.downloadErrors();
      expect(createObjectURL).not.toHaveBeenCalled();

      // Case 2: valid upload — parsedData is populated but validationErrors
      // is null, so the guard still short-circuits.
      await vm.onFileUpload(mockFileUploadEvent(VALID_CSV));
      expect(vm.validationErrors).toBeNull();

      vm.downloadErrors();
      expect(createObjectURL).not.toHaveBeenCalled();

      createObjectURL.mockRestore();
    });

    it('creates a CSV blob annotated with per-row errors and triggers download', async () => {
      const vm = mountAddUsers().vm as any;

      // Three rows chosen to cover each annotation case in one file:
      //   CSV row 2 (idx 0): empty id + mismatched site  → two errors, joined by '; '
      //   CSV row 3 (idx 1): valid                       → empty 'errors' cell
      //   CSV row 4 (idx 2): mismatched site only        → single error
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,site',
        ',child,5,2018,,,"Test School","Class A",,wrong-site',
        '2,child,5,2018,,,"Test School","Class A",,site-id-123',
        '3,child,5,2018,,,"Test School","Class A",,another-wrong-site',
      ].join('\n');
      await vm.onFileUpload(mockFileUploadEvent(csv));
      expect(vm.validationErrors).not.toBeNull();

      // Install DOM / URL mocks only after mount and onFileUpload have resolved.
      // PrimeVue's Portal/Dialog calls document.body.appendChild on every
      // re-render triggered by reactive state changes; mocking it earlier causes
      // Vue to throw because the mock returns undefined instead of a DOM node.
      const createObjectURL = vi.fn(() => 'mock-blob-url');
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();
      const clickMock = vi.fn();
      const originalCreateElement = document.createElement.bind(document);

      global.URL.createObjectURL = createObjectURL;
      document.createElement = vi.fn((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = clickMock;
        return el;
      });
      global.document.body.appendChild = appendChildMock;
      global.document.body.removeChild = removeChildMock;

      vm.downloadErrors();

      // A Blob of the correct MIME type was passed to createObjectURL.
      expect(createObjectURL).toHaveBeenCalledOnce();
      const [blobCallArgs] = createObjectURL.mock.calls as unknown as [Blob][];
      const blob = blobCallArgs![0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv;charset=utf-8;');

      // The download was triggered with the correct filename via an <a> element.
      expect(appendChildMock).toHaveBeenCalledOnce();
      expect(clickMock).toHaveBeenCalledOnce();
      expect(removeChildMock).toHaveBeenCalledOnce();
      const link = appendChildMock.mock.calls[0]?.[0] as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('mock-blob-url');
      expect(link.getAttribute('download')).toMatch(/^test__errors-\d{8}-\d{4}\.csv$/);

      // Parse the blob back as CSV so we can assert the 'errors' column is
      // populated per row, rather than just probing for substrings.
      const csvText = await blob.text();
      const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: 'greedy',
      });
      expect(parsed.errors).toEqual([]);

      // The output is the input plus exactly one new column: 'errors'.
      expect(parsed.meta.fields).toContain('errors');

      const rows = parsed.data;
      expect(rows).toHaveLength(3);

      // CSV row 2 — both errors, joined by '; ' in the order they appear in
      // validationErrors.rows (id error first because zod issues are collected
      // before the custom site issue in onFileUpload).
      expect(rows[0]).toMatchObject({
        id: '',
        site: 'wrong-site',
        errors: 'id: Required; site: Must match the selected site',
      });

      // CSV row 3 — valid row, 'errors' cell must be empty (not missing).
      expect(rows[1]).toMatchObject({
        id: '2',
        site: 'site-id-123',
        errors: '',
      });

      // CSV row 4 — single error.
      expect(rows[2]).toMatchObject({
        id: '3',
        site: 'another-wrong-site',
        errors: 'site: Must match the selected site',
      });

      document.createElement = originalCreateElement;
    });
  });

  describe('submitUsers', () => {
    // A single-user CSV that validates cleanly with one school + one class
    // (no cohort). Used by every test that needs validatedData populated.
    const SUBMIT_CSV = [
      'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
      '1,child,5,2018,,,"Test School","Class A",',
    ].join('\n');

    beforeEach(() => {
      vi.mocked(fetchOrgByName as any).mockReset();
      vi.mocked(usersRepository.createUsers as any).mockReset();
    });

    it('returns early when there is no clean validated data to submit', async () => {
      const vm = mountAddUsers().vm as any;

      // Fresh mount: validatedData is null. The `!validatedData.value`
      // half of the guard fires and submission is aborted before any
      // org lookup or repository call is attempted.
      await vm.submitUsers();

      expect(vm.status).toEqual({
        message: 'Please fix the errors in your CSV file before submitting.',
        severity: 'error',
      });
      expect(vm.isSubmitting).toBe(false);
      expect(fetchOrgByName).not.toHaveBeenCalled();
      expect(usersRepository.createUsers).not.toHaveBeenCalled();
    });

    it('returns early when no specific site is selected', async () => {
      // Override the auth store for this single mount so isAllSitesSelected
      // is true. mockReturnValueOnce keeps the override scoped to the next
      // useAuthStore() call, which is what mountAddUsers triggers.
      vi.mocked(useAuthStore).mockReturnValueOnce({
        currentSite: ref('any'),
        currentSiteName: ref('Test Site'),
      } as any);

      const vm = mountAddUsers().vm as any;
      // SUBMIT_CSV has no 'site' column, so onFileUpload's site-mismatch
      // check is skipped and validatedData populates cleanly even though
      // the all-sites view is active.
      await vm.onFileUpload(mockFileUploadEvent(SUBMIT_CSV));
      expect(vm.validatedData).not.toBeNull();

      await vm.submitUsers();

      expect(vm.status).toEqual({
        message: 'Please select a site before adding users.',
        severity: 'error',
      });
      expect(vm.isSubmitting).toBe(false);
      expect(usersRepository.createUsers).not.toHaveBeenCalled();
    });

    it('skips submission when every user already has a uid', async () => {
      // The 'uid' header is recognised by NORMALIZED_USER_CSV_HEADERS
      // and accepted by the schema, so a row with a populated uid is
      // treated as already-registered. onFileUpload filters these out
      // up front: when the resulting newUsers list is empty, it sets an
      // 'info' status and returns before populating validatedData, so
      // submitUsers never has anything to send to the backend.
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,uid',
        '1,child,5,2018,,,"Test School","Class A",,existing-uid',
      ].join('\n');

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(csv));

      // The all-already-registered case is now caught at upload time:
      // onFileUpload sets the info status and returns before populating
      // either newUsers or validatedData.
      expect(vm.validatedData).toBeNull();
      expect(vm.newUsers).toBeNull();
      expect(vm.status).toEqual({
        message: 'All users in the file have already been registered.',
        severity: 'info',
      });

      // Calling submitUsers in this state hits the !validatedData guard
      // and bails out before any org lookup or repository call.
      await vm.submitUsers();

      expect(vm.isSubmitting).toBe(false);
      expect(fetchOrgByName).not.toHaveBeenCalled();
      expect(usersRepository.createUsers).not.toHaveBeenCalled();
    });

    it('reports a school error and skips class lookup when a school cannot be resolved', async () => {
      // School lookup returns no matches → createOrgIdResolver throws
      // 'Does not exist in selected site' and allSchoolsFound flips to
      // false. The class loop is then skipped entirely so no spurious
      // 'class: Does not exist…' is appended for the unresolved school
      // — the user is told exactly one thing, the cause of the failure.
      vi.mocked(fetchOrgByName as any).mockResolvedValue([]);

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(SUBMIT_CSV));

      await vm.submitUsers();

      expect(usersRepository.createUsers).not.toHaveBeenCalled();
      expect(vm.status).toEqual({
        message: 'Please fix the errors in your CSV file before submitting.',
        severity: 'error',
      });
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.headers).toEqual(['Validation Errors', 'Affected Rows']);
      expect(vm.validationErrors.keys).toEqual(['message', 'rowNums']);
      expect(vm.validationErrors.showDownloadButton).toBe(true);
      expect(vm.validationErrors.rows).toEqual([{ message: 'school: Does not exist in selected site', rowNums: [2] }]);
      expect(vm.isSubmitting).toBe(false);
    });

    it('groups school-resolution errors across multiple rows', async () => {
      // Every school lookup misses, so the same 'school: Does not exist…'
      // message is produced for each row and class lookups are skipped
      // (allSchoolsFound is false on every iteration). Identical messages
      // are grouped into a single entry whose rowNums collects every
      // affected CSV row (header + 1-indexing applied).
      vi.mocked(fetchOrgByName as any).mockResolvedValue([]);

      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
        '1,child,5,2018,,,"Test School","Class A",',
        '2,child,6,2019,,,"Test School","Class A",',
        '3,child,7,2020,,,"Other School","Class B",',
      ].join('\n');

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(csv));

      await vm.submitUsers();

      expect(usersRepository.createUsers).not.toHaveBeenCalled();
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.rows).toEqual([
        { message: 'school: Does not exist in selected site', rowNums: [2, 3, 4] },
      ]);
    });

    it('reports a class error when the school resolves but the class does not', async () => {
      // The school lookup succeeds, so allSchoolsFound stays true and
      // the class loop runs. The class lookup then misses against the
      // resolved school, producing the genuine 'class: Does not exist…'
      // error — no false 'school:' entry alongside it.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'school-1' }])
        .mockResolvedValueOnce([]);

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(SUBMIT_CSV));

      await vm.submitUsers();

      expect(usersRepository.createUsers).not.toHaveBeenCalled();
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.rows).toEqual([{ message: 'class: Does not exist in selected site', rowNums: [2] }]);
    });

    it('skips class lookup when one of multiple schools fails to resolve', async () => {
      // Caregivers and teachers can list multiple schools. If even one
      // school fails to resolve, allSchoolsFound flips to false and the
      // class loop is skipped — the user sees only the genuine 'school:'
      // error rather than a misleading 'class:' error from looking the
      // class up against just the resolved subset of parent schools.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'school-1' }])
        .mockResolvedValueOnce([]);

      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort',
        'teacher-1,teacher,,,,,"Test School,Other School","Class A",',
      ].join('\n');

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(csv));

      await vm.submitUsers();

      expect(usersRepository.createUsers).not.toHaveBeenCalled();
      expect(vm.validationErrors).not.toBeNull();
      expect(vm.validationErrors.rows).toEqual([{ message: 'school: Does not exist in selected site', rowNums: [2] }]);
    });

    it('submits with normalized userType and resolved orgIds, then merges createUsers results', async () => {
      // Two sequential resolves: first the school, then the class scoped
      // to that school. createOrgIdResolver caches by (orgType, name +
      // parents) so each is called exactly once for our single user.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'school-1' }])
        .mockResolvedValueOnce([{ id: 'class-1' }]);

      vi.mocked(usersRepository.createUsers as any).mockResolvedValueOnce([
        { uid: 'uid-1', email: 'a@b.com', password: 'pw' },
      ]);

      // Stub DOM/URL APIs that downloadRegisteredUsers touches on the success
      // path so the test doesn't trip over JSDOM's missing
      // URL.createObjectURL or trigger a real link click.
      global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
      const originalCreateElement = document.createElement.bind(document);
      const originalAppendChild = document.body.appendChild.bind(document.body);
      const originalRemoveChild = document.body.removeChild.bind(document.body);
      document.createElement = vi.fn((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = vi.fn();
        return el;
      });
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();

      try {
        const vm = mountAddUsers().vm as any;
        await vm.onFileUpload(mockFileUploadEvent(SUBMIT_CSV));

        await vm.submitUsers();

        // createUsers was called once with the canonical payload shape.
        expect(usersRepository.createUsers).toHaveBeenCalledOnce();
        const [payload] = vi.mocked(usersRepository.createUsers as any).mock.calls[0]!;
        expect(payload.siteId).toBe('site-id-123');
        expect(payload.users).toHaveLength(1);

        // userType is normalised for the backend ('child' → 'student'),
        // and orgIds reflects the resolved firestore IDs with the
        // 'cohort' → 'groups' rename applied.
        expect(payload.users[0]).toMatchObject({
          userType: 'student',
          orgIds: {
            districts: ['site-id-123'],
            schools: ['school-1'],
            classes: ['class-1'],
            groups: [],
          },
        });

        // Successful merge: registeredUsers carries the credentials that
        // came back from createUsers, indexed by userIdx.
        expect(vm.registeredUsers).toHaveLength(1);
        expect(vm.registeredUsers[0]).toMatchObject({
          email: 'a@b.com',
          password: 'pw',
          uid: 'uid-1',
        });

        expect(vm.status).toEqual({
          message: 'Users created successfully.',
          severity: 'success',
        });
        expect(vm.isSubmitting).toBe(false);
        expect(vm.showBulkCreateUsersModal).toBe(false);
      } finally {
        document.createElement = originalCreateElement;
        document.body.appendChild = originalAppendChild;
        document.body.removeChild = originalRemoveChild;
      }
    });

    it('surfaces createUsers errors and resets submission state', async () => {
      // Org resolution succeeds; the failure happens at the create call.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'school-1' }])
        .mockResolvedValueOnce([{ id: 'class-1' }]);

      vi.mocked(usersRepository.createUsers as any).mockRejectedValueOnce(new Error('boom'));

      const vm = mountAddUsers().vm as any;
      await vm.onFileUpload(mockFileUploadEvent(SUBMIT_CSV));

      await vm.submitUsers();

      // The catch block formats the error and the finally block
      // unconditionally resets the submission state.
      expect(vm.status).toEqual({
        message: 'Error creating users: boom',
        severity: 'error',
      });
      expect(vm.isSubmitting).toBe(false);
      expect(vm.showBulkCreateUsersModal).toBe(false);
      expect(vm.registeredUsers).toBeNull();
    });
  });

  describe('createOrgIdResolver', () => {
    beforeEach(() => {
      vi.mocked(fetchOrgByName as any).mockReset();
    });

    it('returns a getOrgId function', () => {
      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();
      expect(typeof getOrgId).toBe('function');
    });

    it('fetches an org by normalized name and returns the first result id', async () => {
      vi.mocked(fetchOrgByName as any).mockResolvedValueOnce([{ id: 'district-1' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      // Name includes surrounding whitespace and mixed casing. normalizeToLowercase
      // should produce 'test district' before it is passed to fetchOrgByName.
      const id = await getOrgId('districts', '  Test District  ');

      expect(id).toBe('district-1');
      expect(fetchOrgByName).toHaveBeenCalledOnce();
      expect(fetchOrgByName).toHaveBeenCalledWith('districts', 'test district', undefined, undefined);
    });

    it('passes parentDistrictId and parentSchoolId through to fetchOrgByName', async () => {
      vi.mocked(fetchOrgByName as any).mockResolvedValueOnce([{ id: 'class-1' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      const id = await getOrgId('classes', 'Class A', 'district-1', 'school-1');

      expect(id).toBe('class-1');
      expect(fetchOrgByName).toHaveBeenCalledWith('classes', 'class a', 'district-1', 'school-1');
    });

    it('caches results per orgType by normalized name when no parents are provided', async () => {
      vi.mocked(fetchOrgByName as any).mockResolvedValueOnce([{ id: 'district-1' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      const first = await getOrgId('districts', 'Test District');
      // Different casing/whitespace should still hit the same cache entry because
      // the cache key is the normalized name.
      const second = await getOrgId('districts', '  test district');

      expect(first).toBe('district-1');
      expect(second).toBe('district-1');
      expect(fetchOrgByName).toHaveBeenCalledOnce();
    });

    it('caches results per orgType by a compound key when parents are provided', async () => {
      vi.mocked(fetchOrgByName as any).mockResolvedValueOnce([{ id: 'class-1' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      const first = await getOrgId('classes', 'Class A', 'district-1', 'school-1');
      const second = await getOrgId('classes', 'Class A', 'district-1', 'school-1');

      expect(first).toBe('class-1');
      expect(second).toBe('class-1');
      expect(fetchOrgByName).toHaveBeenCalledOnce();
    });

    it('treats different parent scopes as separate cache entries', async () => {
      // Same class name, different parent schools → must fetch twice and
      // store each result under its own compound cache key.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'class-school-1' }])
        .mockResolvedValueOnce([{ id: 'class-school-2' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      const a = await getOrgId('classes', 'Class A', 'district-1', 'school-1');
      const b = await getOrgId('classes', 'Class A', 'district-1', 'school-2');

      expect(a).toBe('class-school-1');
      expect(b).toBe('class-school-2');
      expect(fetchOrgByName).toHaveBeenCalledTimes(2);
    });

    it('does not collide when an org name overlaps with a parent-id boundary', async () => {
      // A naive `${name}__${parentDistrictId}` cache key would treat
      //   ('schools', 'foo__district-1', undefined)            // org literally named "foo__district-1"
      // and
      //   ('schools', 'foo',              'district-1')        // org named "foo" scoped to district-1
      // as the same entry. Each call must trigger its own fetch and
      // round-trip its own resolved id.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'school-literal' }])
        .mockResolvedValueOnce([{ id: 'school-scoped' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      const literal = await getOrgId('schools', 'foo__district-1');
      const scoped = await getOrgId('schools', 'foo', 'district-1');

      expect(literal).toBe('school-literal');
      expect(scoped).toBe('school-scoped');
      expect(fetchOrgByName).toHaveBeenCalledTimes(2);
    });

    it('maintains independent caches per orgType', async () => {
      // Same normalized name across different orgTypes must not collide.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'district-acme' }])
        .mockResolvedValueOnce([{ id: 'group-acme' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      const districtId = await getOrgId('districts', 'Acme');
      const groupId = await getOrgId('groups', 'Acme');

      expect(districtId).toBe('district-acme');
      expect(groupId).toBe('group-acme');
      expect(fetchOrgByName).toHaveBeenCalledTimes(2);
    });

    it('throws "Does not exist in selected site" when no orgs are returned', async () => {
      vi.mocked(fetchOrgByName as any).mockResolvedValueOnce([]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      await expect(getOrgId('schools', 'Missing School', 'district-1')).rejects.toThrow(
        'Does not exist in selected site',
      );
    });

    it('does not cache a failed lookup, so a later success can be resolved', async () => {
      // First call returns no matches and throws; second call for the same
      // name succeeds. Because failures are not cached, fetchOrgByName must
      // be invoked both times.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'school-1' }]);

      const vm = mountAddUsers().vm as any;
      const getOrgId = vm.createOrgIdResolver();

      await expect(getOrgId('schools', 'High School', 'district-1')).rejects.toThrow('Does not exist in selected site');
      const id = await getOrgId('schools', 'High School', 'district-1');

      expect(id).toBe('school-1');
      expect(fetchOrgByName).toHaveBeenCalledTimes(2);
    });

    it('gives each resolver instance its own cache', async () => {
      // Two independent resolvers must not share state — the second resolver
      // should trigger its own fetch even for a name the first already cached.
      vi.mocked(fetchOrgByName as any)
        .mockResolvedValueOnce([{ id: 'district-1' }])
        .mockResolvedValueOnce([{ id: 'district-1' }]);

      const vm = mountAddUsers().vm as any;
      const resolverA = vm.createOrgIdResolver();
      const resolverB = vm.createOrgIdResolver();

      await resolverA('districts', 'Test District');
      await resolverB('districts', 'Test District');

      expect(fetchOrgByName).toHaveBeenCalledTimes(2);
    });
  });

  describe('runWithConcurrency', () => {
    it('returns an empty array when given no chunks', async () => {
      const vm = mountAddUsers().vm as any;

      const worker = vi.fn(async (n: number) => n * 2);
      const results = await vm.runWithConcurrency([], worker);

      expect(results).toEqual([]);
      expect(worker).not.toHaveBeenCalled();
    });

    it('invokes the worker once per chunk and preserves input order in results', async () => {
      const vm = mountAddUsers().vm as any;

      // Resolve out of order to prove ordering comes from the input index, not
      // completion order. Larger numbers settle first.
      const worker = vi.fn((n: number) => new Promise<number>((resolve) => setTimeout(() => resolve(n * 10), 20 - n)));

      const results = await vm.runWithConcurrency([1, 2, 3, 4], worker, 2);

      expect(results).toEqual([10, 20, 30, 40]);
      expect(worker).toHaveBeenCalledTimes(4);
      // Each chunk should have been forwarded verbatim to the worker.
      expect(worker.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4]);
    });

    it('limits in-flight workers to the provided concurrency', async () => {
      const vm = mountAddUsers().vm as any;

      let inFlight = 0;
      let maxInFlight = 0;
      // Each worker sleeps so that several can overlap if the limit allows it.
      const worker = vi.fn(async (n: number) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return n;
      });

      await vm.runWithConcurrency([1, 2, 3, 4, 5, 6], worker, 3);

      expect(maxInFlight).toBe(3);
      expect(worker).toHaveBeenCalledTimes(6);
    });

    it('defaults the concurrency limit to 2', async () => {
      const vm = mountAddUsers().vm as any;

      let inFlight = 0;
      let maxInFlight = 0;
      const worker = vi.fn(async (n: number) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return n;
      });

      await vm.runWithConcurrency([1, 2, 3, 4], worker);

      expect(maxInFlight).toBe(2);
    });

    it('clamps the runner count to the number of chunks when limit exceeds it', async () => {
      const vm = mountAddUsers().vm as any;

      // With limit > chunks.length, runWithConcurrency only spawns chunks.length
      // runners; max concurrency therefore can't exceed chunks.length.
      let inFlight = 0;
      let maxInFlight = 0;
      const worker = vi.fn(async (n: number) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return n;
      });

      const results = await vm.runWithConcurrency([1, 2], worker, 10);

      expect(results).toEqual([1, 2]);
      expect(maxInFlight).toBeLessThanOrEqual(2);
    });

    it('propagates worker errors via the returned promise', async () => {
      const vm = mountAddUsers().vm as any;

      const worker = vi.fn(async (n: number) => {
        if (n === 2) throw new Error('boom');
        return n;
      });

      await expect(vm.runWithConcurrency([1, 2, 3], worker, 2)).rejects.toThrow('boom');
    });
  });

  describe('downloadRegisteredUsers', () => {
    it('does nothing when registeredUsers is null', () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL');

      const vm = mountAddUsers().vm as any;

      // Fresh mount: registeredUsers is null. The guard short-circuits
      // before any blob is created or download triggered.
      vm.downloadRegisteredUsers();

      expect(createObjectURL).not.toHaveBeenCalled();
      createObjectURL.mockRestore();
    });

    it('produces a CSV ordered by USER_CSV_HEADERS and triggers a download', async () => {
      // The component delegates serialisation to unparseCsvFile (Papa.unparse
      // under the hood) and pins the column order to USER_CSV_HEADERS. This
      // test verifies that contract and the download wiring; the granular
      // escaping rules (commas, quote doubling, null/undefined → empty) live
      // in src/helpers/csv.test.ts.
      const createObjectURL = vi.fn(() => 'mock-blob-url');
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();
      const clickMock = vi.fn();
      const originalCreateElement = document.createElement.bind(document);

      global.URL.createObjectURL = createObjectURL;
      document.createElement = vi.fn((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = clickMock;
        return el;
      });
      global.document.body.appendChild = appendChildMock;
      global.document.body.removeChild = removeChildMock;

      try {
        const vm = mountAddUsers().vm as any;

        // Seed registeredUsers directly so this test isolates the download
        // path from the submitUsers integration. The payload mixes:
        //   • USER_CSV_HEADERS keys in arbitrary insertion order — to prove
        //     the output column order is dictated by USER_CSV_HEADERS, not
        //     the row's own key order.
        //   • a school containing both a comma and a '"' — to confirm the
        //     helper's escaping reaches the produced blob.
        //   • null / undefined values — render as empty cells.
        //   • an extraneous 'extraField' key — appended after the headers.
        vm.registeredUsers = [
          {
            id: '1',
            userType: 'child',
            month: 5,
            year: 2018,
            school: 'Test, "Quoted" School',
            class: 'Class A',
            uid: 'uid-1',
            email: null,
            password: undefined,
            extraField: 'x',
          },
          {
            id: '2',
            userType: 'caregiver',
            school: 'Plain School',
            uid: 'uid-2',
          },
        ];
        vm.uploadedFile = createMockFile('', 'test.csv');

        vm.downloadRegisteredUsers();

        // A Blob of the correct MIME type was passed to createObjectURL.
        expect(createObjectURL).toHaveBeenCalledOnce();
        const [blobCallArgs] = createObjectURL.mock.calls as unknown as [Blob][];
        const blob = blobCallArgs![0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('text/csv;charset=utf-8;');

        // downloadRegisteredUsers passes 'registered-users.csv' explicitly to
        // downloadCsv, which is the documented filename contract for this path.
        expect(appendChildMock).toHaveBeenCalledOnce();
        expect(clickMock).toHaveBeenCalledOnce();
        expect(removeChildMock).toHaveBeenCalledOnce();
        const link = appendChildMock.mock.calls[0]?.[0] as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('mock-blob-url');
        expect(link.getAttribute('download')).toMatch(/^test__registered-\d{8}-\d{4}\.csv$/);

        const csvText = await blob.text();
        const lines = csvText.split('\n');
        expect(lines).toHaveLength(3);

        // Header: USER_CSV_HEADERS in order, with the extraneous key tacked
        // onto the end (the helper's documented behaviour). 'site' is
        // intentionally excluded from USER_CSV_HEADERS because the column
        // is only used for input validation, not download.
        expect(lines[0]).toBe(
          'id,userType,month,year,caregiverId,teacherId,school,class,cohort,email,password,uid,extraField',
        );

        // Row 1 exercises the helper's escaping in one go: the school cell
        // is quoted because it contains a comma, with the inner '"' doubled.
        // null (email) and undefined (password) collapse to empty cells.
        expect(lines[1]).toBe('1,child,5,2018,,,"Test, ""Quoted"" School",Class A,,,,uid-1,x');

        // Row 2 has only a handful of fields populated; every absent header
        // becomes an empty cell, including the appended 'extraField'.
        expect(lines[2]).toBe('2,caregiver,,,,,Plain School,,,,,uid-2,');
      } finally {
        document.createElement = originalCreateElement;
      }
    });
  });

  describe('UI', () => {
    it('"Choose CSV File" button is disabled when all sites are selected', () => {
      // Override the default 'site-id-123' with 'any' for this one mount so
      // that isAllSitesSelected computes to true.
      vi.mocked(useAuthStore).mockReturnValueOnce({
        currentSite: ref('any'),
        currentSiteName: ref(''),
      } as any);

      const wrapper = mountAddUsers();
      const vm = wrapper.vm as any;

      expect(vm.isAllSitesSelected).toBe(true);

      // The disabled prop flows from isAllSitesSelected through to CsvUploader.
      const csvUploader = wrapper.findComponent({ name: 'CsvUploader' });
      expect(csvUploader.exists()).toBe(true);
      expect(csvUploader.props('disabled')).toBe(true);
    });

    it('rows datatable shows only users without a uid', async () => {
      // Mixed upload: rows 1 and 3 are new (uid empty) and row 2 is
      // already registered (uid populated). onFileUpload populates
      // newUsers as a list of { user, userIdx } entries, omitting the
      // already-registered row, and CsvTable receives that filtered
      // list as its rows prop.
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,uid',
        '1,child,5,2018,,,"Test School","Class A",,',
        '2,caregiver,,,,,"Test School","Class A",,existing-uid-2',
        '3,child,8,2019,,,"Test School","Class B",,',
      ].join('\n');

      const wrapper = mountAddUsers();
      const vm = wrapper.vm as any;

      await vm.onFileUpload(mockFileUploadEvent(csv));
      await wrapper.vm.$nextTick();

      // validatedData carries every row from the file…
      expect(vm.validatedData).toHaveLength(3);

      // …but newUsers excludes the already-registered row, preserving
      // input order for the remaining two. newUsersMap is a parallel
      // array carrying each row's original index into validatedData,
      // which submitUsers needs to merge createUsers results back in.
      expect(vm.newUsers).toHaveLength(2);
      expect(vm.newUsers.map((u: { id: string }) => u.id)).toEqual(['1', '3']);
      expect(vm.newUsers.every((u: { uid?: string }) => !u.uid)).toBe(true);
      expect(vm.newUsersMap).toEqual([0, 2]);

      // The rows datatable receives the filtered list, not validatedData.
      // The errors datatable's CsvTable is not rendered (validationErrors
      // is null), so findComponent uniquely resolves to the rows table.
      const csvTable = wrapper.findComponent({ name: 'CsvTable' });
      expect(csvTable.exists()).toBe(true);
      expect(csvTable.props('rows')).toEqual(vm.newUsers);
    });

    it('sets info status and hides rows datatable when every uploaded user already has a uid', async () => {
      // Every row carries a populated uid, so onFileUpload's filter
      // produces an empty list. The component then surfaces an
      // info-level status to explain why nothing will be added and
      // returns *before* assigning newUsers or validatedData, so the
      // rows-datatable's `v-if="newUsers && !validationErrors"` keeps
      // CsvTable from rendering at all.
      const csv = [
        'id,userType,month,year,caregiverId,teacherId,school,class,cohort,uid',
        '1,child,5,2018,,,"Test School","Class A",,existing-uid-1',
        '2,caregiver,,,,,"Test School","Class A",,existing-uid-2',
      ].join('\n');

      const wrapper = mountAddUsers();
      const vm = wrapper.vm as any;

      await vm.onFileUpload(mockFileUploadEvent(csv));
      await wrapper.vm.$nextTick();

      // Both refs stay at their initial null because onFileUpload
      // returns immediately after detecting that nothing needs adding.
      expect(vm.validatedData).toBeNull();
      expect(vm.newUsers).toBeNull();
      expect(vm.status).toEqual({
        message: 'All users in the file have already been registered.',
        severity: 'info',
      });

      // No CsvTable should render: the errors table is gated by
      // validationErrors (null here) and the rows table is gated by
      // newUsers (null here).
      const csvTable = wrapper.findComponent({ name: 'CsvTable' });
      expect(csvTable.exists()).toBe(false);
    });
  });
});
