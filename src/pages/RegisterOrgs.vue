<template>
    <main class="container main">
      <aside class="main-sidebar">
        <AdministratorSidebar :actions="sidebarActions" />
      </aside>
      <section class="main-body">
        <!--Upload file section-->
        <div v-if="!isFileUploaded">
          <Panel header="Add Organizations">
            To register each organization, please provide the following details:
            <ul>
              <li>organization type (required)</li>
              <li>organization name (required)</li>
              <li>organization abbreviation (required)</li>
            </ul>

            Additional requirements:
            <ul>
              <li>Classes should be linked to a parent school (required)</li>
            </ul>
            Upload or drag-and-drop a student list below to begin!
          </Panel>
          <Divider />
          <FileUpload name="massUploader[]" customUpload @uploader="onFileUpload($event)" accept=".csv" auto
            :showUploadButton="false" :showCancelButton="false">
            <template #empty>
              <div class="extra-height">
                <p>Drag and drop files to here to upload.</p>
              </div>
            </template>
          </FileUpload>
        </div>
        <!--DataTable with raw Student-->
        <div v-if="isFileUploaded">
          <!-- <RoarDataTable :columns="tableColumns" :data="rawOrgFile" :allowExport="false" /> -->
          <Panel header="Assigning participant data" class="mb-4">
            To register each organization, please provide the following details:
            <ul>
              <li>organization type (required)</li>
              <li>organization name (required)</li>
              <li>organization abbreviation (required)</li>
            </ul>

            Additional requirements:
            <ul>
              <li>Classes should be linked to a parent school (required)</li>
            </ul>
  
            <Message severity="info" :closable="false">You can scroll left-to-right to see more columns</Message>
          </Panel>
  
          <div v-if="errorMessage" class="error-box">
            {{ errorMessage }}
          </div>
          <ConfirmPopup></ConfirmPopup>
          <!-- Can't use RoarDataTable to accomodate header dropdowns -->
          <DataTable ref="dataTable" :value="rawOrgFile" showGridlines :rowHover="true" :resizableColumns="true"
            paginator :alwaysShowPaginator="false" :rows="10" class="datatable">
            <Column v-for="col of tableColumns" :key="col.field" :field="col.field">
              <template #header>
                <div class="col-header">
                  <Dropdown v-model="dropdown_model[col.field]" :options="dropdown_options" optionLabel="label"
                    optionValue="value" optionGroupLabel="label" optionGroupChildren="items"
                    placeholder="What does this column describe?" />
                </div>
              </template>
            </Column>
          </DataTable>
          <div class="submit-container">
            <Button @click="preSubmit" label="Start Registration" :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''" :disabled="activeSubmit" />
          </div>
          <!-- Datatable of error students -->
          <div v-if="showErrorTable" class="error-container">
            <div class="error-header">
              <h3>Error Organizations</h3>
              <Button @click="downloadErrorTable($event)">
                Download Table
              </Button>
            </div>
            <!-- Temporary until I move RoarDataTable's data preprocessing to computed hooks -->
            <DataTable ref="errorTable" :value="errorUsers" showGridlines exportFilename="error-datatable-export"
              :rowHover="true" :resizableColumns="true" paginator :alwaysShowPaginator="false" :rows="10" class="datatable">
              <Column v-for="col of errorUserColumns" :key="col.field" :field="col.field">
                <template #header>
                  {{ col.header }}
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
  
      </section>
  
    </main>
  </template>
  <script setup>
  import { ref, toRaw } from 'vue';
  import { csvFileToJson } from '@/helpers';
  import _cloneDeep from 'lodash/cloneDeep';
  import _compact from 'lodash/compact';
  import _find from 'lodash/find';
  import _forEach from 'lodash/forEach'
  import _includes from 'lodash/includes'
  import _isEmpty from 'lodash/isEmpty';
  import _omit from 'lodash/omit';
  import _pick from 'lodash/pick';
  import _set from 'lodash/set';
  import _uniqBy from 'lodash/uniqBy';
  import _startCase from 'lodash/startCase'
  import { useAuthStore } from '@/store/auth';
  import { useQueryStore } from '@/store/query';
  import { useRouter } from 'vue-router';
  // import RoarDataTable from '../components/RoarDataTable.vue';
  import { storeToRefs } from 'pinia';
  import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
  import { getSidebarActions } from "../router/sidebarActions";
  import { useToast } from "primevue/usetoast";
  import { useConfirm } from "primevue/useconfirm";

