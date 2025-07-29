# LEVANTE Dashboard Agent Guidelines

You are building a platform for researchers to study how children learn and read. There are two primary ways of using the platform, as an administrator or as a participant. Participants (children, parents, and teachers) take assessments (called tasks) and the data is recorded in Firebase (Firestore). The tasks come from the @levante-framework/core-tasks package.

Firekit is a service layer for interacting with Firebase. It handles the Firebase client instance as well as authentication and handles calls to cloud functions. We are in the process of migrating away from Firekit.

## Important things to keep in mind
We are updating data model names. The mapping is: child/children (frontend) = student/students (backend), caregiver = parent, site = district, cohort = group, assignment = administration. Note: "assignment" also refers to items in a user's assignment sub-collection, for which a distinct name is still to be determined.

## Build/Lint/Test Commands
- **Development**: `npm run dev` (with emulator) or `npm run dev:db` (without emulator)
- **Build**: `npm run build:dev` (dev) or `npm run build:prod` (production)
- **Lint**: `npm run lint` (auto-fix) or `npm run check-format` (check only)
- **Format**: `npm run format` (Prettier with 120 char width, single quotes, trailing commas)
- **Test All**: `npm test` (runs Vitest with coverage)
- **Test Single**: `npm test -- path/to/test.js` or `npx vitest run path/to/test.js`
- **Test Watch**: `npm run test:watch`

## Code Style Guidelines
- **Language**: Use TypeScript for .ts files, JavaScript for .js files (migration in progress)
- **Vue**: Use `<script setup>` syntax with Composition API, avoid Options API
- **Imports**: Group by type - Vue/external libs, then @/ aliases, then relative paths
- **Components**: PascalCase names (e.g., `NavBar.vue`), use PrimeVue v4 components prefixed with `Pv`
- **Composables**: camelCase with `use` prefix (e.g., `useAuthStore.ts`)
- **State**: Use Pinia stores, VueUse utilities, and Tanstack Query for data fetching
- **Styling**: Tailwind CSS with mobile-first approach, avoid inline styles
- **Functions**: Arrow functions for methods/computed, `function` keyword for pure functions
- **Error Handling**: Use try-catch blocks, handle Firebase errors gracefully
- **Testing**: Use Vitest with @testing-library/vue, mock Firebase services
- **No Comments**: Avoid adding comments unless explicitly requested
- **Documentation**: Always consult the official documentation for all packages and dependencies. Regularly review updates to ensure you are using the latest recommended practices.

## Documentation Sources
- Vue: https://vuejs.org/guide/introduction.html
- Pinia: https://pinia.vuejs.org/introduction.html
- TanStack: https://tanstack.com/query/latest/docs/framework/vue/overview
- PrimveVue: https://primevue.org/introduction/
