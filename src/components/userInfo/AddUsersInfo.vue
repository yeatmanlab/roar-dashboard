<template>
  <PvPanel header="Add users" class="add-users-panel">
    <div class="info-message-container">
      <i class="pi pi-exclamation-circle"></i>
      <p>Audiences must be created before adding users. You cannot add users otherwise.</p>
    </div>

    <div class="how-to-section">
      <h3>How to Add Users</h3>
      <ol class="numbered-steps">
        <li><span class="step-number">1</span>Download the template below or create your own CSV with the required columns</li>
        <li><span class="step-number">2</span>Fill in the CSV with the user data</li>
        <li><span class="step-number">3</span>Upload the CSV file and click "Start Adding"</li>
        <li><span class="step-number">4</span>When finished, a file called "registered_users.csv" will be downloaded. If it is not in your downloads folder, click the "Download Users" button.</li>
        <li><span class="step-number">5</span>Click "Continue to Link Users" and get their login information.</li>
      </ol>
    </div>

    These fields (columns) are <b>REQUIRED</b> for adding users:

    <ul>
      <li><b>userType</b> - The type of user. Must be one of the following: child, parent, or teacher.</li>
      <li><b>month</b><span class="required">*</span> - The month the child was born. (numeric birth month, e.g. 5 for May)</li>
      <li><b>year</b><span class="required">*</span> - The year the child was born. (four-digit birth year, e.g. 2017)</li>
      <li><b>group</b> OR <b>site</b> AND <b>school</b> - You must specify either a group name OR both a site name and school name for each user.</li>
    </ul>

    These fields (columns) are optional:

    <ul class="optional-fields">
      <li><b>Class</b> - The name of the class.</li>
    </ul>

    <p>Parents and Teachers need to have the same Audiences as their children / students.</p>

    <p class="mb-6"><span class="required">*</span> = Required only for child users. Leave blank for parent or teacher users.</p>

    <div class="download-button-container">
      <button class="download-csv-btn" @click="downloadTemplate" data-testid="download-template">
        <i class="pi pi-download"></i>
        Download CSV Template
      </button>
    </div>

    <p>Below is an example of what your CSV/spreadsheet should look like. Only the required columns will be processed.</p>

    <img
      id="example-image"
      src="https://storage.googleapis.com/road-dashboard/example_researcher_csv.png"
      alt="CSV upload example"
      style="width: 100%; max-width: 1400px; height: auto;"
    />
  </PvPanel>
</template>

<script setup>
import PvPanel from 'primevue/panel';

const generateTemplateFile = () => {
  const headers = ['id', 'userType', 'month', 'year', 'parentId', 'teacherId', 'site', 'school', 'class', 'group'];
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

.required {
  color: var(--bright-red);
}

.add-users-panel :deep(.p-panel-header) {
  font-size: 2rem;
}

.download-button-container {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
}

.download-csv-btn {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s, transform 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.download-csv-btn:hover {
  background-color: var(--primary-darker, #5b0c0f);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.download-csv-btn i {
  font-size: 1.2rem;
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
