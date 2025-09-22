<template>
  <div class="sidebar">
    <div
      class="sidebar__panel__backdrop"
      :class="{ 'is-active': showSideBarPanel }"
      @click="onClickSideBarPanelBackdrop"
    ></div>

    <transition name="sidebar__panel">
      <div v-if="showSideBarPanel" class="sidebar__panel">
        <div class="sidebar__panel__header">
          <h3 class="sidebar__panel__title">{{ t('participant-sidebar.assignments') }}</h3>
        </div>

        <div class="sidebar__panel__main">
          <div
            v-if="selectedStatusCurrent"
            :class="`assignment-group assignment-group--current ${selectedStatusCurrent ? '--active' : ''}`"
          >
            <small class="assignment-group__title"
              >{{ t('participant-sidebar.statusCurrent') }} <span class="ml-auto font-medium">{{ numOfCurrentAssignments }}</span></small
            >
            <ul v-if="currentAssignments.length > 0" class="assignment-group__list">
              <AssignmentCard
                v-for="assignment in currentAssignments"
                :key="assignment?.id"
                :data="assignment"
                :is-active="assignmentsStore.selectedAssignment?.id === assignment?.id"
                :status="ASSIGNMENT_STATUSES.CURRENT"
                @click="onClickAssignment"
              />
            </ul>
            <div v-else class="assignment-group__empty">{{ $t('participant-sidebar.noCurrentAssignments') }}</div>
          </div>

          <div
            v-if="selectedStatusUpcoming"
            :class="`assignment-group assignment-group--upcoming ${selectedStatusUpcoming ? '--active' : ''}`"
          >
            <small class="assignment-group__title"
              >{{ t('participant-sidebar.statusUpcoming') }} <span class="ml-auto font-medium">{{ numOfUpcomingAssignments }}</span></small
            >
            <ul v-if="upcomingAssignments.length > 0" class="assignment-group__list">
              <AssignmentCard
                v-for="assignment in upcomingAssignments"
                :key="assignment?.id"
                :data="assignment"
                :is-active="assignmentsStore.selectedAssignment?.id === assignment?.id"
                :status="ASSIGNMENT_STATUSES.UPCOMING"
                @click="onClickAssignment"
              />
            </ul>
            <div v-else class="assignment-group__empty">{{ $t('participant-sidebar.noUpcomingAssignments') }}</div>
          </div>

          <div
            v-if="selectedStatusPast"
            :class="`assignment-group assignment-group--past ${selectedStatusPast ? '--active' : ''}`"
          >
            <small class="assignment-group__title"
              >{{ t('participant-sidebar.statusPast') }} <span class="ml-auto font-medium">{{ numOfPastAssignments }}</span></small
            >
            <ul v-if="pastAssignments.length > 0" class="assignment-group__list">
              <AssignmentCard
                v-for="assignment in pastAssignments"
                :key="assignment?.id"
                :data="assignment"
                :is-active="assignmentsStore.selectedAssignment?.id === assignment?.id"
                :status="ASSIGNMENT_STATUSES.PAST"
                @click="onClickAssignment"
              />
            </ul>
            <div v-else class="assignment-group__empty">{{ $t('participant-sidebar.noPastAssignments') }}</div>
          </div>
        </div>
      </div>
    </transition>

    <div class="sidebar__rail">
      <div class="sidebar__toggle-btn" @click="onClickSideBarToggleBtn">
        <i v-if="showSideBarPanel" class="pi pi-times"></i>
        <i v-else class="pi pi-list"></i>
      </div>

      <div class="sidebar__divider"></div>

      <div class="sidebar__nav">
        <div
          v-tooltip.right="getTooltip(t('participant-sidebar.statusCurrent'))"
          :class="`sidebar__nav-link --${ASSIGNMENT_STATUSES.CURRENT} ${selectedStatusCurrent ? '--active' : ''}`"
          @click="() => onClickSideBarNavLink(ASSIGNMENT_STATUSES.CURRENT)"
        >
          <i class="pi pi-play"></i>
        </div>

        <div
          v-tooltip.right="getTooltip(t('participant-sidebar.statusUpcoming'))"
          :class="`sidebar__nav-link --${ASSIGNMENT_STATUSES.UPCOMING} ${selectedStatusUpcoming ? '--active' : ''}`"
          @click="() => onClickSideBarNavLink(ASSIGNMENT_STATUSES.UPCOMING)"
        >
          <i class="pi pi-clock"></i>
        </div>

        <div
          v-tooltip.right="getTooltip(t('participant-sidebar.statusPast'))"
          :class="`sidebar__nav-link --${ASSIGNMENT_STATUSES.PAST} ${selectedStatusPast ? '--active' : ''}`"
          @click="() => onClickSideBarNavLink(ASSIGNMENT_STATUSES.PAST)"
        >
          <i class="pi pi-briefcase"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ASSIGNMENT_STATUSES } from '@/constants';
