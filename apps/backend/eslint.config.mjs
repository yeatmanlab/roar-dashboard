import { config } from '@roar-platform/eslint-config/backend';

export default [
  ...config,
  {
    files: ['**/src/**/*.ts'],
    rules: {
      // Enforce using logger instead of console
      'no-console': 'error',
    },
  },
  {
    // Seeds run outside the main TypeScript project (tsconfig.json only covers src/).
    // The import resolver can't find workspace packages for these files, but resolution
    // works correctly at runtime via ts-node.
    files: ['**/seeds/**/*.ts'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    // Ratchet for the repository layer's api-contract coupling.
    // This rule stops repository coupling from growing further.
    // Anything not on the allowlist needs a visible, justified disable comment to land.
    files: ['**/src/repositories/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@roar-platform/api-contract',
              allowImportNames: [
                // Permanent exemption. `asc`/`desc` is a SQL fact with exactly two values that will never change.
                'SortOrder',

                // Deferred types. Each of these backs a `Record<…SortFieldType, Column>`
                // whose exhaustiveness is a compile-time guarantee: the contract cannot
                // expose a sort field the repository has no column for.
                'AdministrationAgreementSortFieldType',
                'AdministrationSortFieldType',
                'AdministrationTaskVariantSortFieldType',
                'AgreementSortFieldType',
                'DistrictSortFieldType',
                'EnrolledUsersSortFieldType',
                'GroupSortFieldType',
                'SchoolClassSortFieldType',
                'SchoolSortFieldType',
                'TaskBundleSortFieldType',
                'TaskSortFieldType',
                'TaskVariantSortFieldType',
                'TaskVariantsSortFieldType',
              ],
              message:
                'Repositories should not import transport types from the api-contract. Domain enums have pgEnum-derived counterparts in src/enums/; query and entity shapes belong to this layer. See roar-project-management#1733.',
            },
          ],
        },
      ],
    },
  },
  {
    // The same ratchet for src/types/.
    // Test files are excluded — parity tests have to import both sides to compare them,
    // exactly as the enum parity tests in src/enums/ do.
    files: ['**/src/types/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@roar-platform/api-contract',
              // Narrower than the repository allowlist on purpose: only the two names shared types genuinely need.
              allowImportNames: ['SortOrder', 'EnrolledUsersSortFieldType'],
              message:
                'Shared types should not re-export api-contract types — that hides the coupling from the repository and service rules. Derive from db/schema or src/enums/ instead. See roar-project-management#1733.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.integration.test.ts'],
    rules: {
      // toReturn() in route-test.helper.ts wraps expect() internally
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', '**.toReturn'] }],
    },
  },
];
