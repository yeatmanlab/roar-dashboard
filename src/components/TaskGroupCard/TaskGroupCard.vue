<template>
  <div
    class="flex-1 flex h-6rem flex-row gap-2 border-1 border-round surface-border bg-white-alpha-90 mb-2 hover:surface-hover"
  >
    <div class="w-11 mt-3 flex flex-row p-0 mb-2">
      <div>
        <img class="w-4rem shadow-2 border-round ml-2" :src="group.image || backupImage" :alt="group.name" />
      </div>
      <div>
        <div class="flex flex-row">
          <span class="font-bold" style="margin-left: 0.625rem">{{ group.name }}</span>
          <PvButton
            class="p-0 surface-hover border-none border-circle hover:text-100 hover:bg-primary"
            @click="toggle($event)"
            ><i
              v-tooltip.top="'Click to view variants'"
              class="pi pi-info-circle text-primary p-1 border-circle hover:text-100"
            ></i
          ></PvButton>
        </div>
        <div class="flex align-items-center gap-2">
          <p class="m-0 mt-1 ml-2">
            <span class="font-bold">Variant name:</span> {{ group.name }} <br />
            <span class="font-bold">Variant id: </span>{{ group.id }}
          </p>
        </div>
        <!-- (i) info button -->
        <PvPopover ref="op" append-to="body" style="width: 40vh">
          <div class="flex justify-content-end mt-0 mb-2">
            <PvButton
              class="p-0 surface-hover border-none border-circle -rotate-45 hover:text-100 hover:bg-primary"
              @click="visible = true"
              ><i
                v-tooltip.top="'Click to expand'"
                class="pi pi-arrows-h border-circle p-2 text-primary hover:text-100"
              ></i
            ></PvButton>
          </div>
          <div class="flex gap-2 flex-column w-full pr-3">
            <!-- Create datatable to show tasks and their respective variants from group.variants -->
            <PvDataTable
              class="p-datatable-small ml-3 border-1 surface-border text-sm"
              header-style="font-size: 20px;"
              :value="group.variants"
              scrollable
              scroll-height="300px"
            >
              <PvColumn field="taskId" header="Task ID"></PvColumn>
              <PvColumn field="variantId" header="Variant ID"></PvColumn>
            </PvDataTable>
          </div>
        </PvPopover>
      </div>
    </div>
    <div class="mr-0 pl-0 flex flex-column">
      <PvButton
        class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
        data-cy="selected-variant"
        @click="handleSelect"
        ><i class="pi pi-chevron-right text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
    </div>
  </div>
  <!-- Variants Full Size Modal -->
  <PvDialog
    v-model:visible="visible"
    modal
    :header="`Variants for Task Group: ${group.name}`"
    :style="{ width: '50rem' }"
  >
    <div class="flex gap-2 flex-column w-full pr-3">
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border text-sm"
        header-style="font-size: 20px;"
        :value="group.variants"
        scrollable
        scroll-height="300px"
      >
        <PvColumn field="taskId" header="Task ID"></PvColumn>
        <PvColumn field="variantId" header="Variant ID"></PvColumn>
      </PvDataTable>
    </div>
  </PvDialog>
</template>

<script setup>
import { ref } from 'vue';
import _toPairs from 'lodash/toPairs';
import PvButton from 'primevue/button';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvDialog from 'primevue/dialog';
import PvPopover from 'primevue/popover';

const props = defineProps({
  group: {
    required: true,
    type: Object,
  },
});

const backupImage = '/src/assets/roar-logo.png';
const showContent = ref(false);
const op = ref(null);
const visible = ref(false);
const emit = defineEmits(['select']);

const handleSelect = () => {
  emit('select', props.group);
};

const toggle = (event) => {
  op.value.toggle(event);
};
</script>
