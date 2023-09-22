<template>
    <div>
        <div class="register-container mx-auto md:flex-none">
            <RegisterTask />
        </div>
    </div>
</template>
  
  <script setup>
  import RegisterTask from "../components/tasks/RegisterTask.vue";

  </script>
  
  <style scoped>
  .register-container {
    border-style: solid;
    border-width: 1px;
    border-radius: 5px;
    border-color: #E5E5E5;
    background-color: #FCFCFC;
    width: 26.875rem;
    padding-right: 1.5rem;
    padding-left: 1.5rem;
    margin-top: 6.5rem;
    position: relative;
  }
  
  .contact-text {
    padding-top: 2.75rem;
    padding-bottom: 2rem;
    text-align: left;
  }
  
  .button-container {
    display: flex;
    gap: 1.125rem;
    justify-content: center;
    margin-bottom: 6.5rem;
  }
  
  .signin-button {
    background-color: #E5E5E5;
    border-color: #C4C4C4;
    color: black;
    width: 8rem;
  }
  
  .signin-button:hover {
    background-color: #b7b5b5;
    border-color: black;
    color: black;
  }
  
  .text-btn {
    border: none;
    background-color: inherit;
    cursor: pointer;
    display: inline-block;
    font-size: 16px;
    color: #2c3e50;
  }
  </style>