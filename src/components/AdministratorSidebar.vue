<template>
  <div class="sidebar-container">
	
	<ul v-if="actions" class="sidebar-actions">
	  <li class="sidebar-title"><strong>Actions</strong></li>
	  <li v-for="(action, index) in actions">
		<router-link :to="action.buttonLink" :key="index">
			<Button :label="action.title" rounded :icon="action.icon" />
		</router-link>
	  </li>
	</ul>

  </div>
</template>
<script setup>

const props = defineProps({
  userInfo: {required: false},
  actions: {required: false}
})

</script>