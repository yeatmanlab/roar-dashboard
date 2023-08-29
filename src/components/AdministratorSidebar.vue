<template>
  <div class="sidebar-container">
	<Panel v-if="userInfo" header="Your Info">
	  <div>District: {{userInfo.district}}</div>
	  <div>School: {school}</div>
	  <div>Class: {class}</div>
	</Panel>
	
	<Panel header="Actions" toggleable>
		<div class="sidebar-actions">
			<div v-for="(action, index) in actions">
				<router-link :to="action.buttonLink" :key="index">
					<Button :label="action.title" rounded :icon="action.icon" />
				</router-link>
			</div>
		</div>
	</Panel>

  </div>
</template>
<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  userInfo: {required: false},
  actions: {required: false}
})

</script>