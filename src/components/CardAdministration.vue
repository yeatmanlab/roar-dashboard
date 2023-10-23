<template>
	<div class="p-card card-administration">
		<div v-if="props.stats && authStore.isUserSuperAdmin()" class="card-admin-chart">
			<Chart type="doughnut" :data="doughnutChartData" :options="doughnutChartOptions" />
		</div>

		<div class="card-admin-body">
			<h2 class="card-admin-title">{{ title }}</h2>
			<div class="card-admin-details">
				<span class="mr-1"><strong>Dates</strong>:</span>
				<span>
					{{ processedDates.start.toLocaleDateString() }} — {{ processedDates.end.toLocaleDateString() }}
				</span>
			</div>
			<div class="card-admin-assessments">
				<span class="mr-1"><strong>Assessments</strong>:</span>
				<span v-for="assessmentId in assessmentIds" class="card-inline-list-item">
					{{ displayNames[assessmentId]?.name ?? assessmentId }}
					<span v-tooltip.top="'Click to view params'" class="pi pi-info-circle cursor-pointer" style="font-size: 1rem"
						@click="toggleParams($event, assessmentId)" />
				</span>
				<OverlayPanel v-for="assessmentId in assessmentIds" :ref="paramPanelRefs[assessmentId]">
					<DataTable stripedRows class="p-datatable-small" tableStyle="min-width: 30rem"
						:value="toEntryObjects(params[assessmentId])">
						<Column field="key" header="Parameter" style="width: 50%"></Column>
						<Column field="value" header="Value" style="width: 50%"></Column>
					</DataTable>
				</OverlayPanel>
			</div>

			<div class="break my-2"></div>

			<div v-if="isAssigned">
				<Button :icon="toggleIcon" size="small" :label="toggleLabel" @click="toggleTable" />
			</div>

			<TreeTable v-if="showTable" class="mt-3" lazy rowHover :loading="loadingTreeTable" :value="treeTableOrgs"
				@nodeExpand="onExpand">
				<Column field="name" header="Name" expander style="width: 20rem"></Column>
				<Column v-if="props.stats" field="id" header="Completion">
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
							<router-link :to="{
								name: 'ScoreReport', params: {
									administrationId: props.id, orgId: node.data.id, orgType:
										node.data.orgType
								}
							}" v-slot="{ href, route, navigate }">
								<Button v-tooltip.top="'See Scores'" severity="secondary" text raised label="Scores" aria-label="Scores"
									size="small" />
							</router-link>
						</span>
					</template>
				</Column>
			</TreeTable>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useQueries } from "@tanstack/vue-query";
import { fetchDocById } from "@/helpers/query/utils";
import { useAuthStore } from "@/store/auth";
import { removeEmptyOrgs } from "@/helpers";
import _capitalize from "lodash/capitalize";
import _flattenDeep from "lodash/flattenDeep";
import _forEach from "lodash/forEach";
import _fromPairs from "lodash/fromPairs";
import _isEmpty from "lodash/isEmpty";
import _mapValues from "lodash/mapValues";
import _toPairs from "lodash/toPairs";
import _without from "lodash/without";

const authStore = useAuthStore();

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

const displayNames = {
	"swr": { name: "Word", order: 3 },
	"swr-es": { name: "Palabra", order: 4 },
	"pa": { name: "Phoneme", order: 2 },
	"sre": { name: "Sentence", order: 5 },
	"letter": { name: "Letter", order: 1 },
}

const assessmentIds = props.assessments.map(assessment => assessment.taskId.toLowerCase()).sort((p1, p2) => {
	return (displayNames[p1]?.order ?? 0) - (displayNames[p2]?.order ?? 0);
});

const paramPanelRefs = _fromPairs(props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), ref()]));
const params = _fromPairs(props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), assessment.params]));

const toEntryObjects = (inputObj) => {
	return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
}

const toggleParams = (event, id) => {
	paramPanelRefs[id].value[0].toggle(event)
}

const displayOrgs = removeEmptyOrgs(props.assignees);
const isAssigned = !_isEmpty(Object.values(displayOrgs));

const showTable = ref(false);
const enableQueries = ref(false);

const toggleIcon = computed(() => {
	if (showTable.value) {
		return "pi pi-chevron-down";
	}
	return "pi pi-chevron-right";
});

const toggleLabel = computed(() => {
	if (showTable.value) {
		return "Hide details";
	}
	return "Show details";
});

const toggleTable = () => {
	enableQueries.value = true;
	showTable.value = !showTable.value;
}

const singularOrgTypes = {
	districts: "district",
	schools: "school",
	classes: "class",
	groups: "group",
	families: "families",
};

// dsgf: districts, schools, groups, families
const dsgfQueries = computed(() => {
	const result = []
	for (const orgType of ["districts", "schools", "groups", "families"]) {
		for (const org of (props.assignees[orgType] ?? [])) {
			result.push({
				queryKey: [orgType, org],
				queryFn: () => fetchDocById(orgType, org, ["name", "schools", "classes", "districtId"]),
				keepPreviousData: true,
				staleTime: 5 * 60 * 1000, // 5 minutes
				enabled: enableQueries,
			})
		}
	}
	return result;
});

const dsgfQueryResults = useQueries({ queries: dsgfQueries });
const loadingDsgfOrgs = computed(() => {
	return dsgfQueryResults.map((q) => q.isLoading).some(Boolean);
})

