<template>
  <LevanteSpinner v-if="isLoading" fullscreen />

  <div v-else class="text-color">
    <div class="w-full px-5 my-5">
      <div class="text-2xl">{{ userName ? 'Welcome,' : 'Welcome!' }}</div>
      <div v-if="userName" class="font-bold text-3xl">{{ userName }}</div>
    </div>

    <div class="w-full px-5 mb-5">
      <div class="info">
        <i class="pi pi-exclamation-circle" />

        <div class="mr-auto">
          First things first, let's read the quick documentation to get a better overview of the LEVANTE Platform.

          <div class="font-semibold">
            Always remember: create a group, add some users to it, and finally create an assignment.
          </div>
        </div>

        <div class="docs-button-wrapper">
          <DocsButton href="https://researcher.levante-network.org/dashboard/add-users" label="Documentation" />
        </div>
      </div>
    </div>

    <div v-if="showSelectSitePrompt" class="w-full px-5 mb-5 -mt-4">
      <div class="info info--site-not-selected">
        <i class="pi pi-exclamation-circle" />
        <div class="font-medium">Select a site to see stats</div>
      </div>
    </div>

    <div class="w-full px-5 mb-5">
      <div class="flex align-items-center gap-4">
        <div class="font-medium text-2xl">Users</div>

        <div class="divider" />

        <div class="flex align-items-center gap-1 font-medium">
          <small>Total:</small>
          <small class="text-color-secondary">{{ isSiteSelected ? numOfUsers : '-' }}</small>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mt-3">
        <div v-for="[key, value] in Object.entries(users)" :key="key" class="user-type">
          <div>{{ value.label }}</div>
          <PvBadge :value="isSiteSelected ? value.numOf : '-'" class="badge" />
        </div>
      </div>
    </div>

    <div class="w-full px-5 mb-5">
      <div class="flex align-items-center gap-4">
        <div class="font-medium text-2xl">Assignments</div>

        <div class="divider" />

        <div class="flex align-items-center gap-1 font-medium">
          <small>Total:</small>
          <small class="text-color-secondary">{{ isSiteSelected ? numOfAssignments : '-' }}</small>
        </div>
      </div>

      <div class="flex flex-wrap gap-4 mt-3">
        <div v-for="[key, value] in Object.entries(assignments)" :key="key" class="assignment-card">
          <div class="flex justify-content-between">
            <div>
              <div class="text-2xl">{{ isSiteSelected ? value.numOf : '-' }}</div>
              <div class="text-color-secondary">{{ `${value.label} Assignments` }}</div>
            </div>

            <div :class="`assignment-icon-wrapper assignment-icon-wrapper--${key}`">
              <i v-if="key === 'open'" class="pi pi-play" />
              <i v-if="key === 'upcoming'" class="pi pi-clock" />
              <i v-if="key === 'closed'" class="pi pi-briefcase" />
            </div>
          </div>

          <div v-if="isSiteSelected">
            <div class="assignment-card-footer">
              <RouterLink
                v-if="value.numOf"
                :to="{
                  name: 'ViewAssignments',
                  state: { status: key },
                }"
                class="inline-flex align-items-center gap-2 font-semibold text-sm text-color no-underline"
              >
                <span>View {{ key }}</span>
                <i class="pi pi-arrow-right text-xs" />
              </RouterLink>

              <div
                v-else
                class="inline-flex align-items-center gap-2 font-semibold text-sm text-color no-underline opacity-50 select-none"
              >
                <span>View {{ key }}</span>
                <i class="pi pi-arrow-right text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="w-full px-5 mb-5">
      <div class="flex align-items-center gap-4">
        <div class="font-medium text-2xl">Groups</div>

        <div class="divider" />

        <div class="flex align-items-center gap-1 font-medium">
          <small>Total:</small>
          <small class="text-color-secondary">{{ isSiteSelected ? numOfGroups : '-' }}</small>
        </div>
      </div>

      <div class="flex flex-wrap align-items-start gap-4 w-full h-auto mt-3">
        <div class="group-card">
          <div class="group-card-header">
            <div class="flex align-items-center gap-2">
              <div class="font-semibold">Schools</div>
              <PvBadge :value="isSiteSelected ? schools.length : '-'" class="badge" />
            </div>

            <div v-if="isSiteSelected">
              <RouterLink
                :to="{
                  name: 'ListGroups',
                  state: { tab: 'schools' },
                }"
                class="inline-flex align-items-center gap-2 font-semibold text-sm text-color no-underline"
              >
                <span v-if="schools.length">View schools</span>
                <span v-else>Create</span>
                <i v-if="schools.length" class="pi pi-arrow-right text-xs" />
                <i v-else class="pi pi-plus text-xs" />
              </RouterLink>
            </div>
          </div>

          <div v-if="isSiteSelected">
            <div v-if="schools.length">
              <div v-for="school in schools" :key="school?.id" class="group-item">
                <div>{{ school?.name }}</div>
                <RouterLink :to="`/list-users/schools/${school?.id}/${school?.name}`" class="group-item-link">
                  <i class="pi pi-users" />
                </RouterLink>
              </div>
            </div>

            <div v-else>
              <div class="p-3 text-sm text-color-secondary">There are no schools yet</div>
            </div>
          </div>

          <div v-else>
            <div class="p-3 text-sm text-color-secondary">Select a site to see stats</div>
          </div>
        </div>

        <div class="group-card">
          <div class="group-card-header">
            <div class="flex align-items-center gap-2">
              <div class="font-semibold">Classes</div>
              <PvBadge :value="isSiteSelected ? classes.length : '-'" class="badge" />
            </div>

            <div v-if="isSiteSelected">
              <RouterLink
                :to="{
                  name: 'ListGroups',
                  state: { tab: 'classes' },
                }"
                class="inline-flex align-items-center gap-2 font-semibold text-sm text-color no-underline"
              >
                <span v-if="classes.length">View classes</span>
                <span v-else>Create</span>

                <i v-if="classes.length" class="pi pi-arrow-right text-xs" />
                <i v-else class="pi pi-plus text-xs" />
              </RouterLink>
            </div>
          </div>

          <div v-if="isSiteSelected">
            <div v-if="classes.length">
              <div v-for="_class in classes" :key="_class?.id" class="group-item">
                <div class="flex flex-column">
                  <small class="text-color-secondary">{{ getParentSchoolName(_class?.schoolId) }}</small>
                  <div>{{ _class?.name }}</div>
                </div>
                <RouterLink :to="`/list-users/classes/${_class?.id}/${_class?.name}`" class="group-item-link">
                  <i class="pi pi-users" />
                </RouterLink>
              </div>
            </div>

            <div v-else>
              <div class="p-3 text-sm text-color-secondary">There are no classes yet</div>
            </div>
          </div>

          <div v-else>
            <div class="p-3 text-sm text-color-secondary">Select a site to see stats</div>
          </div>
        </div>

        <div class="group-card">
          <div class="group-card-header">
            <div class="flex align-items-center gap-2">
              <div class="font-semibold">Cohorts</div>
              <PvBadge :value="isSiteSelected ? cohorts.length : '-'" class="badge" />
            </div>

            <div v-if="isSiteSelected">
              <!-- `tab: 'groups'` is the legacy id for the Cohorts tab. -->
              <RouterLink
                :to="{
                  name: 'ListGroups',
                  state: { tab: 'groups' },
                }"
                class="inline-flex align-items-center gap-2 font-semibold text-sm text-color no-underline"
              >
                <span v-if="cohorts.length">View cohorts</span>
                <span v-else>Create</span>

                <i v-if="cohorts.length" class="pi pi-arrow-right text-xs" />
                <i v-else class="pi pi-plus text-xs" />
              </RouterLink>
            </div>
          </div>

          <div v-if="isSiteSelected">
            <div v-if="cohorts.length">
              <div v-for="cohort in cohorts" :key="cohort?.id" class="group-item">
                <div>{{ cohort?.name }}</div>
                <RouterLink :to="`/list-users/groups/${cohort?.id}/${cohort?.name}`" class="group-item-link">
                  <i class="pi pi-users" />
                </RouterLink>
              </div>
            </div>

            <div v-else>
              <div class="p-3 text-sm text-color-secondary">There are no cohorts yet</div>
            </div>
          </div>

          <div v-else>
            <div class="p-3 text-sm text-color-secondary">Select a site to see stats</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DocsButton from '@/components/DocsButton.vue';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import { useGetSiteOverviewQuery } from '@/composables/queries/useGetSiteOverviewQuery';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import PvBadge from 'primevue/badge';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const authStore = useAuthStore();
