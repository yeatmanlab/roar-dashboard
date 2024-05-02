<template>
  <PvPanel class="m-0 p-0 w-full" header="Select a Consent/Assent Form">
    <PvDataView :value="consents" class="w-full ml-3 mr-3 pt-0 pb-0 pr-5">
      <template #list="slotProps">
        <div class="grid">
          <div v-for="(consent, index) in slotProps.items" :key="index" class="w-full">
            <div
              class="flex flex-column sm:flex-row sm:align-items-center p-2 gap-3 hover:surface-200"
              :class="{ 'border-top-1 surface-border': index !== 0 }"
              style="border-radius: 1rem"
            >
              <div
                class="flex flex-column md:flex-row justify-content-between md:align-items-center flex-1 gap-4 boder-round"
              >
                <div class="flex flex-row md:flex-column justify-content-between align-items-start gap-2">
                  <div>
                    <span class="text-lg font-medium text-900 mt-2 text-primary"
                      >{{ consent.type }} : <span class="text-color">{{ consent.fileName.stringValue }}</span></span
                    >
                    <!-- <span class="font-medium text-secondary text-sm">{{ consent.lastUpdated}}</span> -->
                  </div>
                  <div class="flex flex-row gap-3">
                    <div class="surface-100 p-1" style="border-radius: 30px">
                      <div
                        class="surface-0 flex align-items-center gap-2 justify-content-center py-1 px-2"
                        style="
                          border-radius: 30px;
                          box-shadow:
                            0px 1px 2px 0px rgba(0, 0, 0, 0.04),
                            0px 1px 2px 0px rgba(0, 0, 0, 0.06);
                        "
                      >
                        <span class="text-900 font-medium text-sm">{{ consent.lastUpdated }}</span>
                      </div>
                    </div>
                    <div class="mt-1" style="border-radius: 50%">
                      <PvButton
                        class="p-0 surface-hover w-full border-none border-circle hover:text-100 hover:bg-primary"
                        @click="toggle($event)"
                        ><i
                          v-tooltip.top="'View Document'"
                          class="pi pi-info-circle text-primary p-1 border-circle hover:text-100"
                        ></i
                      ></PvButton>
                    </div>
                  </div>
                </div>
                <div class="flex flex-column md:align-items-end gap-5">
                  <div class="flex flex-row-reverse md:flex-row gap-2">
                    <PvRadioButton v-model="isSelected" :input-id="'selectedConsent' + index" :value="index" />
                    <label :for="'selectedConsent' + index">Select</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </PvDataView>
  </PvPanel>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { fetchLegalDocs } from '@/helpers/query/legal';
import { useQuery } from '@tanstack/vue-query';

let isSelected = ref(null);
const initialized = ref(false);

onMounted(() => {
  initialized.value = true;
});

const { data: consents } = useQuery({
  queryKey: ['currentCommit', 'currentCommit', 'gitHubOrg', 'lastUpdated'],
  queryFn: fetchLegalDocs,
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
});

console.log('consents ', consents);
</script>