const dsgfOrgs = computed(() => {
	return _without(dsgfQueryResults.map((queryResult, index) => {
		if (queryResult.isSuccess) {
			const { classes, schools, collection, ...nodeData } = queryResult.data;
			const node = {
				key: String(index),
				data: {
					orgType: singularOrgTypes[collection],
					schools,
					classes,
					...nodeData,
				},
			};
			if (classes) node.children = classes.map((classId) => {
				return {
					key: `${node.key}-${classId}`,
					data: {
						orgType: "class",
						id: classId,
					}
				}
			});
			return node;
		}
		return undefined;
	}), undefined);
});

const independentSchoolIds = computed(() => {
	if (!loadingDsgfOrgs.value && dsgfOrgs.value.length > 0) {
		const dependentSchools = _flattenDeep(dsgfOrgs.value.map((node) => node.data.schools ?? []));
		return _without(props.assignees.schools, ...dependentSchools);
	} else if (loadingDsgfOrgs.value) {
		return [];
	}
	return props.assignees.schools;
});

const independentClassIds = computed(() => {
	if (!loadingDsgfOrgs.value && dsgfOrgs.value.length > 0) {
		const dependentClasses = _flattenDeep(dsgfOrgs.value.map((node) => node.data.classes ?? []));
		return _without(props.assignees.classes, ...dependentClasses);
	} else if (loadingDsgfOrgs.value) {
		return [];
	}
	return props.assignees.classes;
});

const enableClassQueries = computed(() => {
	return !loadingDsgfOrgs.value && (independentClassIds.value.length ?? 0) > 0;
})

const classQueries = computed(() => {
	return (independentClassIds.value ?? []).map((classId) => ({
		queryKey: ["classes", classId],
		queryFn: () => fetchDocById("classes", classId, ["name", "schoolId"]),
		keepPreviousData: true,
		staleTime: 5 * 60 * 1000, // 5 minutes
		enabled: enableClassQueries,
	}));
});

const classQueryResults = useQueries({ queries: classQueries });
const independentClasses = computed(() => {
	return _without(classQueryResults.map((queryResult, index) => {
		if (queryResult.isSuccess) {
			const { collection, ...nodeData } = queryResult.data;
			const node = {
				key: String(dsgfQueryResults.length + index),
				data: {
					orgType: singularOrgTypes[collection],
					...nodeData,
				},
			};
			return node;
		}
		return undefined;
	}), undefined);
})

const loadingClassOrgs = computed(() => {
	return classQueryResults.map((q) => q.isLoading).some(Boolean);
})

const loadingTreeTable = computed(() => {
	return loadingDsgfOrgs.value || loadingClassOrgs.value || expanding.value;
});

const independentSchools = computed(() => {
	return (dsgfOrgs.value ?? []).filter((node) => {
		return node.data.orgType === "school" && independentSchoolIds.value.includes(node.data.id)
	});
})

const dependentSchools = computed(() => {
	return (dsgfOrgs.value ?? []).filter((node) => {
		return node.data.orgType === "school" && !independentSchoolIds.value.includes(node.data.id);
	});
})

const orgs = computed(() => {
	const _orgs = dsgfOrgs.value.filter((node) => node.data.orgType === "district");
	_orgs.push(...independentSchools.value);

	for (const school of dependentSchools.value) {
		const districtId = school.data.districtId;
		const districtIndex = _orgs.findIndex((node) => node.data.id === districtId);
		if (districtIndex !== -1) {
			if (_orgs[districtIndex].children === undefined) {
				_orgs[districtIndex].children = [{
					...school,
					key: `${_orgs[districtIndex].key}-${school.key}`,
				}];
			} else {
				_orgs[districtIndex].children.push(school);
			}
		} else {
			_orgs.push(school);
		}
	}

	_orgs.push(...(independentClasses.value ?? []));
	_orgs.push(...dsgfOrgs.value.filter((node) => node.data.orgType === "group"));
	_orgs.push(...dsgfOrgs.value.filter((node) => node.data.orgType === "family"));

	return _orgs;
});

const treeTableOrgs = ref([]);
watch(orgs, (newValue) => {
	treeTableOrgs.value = newValue;
});

watch(showTable, (newValue) => {
	if (newValue) treeTableOrgs.value = orgs.value;
});

const expanding = ref(false);
const onExpand = async (node) => {
	console.log("onExpand", node);
	if (node.data.orgType === "school" && node.children?.length > 0 && !node.data.expanded) {
		expanding.value = true;
		const lazyNode = {
			key: node.key,
			data: {
				...node.data,
				expanded: true,
			}
		};

		const promises = node.children.map(({ data }) => {
			return fetchDocById("classes", data.id, ["name", "schoolId"])
		});

		const childNodes = (await Promise.all(promises)).map((schoolData, index) => {
			const { collection, ...nodeData } = schoolData;
			return {
				key: `${node.key}-${index}`,
				data: {
					orgType: singularOrgTypes[collection],
					...nodeData,
				},
			};
		})

		lazyNode.children = childNodes;

		const newNodes = treeTableOrgs.value.map((n) => {
			if (n.data.id === node.data.districtId) {
				const newNode = {
					...n,
					children: n.children.map((child) => {
						if (child.data.id === node.data.id) {
							return lazyNode;
						}
						return child;
					})
				}
				return newNode;
			}

			return n;
		});

		treeTableOrgs.value = newNodes;
		expanding.value = false;
	}
};

const displayOrgsText = computed(() => {
	let orgsList = "";
	_forEach(Object.keys(displayOrgs), (orgType) => {
		let nameList = displayOrgs[orgType].map((org) => org).join(', ')
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
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-content: start;

		p {
			margin-block: .5rem;
		}
	}

	.break {
		flex-basis: 100%;
		height: 0;
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

	.cursor-pointer {
		cursor: pointer;
	}
}

.card-inline-list-item {
	position: relative;

	&:not(:last-child):after {
		content: ", ";
	}
}
</style>