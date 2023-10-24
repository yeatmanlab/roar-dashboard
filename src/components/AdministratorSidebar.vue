<template>
	<div class="sidebar-container">
		<Sidebar v-model:visible="visible">
			<ul v-if="actions" class="sidebar-actions">
				<li class="sidebar-title"><strong>Actions</strong></li>
				<li v-for="(action, index) in actions">
					<router-link :to="action.buttonLink" :key="index">
						<Button :label="action.title" rounded :icon="action.icon" />
					</router-link>
				</li>
			</ul>
		</Sidebar>
		<Button v-tooltip.right="'Click to open the menu'" label="Menu" icon="pi pi-bars" @click="visible = true" />
	</div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
	userInfo: { required: false },
	actions: { required: false }
})

const visible = ref(false)
</script>
