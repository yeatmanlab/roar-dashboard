<template>
  <PvPanel class="m-0 p-0 w-full" header="Select a Consent/Assent Form">
    <PvDataView :value="consents" class="w-full ml-3 mr-3 pt-0 pb-0 pr-5">
      <template #list="slotProps">
        <div class="grid">
          <div v-for="(consent, index) in slotProps.items" :key="index" class="col-12">
            <div
              class="flex flex-column sm:flex-row sm:align-items-center p-2 gap-3"
              :class="{ 'border-top-1 surface-border': index !== 0 }"
            >
              <div class="flex flex-column md:flex-row justify-content-between md:align-items-center flex-1 gap-4">
                <div class="flex flex-row md:flex-column justify-content-between align-items-start gap-2">
                  <div>
                    <span class="font-medium text-secondary text-sm">{{ consent.type }}</span>
                    <div class="text-lg font-medium text-900 mt-2">{{ consent.name }}</div>
                    <span class="font-medium text-secondary text-sm">{{ consent.lastUpdated }}</span>
                  </div>
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
                      <span class="text-900 font-medium text-sm">{{ consent.currentCommit }}</span>
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
import { ref } from 'vue';

let isSelected = ref(null);

const consents = [
  {
    image: 'src/assets/roar-icon.png',
    name: 'district2Consent',
    lastUpdated: 'last updated 1',
    currentCommit: 435345243,
    type: 'Consent',
  },
  {
    image: 'src/assets/roar-icon.png',
    name: 'consolidatedAssent',
    lastUpdated: 'last updated 2',
    currentCommit: 909709792,
    type: 'Assent',
  },
];
</script>
