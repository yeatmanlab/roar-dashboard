<template>
  <main class="container main">
    <section class="main-body">
      <PageTitle title="Manage Tasks" description="Manage tasks and variants." icon="pencil" />

      <CheckboxInput
        id="registeredTasksOnly"
        v-model="registeredTasksOnly"
        label="Show Only Registered Tasks"
        test-id="registered-tasks-only-checkbox"
        @update:model-value="updateRegisteredTasksOnly"
      />
      <CheckboxInput
        id="registeredVariantsOnly"
        v-model="registeredVariantsOnly"
        label="Show Only Registered Variants"
        test-id="registered-variants-only-checkbox"
        @update:model-value="updateRegisteredVariantsOnly"
      />
      <div class="mx-auto md:flex-none">
        <PvTabView>
          <PvTabPanel header="Tasks">
            <ManageTasks :registered-tasks-only="registeredTasksOnly" />
          </PvTabPanel>

          <PvTabPanel header="Variants">
            <ManageVariants
              :registered-tasks-only="registeredTasksOnly"
              :registered-variants-only="registeredVariantsOnly"
            />
          </PvTabPanel>
        </PvTabView>
      </div>
    </section>
  </main>
</template>

<script setup>
import { watch } from 'vue';
import { useDebounce } from '@/composables/useDebounce';
import { useTasksVariantsToggleRegistered } from '@/composables/useTasksVariantsToggleRegistered';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import CheckboxInput from '@/components/Form/CheckboxInput';
import PageTitle from '@/components/PageTitle';
import ManageTasks from '@/containers/ManageTasks/ManageTasks.vue';
import ManageVariants from '@/components/tasks/ManageVariants.vue';

const { registeredTasksOnly, registeredVariantsOnly, updateRegisteredTasksOnly, updateRegisteredVariantsOnly } =
  useTasksVariantsToggleRegistered();
const debouncedTasksOnly = useDebounce(registeredTasksOnly, 300);
const debouncedVariantsOnly = useDebounce(registeredVariantsOnly, 300);

watch(debouncedTasksOnly, (value) => {
  updateRegisteredTasksOnly(value);
});

watch(debouncedVariantsOnly, (value) => {
  updateRegisteredVariantsOnly(value);
});
</script>
