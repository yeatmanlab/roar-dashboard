<template>
  <div class="sidebar-container">
	<ul class="sidebar-info">
	  <li class="sidebar-title"><strong>Your Info</strong></li>
	  <li>District: {district}</li>
	  <li>School: {school}</li>
	  <li>Class: {class}</li>
	</ul>
	
	<ul v-if="actions" class="sidebar-info">
	  <li class="sidebar-title"><strong>Actions</strong></li>
	  <li v-for="(action, index) in actions">
		<router-link :to="action.buttonLink" :key="index">
			<Button rounded>{{action.title}}</Button>
		</router-link>
	  </li>
	</ul>

  </div>
</template>
<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  userInfo: {required: true},
  actions: {required: false}
})

</script>