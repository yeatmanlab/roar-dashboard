<template>
  <div class="card" id="rectangle">
    <span id="heading">Create a new administration</span>
    <p id="section-heading">Use this form to create a new administration.</p>
    <hr>
    <div class="formgrid grid">
        <div class="col-12">
          <div style="width: fit-content;">
            <p id="section-heading">Details</p>
            <div class="grid">
              <div class="col-4">
                <input
                  id="administration-name"
                  type="text"
                  placeholder="Administration name"
                  class="text-base text-color surface-overlay p-2 border-1 border-solid surface-border border-round appearance-none outline-none focus:border-primary w-full"
                >
              </div>
              
              <div class="col-4">
                <Calendar v-model="startDate" placeholder="Start date"/>
              </div>
              
              <div class="col-4">
                <Calendar v-model="endDate" placeholder="End date" />
              </div>
            </div>
          </div>
        </div>
        <div id="section" class="col-12">
          <div style="width: fit-content;">
            <p id="section-heading">Participants</p>
            
            <p id="section-content" style="margin-bottom: 20px">Select participants by varying levels of granularity.</p>
            
            <div class="grid">
              <div class="col-4">
                <Dropdown
                  v-model="selectedDistrict"
                  :options="districts"
                  optionLabel="name"
                  placeholder="Select district(s)"
                  class="w-full md:w-14rem"
                />
              </div>
              
              <div class="col-4">
                <Dropdown
                  v-model="selectedSchool"
                  :options="schools"
                  optionLabel="name"
                  placeholder="Select school(s)"
                  class="w-full md:w-14rem"
                />
              </div>              
              
              <div class="col-4">
                <Dropdown
                  v-model="selectedClass"
                  :options="classes"
                  optionLabel="name"
                  placeholder="Select class(es)"
                  class="w-full md:w-14rem"
                />
              </div>              
            </div>
            
            <p id="section-content">Or select specific participants by their ROAR ID</p>
            <Dropdown
              v-model="selectedParticipant"
              :options="participants"
              optionLabel="name"
              placeholder="Select participants"
              class="w-full md:w-14rem"
            />
          </div>
        </div>
    </div>

    <div id="section" class="col-12">
      <p id="section-heading">Assessments</p>
      <PickList
        v-model="products"
        :showSourceControls="false"
        :showTargetControls="false"
        listStyle="height:342px"
        dataKey="id"
        :stripedRows="true">
          <template #sourceheader> Available </template>
          <template #targetheader> Selected </template>
          <template #item="slotProps">
              <div class="flex flex-wrap p-2 align-items-center gap-3">
                  <img class="w-4rem shadow-2 flex-shrink-0 border-round" :src="slotProps.item.image" :alt="slotProps.item.name" />
                  <div class="flex-1 flex flex-column gap-2">
                      <span class="font-bold" style="margin-left: 10px">{{ slotProps.item.name }}</span>
                      <div class="flex align-items-center gap-2">
                          <i class="pi pi-tag text-sm" style="margin-left: 10px"></i>
                          <span style="margin-left: 10px">{{ slotProps.item.variant }}</span>
                      </div>
                  </div>
              </div>
          </template>
      </PickList>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted } from "vue";
  
  const startData = ref();
  const endData = ref();
  
  const selectedDistrict = ref();
  const districts = ref([
      { name: 'District 1' },
      { name: 'District 2' },
      { name: 'District 3' }
  ]);
  const selectedSchool = ref();
  const schools = ref([
      { name: 'School 1' },
      { name: 'School 2' },
      { name: 'School 3' }
  ]);
  const selectedClass = ref();
  const classes = ref([
      { name: 'Class 1' },
      { name: 'Class 2' },
      { name: 'Class 3' }
  ]);
  // TODO: check if we should change the text to participant(s) from participants
  const selectedParticipant = ref();
  const participants = ref([
      { name: 'Participant 1' },
      { name: 'Participant 2' },
      { name: 'Participant 3' }
  ]);
  
  const products = ref(null);
  
  onMounted(() => {
    return products.value = [
      [
        {
          name: 'SWR',
          variant: 'default',
          image: '/src/assets/swr-icon.jpeg'
        },
        {
          name: 'SWR',
          variant: 'variant 1',
          image: '/src/assets/swr-icon.jpeg'
        },
        {
          name: 'SWR',
          variant: 'variant 2',
          image: '/src/assets/swr-icon.jpeg'
        },
        {
          name: 'SRE',
          variant: 'default',
          image: '/src/assets/sre-icon.jpeg'
        },
        {
          name: 'SRE',
          variant: 'variant 1',
          image: '/src/assets/sre-icon.jpeg'
        },
        {
          name: 'SRE',
          variant: 'variant 2',
          image: '/src/assets/sre-icon.jpeg'
        },
      ], []
    ];
  });

</script> 

<style scoped>
#rectangle{
  background: #FCFCFC;
  border-radius: 5px;
  border-style: solid;
  border-width: 1px;
  border-color: #E5E5E5;
  margin: 68px 28px;
  padding-top: 28px;
  padding-left: 30px;
  text-align: left;
}

hr {
  margin-top: 32px;
  margin-left: -30px;
}

#heading {
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  color: #000000;
  font-size: 26px;
  line-height: 32.68px;
}

#section-heading {
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 18px;
  line-height: 25.09px;
  color: #525252;
}

#administration-name {
  height: 100%;
  border-radius: 5px;
  border-width: 1px;
  border-color: #E5E5E5;
}

#section {
  margin-top: 22px;
}

#section-content {
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 19.52px;
  color: #525252;
  margin: 10px 0px;
}

.p-dropdown	{
  width: 800px;
  /* background: red;
  border-color: blue;
  border-width: 30px; */
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 50px;
  line-height: 20.11px;
  color: green;
}

.p-dropdown-label > .p-inputtext, .p-dropdown-trigger, .p-dropdown-panel	{
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 20.11px;
  color: green;
}

::placeholder {
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 20.11px;
  color: #C4C4C4;
}

.p-picklist-buttons	 {
  /* display: none; */
  color: green;
  width: 100px;
}

</style>
