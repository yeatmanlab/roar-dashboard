<template>
  <PvPanel header="Link Users" class="link-users-panel">
    <div class="info-message-container">
      <i class="pi pi-exclamation-circle"></i>
      <p>
        Make sure you are editing the downloaded file you got after adding users. This new file contains all of your
        information and LEVANTE UIDs.
      </p>
    </div>

    <div class="how-to-section">
      <h3>How to Link Users</h3>
      <ol class="numbered-steps">
        <li>
          <span class="step-number">1</span>Fill in CSV with the user linking data from below. Users need to be linked
          so we can keep track of their relationships, like assigning the proper specific survey sections to caregiver
          and teacher users.
        </li>
        <li><span class="step-number">2</span>Upload the file and click "Start Linking"</li>
      </ol>
    </div>

    <p>
      The following fields define the columns for your CSV file when linking users. Please refer to the legend below for
      specific requirements on each field.
    </p>
    <ul>
      <li><b>id</b><span class="field-marker">*</span> - A unique identifier for the user in CSV file.</li>
      <li><b>userType</b><span class="field-marker">*</span> - The type of user: child, caregiver, teacher.</li>
      <li>
        <b>caregiverId</b><span class="field-marker">*</span><span class="field-marker">†</span> - A unique identifier
        (id) for the child's caregiver.
      </li>
      <li>
        <b>teacherId</b><span class="field-marker">*</span><span class="field-marker">†</span> - A unique identifier
        (id) for the child's teacher. (*only required if administering teacher survey)
      </li>
      <li>
        <b>uid</b><span class="field-marker">*</span><span class="field-marker">‡</span> - The unique LEVANTE identifier
        that is returned after user is added to dashboard.
      </li>
    </ul>

    <p class="mb-6 legend">
      <span class="field-marker">*</span> Required for this Step<br />
      <span class="field-marker">†</span> Required only for child users. Leave blank for caregiver or teacher users.<br />
      <span class="field-marker">‡</span> Created by the platform during Add Users step.
    </p>

    <p>
      Below is an example of what your CSV/spreadsheet should look like. Only the required columns will be processed.
    </p>

    <img
      id="link-users-example-image"
      :src="LEVANTE_BUCKET_URL + '/link_users_example.png'"
      alt="Link Users CSV example"
      style="width: 100%; max-width: 1400px; height: auto"
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
