---
title: Frontend Layer Architecture
description: Pages, containers, and presentational components — three layers with clear responsibilities for data fetching, orchestration, and rendering.
impact: HIGH
scope: frontend
tags: vue, components, container-pattern, architecture
---

## Frontend layer architecture

The frontend is progressively adopting a **container/presentational pattern**. Containers handle data fetching, state orchestration, and business logic. Presentational components receive data via props and communicate back via events — they don't fetch data or access stores. Reference implementations: `StudentScoreReport`, `OrgsList`, `ProgressReport`.

### Incorrect

```vue
<!-- Page component that does everything — fetching, logic, and rendering -->
<script setup>
import { useAuthStore } from '@/store/auth';
import { useAdministrationsQuery } from '@/composables/queries/useAdministrationsQuery';

const authStore = useAuthStore();
const { data, isLoading } = useAdministrationsQuery();

// Business logic mixed into the page
const filteredItems = computed(() => data.value?.filter(/* ... */));
</script>

<template>
  <AppSpinner v-if="isLoading" />
  <div v-else>
    <!-- Hundreds of lines of template mixing layout, data display, and interaction -->
  </div>
</template>
```

```vue
<!-- Presentational component that fetches its own data — defeats the pattern -->
<script setup>
import { useUserDataQuery } from '@/composables/queries/useUserDataQuery';
const { data: user } = useUserDataQuery(props.userId);
</script>
```

### Correct

**Page** — thin routing wrapper that extracts route params and renders the container:

```vue
<!-- pages/scores/StudentScoreReport.vue -->
<script setup>
const props = defineProps({
  administrationId: { type: String, required: true },
  userId: { type: String, required: true },
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
});
</script>

<template>
  <StudentScoreReport
    :administration-id="administrationId"
    :user-id="userId"
    :org-type="orgType"
    :org-id="orgId"
  />
</template>
```

**Container** — owns data fetching, state, and logic:

```vue
<!-- containers/StudentScoreReport/StudentScoreReport.vue -->
<script setup>
// Data fetching via TanStack Query composables
const { data: studentData, isLoading: isLoadingStudent } = useUserDataQuery(props.userId, {
  enabled: initialized,
});
const { data: taskData, isLoading: isLoadingTasks } = useUserRunPageQuery(/* ... */);

// Aggregated loading state
const isLoading = computed(() => isLoadingStudent.value || isLoadingTasks.value);

// Data transformations
const studentFirstName = computed(() => studentData.value?.name?.first ?? '');

// Event handlers
const handleExportToPdf = async () => { /* ... */ };
</script>

<template>
  <AppSpinner v-if="isLoading" />
  <template v-else>
    <HeaderScreen
      :student-first-name="studentFirstName"
      :expanded="expanded"
      @toggle-expand="toggleExpand"
      @export-pdf="handleExportToPdf"
    />
    <ScoreListScreen :task-data="computedTaskData" />
  </template>
</template>
```

**Presentational component** — pure UI, no data fetching, no store access:

```vue
<!-- containers/StudentScoreReport/components/Header/Header.vue -->
<script setup>
defineProps({
  studentFirstName: { type: String, required: true },
  expanded: { type: Boolean, default: false },
});

defineEmits(['toggleExpand', 'exportPdf']);
</script>
```

### Directory structure

Each container lives in its own directory with colocated presentational children:

```
containers/StudentScoreReport/
├── StudentScoreReport.vue           # Container
├── components/                      # Presentational children
│   ├── EmptyState.vue
│   ├── Header/
│   │   ├── Header.vue               # Screen version
│   │   └── Header.print.vue         # Print variant
│   ├── ScoreList/
│   │   ├── ScoreList.vue
│   │   └── ScoreCard/
│   │       └── ScoreCard.vue
│   └── Support/
│       └── Support.vue
└── composables/                     # Container-specific logic (optional)
    └── useScoreListData.js
```

Presentational variants (screen vs print) use a `.print.vue` suffix.

### Component basics

The codebase is JavaScript — components don't use `lang="ts"`. All components use the Composition API with `<script setup>` syntax. Key patterns:

- **Props:** Runtime validation with `defineProps({ type, required, default, validator })`
- **Emits:** Array syntax with `defineEmits(['eventName'])`
- **Two-way binding:** `defineModel()` for form input components
- **Reactivity:** `ref()` for state, `computed()` for derived values, `storeToRefs()` for Pinia destructuring
- **Naming:** PascalCase for files, directories, and template usage. PrimeVue components prefixed with `Pv` (`<PvButton />`, `<PvDataTable />`)

### Test attributes

- **`data-testid`** — unit and component tests. Common in reusable form components. Pattern: `componentname__element-role` (e.g., `data-testid="textinput__label"`)
- **`data-cy`** — E2E tests (Cypress). Common in pages and navigation. Pattern: `component__element` (e.g., `data-cy="navbar__signout-btn-desktop"`)

### The principle

The container/presentational split makes components testable and reusable. Presentational components are pure functions of their props — easy to test, easy to reuse in different contexts, easy to render in Storybook. Containers are the integration point — they wire up queries, handle events, and manage state. When a page component starts growing beyond routing, extract a container.
