<template>
  <PvPanel header="Edit Users" class="users-edit-panel">
    <p>The following fields define the columns for your CSV file when editing existing users. Please refer to the legend below for specific requirements on each field.</p>

    <ul>
      <li><b>uid</b><span class="field-marker">*</span> - The unique LEVANTE identifier of the user to edit. This field is used to find the user and cannot be changed.</li>
      <li><b>month</b><span class="field-marker">†</span> - The new month if editing a child user's birth month (numeric; For Example, 5 for May).</li>
      <li><b>year</b><span class="field-marker">†</span> - The new year if editing a child user's birth year (four-digit; For Example, 2017).</li>
      <li><b>site</b> - The new name of the site.</li>
      <li><b>school</b> - The new name of the school.</li>
      <li><b>class</b> - The new name of the class.</li>
      <li><b>cohort</b> - The new name of the cohort.</li>
    </ul>

    <p class="mb-6 legend">
      <span class="field-marker">*</span> Required for this Step<br/>
      <span class="field-marker">†</span> Editable only for child users. Leave blank if not editing or for caregiver/teacher users.
    </p>

    <div class="warning-message">
      <i class="pi pi-exclamation-triangle"></i>
      <p>Warning: This will override any previous data.</p>
    </div>

    <p>Below is an example of what your CSV should look like. Note that you may upload a CSV with any columns
    you need, but only the fields listed above will be processed during the edit.</p>

    <div class="info-message">
      <i class="pi pi-info-circle"></i>
      <div>
        <p>Possible errors during update:</p>
        <ul>
          <li>User with specified UID does not exist</li>
          <li>Invalid format for a specific field</li>
          <li>Missing required data</li>
          <li>Group is not found</li>
        </ul>
      </div>
    </div>

    <img
      id="example-image"
      :src="LEVANTE_BUCKET_URL + '/edit_users_example.png'"
      alt="Edit Users CSV Example"
      style="width: 100%; max-width: 1400px; height: auto;"
    />
  </PvPanel>
</template>

<script setup>
import PvPanel from 'primevue/panel';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';
</script>

<style scoped>
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
  margin-bottom: 1rem; /* Added for spacing after legend */
}

.warning-message {
  display: flex;
  align-items: center;
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 0.5rem;
  color: #856404;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.warning-message i {
  font-size: 1.2em;
  margin-right: 0.75rem;
}

.warning-message p {
  margin: 0;
  font-weight: bold;
}

.info-message {
  display: flex;
  background-color: #d1ecf1;
  border: 1px solid #bee5eb;
  border-radius: 0.5rem;
  color: #0c5460;
  padding: 0.75rem;
  margin: 1rem 0;
}

.info-message i {
  font-size: 1.2em;
  margin-right: 0.75rem;
  margin-top: 0.25rem;
}

.info-message p {
  margin: 0 0 0.5rem 0;
  font-weight: bold;
}

.info-message ul {
  margin: 0;
  padding-left: 1.5rem;
}

#example-image {
  width: 100%;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
}

.required-field {
  color: red;
}

/* Style for the panel header */
.users-edit-panel :deep(.p-panel-header) {
  font-size: 1.8em;
  font-weight: bold;
}
</style> 
