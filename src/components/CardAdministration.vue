<template>
	<div :data-administration="id" class="p-card card-administration">
		<div class="card-admin-chart">
			<Chart type="doughnut" :data="chartData" :options="chartOptions" />
		</div>

		<div class="card-admin-body">
			<h2 class="card-admin-title">{{ title }}</h2>
			<div class="card-admin-details">
				<p><strong>{{ dates.start.toLocaleDateString() }} — {{ dates.end.toLocaleDateString() }}</strong></p>
				<p><strong>Assigned to: </strong>
					<span v-for="orgType in Object.keys(displayOrgs)" class="card-inline-list-item">
						<span v-if="displayOrgs[orgType].length">
							{{ _capitalize(orgType) }}:
							<span v-for="assignee in displayOrgs[orgType]" class="card-inline-list-item">
								{{ assignee.name }}
							</span>
						</span>
					</span>
				</p>
			</div>
			<div class="card-admin-assessments">
				<p><strong>Assessments</strong></p>
				<p><span v-for="assessmentId in assessmentIds" class="card-inline-list-item">{{ assessmentId }}</span></p>
			</div>
			<div class="card-admin-link">
				<router-link :to="{ name: 'ViewAdministration', params: { id: id } }" v-slot="{ href, route, navigate }">
					<button :href="href" @click="navigate" class='p-button p-button-secondary p-button-outlined'>
						View all details
					</button>
				</router-link>
			</div>

			<TreeTable v-if="isAssigned" :value="hierarchicalAssignedOrgs">
				<Column field="name" header="Name" expander></Column>
				<!-- <Column field="orgType" header="Type"></Column>
				<Column field="abbreviation" header="Abbreviation"></Column>
				<Column field="grade" header="Grade"></Column> -->
			</TreeTable>
		</div>
	</div>
</template>

<script setup>
import { ref } from "vue";
import { storeToRefs } from "pinia";
import DataViewClass from "@/components/DataViewClass.vue";
import { useQueryStore } from "@/store/query";
import { filterAdminOrgs, removeEmptyOrgs } from "@/helpers";
import _capitalize from "lodash/capitalize";
import _isEmpty from "lodash/isEmpty";
import _toPairs from "lodash/toPairs";

const queryStore = useQueryStore();
const { adminOrgs } = storeToRefs(queryStore);

const props = defineProps({
	id: String,
	title: String,
	stats: Object,
	dates: Object,
	assignees: Object,
	assessments: Array,
});

const assessmentIds = props.assessments.map(assessment => assessment.taskId.toUpperCase());

const assignedOrgs = filterAdminOrgs(adminOrgs.value, props.assignees);
const displayOrgs = removeEmptyOrgs(assignedOrgs);
const isAssigned = !_isEmpty(Object.values(displayOrgs));
const hierarchicalAssignedOrgs = isAssigned ? queryStore.getTreeTableOrgs(assignedOrgs) : null;

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

const setChartData = () => {
	let docStyle = getComputedStyle(document.documentElement);
	const { assigned, started, completed } = props.stats.total;

	return {
		labels: ['Assigned', 'Started', 'Completed'],
		datasets: [
			{
				data: [assigned, started, completed],
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

chartData.value = setChartData();
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