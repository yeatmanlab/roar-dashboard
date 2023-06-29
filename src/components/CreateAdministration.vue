<template>
  <div class="card" id="rectangle">
    <h3 id="heading">Create a new administration</h3>
    <p id="content">Use this form to create a new administration.</p>
    <hr>
    <div class="formgrid grid">
        <div>
            <h4>Details</h4>
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
                <Calendar v-model="startDate" placeholder="Start date" showIcon/>
              </div>
              
              <div class="col-4">
                <Calendar v-model="endDate" placeholder="End date" showIcon />
              </div>
            </div>
            
        </div>
        <div class="field col-12">
            <h4>Participants</h4>
            
            <p>Select participants by varying levels of granularity.</p>
            
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
            
            <p>Or select specific participants by their ROAR ID</p>
            <Dropdown
              v-model="selectedParticipant"
              :options="participants"
              optionLabel="name"
              placeholder="Select participants"
              class="w-full md:w-14rem"
            />
            
        </div>
    </div>

    <h4>Assessments</h4>
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
                      <span class="font-bold">{{ slotProps.item.name }}</span>
                      <div class="flex align-items-center gap-2">
                          <i class="pi pi-tag text-sm"></i>
                          <span>{{ slotProps.item.variant }}</span>
                      </div>
                  </div>
              </div>
          </template>
      </PickList>
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
  width: 100%;
  height: 100%;
  background: #E5E5E5;
  border-radius: 5px;
  border-width: 1px;
}

.card {
  float: left;
  width: 300px;
  border: 3px solid #73AD21;
  padding: 10px;
  text-align: left;
}

#heading {
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 26px;
  line-height: 32.68px;
}

#content {
  font-family: 'Source Sans Pro', sans-serif;
  font-weight: 400;
  font-size: 18px;
  line-height: 25.09px;
  color: #525252;
}

</style>
