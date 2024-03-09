<template>
  <div
    v-if="!hasControls"
    class="flex-1 flex flex-row gap-2 border-1 border-round surface-border bg-white-alpha-90 mt-1 hover:surface-hover"
  >
    <div class="w-11 mt-3 flex flex-row p-0 mb-2">
      <div>
        <img
          class="w-4rem shadow-2 border-round ml-2"
          :src="variant.task.image || backupImage"
          :alt="variant.task.name"
        />
      </div>
      <div>
        <div class="flex flex-row">
          <span class="font-bold" style="margin-left: 0.625rem">{{ variant.task.name }}</span>
          <PvButton
            class="p-0 surface-hover border-none border-circle hover:text-100 hover:bg-primary"
            @click="toggle($event)"
            ><i
              v-tooltip.top="'Click to view params'"
              class="pi pi-info-circle text-primary p-1 border-circle hover:text-100 hover:bg-primary"
            ></i
          ></PvButton>
        </div>
        <div class="flex align-items-center gap-2">
          <p class="m-0 mt-1 ml-2">
            <span class="font-bold">Variant name:</span> {{ variant.variant.name }} <br />
            <span class="font-bold">Variant id: </span>{{ variant.id }}
          </p>
        </div>
        <PvOverlayPanel ref="op" append-to="body" style="width: 40vh">
          <div class="flex justify-content-end mt-0 mb-2">
            <PvButton class="p-0 surface-hover border-none border-circle -rotate-45" @click="visible = true"
              ><i
                v-tooltip.top="'Click to expand'"
                class="pi pi-arrows-h border-circle p-2 text-primary hover:text-100 hover:bg-primary"
              ></i
            ></PvButton>
          </div>
          <div class="flex gap-2 flex-column w-full pr-3">
            <PvDataTable
              class="p-datatable-small ml-3 border-1 surface-border text-sm"
              header-style="font-size: 20px;"
              :value="displayParamList(variant.variant.params)"
              scrollable
              scroll-height="300px"
            >
              <PvColumn
                field="key"
                header="Parameter"
                style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
              ></PvColumn>
              <PvColumn
                field="value"
                header="Value"
                style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
              ></PvColumn>
            </PvDataTable>
          </div>
        </PvOverlayPanel>
      </div>
    </div>
  </div>
  <!---------- end card without buttons ----- >-->
  <div v-else :class="isActive()">
    <div class="ml-0 pl-0">
      <PvButton
        class="surface-hover border-y-1 border-200 border-noround m-0 hover:bg-primary p-0"
        @click="handleRemove"
        ><i class="pi pi-times text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
      <PvButton class="surface-hover border-y-1 border-200 border-noround m-0 hover:bg-primary p-0"
        ><i class="pi pi-sort-up text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
      <PvButton class="surface-hover border-y-1 border-200 border-noround m-0 hover:bg-primary p-0"
        ><i class="pi pi-sort-down text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
    </div>
    <div class="w-11 mt-3 flex flex-row p-0">
      <div>
        <img class="w-4rem shadow-2 border-round" :src="variant.task.image || backupImage" :alt="variant.task.name" />
      </div>
      <div>
        <div class="flex flex-row">
          <span class="font-bold" style="margin-left: 0.625rem">{{ variant.task.name }}</span>
          <PvButton class="p-0 surface-hover border-none border-circle" @click="toggle($event)"
            ><i
              v-tooltip.top="'Click to view params'"
              class="pi pi-info-circle text-primary p-1 border-circle hover:text-100 hover:bg-primary"
            ></i
          ></PvButton>
        </div>
        <div class="flex align-items-center gap-2">
          <p class="m-0 mt-1 ml-2">
            <span class="font-bold">Variant name:</span> {{ variant.variant.name }} <br />
            <span class="font-bold">Variant id: </span>{{ variant.id }}
          </p>
        </div>
      </div>
      <PvOverlayPanel ref="op" append-to="body" class="border-1 surface-border" style="width: 40vh">
        <div class="flex justify-content-end mt-0 mb-2">
          <PvButton class="p-0 surface-hover border-none border-circle -rotate-45" @click="visible = true"
            ><i
              v-tooltip.top="'Click to expand'"
              class="pi pi-arrows-h border-circle p-2 text-primary hover:text-100 hover:bg-primary"
            ></i
          ></PvButton>
        </div>
        <div class="flex gap-2 flex-column w-full pr-3">
          <PvDataTable
            class="p-datatable-small ml-3 border-1 surface-border text-sm p-0"
            header-style="font-size: 20px;"
            :value="displayParamList(variant.variant.params)"
            scrollable
            scroll-height="300px"
          >
            <PvColumn
              field="key"
              header="Parameter"
              style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
            ></PvColumn>
            <PvColumn
              field="value"
              header="Value"
              style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
            ></PvColumn>
          </PvDataTable>
        </div>
      </PvOverlayPanel>
    </div>
    <div class="mr-0 pl-0 flex flex-column justify-content-end">
      <PvButton class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
        ><i class="pi pi-pencil text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
      <PvButton
        class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
        @click="toggleShowContent()"
        ><i :class="iconClass()" style="font-size: 1rem"></i
      ></PvButton>
    </div>
  </div>
  <div
    v-if="showContent"
    class="flex-1 flex flex-column border-1 border-round surface-border surface-hover mb-2 hover:surface-ground mr-2 ml-2 pb-2"
    style="margin-top: -5px"
  >
    <div class="flex gap-2 mt-2 flex-column w-full pr-3">
      <p class="font-bold mt-3 mb-1 ml-3">Required Conditions:</p>
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border"
        table-style="min-width:50vh"
        :value="toEntryObjects(variant.variant.params)"
        scrollable
        scroll-height="300px"
      >
        <PvColumn
          field="key"
          header="Parameter"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh; margin: 0.3vh"
        ></PvColumn>
        <PvColumn
          field="operation"
          header="Operation"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh"
        ></PvColumn>
        <PvColumn
          field="value"
          header="Value"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh"
        ></PvColumn>
      </PvDataTable>
    </div>
    <div class="flex mt-2 flex-column w-full pr-3">
      <p class="font-bold mt-3 mb-1 ml-3">Optional Conditions:</p>
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border"
        table-style="min-width:50vh"
        :value="toEntryObjects(variant.variant.params)"
        scrollable
        scroll-height="300px"
      >
        <PvColumn
          field="key"
          header="Parameter"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh"
        ></PvColumn>
        <PvColumn
          field="operation"
          header="Operation"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh"
        ></PvColumn>
        <PvColumn
          field="value"
          header="Value"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh"
        ></PvColumn>
      </PvDataTable>
    </div>
  </div>
  <PvDialog v-model:visible="visible" modal header="Parameters" :style="{ width: '50rem' }">
    <div class="flex gap-2 flex-column w-full pr-3">
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border text-xl"
        header-style="font-size: 20px;"
        :value="displayParamList(variant.variant.params)"
        scrollable
        scroll-height="300px"
      >
        <PvColumn
          field="key"
          header="Parameter"
          style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
        ></PvColumn>
        <PvColumn
          field="value"
          header="Value"
          style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
        ></PvColumn>
      </PvDataTable>
    </div>
  </PvDialog>
