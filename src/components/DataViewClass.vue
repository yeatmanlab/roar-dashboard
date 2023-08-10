<template>
	<section class="admin-class-row">
		<header>
			<h3 class="class-title">Class Name<br><small class="class-id">{{id}}</small></h3>
			<router-link
			  :to="{ name: 'ViewAdministration', params: { id: id } }"
			  v-slot="{href, route, navigate}"
			  >
				<button :href="href" @click="navigate" class='p-button p-button-secondary p-button-outlined'>
				  View &rarr;
				</button>
			</router-link>
		</header>
		<footer>
			<ProgressBar :value="40"> 40 / 100 </ProgressBar>
		</footer>
	</section>
</template>

<script setup>
	import { ref, onMounted } from "vue";

	const props = defineProps({
		id: Number,
		stats: Object,
	});
	
	onMounted(() => {
		const started 		= props.stats.completed;
		const completed 	= props.stats.started;
		const total 		= (props.stats.total - started - completed);
	});
</script>

<style lang="scss">
	.admin-class-row {
		display: flex;
		flex-direction: row-reverse;
		gap: 1rem;
		padding: 2rem;
		margin-bottom: 1rem;
		background: var(--surface-a);
		border: 1px solid var(--surface-d);
		border-radius: 5px;
		flex-wrap: wrap;
		justify-content: space-between;
		
		header {
			flex: 1 auto;
			display: flex;
			width: 100%;
			justify-content: space-between;
			border-bottom: 1px solid var(--surface-c);
			margin-bottom: 2rem;

			
			button {
				white-space: nowrap;
			}
			
		}
		
		.class-title {
			margin-top: 0rem;
			width: 100%;
			margin-bottom: 1rem;
		}
		
		.class-id {
			font-size: small;
		}
		
		footer {
			width: 100%;
		}
	}
</style>