import { each } from 'lodash';
  
  const authStore = useAuthStore();
  const queryStore = useQueryStore();
  const router = useRouter();
  const confirm = useConfirm();
  const { roarfirekit, isFirekitInit } = storeToRefs(authStore);
  const toast = useToast();
  const isFileUploaded = ref(false);
  const rawOrgFile = ref({});
  
  const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));
  
  // Primary Table & Dropdown refs
  const dataTable = ref();
  const tableColumns = ref([])
  const dropdown_model = ref({})
  const dropdown_options = ref([
  {
      label: 'Required',
      items: [
        { label: 'Org Type', value: 'org_type' },
        { label: 'Name', value: 'name' },
        { label: 'Abbreviation', value: 'abbreviation' }, // 'class' is a javascript keyword.
      ]
  },
    {
      label: 'Optional',
      items: [
        { label: 'Ignore this column', value: 'ignore' },
        { label: 'Parent District', value: 'district' },
        { label: 'Parent School', value: 'school' },
        { label: 'Grade', value: 'grade' },
        { label: 'NCES ID', value: 'nces_id' },
        { label: 'AddressLine1', value: 'addressline1' },
        { label: 'AddressLine2', value: 'addressline2' },
        { label: 'AddressCity', value: 'addresscity' },
        { label: 'AddressState', value: 'addressstate' },
        { label: 'AddressZip', value: 'addresszip' },

        { label: 'Tags', value: 'tags' },
      ]
    },

  ])

  // Constant
  const gradesDict = {
  'Pre-K': 'PK',
  'Transitional Kindergarten': 'TK',
  'Kindergarten': 'K',
  'Grade 1': 1,
  'Grade 2': 2,
  'Grade 3': 3,
  'Grade 4': 4,
  'Grade 5': 5,
  'Grade 6': 6,
  'Grade 7': 7,
  'Grade 8': 8,
  'Grade 9': 9,
  'Grade 10': 10,
  'Grade 11': 11,
  'Grade 12': 12,
};

  
  // Error Users Table refs
  const errorTable = ref();
  const errorUsers = ref([]);
  const errorUserColumns = ref([]);
  const errorMessage = ref("");
  const showErrorTable = ref(false);
  
  const activeSubmit = ref(false);
  let processedUsers = 0;
  
  // Selecting Orgs
  let districts = [];
  let schools = [];
  let classes = [];
  let groups = [];
  
  // Functions supporting Selecting Orgs
  const initFormFields = async () => {
    console.log('inside init form fields')
    unsubscribe();
    // TODO: Optimize this with Promise.all or some such
    districts = await queryStore.getOrgs("districts");
    schools = await queryStore.getOrgs("schools");
    classes = await queryStore.getOrgs("classes");
    groups = await queryStore.getOrgs("groups");
  }
  
  const unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getOrgs && state.roarfirekit.isAdmin()) {
      await initFormFields();
    }
  });
  
  // Functions supporting the uploader
  const onFileUpload = async (event) => {
    rawOrgFile.value = await csvFileToJson(event.files[0])
    tableColumns.value = generateColumns(toRaw(rawOrgFile.value[0]))
    populateDropdown(tableColumns.value)
    isFileUploaded.value = true;
    toast.add({ severity: 'success', summary: 'Success', detail: 'File Successfully Uploaded', life: 3000 });
  }
  
  function populateDropdown(columns) {
    _forEach(columns, col => {
      dropdown_model.value[col.field] = ''
    })
  }
  
  function generateColumns(rawJson) {
    let columns = [];
    const columnValues = Object.keys(rawJson)
    _forEach(columnValues, col => {
      let dataType = (typeof rawJson[col])
      if (dataType === 'object') {
        if (rawJson[col] instanceof Date) {
            dataType = 'date';
        } 
      }

      columns.push({
        field: col,
        header: _startCase(col),
        dataType: dataType
      })
    })
    return columns
  }
  
  function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }
  
  function checkUniqueStudents(students, field) {
    const uniqueStudents = _uniqBy(students, (student) => student[field])
    return (students.length === uniqueStudents.length)
  }

  // This function will group the entries by 'org_type'
  function groupByOrgType(arr) {
    return arr.reduce((acc, curr) => {
      (acc[curr.org_type] = acc[curr.org_type] || []).push(curr);
      return acc;
    }, {});
  }

  // This function will check a grouped list for duplicate names
  function hasDuplicateNames(groupedList) {
    let orgsWithDuplicates = [];
    for (let key in groupedList) {
      let names = groupedList[key].map(item => item.name);
      let uniqueNames = [...new Set(names)];
      if (names.length !== uniqueNames.length) {
        orgsWithDuplicates.push(key);
      }
    }
    return orgsWithDuplicates;  // Return an array of org_types with duplicates
  }

  function pluralizeOrgType(orgType) {
  //for specific org_types that don't follow regular pluralization rules, add them here.
  const specialPlurals = {
    'class': 'classes'
  };

  if (specialPlurals[orgType]) {
    return specialPlurals[orgType];
  }
  
  return orgType + 's';  // For most English nouns, simply adding "s" forms the plural
}