const { currentSite, userData } = storeToRefs(authStore);

const isSiteSelected = computed(() => !!currentSite.value && currentSite.value !== 'any');
const showSelectSitePrompt = computed(() => !!userData.value && !isSiteSelected.value);
const { data: siteOverview, isLoading } = useGetSiteOverviewQuery(() =>
  isSiteSelected.value ? (currentSite.value as string) : '',
);

const userName = computed(() => {
  const displayName = userData.value?.displayName;
  if (displayName) return displayName;

  const name = userData.value?.name as
    | {
        first?: string;
        middle?: string;
        last?: string;
      }
    | undefined;
  return [name?.first, name?.middle, name?.last].filter(Boolean).join(' ');
});

const userCounts = computed(() => siteOverview.value?.counts.users ?? { teachers: 0, caregivers: 0, children: 0 });

const assignmentCounts = computed(() => siteOverview.value?.counts.assignments ?? { open: 0, upcoming: 0, closed: 0 });

const users = computed(() => ({
  teachers: { label: 'Teachers', numOf: userCounts.value.teachers },
  caregivers: { label: 'Caregivers', numOf: userCounts.value.caregivers },
  children: { label: 'Children', numOf: userCounts.value.children },
}));

const numOfUsers = computed(() => userCounts.value.teachers + userCounts.value.caregivers + userCounts.value.children);

