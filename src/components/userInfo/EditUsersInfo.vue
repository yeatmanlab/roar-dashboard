<template>
  <PvPanel header="Edit Users" class="users-edit-panel">


    <p>The UID is <b>REQUIRED</b> to edit a user.</p>
    
    <p>These fields are <b>ALLOWED</b> to be edited:</p>

    <ul>
      <li><b>month</b> - The month to edit.</li>
      <li><b>year</b> - The year to edit.</li>
      <li><b>site</b> - The site to edit.</li>
      <li><b>school</b> - The school to edit.</li>
      <li><b>class</b> - The class to edit.</li>
      <li><b>cohort</b> - The cohort to edit.</li>
    </ul>

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
