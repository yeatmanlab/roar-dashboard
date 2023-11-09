<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :user-info="userInfo" :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <div class="register-container mx-auto md:flex-none">
        <RegisterTask />
      </div>
    </section>
  </main>
</template>
  
<script setup>
import { ref, } from "vue";
import RegisterTask from "@/components/tasks/RegisterTask.vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "@/router/sidebarActions";
import { useAuthStore } from "@/store/auth";

const authStore = useAuthStore();

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin, true));

const userInfo = ref(
  {
    name: "Admin name",
    district: "District Name"
  }
)
</script>
  
<style scoped>
.register-container {
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  border-color: #E5E5E5;
  background-color: #FCFCFC;
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