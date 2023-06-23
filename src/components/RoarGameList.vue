<template>
  <div id="games" ref="gameContainer">
	<template v-for="(item, index) in items">
		<RoarGameListItem
		  :gameId="item.id"
		  :title="item.title" 
		  :description="item.description" 
		  :imgSrc="item.imgSrc"
		  :metadata="item.metadata" 
		  :completed="item.completed"
		/>
	</template>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import RoarGameListItem from '@/components/RoarGameListItem.vue';

const props = defineProps({
  items: {required: true, default: {}},
  focusIndex: {required: false, default: 1}
})

</script>
<style scoped lang="scss">
  #games {
	display: flex;
	flex-direction: column;
	gap: 4rem;
	width: 100%;
	overflow: scroll;
  }
</style>