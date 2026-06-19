<template>
  <main class="container main">
    <section class="main-body">
      <PageTitle title="Manage Tasks" description="Manage tasks and variants." icon="pencil" />

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
            <ManageTasks />
          </PvTabPanel>

          <PvTabPanel header="Variants">
            <ManageVariants :registered-variants-only="registeredVariantsOnly" />
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

const { registeredVariantsOnly, updateRegisteredVariantsOnly } = useTasksVariantsToggleRegistered();
const debouncedVariantsOnly = useDebounce(registeredVariantsOnly, 300);

watch(debouncedVariantsOnly, (value) => {
  updateRegisteredVariantsOnly(value);
});
</script>