</template>

<script setup>
import { ref } from 'vue';
import _toPairs from 'lodash/toPairs';

const props = defineProps({
  variant: {
    required: true,
    type: Object,
  },
  hasControls: {
    required: false,
    type: Boolean,
    default: false,
  },
});

const backupImage = '/src/assets/roar-logo.png';
const showContent = ref(false);
const emit = defineEmits(['remove']);
const op = ref(null);
const visible = ref(false);

const handleRemove = () => {
  emit('remove', props.variant);
};

function toggleShowContent() {
  showContent.value = !showContent.value;
}

function iconClass() {
  return showContent.value
    ? 'pi pi-chevron-up text-primary hover:text-white-alpha-90 p-2'
    : 'pi pi-chevron-down text-primary hover:text-white-alpha-90 p-2';
}

const toEntryObjects = (inputObj) => {
  const operation = 'operation';
  return _toPairs(inputObj).map(([key, value]) => ({ key, operation, value }));
};

const isActive = () => {
  return !showContent.value
    ? 'flex-1 flex flex-row gap-2 border-1 border-round surface-border bg-white-alpha-90 mt-1 hover:surface-hover m-2 mb-0 z-1 relative'
    : 'flex-1 flex flex-row gap-2 border-1 border-round surface-border bg-white-alpha-90 mt-1 hover:surface-hover m-2 mb-0 z-1 relative shadow-2';
};

const displayParamList = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
};

const toggle = (event) => {
  op.value.toggle(event);
};
</script>
