<template>
  <div class="sidebar-container">
	<ul class="sidebar-info">
	  <li class="sidebar-title"><strong>Your Info</strong></li>
	  <li>District: {district}</li>
	  <li>School: {school}</li>
	  <li>Class: {class}</li>
	</ul>
	
	<ul class="sidebar-info">
	  <li class="sidebar-title"><strong>Your Info</strong></li>
	  <li>District: {district}</li>
	  <li>School: {school}</li>
	  <li>Class: {class}</li>
	</ul>

  </div>
</template>
<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  userInfo: {required: true}
})

</script>