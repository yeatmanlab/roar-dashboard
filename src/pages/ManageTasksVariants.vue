<template>
  <main class="container main">
    <section class="main-body">
      <PageTitle title="Manage Tasks" description="Manage tasks and variants." icon="pencil" />

      <div class="mx-auto md:flex-none">
        <PvTabView>
          <PvTabPanel header="Tasks">
            <ManageTasks />
          </PvTabPanel>

          <PvTabPanel header="Variants">
            <ManageVariants />
          </PvTabPanel>
        </PvTabView>
      </div>
    </section>
  </main>
</template>

<script setup>
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import PageTitle from '@/components/PageTitle';
import ManageTasks from '@/containers/ManageTasks';
import ManageVariants from '@/components/tasks/ManageVariants.vue';
</script>
