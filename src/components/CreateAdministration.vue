<template>
  <router-link :to="{ name: 'Home' }" class="return-button">
    <Button icon="pi pi-angle-left" label="Return to Dashboard" />
  </router-link>
  <div class="card" id="rectangle" v-if="formReady">
    <span id="heading">Create a new administration</span>
    <p id="section-heading">Use this form to create a new administration.</p>
    <hr>
    <div class="formgrid grid">
      <div class="col-12">
        <div style="width: fit-content;">
          <div class="grid mt-5">
            <div class="col-6">
              <span class="p-float-label">
                <InputText id="administration-name" v-model="administrationName" />
                <label for="administration-name">Administration Name</label>
              </span>
            </div>

            <div class="col-6">
              <span class="p-float-label">
                <Calendar v-model="dates" :minDate="minStartDate" inputId="dates" :numberOfMonths="2"
                  selectionMode="range" :manualInput="false" showIcon showButtonBar />
                <label for="dates">Dates</label>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 mt-5">
        <div style="width: fit-content;">
          <p id="section-heading">Assign this administration to organizations</p>

          <div class="orgs-container">
            <div class="org-dropdown" v-if="districts.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedDistricts" :options="districts" optionLabel="name" class="w-full md:w-14rem"
                  inputId="districts" />
                <label for="districts">Districts</label>
              </span>
            </div>

            <div class="org-dropdown" v-if="schools.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedSchools" :options="schools" optionLabel="name" class="w-full md:w-14rem"
                  inputId="schools" />
                <label for="schools">Schools</label>
              </span>
            </div>

            <div class="org-dropdown" v-if="classes.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedClasses" :options="classes" optionLabel="name" class="w-full md:w-14rem"
                  inputId="classes" />
                <label for="classes">Classes</label>
              </span>
            </div>

            <div class="org-dropdown" v-if="studies.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedStudies" :options="studies" optionLabel="name" class="w-full md:w-14rem"
                  inputId="studies" />
                <label for="studies">Studies</label>
              </span>
            </div>

            <div class="org-dropdown" v-if="families.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedFamilies" :options="families" optionLabel="name" class="w-full md:w-14rem"
                  inputId="families" />
                <label for="families">Families</label>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-12 mb-3">
      <p id="section-heading">Select Assessments</p>
      <PickList v-model="assessments" :showSourceControls="false" listStyle="height: 21.375rem" dataKey="id"
        :stripedRows="true" :pt="{
          moveAllToTargetButton: { root: { class: 'hide' } },
          moveAllToSourceButton: { root: { class: 'hide' } },
          targetMoveTopButton: { root: { class: 'hide' } },
          targetMoveBottomButton: { root: { class: 'hide' } },
        }">
        <template #sourceheader>Available</template>
        <template #targetheader>Selected</template>
        <template #item="slotProps">
          <div class="flex flex-wrap p-2 align-items-center gap-3">
            <img class="w-4rem shadow-2 flex-shrink-0 border-round" :src="slotProps.item.task.image || backupImage"
              :alt="slotProps.item.task.name" />
            <div class="flex-1 flex flex-column gap-2">
              <span class="font-bold" style="margin-left: 0.625rem">{{ slotProps.item.task.name }}</span>
              <div class="flex align-items-center gap-2">
                <i class="pi pi-tag text-sm" style="margin-left: 0.625rem"></i>
                <span>Variant: {{ slotProps.item.variant.name || slotProps.item.variant.id }}</span>
              </div>
            </div>
            <Button type="button" rounded size="small" icon="pi pi-info" @click="toggle($event, slotProps.item.id)" />
            <OverlayPanel :ref="paramPanelRefs[slotProps.item.id]">
              <DataTable stripedRows class="p-datatable-small" tableStyle="min-width: 30rem"
                :value="toEntryObjects(slotProps.item.variant.params)">
                <Column field="key" header="Parameter" style="width: 50%"></Column>
                <Column field="value" header="Value" style="width: 50%"></Column>
              </DataTable>
            </OverlayPanel>
          </div>
        </template>
      </PickList>
    </div>

    <div class="col-12 mb-3">
      <ToggleButton v-model="sequential" />

      <Button label="Create" @click="initFormFields" />
    </div>
  </div>
  <div v-else class="loading-container">
    <AppSpinner style="margin-bottom: 1rem;" />
    <span>Loading Administration Data</span>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { storeToRefs } from "pinia";
