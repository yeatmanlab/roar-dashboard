<template>
  <main class="container main">
    <section class="main-body">
      <div class="register-container mx-auto md:flex-none">
        <RegisterTask />
      </div>
    </section>
  </main>
</template>

<script setup>
import RegisterTask from '@/components/tasks/RegisterTask.vue';
</script>

<style scoped>
.register-container {
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  border-color: #e5e5e5;
  background-color: #fcfcfc;
  width: 65%;
  padding-right: 1.5rem;
  padding-left: 1.5rem;
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
  background-color: #e5e5e5;
  border-color: #c4c4c4;
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