const assignments = computed(() => ({
  open: { label: 'Open', numOf: assignmentCounts.value.open },
  upcoming: { label: 'Upcoming', numOf: assignmentCounts.value.upcoming },
  closed: { label: 'Past', numOf: assignmentCounts.value.closed },
}));

const numOfAssignments = computed(
  () => assignmentCounts.value.open + assignmentCounts.value.upcoming + assignmentCounts.value.closed,
);

const sortByName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const schools = computed(() => sortByName(siteOverview.value?.schools ?? []));
const classes = computed(() => sortByName(siteOverview.value?.classes ?? []));
const cohorts = computed(() => sortByName(siteOverview.value?.cohorts ?? []));

const numOfGroups = computed(() => schools.value.length + classes.value.length + cohorts.value.length);

const getParentSchoolName = (schoolId: string): string =>
  schools.value.find((school) => school.id === schoolId)?.name ?? '';
</script>

<style scoped lang="scss">
.info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
  padding: 1rem;
  background: var(--gray-100);
  border-radius: 12px;
  color: var(--gray-500);

  &.info--site-not-selected {
    background: rgba(var(--bright-yellow-rgb), 0.1);
    color: var(--bright-yellow);
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.docs-button-wrapper {
  border: 4px solid var(--docs-btn-hover);
  border-radius: 10px;
}

.divider {
  display: block;
  flex: 1;
  height: 1px;
  background: var(--gray-200);
}

.user-type {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 175px;
  gap: 0.75rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gray-200);
  border-radius: 0.5rem;

  @media (max-width: 768px) {
    width: 100%;
  }
}

.badge {
  color: var(--bright-red);
  background: rgba(var(--bright-red-rgb), 0.1);
}

.assignment-card {
  display: block;
  width: 320px;
  height: auto;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--gray-200);
  border-radius: 0.5rem;

  @media (max-width: 768px) {
    width: 100%;
  }
}

.assignment-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 100%;

  .pi {
    font-size: 20px;
  }

  &.assignment-icon-wrapper--open {
    background: rgba(var(--bright-green-rgb), 0.1);
    color: var(--bright-green);
  }

  &.assignment-icon-wrapper--upcoming {
    background: rgba(var(--bright-yellow-rgb), 0.1);
    color: var(--bright-yellow);
  }

  &.assignment-icon-wrapper--closed {
    background: rgba(var(--bright-red-rgb), 0.1);
    color: var(--bright-red);
  }
}

.assignment-card-footer {
  display: flex;
  justify-content: flex-end;
  margin: 0.75rem 0 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--gray-200);
}

.group-card {
  display: block;
  width: calc((100% - 48px) / 3);
  height: auto;
  margin: 0;
  padding: 0;
  border: 1px solid var(--gray-200);
  border-radius: 0.5rem;
  overflow: hidden;

  @media (max-width: 768px) {
    width: 100%;
  }
}

.group-card-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 1.125rem;
  border-bottom: 3px solid var(--primary-color);
}

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0;
  padding: 0.75rem 1.125rem;
  border-top: 1px solid var(--gray-200);
  transition: background 0.2s ease-out;

  &:first-of-type {
    border-top: none;
  }

  &:hover {
    background-color: var(--gray-100);
  }
}

.group-item-link {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0;
  padding: 0;
  background-color: var(--gray-200);
  border-radius: 0.33rem;
  color: var(--text-color);
  text-decoration: none;
}
</style>
