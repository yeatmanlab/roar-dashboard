<template>
  <div class="card" id="rectangle">
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
                  selectionMode="range" :manualInput="false" showButtonBar />
                <label for="dates">Dates</label>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 mt-5">
        <div style="width: fit-content;">
          <p id="section-heading">Assign participants by organization</p>

          <div class="grid mt-5">
            <div class="col-4 mb-5" v-if="districts.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedDistricts" :options="districts" optionLabel="name" class="w-full md:w-14rem"
                  inputId="districts" />
                <label for="districts">Districts</label>
              </span>
            </div>

            <div class="col-4 mb-5" v-if="schools.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedSchools" :options="schools" optionLabel="name" class="w-full md:w-14rem"
                  inputId="schools" />
                <label for="schools">Schools</label>
              </span>
            </div>

            <div class="col-4 mb-5" v-if="classes.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedClasses" :options="classes" optionLabel="name" class="w-full md:w-14rem"
                  inputId="classes" />
                <label for="classes">Classes</label>
              </span>
            </div>

            <div class="col-4 mb-5" v-if="studies.length > 0">
              <span class="p-float-label">
                <MultiSelect v-model="selectedStudies" :options="studies" optionLabel="name" class="w-full md:w-14rem"
                  inputId="studies" />
                <label for="studies">Studies</label>
              </span>
            </div>

            <div class="col-4 mb-5" v-if="families.length > 0">
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
            <img class="w-4rem shadow-2 flex-shrink-0 border-round" :src="slotProps.item.image"
              :alt="slotProps.item.name" />
            <div class="flex-1 flex flex-column gap-2">
              <span class="font-bold" style="margin-left: 0.625rem">{{ slotProps.item.name }}</span>
              <div class="flex align-items-center gap-2">
                <i class="pi pi-tag text-sm" style="margin-left: 0.625rem"></i>
                <span style="margin-left: 0.625rem">{{ slotProps.item.variant }}</span>
              </div>
            </div>
          </div>
        </template>
      </PickList>
    </div>

    <div class="col-12 mb-3">
      <ToggleButton v-model="sequential" />

      <Button label="Create" rounded @click="initFormFields" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import _get from "lodash/get";
import _isEmpty from "lodash/isEmpty";
import _union from "lodash/union";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";

const minStartDate = ref(new Date());

const dates = ref();

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { isFirekitInit, roarfirekit } = storeToRefs(authStore);

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

const superAdmin = ref(roarfirekit.value._superAdmin);
const adminOrgs = ref(roarfirekit.value._adminOrgs);

const { allVariants: assessments } = storeToRefs(queryStore);

const initFormFields = async () => {
  const requireRegisteredTasks = !roarfirekit.value.superAdmin

  queryStore.getVariants(requireRegisteredTasks);
  districts.value = await queryStore.getOrgs("districts");
  schools.value = await queryStore.getOrgs("schools");
  classes.value = await queryStore.getOrgs("classes");
  studies.value = await queryStore.getOrgs("studies");
  families.value = await queryStore.getOrgs("families");
}

onMounted(async () => {
  if (isFirekitInit.value && roarfirekit.value.isAdmin()) {
    initFormFields();
  }
});

watch([isFirekitInit, superAdmin, adminOrgs], ([newFirekitInit, newSuperAdmin, newAdminOrgs]) => {
  console.log(newFirekitInit, newSuperAdmin, newAdminOrgs.value);
  if (newSuperAdmin !== undefined && newAdminOrgs !== undefined) {
    const isAdmin = newSuperAdmin || _isEmpty(_union(...Object.values(newAdminOrgs.value)));
    console.log("isAdmin", isAdmin);
    if (newFirekitInit && isAdmin) {
      initFormFields();
    }
  }
});
</script> 

<style lang="scss">
#rectangle {
  background: #FCFCFC;
  border-radius: 0.3125rem;
  border-style: solid;
  border-width: 0.0625rem;
  border-color: #E5E5E5;
  margin: 4.25rem 1.75rem;
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