function formatLists2Strings(orgTypes) {
  const pluralizedTypes = orgTypes.map(pluralizeOrgType);

  if (pluralizedTypes.length === 1) {
    return pluralizedTypes[0];
  } else if (pluralizedTypes.length === 2) {
    return pluralizedTypes.join(' and ');
  } else {
    return pluralizedTypes.slice(0, -1).join(', ') + ', and ' + pluralizedTypes.slice(-1);
  }
}

function formatColumn(column) {
    return column.split('_')
                 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                 .join(' ');
}

const preSubmit = (event) => {

    errorMessage.value = "";
    activeSubmit.value = true;
    const modelValues = _compact(Object.values(dropdown_model.value))

    if (!_includes(modelValues, 'org_type')) {
    // Username / email needs to be filled in
    errorMessage.value = "Please select a column to be the organization type."
    activeSubmit.value = false;
    return;
    }

    if (!_includes(modelValues, 'name')){
      errorMessage.value = "Please select a column to be the organization name."
      activeSubmit.value = false;
      return;
    }

    if (!_includes(modelValues, 'abbreviation')){
      errorMessage.value = "Please select a column to be the organization abbreviation."
      activeSubmit.value = false;
      return;
    }

    let columns = ['org_type','name','abbreviation']
    let missingEntries = []
    let flagSchool = false
    let dropdownMap = _cloneDeep(dropdown_model.value)
    _forEach(rawOrgFile.value, org => {
      _forEach(columns, col => {
        const columnMap = getKeyByValue(dropdownMap, col)
        if (_isEmpty(org[columnMap])) {
          missingEntries.push(formatColumn(col))
        }
        if (['org_type'].includes(col)){
          if (org[columnMap] === "school"){
            flagSchool = true
          }
        }
      })
    })

    if (missingEntries.length>0){
      errorMessage.value = `Entries missing for: ${formatLists2Strings(missingEntries)}. Please check the columns.`
      activeSubmit.value = false;
      return;
    }
    
    if (flagSchool) {
      confirm.require({
        target: event.currentTarget,
        message:
          "For any school not assigned to a parent district "
          + "we will create a parent pseudo-district using this "
          + "school's data. Are you sure you want to do that?",
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          submitOrgs();
        },
        reject: () => {
          return;
        }
      });
    } else {
      submitOrgs();
    }
}
  

