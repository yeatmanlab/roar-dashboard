<template>
  <PvPanel header="Add users" class="add-users-panel">
    <div class="info-message-container">
      <i class="pi pi-exclamation-circle"></i>
      <p>Groups must be created before adding users. You cannot add users otherwise.</p>
    </div>

    <div class="how-to-section">
      <h3>How to Add Users</h3>
      <ol class="numbered-steps">
        <li>
          <span class="step-number">1</span>Download the template below or create your own CSV with the required columns
        </li>
        <li><span class="step-number">2</span>Fill in the CSV with the user data</li>
        <li><span class="step-number">3</span>Upload the CSV file and click "Add Users from Uploaded File"</li>
        <li>
          <span class="step-number">4</span>When finished, a file called "registered_users.csv" will be downloaded. If
          it is not in your downloads folder, click the "Download Users" button.
        </li>
        <li><span class="step-number">5</span>Click "Continue to Link Users" and get their login information.</li>
      </ol>
    </div>

    <p>
      The following fields define the columns for your CSV file when adding users. Please refer to the legend below for
      specific requirements on each field.
    </p>
    <p>Caregivers and Teachers need to have the same Groups as the children they relate to.</p>
    <ul>
      <li><b>id</b><span class="field-marker">*</span> - A unique identifier for the user in CSV file.</li>
      <li><b>userType</b><span class="field-marker">*</span> - The type of user: child, caregiver, teacher.</li>
      <li>
        <b>month</b><span class="field-marker">**</span> - The month a child user was born (numeric; For Example, 5 for
        May).
      </li>
      <li>
        <b>year</b><span class="field-marker">**</span> - The year a child user was born (four-digit; For Example,
        2017).
      </li>
      <li><b>caregiverId</b> - A unique identifier (id) for the child's caregiver.</li>
      <li><b>teacherId</b> - A unique identifier (id) for the child's teacher.</li>
      <li>
        One of the following:<span class="field-marker">*</span>
        <ul class="nested-list">
          <li><b>cohort</b> - The name of the cohort.</li>
          <li>
            <b>school</b> - The name of the school.
            <ul class="nested-list">
              <li><b>class</b> - The name of the class. Must have a school as well. (Optional)</li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>

    <p class="mb-6 legend">
      <span class="field-marker">*</span> Required for this Step.<br />
      <span class="field-marker">**</span> Required only for child users. Leave blank for caregiver or teacher users.
    </p>

    <PvAccordion v-model:value="siteColumnAccordionValue" class="mb-6">
      <PvAccordionPanel value="site-column">
        <PvAccordionHeader>What if my user file has a site column?</PvAccordionHeader>
        <PvAccordionContent>
          <p>
            Early users of the dashboard may have user csv files which include a site column. 
            This is no longer required for the add users process. 
            The site to which users are added is now determined by the site selected in the site selector (top right). 
            The Add Users process will only add users to the currently selected site, and will display a warning if your file contains a site column with values that do not match the currently selected site. 
            Users in those rows will cause the add users process to fail. We recommend splitting up your user files by site.
          </p>
        </PvAccordionContent>
      </PvAccordionPanel>
    </PvAccordion>

    <p>
      Below is an example of what your CSV/spreadsheet should look like. Only the required columns will be processed.
    </p>

    <div class="csv-example-image-container">
      <img
        v-if="!shouldUsePermissions"
        id="add-users-example-image"
        :src="LEVANTE_STATIC_ASSETS_URL + '/add_users_example.png'"
        alt="Add Users CSV Example "
        class="csv-example-image"
      />
      <img
        v-else
        id="add-users-example-image"
        :src="LEVANTE_STATIC_ASSETS_URL + '/add_users_example_with_permissions.png'"
        alt="Add Users CSV Example "
        class="csv-example-image"
      />
    </div>

    <div class="download-button-container">
      <PvButton
        class="download-csv-btn"
        data-testid="download-template"
        severity="primary"
        variant="outlined"
        @click="downloadTemplate"
      >
        <i class="pi pi-download"></i>
        Download CSV Template
      </PvButton>
    </div>
  </PvPanel>
</template>

<script setup>
import { LEVANTE_STATIC_ASSETS_URL } from '@/constants/bucket';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import PvPanel from 'primevue/panel';
import PvButton from 'primevue/button';
import PvAccordion from 'primevue/accordion';
import PvAccordionPanel from 'primevue/accordionpanel';
import PvAccordionHeader from 'primevue/accordionheader';
import PvAccordionContent from 'primevue/accordioncontent';

const authStore = useAuthStore();
const { shouldUsePermissions } = storeToRefs(authStore);
const siteColumnAccordionValue = ref(null);

const generateTemplateFile = () => {
  const headers = ['id', 'userType', 'month', 'year', 'caregiverId', 'teacherId', 'site', 'school', 'class', 'cohort'];

  if (shouldUsePermissions.value) {
    const siteIndex = headers.indexOf('site');
    if (siteIndex != -1) headers.splice(siteIndex, 1);
  }

  const csvContent = headers.join(',') + '\n';
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

const downloadTemplate = () => {
  const blob = generateTemplateFile();
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'add_users_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<style lang="scss" scoped>
.info-message-container {
  display: flex;
  background-color: rgb(252, 252, 218);
  border: 2px solid rgb(228, 206, 7);
  border-radius: 0.5rem;
  color: rgb(199, 180, 7);
  margin-bottom: 1rem;

  p {
    font-weight: bold;
    margin: 1rem 1rem 1rem 0;
  }

  i {
    margin: 1rem;
  }
}

.field-marker {
  color: var(--bright-red);
  font-weight: bold;
  vertical-align: super;
  font-size: 0.8em;
  margin-left: 0.1em;
}

.legend {
  line-height: 1.6;
}

.nested-list {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding-left: 1.5em; /* Indent nested lists */
}

.required {
  color: var(--bright-red);
}

.add-users-panel :deep(.p-panel-header) {
  font-size: 2rem;
}

.download-button-container {
  display: flex;
  margin: 2rem 0 0;

  .download-csv-btn {
    &:hover {
      background: var(--primary-color);
      color: white;
    }
  }
}

.how-to-section {
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 2rem 0;

  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--primary-color);
    font-size: 1.2rem;
    font-weight: bold;
  }

  .numbered-steps {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      margin-bottom: 0.75rem;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    li:last-child {
      margin-bottom: 0;
    }

    .step-number {
      background-color: var(--primary-color);
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      flex-shrink: 0;
    }
  }
}

.csv-example-image-container {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  position: relative;
  height: 123px;

  .csv-example-image {
    width: auto;
    max-height: 108px;
    display: block;
    position: absolute;
    left: 0;
  }
}
</style>
