<template>
  <div class="survey-list">
    <div class="container">
      <h1>Survey List</h1>
      <p>This will show all available surveys from the GCS bucket.</p>
      <div class="survey-grid">
        <div class="survey-card">
          <h3>Family Survey</h3>
          <p>parent_survey_family.json</p>
        </div>
        <div class="survey-card">
          <h3>Child Survey</h3>
          <p>parent_survey_child.json</p>
        </div>
        <div class="survey-card">
          <h3>Student Survey</h3>
          <p>child_survey.json</p>
        </div>
        <div class="survey-card">
          <h3>Teacher General</h3>
          <p>teacher_survey_general.json</p>
        </div>
        <div class="survey-card">
          <h3>Teacher Classroom</h3>
          <p>teacher_survey_classroom.json</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Survey list functionality will go here
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.survey-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.survey-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.survey-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.survey-card h3 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.survey-card p {
  margin: 0;
  color: #6c757d;
  font-family: monospace;
  font-size: 0.9rem;
}
</style> 