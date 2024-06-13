<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column flex-wrap align-items-center justify-content-between mb-3 gap-3">
        <div class="text-2xl font-bold">you are offline.</div>
        <div class-="text-lg">Here's a few things you can still do</div>
        <ul>
          <li>read a book</li>
          <li>touch some grass</li>
        </ul>
      </div>
    </section>
  </main>
</template>

<script setup></script>

<style scoped>
.card-container {
  display: flex;
  flex-direction: row;
  margin: 0 0 2rem;
  flex: 1;
  gap: 1rem;
}

.card-wrapper {
  width: 100%;
  text-decoration: none;
  color: inherit;
}

.card-title {
  text-align: left;
  height: 100%;
}

.card-button {
  display: flex;
  justify-content: flex-end;
}

.loading-container {
  width: 100%;
  text-align: center;
}
</style>
