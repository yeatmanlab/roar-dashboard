&lt;template> &lt;div v-if="isLoading" class="flex flex-column justify-content-center align-items-center
loading-container"> &lt;AppSpinner style="margin-bottom: 1rem" /> &lt;span>{{ $t('scoreReports.loading') }}&lt;/span>
&lt;/div> &lt;div v-else class="container flex flex-column align-items-around"> &lt;div id="longitudinal-report-header"
class="flex flex-column md:flex-row align-items-center my-2"> &lt;div class="student-name text-center md:text-left
my-3"> &lt;h1 class="text-lg uppercase text-gray-400">{{ $t('scoreReports.longitudinalTitle') }}&lt;/h1> &lt;h2
class="text-5xl"> &lt;strong>{{ studentFirstName }} {{ studentLastName }}&lt;/strong> &lt;/h2> &lt;/div> &lt;div
class="student-info bg-gray-200"> &lt;p v-if="studentData?.studentData?.grade"> &lt;strong>{{
  $t('scoreReports.grade')
}}:&lt;/strong> {{ getGradeWithSuffix(studentData.studentData.grade) }} &lt;/p> &lt;p
v-if="studentData?.studentData?.class"> &lt;strong>{{ $t('scoreReports.class') }}:&lt;/strong>
{{ studentData.studentData.class }} &lt;/p> &lt;/div> &lt;/div> &lt;div class="welcome-banner"> &lt;div
class="banner-text">{{ $t('scoreReports.longitudinalWelcome') }}&lt;/div> &lt;div class="flex gap-2"> &lt;PvButton
outlined class="text-white bg-primary border-white border-1 border-round h-3rem p-3 hover:bg-red-900" :label="!expanded
? $t('scoreReports.expandSections') : $t('scoreReports.collapseSections')" :icon="!expanded ? 'pi pi-plus ml-2' : 'pi
pi-minus ml-2'" icon-pos="right" data-html2canvas-ignore="true" @click="setExpand" /> &lt;PvButton outlined
class="text-white bg-primary border-white border-1 border-round h-3rem p-3 hover:bg-red-900"
:label="$t('scoreReports.exportPDF')" :icon="exportLoading ? 'pi pi-spin pi-spinner ml-2' : 'pi pi-download ml-2'"
:disabled="exportLoading" icon-pos="right" data-html2canvas-ignore="true" @click="exportToPdf" /> &lt;/div> &lt;/div>
&lt;div v-if="!hasAnyData" class="flex flex-column align-items-center py-6 bg-gray-100"> &lt;i18n-t
keypath="scoreReports.noDataAvailable" tag="div" class="my-2 text-2xl font-bold text-gray-600"> &lt;template #firstName>
{{ studentFirstName }}
&lt;/template> &lt;/i18n-t> &lt;/div> &lt;div v-else> &lt;div class="administration-selector my-4"> &lt;h3>{{
  $t('scoreReports.selectAdministrations')
}}&lt;/h3> &lt;PvMultiSelect v-model="selectedAdministrations" :options="availableAdministrations" option-label="name"
:placeholder="$t('scoreReports.selectPlaceholder')" class="w-full md:w-20rem" @change="handleAdministrationChange" />
&lt;/div> &lt;div v-for="administration in selectedAdministrations" :key="administration.id" class="mb-4"> &lt;h3
class="administration-title">{{ administration.name }}&lt;/h3> &lt;div class="individual-report-cards">
&lt;individual-score-report-task v-if="administrationData[administration.id]?.length" :student-data="studentData"
:task-data="administrationData[administration.id]" :expanded="expanded" /> &lt;/div> &lt;/div> &lt;div
id="support-graphic" class="support-wrapper"> &lt;PvAccordion class="my-2 w-full" :active-index="expanded ? 0 : null"
expand-icon="pi pi-plus ml-2" collapse-icon="pi pi-minus ml-2" > &lt;PvAccordionTab
:header="$t('scoreReports.taskTabHeader')"> &lt;div class="flex flex-column align-items-center text-lg"> &lt;img
v-if="!(studentData?.studentData?.grade >= 6)" src="../assets/support-distribution.png" width="650" /> &lt;div
class="text-xl font-bold mt-2">{{ $t('scoreReports.taskIntro') }}&lt;/div> &lt;ul> &lt;i18n-t
keypath="scoreReports.standardScoreDescription" tag="li"> &lt;template #taskTitle> &lt;b>{{
  _startCase($t('scoreReports.standardScore'))
}}&lt;/b> &lt;/template> &lt;/i18n-t> &lt;i18n-t v-if="!(studentData?.studentData?.grade >= 6)"
keypath="scoreReports.percentileScoreDescription" tag="li" > &lt;template #taskTitle> &lt;b>{{
  _startCase($t('scoreReports.percentileScore'))
}}&lt;/b> &lt;/template> &lt;/i18n-t> &lt;/ul> &lt;/div> &lt;/PvAccordionTab> &lt;/PvAccordion> &lt;/div> &lt;/div>
&lt;/div> &lt;/template> &lt;script setup> import { ref, computed, onMounted } from 'vue'; import { storeToRefs } from
'pinia'; import { useI18n } from 'vue-i18n'; import { useAuthStore } from '@/stores/auth'; import { useUserRunPageQuery
} from '@/composables/queries/useUserRunPageQuery'; import { startCase as _startCase } from 'lodash'; import
IndividualScoreReportTask from '@/components/reports/IndividualScoreReportTask.vue'; import AppSpinner from
'@/components/AppSpinner.vue'; import { getGradeWithSuffix } from '@/utils/gradeUtils'; import html2canvas from
'html2canvas'; import { jsPDF } from 'jspdf'; const props = defineProps({ userId: { type: String, required: true },
orgType: { type: String, required: true }, orgId: { type: String, required: true } }); const { t } = useI18n(); const
authStore = useAuthStore(); const { user } = storeToRefs(authStore); const isLoading = ref(true); const exportLoading =
ref(false); const expanded = ref(false); const initialized = ref(false); const selectedAdministrations = ref([]); const
administrationData = ref({}); const studentData = computed(() => user.value); const studentFirstName = computed(() =>
studentData.value?.studentData?.firstName || ''); const studentLastName = computed(() =>
studentData.value?.studentData?.lastName || ''); // Mock data for available administrations - replace with actual API
call const availableAdministrations = ref([ { id: '1', name: 'Fall 2024' }, { id: '2', name: 'Spring 2025' } ]); const
hasAnyData = computed(() => { return Object.values(administrationData.value).some(data => data && data.length > 0); });
const setExpand = () => { expanded.value = !expanded.value; }; const handleAdministrationChange = async () => { for
(const admin of selectedAdministrations.value) { if (!administrationData.value[admin.id]) { const { data } = await
useUserRunPageQuery( props.userId, admin.id, props.orgType, props.orgId, { enabled: true } );
administrationData.value[admin.id] = data.value; } } }; const exportToPdf = async () => { try { exportLoading.value =
true; const element = document.querySelector('.container'); const canvas = await html2canvas(element, { scale: 2,
useCORS: true, allowTaint: true, ignoreElements: (element) => { return element.hasAttribute('data-html2canvas-ignore');
}, }); const imgData = canvas.toDataURL('image/png'); const pdf = new jsPDF('p', 'mm', 'a4'); const pdfWidth =
pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight(); pdf.addImage(imgData, 'PNG', 0,
0, pdfWidth, pdfHeight); pdf.save(`${studentFirstName.value}_${studentLastName.value}_longitudinal_report.pdf`); } catch
(error) { console.error('Error generating PDF:', error); } finally { exportLoading.value = false; } }; onMounted(async
() => { try { initialized.value = true; isLoading.value = false; } catch (error) { console.error('Error initializing
comparison report:', error); isLoading.value = false; } }); &lt;/script> &lt;style scoped> .container { max-width:
1200px; margin: 0 auto; padding: 2rem; } .loading-container { min-height: 400px; } .student-info { padding: 1rem 2rem;
border-radius: 8px; margin-left: 2rem; } .welcome-banner { background-color: var(--primary-color); color: white;
padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items:
center; } .banner-text { font-size: 1.2rem; font-weight: 500; } .administration-title { font-size: 1.5rem; color:
var(--primary-color); margin-bottom: 1rem; } .individual-report-cards { background-color: white; border-radius: 8px;
padding: 1.5rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); } .administration-selector { background-color: white;
border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); } @media (max-width: 768px) {
.student-info { margin-left: 0; margin-top: 1rem; } .welcome-banner { flex-direction: column; gap: 1rem; } } &lt;/style>
