# LEVANTE Dashboard Testing Documentation

This document provides comprehensive information about all testing strategies, configurations, and available tests in the LEVANTE Dashboard project.

## Table of Contents

- [Testing Overview](#testing-overview)
- [Test Types](#test-types)
- [Testing Frameworks](#testing-frameworks)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Coverage](#coverage)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Testing Overview

The LEVANTE Dashboard uses a comprehensive testing strategy that includes:

- **Unit Tests**: Component and utility function testing with Vitest
- **Integration Tests**: Component interaction testing with Vue Testing Library
- **End-to-End Tests**: Full user workflow testing with Cypress
- **Localization Tests**: Multi-language functionality testing
- **Mutation Tests**: API interaction testing

## Test Types

### 1. Unit Tests (Vitest)

Unit tests are located in various directories and test individual components, utilities, and functions.

**Framework**: Vitest with Happy DOM
**Test Pattern**: `**/*.test.{js,ts}`
**Setup**: [`vitest.setup.js`](vitest.setup.js)

#### Component Tests

- **Location**: [`src/components/tests/`](src/components/tests/)
- **Examples**:
  - [`AddGroupModal.test.js`](src/components/tests/AddGroupModal.test.js) - Modal component functionality
  - [`NavBar.test.js`](src/components/tests/NavBar.test.js) - Navigation component
  - [`RoarDataTable.test.js`](src/components/tests/RoarDataTable.test.js) - Data table component
  - [`UserActions.test.js`](src/components/tests/UserActions.test.js) - User action components

#### Page Tests

- **Location**: [`src/pages/tests/`](src/pages/tests/)
- **Examples**:
  - [`SignIn.test.js`](src/pages/tests/SignIn.test.js) - Authentication page
  - [`HomeAdministrator.test.js`](src/pages/tests/HomeAdministrator.test.js) - Admin dashboard
  - [`CreateAssignment.test.js`](src/pages/tests/CreateAssignment.test.js) - Assignment creation
  - [`ListGroups.test.js`](src/pages/tests/ListGroups.test.js) - Groups management
  - [`addUsers.test.js`](src/pages/tests/addUsers.test.js) - User management

#### Helper/Utility Tests

- **Location**: [`src/helpers/__tests__/`](src/helpers/__tests__/)
- **Examples**:
  - [`languageDiscovery.test.ts`](src/helpers/__tests__/languageDiscovery.test.ts) - Language system testing
  - [`getDynamicRouterPath.test.ts`](src/helpers/__tests__/getDynamicRouterPath.test.ts) - Router utilities
  - [`computeQueryOverrides.test.ts`](src/helpers/__tests__/computeQueryOverrides.test.ts) - Query utilities
  - [`hasArrayEntries.test.ts`](src/helpers/__tests__/hasArrayEntries.test.ts) - Array utilities

#### Composable Tests

- **Location**: [`src/composables/`](src/composables/)
- **Query Tests**: Testing data fetching composables
  - [`useUserDataQuery.test.ts`](src/composables/useUserDataQuery.test.ts)
  - [`useGroupsListQuery.test.ts`](src/composables/useGroupsListQuery.test.ts)
  - [`useDistrictsListQuery.test.ts`](src/composables/useDistrictsListQuery.test.ts)
  - [`useTasksQuery.test.ts`](src/composables/useTasksQuery.test.ts)
  - [`useOrgUsersQuery.test.ts`](src/composables/useOrgUsersQuery.test.ts)
  - And many more...
- **Mutation Tests**: Testing data modification composables
  - [`useDeleteAdministrationMutation.test.js`](src/composables/useDeleteAdministrationMutation.test.js)
  - [`useUpdateUserMutation.test.js`](src/composables/useUpdateUserMutation.test.js)
  - [`useUpdateTaskMutation.test.js`](src/composables/useUpdateTaskMutation.test.js)
  - [`useAddTaskMutation.test.js`](src/composables/useAddTaskMutation.test.js)
- **Utility Tests**: Testing utility composables
  - [`useUserType.test.js`](src/composables/useUserType.test.js)
  - [`useInactivityTimeout.test.js`](src/composables/useInactivityTimeout.test.js)
  - [`useSSOAccountReadinessVerification.test.js`](src/composables/useSSOAccountReadinessVerification.test.js)

### 2. End-to-End Tests (Cypress)

E2E tests simulate real user interactions and test complete workflows.

**Framework**: Cypress v14+
**Location**: [`cypress/e2e/`](cypress/e2e/)
**Config**: [`cypress.config.ts`](cypress.config.ts)

#### Test Files

##### [`testTasks.cy.ts`](cypress/e2e/testTasks.cy.ts)

- **Purpose**: Tests core task functionality from dashboard
- **Features**:
  - User authentication flow
  - Task selection and initialization
  - Task completion workflow
  - Navigation between tasks
- **Environment Variables**:
  - `E2E_USE_ENV`: Flag to use environment credentials
  - `E2E_BASE_URL`: Test URL (default: http://localhost:5173/signin)
  - `E2E_TEST_EMAIL`: Test user email
  - `E2E_TEST_PASSWORD`: Test user password

##### [`locales.cy.ts`](cypress/e2e/locales.cy.ts)

- **Purpose**: Tests localization functionality
- **Features**:
  - Multi-language support testing
  - Language switching functionality
  - Translation rendering verification
- **Supported Locales**: `en`, `en-US`, `es`, `es-CO`, `de`, `fr-CA`, `nl`, `en-GH`, `de-CH`, `es-AR`
- **Environment Variables**:
  - `E2E_LOCALES`: Comma-separated list of locales to test
  - `E2E_SKIP_LOGIN`: Skip authentication (useful for frontend-only testing)

##### [`locales-emulator.cy.ts`](cypress/e2e/locales-emulator.cy.ts)

- **Purpose**: Tests localization with Firebase emulator
- **Features**: Similar to [`locales.cy.ts`](cypress/e2e/locales.cy.ts) but with emulator backend

##### [`smoke.cy.ts`](cypress/e2e/smoke.cy.ts)

- **Status**: Currently disabled due to CI failures
- **Purpose**: Basic smoke tests for critical functionality

### 3. Translation Tests

The dashboard includes comprehensive translation testing:

#### Language Discovery System Tests

- **File**: [`src/helpers/__tests__/languageDiscovery.test.ts`](src/helpers/__tests__/languageDiscovery.test.ts)
- **Coverage**:
  - Full locale discovery from dashboard translation system
  - Legacy language code compatibility
  - Language mapping functions
  - Translation key validation
  - Primary vs legacy language options

## Testing Frameworks

### Vitest Configuration

```javascript
// vitest.config.js
{
  environment: 'happy-dom',
  globals: true,
  setupFiles: ['./vitest.setup.js'],
  coverage: {
    provider: 'istanbul',
    include: ['src/**/*'],
    exclude: ['**/test-support/**'],
    reporter: ['html', 'text'] // or ['json', 'text-summary'] in CI
  }
}
```

**File**: [`vitest.config.js`](vitest.config.js)

### Cypress Configuration

```typescript
// cypress.config.ts
{
  e2e: {
    excludeSpecPattern: ['**/locales*.cy.ts'], // Excluded by default
    env: {
      E2E_BASE_URL: 'http://localhost:5173/signin',
      E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL,
      E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD,
      E2E_SKIP_LOGIN: process.env.E2E_SKIP_LOGIN,
      E2E_LOCALES: process.env.E2E_LOCALES
    }
  }
}
```

**File**: [`cypress.config.ts`](cypress.config.ts)

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.js
npx vitest run path/to/test.js

# Run specific test pattern
npm test -- --grep "Language Discovery"
```

### End-to-End Tests (Cypress)

```bash
# Open Cypress Test Runner (GUI)
npm run cypress:open

# Run locale tests with emulator
npm run cypress:locales:emulator

# Run complete e2e locale test with setup
npm run e2e:locales:emulator

# Run Cypress headlessly
npx cypress run

# Run specific test file
npx cypress run --spec "cypress/e2e/testTasks.cy.ts"
```

### Environment-Specific Test Commands

```bash
# Locale testing with emulator environment
E2E_USE_ENV=TRUE E2E_BASE_URL=http://localhost:5173/signin \
E2E_TEST_EMAIL=student@levante.test E2E_TEST_PASSWORD=student123 \
npx cypress run --spec cypress/e2e/locales-emulator.cy.ts

# Locale testing with custom locales
E2E_LOCALES="en-US,es-CO,de" npx cypress run --spec cypress/e2e/locales.cy.ts

# Skip login for frontend-only testing
E2E_SKIP_LOGIN=TRUE npx cypress run --spec cypress/e2e/locales.cy.ts
```

## Test Structure

### Unit Test Structure

```javascript
// Example: Component test
import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import Component from '@/components/Component.vue';

describe('Component', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(Component, {
      // Vue Test Utils configuration
    });
  });

  it('should render correctly', () => {
    expect(wrapper.exists()).toBe(true);
  });
});
```

### E2E Test Structure

```typescript
// Example: Cypress test
describe('Feature Test', () => {
  beforeEach(() => {
    cy.visit('/signin');
    // Setup steps
  });

  it('should complete user workflow', () => {
    // Test steps
    cy.get('[data-cy="button"]').click();
    cy.contains('Expected Text').should('exist');
  });
});
```

## Coverage

### Coverage Configuration

- **Provider**: Istanbul
- **Threshold**: Configured per project needs
- **Exclude Patterns**:
  - `**/test-support/**`
  - Node modules
  - Configuration files

### Coverage Reports

- **Development**: HTML report in `coverage/` directory
- **CI/CD**: JSON and text summary reports

### Viewing Coverage

```bash
# Generate and view coverage report
npm test -- --coverage
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

## Test Support Utilities

### Test Support Directory

- **Location**: [`src/test-support/`](src/test-support/)
- **Purpose**: Shared testing utilities, mocks, and fixtures
- **Excluded**: From coverage reports

### Common Test Utilities

#### Mocks

- Firebase authentication mocks
- Vue Query mocks
- I18n mocks
- Router mocks

#### Test Data

- User fixtures
- Task fixtures
- Translation fixtures

## Best Practices

### Unit Testing

1. **Isolation**: Test components in isolation with proper mocking
2. **Accessibility**: Test for accessibility compliance
3. **User Behavior**: Test from user perspective, not implementation details
4. **Edge Cases**: Cover error states and edge cases
5. **Async Testing**: Properly handle async operations

### E2E Testing

1. **Realistic Data**: Use realistic test data
2. **Stable Selectors**: Use `data-cy` attributes for element selection
3. **Independent Tests**: Each test should be independent and repeatable
4. **Cleanup**: Ensure proper cleanup after tests
5. **Environment Consistency**: Use consistent test environments

### Translation Testing

1. **Key Coverage**: Test all translation keys are present
2. **Locale Switching**: Test dynamic locale switching
3. **Fallbacks**: Test fallback locale behavior
4. **Special Characters**: Test with special characters and long text

## Troubleshooting

### Common Issues

#### Unit Tests

- **Module Resolution**: Ensure proper path aliases in test configuration
- **Vue Component Mounting**: Check for proper Vue Test Utils setup
- **Async Operations**: Use proper async/await or test utilities

#### E2E Tests

- **Element Not Found**: Check for dynamic content loading and use proper waits
- **Authentication**: Ensure test credentials are valid
- **Network Issues**: Check for proper mocking or test environment setup

#### Translation Tests

- **Missing Keys**: Ensure all translation files are generated
- **Locale Format**: Use proper locale format (e.g., 'en-US' vs 'en')
- **Dynamic Loading**: Wait for translations to load in tests

### Debug Commands

```bash
# Verbose test output
npm test -- --reporter=verbose

# Debug specific test
npm test -- --grep "specific test" --timeout 0

# Cypress debug mode
DEBUG=cypress:* npx cypress run

# Test with Node debugger
node --inspect-brk node_modules/.bin/vitest run
```

### Environment Setup

#### Development Testing

```bash
# Start development server
npm run dev:db

# In another terminal, run tests
npm test
```

#### Emulator Testing

```bash
# Start Firebase emulators
npx firebase emulators:start --only auth,firestore

# Run emulator-specific tests
npm run e2e:locales:emulator
```

## Integration with CI/CD

### GitHub Actions

- Tests run on pull requests and main branch
- Coverage reports are generated and uploaded
- E2E tests run against staging environments

### Pre-commit Hooks

- Linting and formatting checks
- Unit test execution
- Type checking

## Contributing to Tests

### Adding New Tests

1. Follow existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add proper documentation and comments
4. Update this README when adding new test categories

### Test Maintenance

1. Keep tests up-to-date with feature changes
2. Refactor tests when code structure changes
3. Monitor and fix flaky tests
4. Update test data and fixtures regularly

---

For questions about testing or to report issues with tests, please refer to the main project documentation or create an issue in the repository.