import { getTooltip } from '@/helpers';
import { useAssignmentsStore } from '@/store/assignments';
import { AdministrationType } from '@levante-framework/levante-zod';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import AssignmentCard from './assignments/AssignmentCard.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const assignmentsStore = useAssignmentsStore();
const { userAssignments, selectedStatus } = storeToRefs(assignmentsStore);
assignmentsStore.setSelectedStatus(assignmentsStore.selectedStatus.value || ASSIGNMENT_STATUSES.CURRENT);

const showSideBarPanel = ref(false);

const now = computed(() => new Date());

function isCurrent(assignment: AdministrationType, now: Date) {
  const opened = new Date(assignment?.dateOpened);
  const closed = new Date(assignment?.dateClosed);
  return opened <= now && closed >= now;
}

function isPast(assignment: AdministrationType, now: Date) {
  return new Date(assignment?.dateClosed) < now;
}

function isUpcoming(assignment: AdministrationType, now: Date) {
  return new Date(assignment?.dateOpened) > now;
}

const currentAssignments = computed(() => userAssignments.value.filter((a) => isCurrent(a, now.value)));
const pastAssignments = computed(() => userAssignments.value.filter((a) => isPast(a, now.value)));
const upcomingAssignments = computed(() => userAssignments.value.filter((a) => isUpcoming(a, now.value)));

const numOfCurrentAssignments = computed(() => {
  const length = currentAssignments.value?.length;
  return length > 0 ? length.toString() : '--';
});

const numOfPastAssignments = computed(() => {
  const length = pastAssignments.value?.length;
  return length > 0 ? length.toString() : '--';
});

const numOfUpcomingAssignments = computed(() => {
  const length = upcomingAssignments.value?.length;
  return length > 0 ? length.toString() : '--';
});

const selectedStatusCurrent = computed(() => selectedStatus.value === ASSIGNMENT_STATUSES.CURRENT);
const selectedStatusPast = computed(() => selectedStatus.value === ASSIGNMENT_STATUSES.PAST);
const selectedStatusUpcoming = computed(() => selectedStatus.value === ASSIGNMENT_STATUSES.UPCOMING);

const onClickAssignment = (assignment: AdministrationType, status: string) => {
  assignmentsStore.setSelectedAssignment(assignment);
  assignmentsStore.setSelectedStatus(status);
  showSideBarPanel.value = false;
};

const onClickSideBarNavLink = (status: string) => {
  assignmentsStore.setSelectedStatus(status);
  showSideBarPanel.value = true;
};

const onClickSideBarPanelBackdrop = () => {
  showSideBarPanel.value = false;
};

const onClickSideBarToggleBtn = () => {
  showSideBarPanel.value = !showSideBarPanel.value;
};
</script>

<style lang="scss">
.sidebar {
  display: inline-flex;
  width: auto;
  height: 100dvh;
  margin: 0;
  padding: 0;
  background: white;
  border-top: 7px solid var(--primary-color);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 20;
}