async function submitOrgs(rawJson) {
    errorMessage.value = "";
    activeSubmit.value = true;
    const modelValues = _compact(Object.values(dropdown_model.value))

    let submitObject = []
    // Construct list of student objects, handle special columns
    _forEach(rawOrgFile.value, student => {
      let studentObj = {}
      let dropdownMap = _cloneDeep(dropdown_model.value)
      _forEach(modelValues, col => {
        const columnMap = getKeyByValue(dropdownMap, col)
        let tagArr = [];

        if (['ignore'].includes(col)) {
          return;
        }

        
        if (['addressline1','addressline2','addresscity','addressstate','addresszip'].includes(col)) {
          studentObj[col] = student[columnMap]
          if (!studentObj['address'] && student[columnMap]) {
            studentObj['address'] = [student[columnMap]]
          } else if (student[columnMap]) {
            studentObj['address'].push(student[columnMap])
          }
        } else if (['tags'].includes(col)){
          let tags = student[columnMap] ? student[columnMap].split(',').map(tag => tag.trim()) : [];
          for (let i = 0; i < tags.length; i++) {
            tagArr.push(tags[i]);
          }
          studentObj[col] = tagArr;
        } else {
          studentObj[col] = student[columnMap]
        }
      })
      submitObject.push(studentObj)
    })

    let groupedSubmitObject = groupByOrgType(submitObject);

    // Check for duplicates by group
    let duplicateOrgTypes = hasDuplicateNames(groupedSubmitObject);
    if (duplicateOrgTypes.length > 0) {
      errorMessage.value = `One or more of the ${formatLists2Strings(duplicateOrgTypes)} in this CSV are not unique.`
      activeSubmit.value = false;
      return;
    }

    // Begin submit process
    const totalUsers = submitObject.length;
    for (let eachorg of submitObject) {
      // Handle Email Registration

      let orgData = {
        name: eachorg.name,
        abbreviation: eachorg.abbreviation,
      };

      const {district,school,grade,nces_id,address,tags,...otherorgData} = eachorg
      if (nces_id) _set(orgData, 'ncesId', String(nces_id))
      if (address) _set(orgData, 'address', address)
      let tag_length = tags ? tags.length: 0
      if (tag_length>0) _set(orgData, 'tags', tags)


      if (eachorg.org_type === "class" && _isEmpty(school)){
        addErrorUser(eachorg, `Error: Class must have an assigned parent school`)
      }
      if (eachorg.org_type === "class" && _isEmpty(grade)){
        addErrorUser(eachorg, `Error: Class must have an assigned grade`)
      }


      // If district is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      if (eachorg.org_type === "school" && district) {
        const id = getDistrictId(district);
        if (!_isEmpty(id)) {
          _set(orgData, 'districtId', id)
        } else {
          addErrorUser(eachorg, `Error: District '${district}' is invalid`)
          continue;
        }
      } else if (eachorg.org_type === "school" && _isEmpty(district)) {
        const districtData = { ...orgData };
        if (nces_id) districtData.ncesId = orgData.ncesId.slice(0, 7);
        
        try {
          const result = await roarfirekit.value.createOrg('districts', districtData);
          orgData.districtId = result;
          toast.add({ severity: 'success', summary: 'District Creation Success', detail: `For ${orgData.name} pseudo-district was sucessfully created.`, life: 9000 });
        } catch (error) {
          toast.add({ severity: 'error', summary: 'District Creation Failed', detail: 'Please see error table below.', life: 3000 });
          console.error("Error creating parent district:", error);
        }
      }
  
      if (eachorg.org_type === "school" && _isEmpty(orgData.districtId)) {
        addErrorUser(eachorg, `Error: For School '${orgData.name}' pseudo-district failed to be created.`)
        continue;
      }


      // If school is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      if (eachorg.org_type === "class" && school) {
        const id = getSchoolId(school);
        if (!_isEmpty(id)) {
          _set(orgData, 'schoolId', id)
        } else {
          addErrorUser(eachorg, `Error: School '${school}' is invalid.`)
          continue;
        }
      }

      // If grade is a given column, check if the name is
      //   associated with a valid value. If so, add the value to
      //   the sendObject. If not, reject user
      if (eachorg.org_type === "class" && grade){
        const value = gradesDict[grade];
        if (!_isEmpty(value)) {
          _set(orgData, 'grade', value)
        } else {
          addErrorUser(eachorg, `Error: Grade '${grade}' is invalid.`)
          continue;
        }
      }

      // console.log(orgData)
      await roarfirekit.value.createOrg(pluralizeOrgType(eachorg.org_type), orgData).then(() => {
        toast.add({ severity: 'success', summary: 'Success', detail:`${orgData.name} was sucessfully created.`, life: 3000 });
        processedUsers = processedUsers + 1;
        if(processedUsers >= totalUsers){
          activeSubmit.value = false;
          if(errorUsers.value.length === 0) {
            // Processing is finished, and there are no error users.
            router.push({ name: "Home" })
          }
        }
      }).catch((e) => {
          toast.add({ severity: 'error', summary: 'Org Creation Failed', detail: 'Please see error table below.', life: 3000 });
          addErrorUser(user, e)
          console.log('checking...', processedUsers, totalUsers)
          if(processedUsers >= totalUsers){
            activeSubmit.value = false;
          }
        })
  
    }
  }
  
  
  // Support functions for submitStudents process
  function addErrorUser(user, error) {
    // If there are no error users yet, generate the
    //  columns before displaying the table.
    delete user.address;

    if (_isEmpty(errorUserColumns.value)) {
      errorUserColumns.value = generateColumns(user)
      errorUserColumns.value.unshift({
        dataType: 'string',
        field: 'error',
        header: 'Cause of Error',
      })
      showErrorTable.value = true
    }
    // Concat the userObject with the error reason.
    let tag_length = user.tags ? Object.keys(user.tags).length : 0;
    if (tag_length>0){
      user.tags = Object.values(user.tags).join(',');
    } else {
    user.tags = '';
    }


    errorUsers.value.push({
      ...user,
      error
    })
    processedUsers = processedUsers + 1;
  }
  
  // Find the district id given the name. undefined if missing.
  // function getDistrictId(districtName) {
  //   return _pick(_find(districts, (district) => {
  //     return district.name === districtName;
  //   }), 'id')
  // }
  
  // Find the school id given the name. undefined if missing.
  // function getSchoolId(schoolName) {
  //   return _pick(_find(schools, (school) => {
  //     return school.name === schoolName;
  //   }), 'id')
  // }

  function getDistrictId(districtName) {
    const foundDistrict = _find(districts, (district) => {
        return district.name === districtName;
    });
    
    return foundDistrict ? foundDistrict.id : undefined;
}

  function getSchoolId(schoolName) {
    const foundSchool = _find(schools, (school) => {
        return school.name === schoolName;
    });
    
    return foundSchool ? foundSchool.id : undefined;
}






  
  // Find the class id given the name. undefined if missing.
  function getClassId(className) {
    return _pick(_find(classes, (c) => {
      return c.name === className;
    }), ['id', 'abbreviation'])
  }
  
  // Find the group id given the name. undefined if missing.
  function getGroupId(groupName) {
    return _pick(_find(groups, (group) => {
      return group.name === groupName;
    }), ['id', 'abbreviation'])
  }
  
  // Functions supporting error table
  function downloadErrorTable() {
    errorTable.value.exportCSV()
  }
  
  // Event listener for the 'beforeunload' event
  // window.addEventListener('beforeunload', (e) => {
  //   console.log('handler for beforeunload')
  //   e.preventDefault();
  // });
  </script>
  <style scoped>
  .extra-height {
    min-height: 33vh;
  }
  
  .info-box {
    padding: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    background-color: var(--surface-b);
    border-radius: 5px;
    border: 1px solid var(--surface-d);
  }
  
  .error-box {
    padding: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    background-color: var(--red-300);
    border-radius: 5px;
    border: 1px solid var(--red-600);
    color: var(--red-600);
    font-weight: bold;
  }
  
  .col-header {
    display: flex;
    flex-direction: column;
  }
  
  .submit-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 1rem;
  }
  
  .error {
    color: red;
  }
  
  .datatable {
    border: 1px solid var(--surface-d);
    border-radius: 5px;
  }
  
  .error-container {
    margin-top: 1rem;
  }
  
  .error-header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding-bottom: 0.5rem;
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
  </style>