import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@vueuse/head';
import router from '@/router/index.js';
import App from '@/App.vue';

import piniaPluginPersistedState from 'pinia-plugin-persistedstate';
import TextClamp from 'vue3-text-clamp';

import PrimeVue from 'primevue/config';

// PrimeVue components
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';
import PvAutoComplete from 'primevue/autocomplete';
import PvBadge from 'primevue/badge';
import PvBlockUI from 'primevue/blockui';
import Button from 'primevue/button';
import PvCalendar from 'primevue/calendar';
import Card from 'primevue/card';
import Checkbox from 'primevue/checkbox';
import PvChart from 'primevue/chart';
import Chip from 'primevue/chip';
import PvConfirmPopup from 'primevue/confirmpopup';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvDataView from 'primevue/dataview';
import PvDivider from 'primevue/divider';
import Dropdown from 'primevue/dropdown';
import FileUpload from 'primevue/fileupload';
import FocusTrap from 'primevue/focustrap';
import InputNumber from 'primevue/inputnumber';
import InputSwitch from 'primevue/inputswitch';
import InputText from 'primevue/inputtext';
import InlineMessage from 'primevue/inlinemessage';
import PvListbox from 'primevue/listbox';
import Message from 'primevue/message';
import Menu from 'primevue/menu';
import MultiSelect from 'primevue/multiselect';
import OverlayPanel from 'primevue/overlaypanel';
import Panel from 'primevue/panel';
import PvPassword from 'primevue/password';
import PickList from 'primevue/picklist';
import ProgressBar from 'primevue/progressbar';
import ScrollPanel from 'primevue/scrollpanel';
import SelectButton from 'primevue/selectbutton';
import Sidebar from 'primevue/sidebar';
import PvSkeleton from 'primevue/skeleton';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import Toolbar from 'primevue/toolbar';
import Tooltip from 'primevue/tooltip';
import PvTreeTable from 'primevue/treetable';
import PvTriStateCheckbox from 'primevue/tristatecheckbox';

// PrimeVue confirmation service import
import ConfirmationService from 'primevue/confirmationservice';

// PrimeVue data table imports
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Row from 'primevue/row';

import { VueQueryPlugin } from '@tanstack/vue-query';

// Internal Roar components
import RoarDataTable from '@/components/RoarDataTable.vue';

import VueGoogleMaps from 'vue-google-maps-community-fork';

// Style assets
import 'primevue/resources/primevue.css'; // primevue css
import 'primeicons/primeicons.css'; // icons
import 'primeflex/primeflex.scss'; // primeflex

import './assets/styles/theme-tailwind.css'; // base theme (pulled from Primevue)
import './assets/styles/theme.scss'; // ROAR theme

// Begin the app!
const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedState);

app.use(PrimeVue, { ripple: true });
app.use(ToastService);
app.use(ConfirmationService);
app.use(pinia);
app.use(router);
app.use(VueGoogleMaps, {
  load: {
    key: 'AIzaSyA2Q2Wq5na79apugFwoTXKyj-RTDDR1U34',
    libraries: 'places',
  },
});
app.use(createHead());
app.use(TextClamp);
app.use(VueQueryPlugin);

app.component('PvAccordion', PvAccordion);
app.component('PvAccordionTab', PvAccordionTab);
app.component('PvAutoComplete', PvAutoComplete);
app.component('PvBadge', PvBadge);
app.component('PvBlockUI', PvBlockUI);
app.component('Button', Button);
app.component('PvCalendar', PvCalendar);
app.component('Card', Card);
app.component('Checkbox', Checkbox);
app.component('PvChart', PvChart);
app.component('Chip', Chip);
app.component('PvConfirmPopup', PvConfirmPopup);
app.component('PvConfirmDialog', PvConfirmDialog);
app.component('PvDataView', PvDataView);
app.component('PvDivider', PvDivider);
app.component('Dropdown', Dropdown);
app.component('FileUpload', FileUpload);
app.component('InlineMessage', InlineMessage);
app.component('InputNumber', InputNumber);
app.component('InputSwitch', InputSwitch);
app.component('InputText', InputText);
app.component('PvListbox', PvListbox);
app.component('Message', Message);
app.component('Menu', Menu);
app.component('MultiSelect', MultiSelect);
app.component('OverlayPanel', OverlayPanel);
app.component('Panel', Panel);
app.component('PvPassword', PvPassword);
app.component('PickList', PickList);
app.component('ProgressBar', ProgressBar);
app.component('ScrollPanel', ScrollPanel);
app.component('SelectButton', SelectButton);
app.component('Sidebar', Sidebar);
app.component('PvSkeleton', PvSkeleton);
app.component('PvTabPanel', PvTabPanel);
app.component('PvTabView', PvTabView);
app.component('Tag', Tag);
app.component('Toast', Toast);
app.component('PvTreeTable', PvTreeTable);
app.component('PvTriStateCheckbox', PvTriStateCheckbox);
app.component('DataTable', DataTable);
app.component('Column', Column);

app.component('RoarDataTable', RoarDataTable);

app.directive('tooltip', Tooltip);
app.directive('focustrap', FocusTrap);

// Register all components that begin with App
const appComponentFiles = import.meta.globEager('./components/App*.vue');

Object.entries(appComponentFiles).forEach(([path, m]) => {
  const componentName = path.split('/').pop().replace('.vue', '');
  app.component(componentName, m.default);
});

import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

app.mount('#app');
