<template>
  <div
    v-if="!hasControls"
    class="flex-1 flex flex-row gap-2 border-1 border-round surface-border bg-white-alpha-90 mt-1 hover:surface-hover m-2 mb-2"
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
          <PvButton class="p-0 surface-hover border-none border-circle" @click="toggle($event)"
            ><i class="pi pi-info-circle text-primary"></i
          ></PvButton>
        </div>
        <div class="flex align-items-center gap-2">
          <p class="m-0 mt-1 ml-2">
            <span class="font-bold">Variant name:</span> {{ variant.variant.name }} <br />
            <span class="font-bold">Variant id: </span>{{ variant.id }}
          </p>
        </div>
        <PvOverlayPanel ref="op" append-to="body" style="width: 450px">
          <div class="flex gap-2 flex-column w-full pr-3">
            <PvDataTable
              class="p-datatable-small ml-3 border-1 surface-border text-xs"
              header-style="font-size: small;"
              table-style="min-width:40vh"
              :value="displayParamList(variant.variant.params)"
              scrollable
              scroll-height="300px"
            >
              <PvColumn
                field="key"
                header="Parameter"
                style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
              >
              </PvColumn>
              <PvColumn
                field="value"
                header="Value"
                style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
              >
              </PvColumn>
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
        <span class="font-bold" style="margin-left: 0.625rem">{{ variant.task.name }}</span>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-info-circle" style="margin-left: 0.625rem"></i>

          <p class="m-0 mt-1">
            <span class="font-bold">Variant name:</span> {{ variant.variant.name }} <br />
            <span class="font-bold">Variant id: </span>{{ variant.id }}
          </p>
        </div>
      </div>
    </div>
    <div class="mr-0 pl-0 flex flex-column justify-content-end">
      <EditVariantDialog :visible="visible" :assessment="variant" :updateVariant="callUpdateVariant" />
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
      <p class="font-bold mt-3 mb-1 ml-3">Required Parameters:</p>
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
        <PvColumn field="value" header="Value" style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh">
        </PvColumn>
      </PvDataTable>
    </div>
    <div class="flex mt-2 flex-column w-full pr-3">
      <p class="font-bold mt-3 mb-1 ml-3">Optional Parameters:</p>
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
        <PvColumn field="value" header="Value" style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh">
        </PvColumn>
      </PvDataTable>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import _toPairs from 'lodash/toPairs';
import EditVariantDialog from '@/components/EditVariantDialog.vue';

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
  updateVariant: {
    required: true,
    type: Function,
  },
});

const callUpdateVariant = (id, assessment) => {
  return props.updateVariant(id, assessment);
};

const backupImage = '/src/assets/roar-logo.png';
const showContent = ref(false);
const emit = defineEmits(['remove']);
const op = ref(null);

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
