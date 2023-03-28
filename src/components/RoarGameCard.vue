<template>
	<Card class="p-card-game m-4">
		<template #header>
		  <img :src="imgSrc" />
		</template>
		<template #title>
		  {{title}}
		</template>
		<template #content>
		  {{description}}
		</template>
		<template #footer v-if="metadata">
		  <Tag v-for="(items,index) in metadata" :value="items"></Tag>
		</template>
	  </Card>

</template>

<script setup>
	const props = defineProps({
  		title: {type:String, required: true},
  		description: {type: String, required: true},
  		metadata: {type: Object, default: {}},
  		imgSrc: {type: String, default: ''}
	});

	// export default {
	// 	name: 'Card'
	// };
</script>

<style scoped>
	
</style>