import _fromPairs from "lodash/fromPairs";
import _get from "lodash/get";
import _isEmpty from "lodash/isEmpty";
import _toPairs from "lodash/toPairs";
import _union from "lodash/union";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import AppSpinner from "./AppSpinner.vue";

let paramPanelRefs = {};

const toEntryObjects = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
}

const toggle = (event, id) => {
  console.log("Toggling " + id)
  paramPanelRefs[id].value.toggle(event)
}

const formReady = ref(false);

const administrationName = ref("");
const minStartDate = ref(new Date());

const dates = ref();

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { roarfirekit } = storeToRefs(authStore);

const districts = ref([]);
const schools = ref([]);
const classes = ref([]);
const studies = ref([]);
const families = ref([]);

const selectedDistricts = ref();
const selectedSchools = ref();
const selectedClasses = ref();
const selectedStudies = ref();
const selectedFamilies = ref();

const sequential = ref(true);

const { allVariants } = storeToRefs(queryStore);
const assessments = ref([[], []])

const backupImage = "/src/assets/swr-icon.jpeg";

const initFormFields = async () => {
  unsubscribe();
  const requireRegisteredTasks = !roarfirekit.value.superAdmin

  const variantsPromise = queryStore.getVariants(requireRegisteredTasks);
  const districtsPromise = queryStore.getOrgs("districts");
  const schoolsPromise = queryStore.getOrgs("schools");
  const classesPromise = queryStore.getOrgs("classes");
  const studiesPromise = queryStore.getOrgs("students");
  const familiesPromise = queryStore.getOrgs("families");
  let otherPromises = [];

  [districts.value, schools.value, classes.value, studies.value, families.value, ...otherPromises] = await Promise.all([districtsPromise, schoolsPromise, classesPromise, studiesPromise, familiesPromise, variantsPromise]);
  assessments.value = [allVariants.value, []];
  paramPanelRefs = _fromPairs(allVariants.value.map((variant) => [variant.id, ref()]));
  formReady.value = true;
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
    await initFormFields();
  }
});
</script> 

<style lang="scss">
.return-button {
  display: block;
  margin: 1rem 1.75rem;
}
.loading-container {
  width: 100%;
  text-align: center;
}

.orgs-container { 
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: -1rem;
  margin-bottom: 1rem;
}

.org-dropdown {
  margin-right: 3rem;
  margin-top: 2rem;
}

#rectangle {
  background: #FCFCFC;
  border-radius: 0.3125rem;
  border-style: solid;
  border-width: 0.0625rem;
  border-color: #E5E5E5;
  margin: 0 1.75rem;
  padding-top: 1.75rem;
  padding-left: 1.875rem;
  text-align: left;
  overflow: hidden;

  hr {
    margin-top: 2rem;
    margin-left: -1.875rem;
  }

  #heading {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    color: #000000;
    font-size: 1.625rem;
    line-height: 2.0425rem;
  }

  #section-heading {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    font-size: 1.125rem;
    line-height: 1.5681rem;
    color: #525252;
  }

  #administration-name {
    height: 100%;
    border-radius: 0.3125rem;
    border-width: 0.0625rem;
    border-color: #E5E5E5;
  }

  #section {
    margin-top: 1.375rem;
  }

  #section-content {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    font-size: 0.875rem;
    line-height: 1.22rem;
    color: #525252;
    margin: 0.625rem 0rem;
  }

  .p-dropdown-label {
    font-family: 'Source Sans Pro', sans-serif;
    color: #C4C4C4;
  }

  ::placeholder {
    font-family: 'Source Sans Pro', sans-serif;
    color: #C4C4C4;
  }

  // .p-button {
  //   width: 11.5625rem;
  //   height: 2.25rem;
  //   border-radius: 3.9375rem;
  //   margin: 1.5rem 0rem;
  //   margin-right: 1.375rem;
  //   float: right;
  // }

  .hide {
    display: none;
  }

}
</style>
