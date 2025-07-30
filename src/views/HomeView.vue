<template>
  <div class="home">
    <h1>🔬 Levante Survey Manager</h1>
    <p>Welcome to the survey management dashboard!</p>
    
    <div class="card">
      <h2>Available Surveys</h2>
      <ul>
        <li>📋 Family Survey (parent_survey_family.json)</li>
        <li>👶 Child Survey (parent_survey_child.json)</li>
        <li>🎓 Student Survey (child_survey.json)</li>
        <li>👨‍🏫 Teacher General (teacher_survey_general.json)</li>
        <li>🏫 Teacher Classroom (teacher_survey_classroom.json)</li>
      </ul>
    </div>

    <div class="actions">
      <button @click="goToAbout" class="btn">View Survey List</button>
      <button @click="showAlert" class="btn btn-secondary">Create Survey</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToAbout = () => {
  router.push('/about')
}

const showAlert = () => {
  alert('Survey Creator coming soon!')
}
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: white;
}

.home h1 {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 1rem;
}

.home p {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 2rem;
}

.card {
  background: white;
  color: #333;
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.card h2 {
  margin-top: 0;
  color: #2c3e50;
}

.card ul {
  list-style: none;
  padding: 0;
}

.card li {
  padding: 0.5rem 0;
  font-size: 1.1rem;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 1rem 2rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: white;
  color: #667eea;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

@media (max-width: 768px) {
  .home {
    padding: 1rem;
  }
  
  .home h1 {
    font-size: 2rem;
  }
  
  .actions {
    flex-direction: column;
    align-items: center;
  }
}
</style> 