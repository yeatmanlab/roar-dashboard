<template>
    <PvPanel header="Link Users" class="link-users-panel">
      <div class="info-message-container">
        <i class="pi pi-exclamation-circle"></i>
        <p>Make sure you are editing the downloaded file you got after adding users. This new file contains all of your information and LEVANTE UIDs.</p>
      </div>

      <div class="how-to-section">
        <h3>How to Link Users</h3>
        <ol class="numbered-steps">
          <li><span class="step-number">1</span>Fill in CSV with the user linking data from below. Users need to be linked so we can keep track of their relationships, like assigning the proper specific survey sections to parent and teacher users.</li>
          <li><span class="step-number">2</span>Upload the file and click "Start Linking"</li>
        </ol>
      </div>

      These fields are <b>REQUIRED</b> to link users:
  
      <ul>
        <li><b>id</b> - A unique identifier for the user in your CSV file. Start from 1.</li>
        <li><b>userType</b> - The type of user. Must be one of the following: child, parent, teacher.</li>
        <li><b>parentId</b><span class="required">*</span> - The unique identifier for the child's parent </li>
        <li><b>teacherId</b><span class="required">*</span> - The unique identifier for the child's teacher.</li>
        <li><b>uid</b> - The unique identifier that is returned when the user was added.</li>
      </ul>
  
      <p class="mb-6">
        <span class="required">*</span> = These fields are ONLY required for child users.
      </p>
  
      <p>Below is an example of what your CSV should look like. Note that you may upload a CSV with any columns
      you need, but those not required for linking will be ignored during processing.</p>
  
      <img
        id="example-image"
        :src="LEVANTE_BUCKET_URL + '/link_users_example.png'"
        alt="CSV upload example"
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
  
#example-image {
  width: 100%;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
}

.required {
  color: var(--bright-red);
}

.link-users-panel :deep(.p-panel-header) {
  font-size: 2rem;
}

.mb-6 {
  margin-bottom: 1.5rem;
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
</style>
  