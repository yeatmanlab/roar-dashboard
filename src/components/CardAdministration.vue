<template>
	<div class="p-card card-administration">
		<div v-if="stats" class="card-admin-chart">
			<Chart type="doughnut" :data="doughnutChartData" :options="doughnutChartOptions" />
		</div>

		<div class="card-admin-body">
			<h2 class="card-admin-title">{{ title }}</h2>
			<div class="card-admin-details">
				<p><strong>{{ processedDates.start.toLocaleDateString() }} — {{ processedDates.end.toLocaleDateString()
				}}</strong></p>
				<text-clamp :text="displayOrgsText" :max-lines="3" location="end">
					<template v-if="displayOrgsText" #before>
						<b>Assigned to: </b>
					</template>
					<template #after="{ clamped, expanded, toggle }">
						<Button v-if="clamped || expanded" text :label="expanded ? 'Show Less' : 'Show More'" @click="toggle"
							style="padding: 0 .5rem" />
					</template>
				</text-clamp>
			</div>
			<div class="card-admin-assessments">
				<p><strong>Assessments</strong></p>
				<p><span v-for="assessmentId in assessmentIds" class="card-inline-list-item">{{ assessmentId }}</span></p>
			</div>

			<TreeTable v-if="isAssigned" :value="hierarchicalAssignedOrgs">
				<Column field="name" header="Name" expander style="width: 20rem"></Column>
				<Column v-if="stats" field="id" header="Completion">
					<template #body="{ node }">
						<Chart type="bar" :data="setBarChartData(node.data.id)" :options="barChartOptions" class="h-3rem" />
					</template>
				</Column>
				<Column field="id" header="" style="width: 14rem">
					<template #body="{ node }">
						<span class="p-buttonset m-0">
							<router-link
								:to="{ name: 'ViewAdministration', params: { administrationId: props.id, orgId: node.data.id, orgType: node.data.orgType } }"
								v-slot="{ href, route, navigate }">
								<Button v-tooltip.top="'See completion details'" severity="secondary" text raised label="Progress"
									aria-label="Completion details" size="small" />
							</router-link>
							<router-link v-if="authStore.isUserSuperAdmin()" :to="{
								name: 'ScoreReport', params: {
									administrationId: props.id, orgId: node.data.id, orgType:
										node.data.orgType
								}
							}" v-slot="{ href, route, navigate }">
								<Button v-tooltip.top="'See Scores'" severity="secondary" text raised label="Scores" aria-label="Scores"
									size="small" />
							</router-link>
							<span v-else v-tooltip.top="'Coming Soon'">
								<Button v-tooltip.top="'Coming Soon'" severity="secondary" text raised label="Scores" disabled
									aria-label="Scores" size="small" />
							</span>
						</span>
					</template>
				</Column>
			</TreeTable>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";
import { filterAdminOrgs, removeEmptyOrgs } from "@/helpers";
import _capitalize from "lodash/capitalize";
import _isEmpty from "lodash/isEmpty";
import _mapValues from "lodash/mapValues";
import _toPairs from "lodash/toPairs";
import _forEach from "lodash/forEach";

const authStore = useAuthStore();
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

const processedDates = computed(() => {
	return _mapValues(props.dates, (date) => {
		return new Date(date);
	})
})

const assessmentIds = props.assessments.map(assessment => assessment.taskId.toUpperCase());

const assignedOrgs = filterAdminOrgs(adminOrgs.value, props.assignees);
const displayOrgs = removeEmptyOrgs(assignedOrgs);
const isAssigned = !_isEmpty(Object.values(displayOrgs));
const hierarchicalAssignedOrgs = isAssigned ? queryStore.getTreeTableOrgs(assignedOrgs) : null;

const displayOrgsText = computed(() => {
	let orgsList = "";
	_forEach(Object.keys(displayOrgs), orgType => {
		let nameList = displayOrgs[orgType].map(org => org.name).join(', ')
		orgsList = orgsList + `${_capitalize(orgType)}: ${nameList} \n`
	})
	return orgsList;
})

