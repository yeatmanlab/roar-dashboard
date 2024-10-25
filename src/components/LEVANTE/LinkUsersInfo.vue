<template>
    <PvPanel header="Link Users">
      These fields are <b>REQUIRED</b> to link users:
  
      <ul>
        <li><b>id</b> - A unique identifier for the user in your CSV. Start from 1.</li>
        <li><b>userType</b> - The type of user. Must be one of the following: child, parent, teacher.</li>
        <li><b>parentId<span class="required-field">*</span></b> - The unique identifier for the parent. Start from 1.</li>
        <li><b>teacherId<span class="required-field">*</span></b> - The unique identifier for the teacher. Start from 1.</li>
        <li><b>Group or District and Class</b> - The name of the group or district and class.</li>
        <li><b>uid</b> - The unique identifier that is returned when the user was registered.</li>
      </ul>
  
      <p>
        <span class="required-field">*</span> = These fields are ONLY required for child users.
      </p>

  
      <p>Below is an example of what your CSV should look like. Note that you may upload a CSV with any columns
      you need, but those not required for linking will be ignored during processing.</p>
  
      <img
        id="example-image"
        src="https://storage.googleapis.com/road-dashboard/link-users-example.png"
        alt="CSV upload example"
      />
    </PvPanel>
  </template>
  
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

  .required-field {
    color: red;
  }
  </style>
  