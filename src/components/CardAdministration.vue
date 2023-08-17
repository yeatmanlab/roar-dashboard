<template>
	<div :data-administration="id" class="p-card card-administration">
		<div class="card-admin-chart">
			<Chart type="doughnut" :data="chartData" :options="chartOptions"/>
		</div>

		<div class="card-admin-body">
			<h2 class="card-admin-title">{{title}}</h2>
			<div class="card-admin-details">
				<p><strong>{{dates.start}}—{{dates.end}}</strong></p>
				<p><strong>Assigned to: </strong> 
					<span v-for="assignee in assignees" class="card-inline-list-item">
					  {{ assignee }}
					</span>
				</p>
			</div>
			<div class="card-admin-assessments">
				<p><strong>Assessments</strong></p>
				<p><span v-for="assessment in assessments" class="card-inline-list-item">{{ assessment }}</span></p>
			</div>			
			<div class="card-admin-link">
				<router-link
				  :to="{ name: 'ViewAdministration', params: { id: id } }"
				  v-slot="{href, route, navigate}"
				  >
					<button :href="href" @click="navigate" class='p-button p-button-secondary p-button-outlined'>
					  View all details
					</button>
				</router-link>
			</div>
			
			<div class="card-admin-class-list">
				<DataViewClass id="123456" :stats="stats" />
			</div>

			
		</div>
				
	</div>

</template>

<script setup>
	import { ref, onMounted } from "vue";
	import DataViewClass from "@/components/DataViewClass.vue";
	
	const props = defineProps({
		id: Number,
		title: String, 
		stats: Object,
		dates: Object,
		assignees: Array, 
		assessments: Array,
	});
	
	onMounted(() => {
		const stats 		= props.stats;
		const classID 		= '2345';
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


</script>

<style lang="scss">
	.card-administration {
		text-align: left;
		width: 100%;
		background: var(--surface-b);
		border: 1px solid var(--surface-d);
		border-radius: var(--border-radius);
		display: flex;
		flex-direction: row;
		gap: 2rem;
		padding: 1rem;
		
		.card-admin-chart {
			padding: 1rem;	
			width: 23ch;
		}
		
		.card-admin-body {
			flex: 1 1 auto;
			display: inline-flex;
			flex-direction: row;
			flex-wrap: wrap;
			align-content: start;
			
			p {
				margin-block: .5rem;
			}
		}
		
		.card-admin-title {
			font-weight: bold;
			width: 100%;
			padding-bottom: .5rem;
			border-bottom: 1px solid var(--surface-d);
			flex: 1 1 100%;
		}
		
		.card-admin-details {
			width: 45%;
		}
				
		.card-admin-link {
			margin-top: 2rem;
			width: 100%;
		}
		
		.card-admin-class-list {
			width: 100%;
			margin-top: 2rem;
		}
	}
	
	.card-inline-list-item {
		position: relative;
		
		&:not(:last-child):after {
			content: ", "; 
		}
	}
</style>