const doughnutChartData = ref();
const doughnutChartOptions = ref();
const barChartOptions = ref();

const setDoughnutChartOptions = () => ({
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

const setDoughnutChartData = () => {
	const docStyle = getComputedStyle(document.documentElement);
	let { assigned = 0, started = 0, completed = 0 } = props.stats.total?.assignment || {};

	started -= completed;
	assigned -= (started + completed);

	return {
		labels: ['Completed', 'Started', 'Assigned'],
		datasets: [
			{
				data: [completed, started, assigned],
				backgroundColor: [
					docStyle.getPropertyValue('--bright-green'),
					docStyle.getPropertyValue('--yellow-100'),
					docStyle.getPropertyValue('--surface-d'),
				],
				// hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
			}
		]
	};
};

const getBorderRadii = (left, middle, right) => {
	const defaultRadius = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
	const borderRadii = { left: { ...defaultRadius }, middle: { ...defaultRadius }, right: { ...defaultRadius } };
	if (left > 0) {
		borderRadii.left.topLeft = Number.MAX_VALUE;
		borderRadii.left.bottomLeft = Number.MAX_VALUE;
	} else if (middle > 0) {
		borderRadii.middle.topLeft = Number.MAX_VALUE;
		borderRadii.middle.bottomLeft = Number.MAX_VALUE;
	} else {
		borderRadii.right.topLeft = Number.MAX_VALUE;
		borderRadii.right.bottomLeft = Number.MAX_VALUE;
	}

	if (right > 0) {
		borderRadii.right.topRight = Number.MAX_VALUE;
		borderRadii.right.bottomRight = Number.MAX_VALUE;
	} else if (middle > 0) {
		borderRadii.middle.topRight = Number.MAX_VALUE;
		borderRadii.middle.bottomRight = Number.MAX_VALUE;
	} else {
		borderRadii.left.topRight = Number.MAX_VALUE;
		borderRadii.left.bottomRight = Number.MAX_VALUE;
	}

	return borderRadii;
}

const setBarChartData = (orgId) => {
	let { assigned = 0, started = 0, completed = 0 } = props.stats[orgId]?.assignment || {};
	const documentStyle = getComputedStyle(document.documentElement);

	started -= completed;
	assigned -= (started + completed);

	const borderRadii = getBorderRadii(completed, started, assigned);
	const borderWidth = 0;

	const chartData = {
		labels: [''],
		datasets: [
			{
				type: 'bar',
				label: 'Completed',
				backgroundColor: documentStyle.getPropertyValue('--bright-green'),
				data: [completed],
				borderWidth: borderWidth,
				borderSkipped: false,
				borderRadius: borderRadii.left,
			},
			{
				type: 'bar',
				label: 'Started',
				backgroundColor: documentStyle.getPropertyValue('--yellow-100'),
				data: [started],
				borderWidth: borderWidth,
				borderSkipped: false,
				borderRadius: borderRadii.middle,
			},
			{
				type: 'bar',
				label: 'Assigned',
				backgroundColor: documentStyle.getPropertyValue('--surface-d'),
				data: [assigned],
				borderWidth: borderWidth,
				borderSkipped: false,
				borderRadius: borderRadii.right,
			},
		],
	};

	return chartData;
};

const setBarChartOptions = () => {
	return {
		indexAxis: 'y',
		maintainAspectRatio: false,
		aspectRatio: 9,
		plugins: {
			tooltips: {
				mode: 'index',
				intersect: false,
			},
			legend: false,
		},
		scales: {
			x: {
				stacked: true,
				ticks: {
					display: false,
				},
				grid: {
					display: false,
				},
				border: {
					display: false,
				}
			},
			y: {
				stacked: true,
				ticks: {
					display: false,
				},
				grid: {
					display: false,
				},
				border: {
					display: false,
				},
			},
		},
	};
};

onMounted(() => {
	if (props.stats) {
		doughnutChartData.value = setDoughnutChartData();
		doughnutChartOptions.value = setDoughnutChartOptions();
		barChartOptions.value = setBarChartOptions();
	}
})
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