.sidebar__rail {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 0.75rem;
  width: var(--sidebar-width);
  height: 100%;
  padding: 0.75rem 0;
  background: white;
  border-right: 1px solid var(--surface-d);
  position: relative;
}

.sidebar__toggle-btn,
.sidebar__nav-link {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: 0.75rem;
  color: var(--gray-600);
  cursor: pointer;

  .pi {
    font-size: 18px;
  }
}

.sidebar__toggle-btn {
  &:hover {
    color: black;
  }
}

.sidebar__divider {
  display: block;
  width: 2rem;
  height: auto;
  margin: 0;
  border-bottom: 1px solid var(--surface-d);
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 0.75rem;
}

.sidebar__nav-link {
  transition: all 0.2s ease-out;

  &.--current {
    &:hover {
      color: var(--bright-green);
    }

    &.--active {
      background: rgba(var(--bright-green-rgb), 0.1);
      color: var(--bright-green);
    }
  }

  &.--upcoming {
    &:hover {
      color: var(--bright-yellow);
    }

    &.--active {
      background: rgba(var(--bright-yellow-rgb), 0.1);
      color: var(--bright-yellow);
    }
  }

  &.--past {
    &:hover {
      color: var(--bright-red);
    }

    &.--active {
      background: rgba(var(--bright-red-rgb), 0.1);
      color: var(--bright-red);
    }
  }
}

.sidebar__panel {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-panel-width);
  height: 100%;
  margin: 0;
  padding: 0.65rem 0;
  background: white;
  position: absolute;
  top: 0;
  left: 100%;
  box-shadow: 3px 0 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease-in-out;
}

.sidebar__panel__backdrop {
  display: block;
  width: 100vw;
  height: 100svh;
  position: absolute;
  top: 0;
  left: 0;
  background: rgba(0, 0, 0, 0);
  pointer-events: none;
  transition: background 0.3s ease-in-out;

  &.is-active {
    background: rgba(0, 0, 0, 0.5);
    pointer-events: initial;
  }
}

.sidebar__panel-enter-from,
.sidebar__panel-leave-to {
  transform: translateX(-100%);
}

.sidebar__panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 56px;
  margin: 0;
  padding: 0 1.5rem 0.5rem;
  border-bottom: 1px solid var(--surface-d);
}

.sidebar__panel__title {
  display: block;
  margin: 0;
  font-weight: 700;
  color: var(--gray-600);
}

.sidebar__panel__close-btn {
  display: block;
  margin: 0;
  color: var(--gray-600);
  cursor: pointer;

  &:hover {
    color: black;
  }
}

.sidebar__panel__main {
  display: block;
  width: 100%;
  height: auto;
  flex: 1;
  margin: 0;
  padding: 1.5rem;
  overflow-y: auto;
}

.assignment-group {
  &.assignment-group--current {
    .assignment-group__item {
      cursor: pointer;
    }
  }
}

.assignment-group__title {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: 0;
  font-weight: 700;
  color: var(--gray-600);
  text-transform: uppercase;
}

.assignment-group__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  height: auto;
  margin: 1rem 0 0;
  padding: 0;
  list-style-type: none;
}

.assignment-group__item {
  display: flex;
  align-items: center;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--surface-d);
  border-radius: 0.75rem;

  &.--active {
    background: rgba(var(--bright-yellow-rgb), 0.1);
    border: 1px solid var(--bright-yellow);

    .assignment__name {
      color: var(--bright-yellow);
    }
  }
}

.assignment__content {
  display: block;
  flex: 1;
  margin: 0;
}

.assignment__selected-icon {
  color: var(--bright-yellow);
}

.assignment__name {
  display: block;
  margin: 0;
  font-weight: 700;
  color: var(--gray-600);
}

.assignment__dates {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.25rem;
  margin: 0.5rem 0 0;
  font-weight: 500;
  color: var(--gray-500);

  .pi {
    margin: -2px 0 0;
  }
}

.assignment-group__empty {
  display: block;
  margin: 1rem 0 0;
  color: var(--gray-600);
}
</style>
