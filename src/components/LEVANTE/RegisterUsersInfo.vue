<template>
  <PvPanel header="Register users">
    <div class="info-message-container">
      <i class="pi pi-exclamation-circle"></i>
      <p>A Group (Organization) must be created before registering users. You cannot register users otherwise.</p>
    </div>
    These fields are <b>REQUIRED</b> for registering users:

    <ul>
      <li><b>id</b> - The unique identifier for the user. Start from 1.</li>
      <li><b>userType</b> - The type of user. Must be one of the following: child, parent, teacher.</li>
      <li><b>month</b> - The month of the year the user was born.</li>
      <li><b>year</b> - The year the user was born.</li>
      <li><b>group</b> - The name of the group.</li>
    </ul>

    These fields are optional, <b>HOWEVER</b>, you <i>must</i> use them if you want to link children with thier parents
    and teachers:

    <ul class="optional-fields">
      <li><b>childId</b> - The unique identifier for the child. Start from 1.</li>
      <li><b>parentId</b> - The unique identifier for the parent. Start from 1.</li>
      <li><b>teacherId</b> - The unique identifier for the teacher. Start from 1.</li>
    </ul>

    Below is an example of what your CSV/spreadsheet could look like. Note that you may upload a CSV with any columns
    you need, but those not required for registration can be ignored during processing by selecting the "Ignore this
    column" option.

    <img
      id="example-image"
      src="https://storage.googleapis.com/road-dashboard/example_researcher_csv.png"
      alt="CSV upload example"
    />
  </PvPanel>
</template>

<script setup>
import PvPanel from 'primevue/panel';
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
</style>
