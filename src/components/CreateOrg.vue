<template>
  <router-link :to="{ name: 'Home' }">
    <Button class="return-button" icon="pi pi-angle-left" label="Return to Dashboard" />
  </router-link>
  <div class="card" id="rectangle">
    <span id="heading">Create a new organization</span>
    <p id="section-heading">Use this form to create a new organization.</p>
    <hr>
    <div class="formgrid grid mb-3">
      <div class="col-12">
        <div style="width: fit-content;">
          <div class="grid mt-5">
            <div class="col-6">
              <span class="p-float-label">
                <Dropdown v-model="orgType" inputId="org-type" :options="orgTypes" showClear optionLabel="singular"
                  placeholder="Select an org type" class="w-full md:w-14rem" />
                <label for="org-type">Org Type</label>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12">
        <div style="width: fit-content;">
          <div class="grid mt-5">
            <div class="col-6">
              <span class="p-float-label">
                <InputText id="org-name" v-model="orgName" />
                <label for="org-name">{{ orgTypeLabel }} Name</label>
              </span>
            </div>

            <div class="col-6">
              <span class="p-float-label">
                <InputText id="org-initial" v-model="orgInitials" />
                <label for="org-initial">{{ orgTypeLabel }} Abbreviation</label>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 mt-5" v-if="parentOrgType === 'school'">
        <div style="width: fit-content;">
          <p id="section-heading">Select the grade level for this class</p>

          <div class="grid mt-5">
            <div class="col-4 mb-5">
              <span class="p-float-label">
                <Dropdown v-model="grade" inputId="grade" :options="grades" showClear optionLabel="name"
                  placeholder="Select a grade" class="w-full md:w-14rem" />
                <label for="grade">Grade</label>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 mt-2" v-if="parentOrgType">
        <div style="width: fit-content;">
          <p id="section-heading">Assign this {{ orgTypeLabel.toLowerCase() }} to a {{ parentOrgType }}.</p>

          <div class="grid mt-5">
            <div class="col-4 mb-5" v-if="parentOrgType === 'district'">
              <span class="p-float-label">
                <Dropdown v-model="district" inputId="district" :options="districts" showClear optionLabel="name"
                  placeholder="Select a district" class="w-full md:w-14rem" />
                <label for="district">District</label>
              </span>
            </div>

            <div class="col-4 mb-5" v-if="parentOrgType === 'school'">
              <span class="p-float-label">
                <Dropdown v-model="school" inputId="school" :options="schools" showClear optionLabel="name"
                  placeholder="Select a school" class="w-full md:w-14rem" />
                <label for="school">School</label>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-12 mb-3">
      <Button :label="`Create ${orgTypeLabel}`" @click="submit" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import _capitalize from "lodash/capitalize";
import _get from "lodash/get";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";

const orgTypes = [
  { firestoreCollection: 'districts', singular: 'district' },
  { firestoreCollection: 'schools', singular: 'school' },
  { firestoreCollection: 'classes', singular: 'class' },
  { firestoreCollection: 'studies', singular: 'study' },
  { firestoreCollection: 'families', singular: 'family' },
];
const orgType = ref();
const orgTypeLabel = computed(() => {
  if (orgType.value) {
    return _capitalize(orgType.value.singular);
  }
  return "Org";
})

const parentOrgType = computed(() => {
  if (orgType.value?.singular === "school") {
    return "district";
  } else if (orgType.value?.singular === "class") {
    return "school";
  }
})

const orgName = ref();
const orgInitials = ref();
const grade = ref();
const grades = [
  { name: 'Pre-K', value: 'PK' },
  { name: 'Transitional Kindergarten', value: 'TK' },
  { name: 'Kindergarten', value: 'K' },
  { name: 'Grade 1', value: 1 },
  { name: 'Grade 2', value: 2 },
  { name: 'Grade 3', value: 3 },
  { name: 'Grade 4', value: 4 },
  { name: 'Grade 5', value: 5 },
  { name: 'Grade 6', value: 6 },
  { name: 'Grade 7', value: 7 },
  { name: 'Grade 8', value: 8 },
  { name: 'Grade 9', value: 9 },
  { name: 'Grade 10', value: 10 },
  { name: 'Grade 11', value: 11 },
  { name: 'Grade 12', value: 12 },
];

const queryStore = useQueryStore();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const districts = ref([]);
const schools = ref([]);

const district = ref();
const school = ref();

const submit = () => {
  let orgData = {
    name: orgName.value,
    abbreviation: orgInitials.value,
  };

  if (school.value) {
    orgData.schoolId = school.value.id;
  } else if (district.value) {
    orgData.districtId = district.value.id;
  }

  if (grade.value) orgData.grade = grade.value.value;

  roarfirekit.value.createOrg(orgType.value.firestoreCollection, orgData)
};

const getOrgs = async () => {
  unsubscribe();
  districts.value = await queryStore.getOrgs("districts");
  schools.value = await queryStore.getOrgs("schools");
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
    await getOrgs();
  }
});

</script> 

<style lang="scss">
.return-button {
  margin: 1rem 1.75rem;
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

  // .p-dropdown-label {
  //   font-family: 'Source Sans Pro', sans-serif;
  //   color: #C4C4C4;
  // }

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
