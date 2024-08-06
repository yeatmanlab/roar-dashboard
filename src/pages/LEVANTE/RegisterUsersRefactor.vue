<template>
    <main class="container main">
      <section class="main-body">
        <!--Upload file section-->
        <RegisterUsersInfo />
  
        <PvDivider />
  
        <div v-if="!isFileUploaded">
          <PvFileUpload
            v-if="!isFileUploaded"
            name="massUploader[]"
            custom-upload
            accept=".csv"
            class="bg-primary text-white border-none border-round w-1 h-2rem m-0 pl-2 hover:bg-red-900"
            auto
            :show-upload-button="false"
            :show-cancel-button="false"
            @uploader="onFileUpload($event)"
          >
            <template #empty>
              <div class="extra-height">
                <p>Drag and drop files here <b>or</b> click choose to upload.</p>
              </div>
            </template>
          </PvFileUpload>
        </div>
  
        <div v-if="isFileUploaded && !errorMissingColumns && !errorUsers.length">
          <PvDataTable
            ref="dataTable"
            :value="rawUserFile"
            show-gridlines
            :row-hover="true"
            :resizable-columns="true"
            paginator
            :always-show-paginator="false"
            :rows="10"
            class="datatable"
          >
            <PvColumn v-for="col of allFields" :key="col.field" :field="col.field">
              <template #header>
                <div class="col-header">
                  <b>{{ col.header }}</b>
                </div>
              </template>
            </PvColumn>
          </PvDataTable>
  
          <div class="submit-container">
            <PvButton v-if="registeredUsers.length" label="Download Registered Users" @click="downloadCSV" />
            <PvButton
              v-else
              :label="activeSubmit ? 'Registering Users' : 'Start Registration'"
              :icon="activeSubmit ? 'pi pi-spin pi-spinner' : ''"
              :disabled="activeSubmit"
              @click="submitUsers"
            />
          </div>
        </div>
  
        <!-- Datatable of error students -->
        <div v-if="showErrorTable" class="error-container">
          <div class="error-header">
            <h3>Rows with Errors</h3>
          </div>
          <PvDataTable
            ref="errorTable"
            :value="errorUsers"
            show-gridlines
            export-filename="error-datatable-export"
            :row-hover="true"
            :resizable-columns="true"
            paginator
            :always-show-paginator="false"
            :rows="10"
            class="datatable"
          >
            <PvColumn v-for="col of errorUserColumns" :key="col.field" :field="col.field">
              <template #header>
                {{ col.header }}
              </template>
            </PvColumn>
          </PvDataTable>
        </div>
      </section>
    </main>
  </template>
  
  <script setup>
  import { ref, toRaw, watch, nextTick } from 'vue';
  import { csvFileToJson } from '@/helpers';
  import _cloneDeep from 'lodash/cloneDeep';
  import _forEach from 'lodash/forEach';
  import _isEmpty from 'lodash/isEmpty';
  import _startCase from 'lodash/startCase';
  import _chunk from 'lodash/chunk';
  import { useToast } from 'primevue/usetoast';
  import RegisterUsersInfo from '@/components/LEVANTE/RegisterUsersInfo.vue';
  import { useAuthStore } from '@/store/auth';
  import { pluralizeFirestoreCollection } from '@/helpers';
  import { fetchOrgByName } from '@/helpers/query/orgs';
  
  const authStore = useAuthStore();
  const toast = useToast();
  const isFileUploaded = ref(false);
  const rawUserFile = ref({});
  const registeredUsers = ref([]);
  
  // Primary Table & Dropdown refs
  const dataTable = ref();
  
  const requiredColumns = ['userType', 'month', 'year', 'group', 'district', 'school', 'class'];
  const allFields = [
    {
      field: 'userType',
      header: 'User Type',
      dataType: 'string',
    },
    {
      field: 'month',
      header: 'Month',
      dataType: 'number',
    },
    {
      field: 'year',
      header: 'Year',
      dataType: 'number',
    },
    {
      field: 'group',
      header: 'Group',
      dataType: 'string',
    },
    {
      field: 'district',
      header: 'District',
      dataType: 'string',
    },
    {
      field: 'school',
      header: 'School',
      dataType: 'string',
    },
    {
      field: 'class',
      header: 'Class',
      dataType: 'string',
    },
  ];
  
  // Error Users Table refs
  const errorTable = ref();
  const errorUsers = ref([]);
  const errorUserColumns = ref([]);
  const errorMessage = ref('');
  const showErrorTable = ref(false);
  const errorMissingColumns = ref(false);
  
  const activeSubmit = ref(false);
  
  watch(
    errorUsers,
    () => {
      // Scroll to bottom of page after error table is displayed
      // Using nextTick to ensure the error table is rendered otherwise the scroll
      // happens before the table is rendered
      nextTick(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    },
    { deep: true },
  );
  
  // Functions supporting the uploader
  const onFileUpload = async (event) => {
    // Reset in case of previous error
    rawUserFile.value = {};
    errorUsers.value = [];
    errorUserColumns.value = [];
    showErrorTable.value = false;
    errorMessage.value = '';
    errorTable.value = null;
    errorMissingColumns.value = false;
  
    rawUserFile.value = await csvFileToJson(event.files[0]);
  
    // Check uploaded CSV has required columns
    const missingColumns = requiredColumns.filter((col) => !(col in toRaw(rawUserFile.value[0])));
    if (missingColumns.length > 0) {
      toast.add({
        severity: 'error',
        summary: 'ERROR: Missing Columns: ' + missingColumns.join(', '),
        life: 5000,
      });
      errorMissingColumns.value = true;
      return;
    }

    const requiredFields = ['userType'];

    rawUserFile.value.forEach((user) => {
      const missingFields = [];

      // Check for required fields
      requiredFields.forEach((field) => {
        if (!user[field]) {
          missingFields.push(field);
        }
      });

      // Check for group or district and school
      if (!user.group) {
        if (!user.district || !user.school) {
          missingFields.push('group or district and school');
        }
      }

      // Add error if any required fields are missing
      if (missingFields.length > 0) {
        addErrorUser(user, `Missing Field(s): ${missingFields.join(', ')}`);
      }
    });
  
    if (errorUsers.value.length) {
      toast.add({
        severity: 'error',
        summary: 'ERROR: Missing Fields. See below for details.',
        life: 5000,
      });
    }

  
    if (!missingColumns.length && !errorUsers.value.length) {
      isFileUploaded.value = true;
      errorMissingColumns.value = false;
      showErrorTable.value = false;
      toast.add({ severity: 'success', summary: 'Success', detail: 'File Successfully Uploaded', life: 3000 });
    }
  };
  
  function generateColumns(rawJson) {
    let columns = [];
    const columnValues = Object.keys(rawJson);
    _forEach(columnValues, (col) => {
      let dataType = typeof rawJson[col];
      if (dataType === 'object') {
        if (rawJson[col] instanceof Date) dataType = 'date';
      }
      columns.push({
        field: col,
        header: _startCase(col),
        dataType: dataType,
      });
    });
    return columns;
  }
  
  async function submitUsers() {
    // Reset error users
    activeSubmit.value = true;
    errorUsers.value = [];
    errorUserColumns.value = [];
    showErrorTable.value = false;
    errorMessage.value = '';
  
    // Group needs to be an array of strings
  
    const usersToBeRegistered = _cloneDeep(toRaw(rawUserFile.value));
  

    // Check orgs exist
    for (const user of usersToBeRegistered) {
      const { district, school, _class, group: groups, } = user;

      const orgNameMap = {
        district: district,
        school: school,
        class: _class?.split(','),
        group: groups?.split(','),
      };

      // console.log('orgNameMap', orgNameMap);

      // If orgType is a given column, check if the name is
      //   associated with a valid id. If so, add the id to
      //   the sendObject. If not, reject user
      for (const [orgType, orgName] of Object.entries(orgNameMap)) {
        if (orgName) {
          let orgInfo = {
            district: [],
            school: [],
            class: [],
            group: [],
          };

          if (orgType === 'school') {
            const { id: districtId } = await getOrgId('districts', district);
            const orgIds = await getOrgId(pluralizeFirestoreCollection(orgType), orgName, ref(districtId), ref(undefined))
            // Need to Raw it because a large amount of users causes this to become a proxy object
            orgInfo['school'] = orgIds.map(orgData => toRaw(orgData).id);
          } else if (orgType === 'class') {
            for (const aClass of orgNameMap.class) {
              const { id: districtId } = await getOrgId('districts', district);
              const { id: schoolId } = await getOrgId('schools', school);
              const orgIds = await getOrgId(pluralizeFirestoreCollection(orgType), aClass, ref(districtId), ref(schoolId));
              orgInfo.class.push(...orgIds.map(orgData => toRaw(orgData).id));
            }
          } else if (orgType === 'group') {
            for (const group of orgNameMap.group) {
              const orgId = await getOrgId(pluralizeFirestoreCollection(orgType), group, ref(undefined), ref(undefined));
              orgInfo.group.push(...orgId.map(orgData => toRaw(orgData).id));
            }
          } else {
            const orgIds = await getOrgId(pluralizeFirestoreCollection(orgType), orgName, ref(undefined), ref(undefined));
            orgInfo['district'] = orgIds.map(orgData => toRaw(orgData).id);
          }

          if (!_isEmpty(orgInfo)) {
            user.orgIds = orgInfo;
          } else {
            addErrorUser(user, `Error: ${orgType} '${orgName}' is invalid`);
            if (processedUsers >= totalUsers) {
              activeSubmit.value = false;
            }
            return;
          }
        }
      }

      console.log('org ids:', user.orgIds)
    }


    // TODO: Figure out deadline-exceeded error with 700+ users. (Registration works fine, creates all documents but the client recieves the error)
    // Spit users into chunks of 1000
    const chunkedUsersToBeRegistered = _chunk(usersToBeRegistered, 700);

    console.log('chunkedUsersToBeRegistered', chunkedUsersToBeRegistered);
  
    // Begin submit process
    // Org must be created before users can be created
    let processedUserCount = 0;
    for (const users of chunkedUsersToBeRegistered) {
      try {
        const res = await authStore.createUsers(users);
        const currentRegisteredUsers = res.data.data;
        
        // Update only the newly registered users
        currentRegisteredUsers.forEach((registeredUser, index) => {
          const rawUserIndex = processedUserCount + index;
          if (rawUserIndex < rawUserFile.value.length) {
            rawUserFile.value[rawUserIndex].email = registeredUser.email;
            rawUserFile.value[rawUserIndex].password = registeredUser.password;
            rawUserFile.value[rawUserIndex].uid = registeredUser.uid;
          }
        });

        registeredUsers.value.push(...currentRegisteredUsers);
        
        // Update the count of processed users
        processedUserCount += currentRegisteredUsers.length;

      } catch (error) {
        // TODO: Show users that failed to register
        console.error(error);
    
        toast.add({
          severity: 'error',
          summary: 'Error registering users: ' + error.message,
          life: 9000,
        });
      }
    }

    activeSubmit.value = false;
    toast.add({
      severity: 'success',
      summary: 'User Creation Success',
      life: 9000,
    });
    
    convertUsersToCSV();
  }


  const csvBlob = ref(null);
  const csvURL = ref(null);
  
  function convertUsersToCSV() {
    const headerObj = toRaw(rawUserFile.value[0]);
  
    // Convert Objects to CSV String
    const csvHeader = Object.keys(headerObj).join(',') + '\n';
    const csvRows = rawUserFile.value
      .map((obj) =>
        Object.values(obj)
          .map((value) => {
            if (value === null || value === undefined) return '';
            return `"${value.toString().replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\n');
  
    const csvString = csvHeader + csvRows;
  
    // Create Blob from CSV String
    csvBlob.value = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
    // Create URL from Blob
    csvURL.value = URL.createObjectURL(csvBlob.value);
  
    // Initiate download
    downloadCSV();
  }
  
  function downloadCSV() {
    const filename = 'registered-users.csv';
  
    if (csvURL.value) {
      // Create Download Link
      const link = document.createElement('a');
      link.setAttribute('href', csvURL.value);
      link.setAttribute('download', filename);
      document.body.appendChild(link); // Required for Firefox
  
      // Trigger the Download
      link.click();
  
      // Cleanup
      document.body.removeChild(link);
    }
  }
  
  function addErrorUser(user, error) {
    // If there are no error users yet, generate the
    //  columns before displaying the table.
    if (_isEmpty(errorUserColumns.value)) {
      errorUserColumns.value = generateColumns(user);
      errorUserColumns.value.unshift({
        dataType: 'string',
        field: 'error',
        header: 'Cause of Error',
      });
      showErrorTable.value = true;
    }
    // Concat the userObject with the error reason.
    errorUsers.value.push({
      ...user,
      error,
    });
  }
  
  // TODO: Refactor this to be a single call
  const orgIds = ref({
    districts: {},
    schools: {},
    classes: {},
    groups: {},
  });

    /**
   * Retrieves the ID of an organization based on its type and name.
   * If the ID is not already cached, it fetches it from the server.
   *
   * @async
   * @function getOrgId
   * @param {string} orgType - The type of organization (e.g., 'districts', 'schools', 'classes', 'groups').
   * @param {string} orgName - The name of the organization.
   * @param {Object|undefined} parentDistrict - The parent district reference, if applicable.
   * @param {Object|undefined} parentSchool - The parent school reference, if applicable.
   * @returns {Promise<Object>} A promise that resolves to an object containing organization details, including its ID.
   * @throws {Error} Throws an error if no organizations are found for the given type and name.
   *
   * @example
   * // Get the ID for a school
   * const schoolInfo = await getOrgId('schools', 'High School A', districtRef, undefined);
   *
   * @description
   * This function first checks if the organization ID is already cached in the `orgIds.value` object.
   * If not, it calls the `fetchOrgByName` function to retrieve the organization details from the server.
   * The fetched data is then cached for future use.
   * If no organizations are found, it throws an error.
   */
  const getOrgId = async (orgType, orgName, parentDistrict, parentSchool) => {
    if (orgIds.value[orgType][orgName]) return orgIds.value[orgType][orgName];
  
    // Currently we don't supply selectedDistrict or selectedSchool
    // Array of objects. Ex: [{abbreviation: 'LVT', id: 'lut54353jkler'}]
    const orgs = await fetchOrgByName(orgType, orgName, parentDistrict, parentSchool);
    const orgsWithIds = orgs.map((org) => org.id);
  
    if (orgs.length === 0) {
      throw new Error(`No organizations found for ${orgType} '${orgName}'`);
    }
  
    orgIds.value[orgType][orgName] = orgs;
  
    // console.log('orgs: ', orgs);
  
    return orgsWithIds;
  };

  </script>
  
  <style scoped>
  .extra-height {
    min-height: 33vh;
  }
  
  .optional-fields {
    margin-bottom: 2rem;
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