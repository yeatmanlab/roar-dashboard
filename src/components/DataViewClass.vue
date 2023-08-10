<template>
	<section class="admin-class-row">
		<header>
			<nav>
				<h2 class="class-title">Class Name<br><small class="class-id">{{id}}</small></h2>
				<router-link
				  :to="{ name: 'ViewAdministration', params: { id: id } }"
				  v-slot="{href, route, navigate}"
				  >
					<button :href="href" @click="navigate" class='p-button p-button-secondary p-button-outlined'>
					  View &rarr;
					</button>
				</router-link>
			</nav>
			<ul>
				<li><strong>Total students:</strong> 2345</li>
				<li><strong>Students who have started:</strong> 345</li>
			</ul>
		</header>
		<footer><Chart type="doughnut" :data="chartData" :options="chartOptions"/></footer>
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
		chartData.value 	= setChartData(total, started, completed);
	});
	
	const chartData = ref();
	const chartOptions = ref({
		cutout: '60%',
		showToolTips: true,
		plugins: {
			  legend: {
				display: false
			  },
			  tooltip: {
				enabled: true
			  }
		}
	});
	
	const setChartData = (total, started, completed) => {
		  let docStyle = getComputedStyle(document.documentElement);
		  
		  return {
			labels: ['Not Started', 'Started', 'Completed'],
			datasets: [
			  {
				data: [total, started, completed],
				backgroundColor: [
					  docStyle.getPropertyValue('--surface-d'),
					docStyle.getPropertyValue('--yellow-100'),
					docStyle.getPropertyValue('--bright-green'),
					  
				],
				// hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
			  }
			]
		  };
	};

	// onMounted(() => {
	// 	const started 		= props.stats.completed;
	// 	const completed 	= props.stats.started;
	// 	const total 		= (props.stats.total - started - completed);
	// 	chartData.value 	= setChartData(total, started, completed);
	// });
</script>

<style lang="scss">
	.admin-class-row {
		display: flex;
		flex-direction: row-reverse;
		gap: 3rem;
		padding: 2rem;
		margin-bottom: 1rem;
		background: var(--surface-a);
		border: 1px solid var(--surface-d);
		border-radius: 5px;
		flex-wrap: wrap;
		justify-content: space-between;
		
		header {
			flex: 1 auto;
			
			nav {
				display: flex;
				width: 100%;
				justify-content: space-between;
				border-bottom: 1px solid var(--surface-c);
				margin-bottom: 2rem;

			}
			
			button {
				white-space: nowrap;
			}
			
			ul {
				padding-left: 1ch;
			}
		}
		
		.class-title {
			margin-top: 1rem;
			width: 100%;
			margin-bottom: 1rem;
		}
		
		.class-id {
			font-size: small;
		}
		
		footer {
			width: 20ch;
		}
	}
</style>