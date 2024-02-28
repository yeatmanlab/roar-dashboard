import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@vueuse/head';
import { initSentry } from '@/sentry';
import router from '@/router/index.js';
import App from '@/App.vue';

import piniaPluginPersistedState from 'pinia-plugin-persistedstate';
import TextClamp from 'vue3-text-clamp';

import PrimeVue from 'primevue/config';

// PrimeVue component imports
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';
import PvAutoComplete from 'primevue/autocomplete';
import PvBadge from 'primevue/badge';
import PvBlockUI from 'primevue/blockui';
import PvButton from 'primevue/button';
import PvCalendar from 'primevue/calendar';
import PvCard from 'primevue/card';
import PvCheckbox from 'primevue/checkbox';
import PvChart from 'primevue/chart';
import PvChip from 'primevue/chip';
import PvColumn from 'primevue/column';
import PvConfirmPopup from 'primevue/confirmpopup';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvDataTable from 'primevue/datatable';
import PvDataView from 'primevue/dataview';
import PvDivider from 'primevue/divider';
import PvDropdown from 'primevue/dropdown';
import PvFileUpload from 'primevue/fileupload';
import PvInputNumber from 'primevue/inputnumber';
import PvInputSwitch from 'primevue/inputswitch';
import PvInputText from 'primevue/inputtext';
import PvInlineMessage from 'primevue/inlinemessage';
import PvListbox from 'primevue/listbox';
import PvMessage from 'primevue/message';
import PvMenu from 'primevue/menu';
import PvMultiSelect from 'primevue/multiselect';
import PvOverlayPanel from 'primevue/overlaypanel';
import PvPanel from 'primevue/panel';
import PvPassword from 'primevue/password';
import PvPickList from 'primevue/picklist';
import PvProgressBar from 'primevue/progressbar';
import PvRadioButton from 'primevue/radiobutton';
import PvScrollPanel from 'primevue/scrollpanel';
import PvSidebar from 'primevue/sidebar';
import PvSelectButton from 'primevue/selectbutton';
import PvSplitter from 'primevue/splitter';
import PvSplitterPanel from 'primevue/splitterpanel';
import PvSkeleton from 'primevue/skeleton';
import PvSpeedDial from 'primevue/speeddial';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import PvTag from 'primevue/tag';
import PvToast from 'primevue/toast';
import PvTreeTable from 'primevue/treetable';
import PvTriStateCheckbox from 'primevue/tristatecheckbox';

// PrimeVue directive imports
import PvTooltip from 'primevue/tooltip';

// PrimeVue service imports
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

import { VueQueryPlugin } from '@tanstack/vue-query';
import VueGoogleMaps from 'vue-google-maps-community-fork';

// Internal Roar components
import RoarDataTable from '@/components/RoarDataTable.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';

// Style assets
import 'primevue/resources/primevue.css'; // primevue css
import 'primeicons/primeicons.css'; // icons
import 'primeflex/primeflex.scss'; // primeflex

import './assets/styles/theme-tailwind.css'; // base theme (pulled from Primevue)
import './assets/styles/theme.scss'; // ROAR theme

// translations
import { i18n } from '@/translations/i18n.js';
// https://www.npmjs.com/package/vue-country-flag-next
import CountryFlag from 'vue-country-flag-next';

// Begin the app!
const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedState);

initSentry(app);

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
app.use(i18n);
app.use(CountryFlag);

app.component('PvAccordion', PvAccordion);
app.component('PvAccordionTab', PvAccordionTab);
app.component('PvAutoComplete', PvAutoComplete);
app.component('PvBadge', PvBadge);
app.component('PvBlockUI', PvBlockUI);
app.component('PvButton', PvButton);
app.component('PvCalendar', PvCalendar);
app.component('PvCard', PvCard);
app.component('PvCheckbox', PvCheckbox);
app.component('PvChart', PvChart);
app.component('PvChip', PvChip);
app.component('PvConfirmPopup', PvConfirmPopup);
app.component('PvConfirmDialog', PvConfirmDialog);
app.component('PvDataView', PvDataView);
app.component('PvDivider', PvDivider);
app.component('PvDropdown', PvDropdown);
app.component('PvFileUpload', PvFileUpload);
app.component('PvInlineMessage', PvInlineMessage);
app.component('PvInputNumber', PvInputNumber);
app.component('PvInputSwitch', PvInputSwitch);
app.component('PvInputText', PvInputText);
app.component('PvListbox', PvListbox);
app.component('PvMessage', PvMessage);
app.component('PvMenu', PvMenu);
app.component('PvMultiSelect', PvMultiSelect);
app.component('PvOverlayPanel', PvOverlayPanel);
app.component('PvPanel', PvPanel);
app.component('PvPassword', PvPassword);
app.component('PvPickList', PvPickList);
app.component('PvProgressBar', PvProgressBar);
app.component('PvRadioButton', PvRadioButton);
app.component('PvScrollPanel', PvScrollPanel);
app.component('PvSidebar', PvSidebar);
app.component('PvSkeleton', PvSkeleton);
app.component('PvSplitter', PvSplitter);
app.component('PvSplitterPanel', PvSplitterPanel);
app.component('PvSpeedDial', PvSpeedDial);
app.component('PvSelectButton', PvSelectButton);
app.component('PvTabPanel', PvTabPanel);
app.component('PvTabView', PvTabView);
app.component('PvTag', PvTag);
app.component('PvToast', PvToast);
app.component('PvTreeTable', PvTreeTable);
app.component('PvTriStateCheckbox', PvTriStateCheckbox);
app.component('PvDataTable', PvDataTable);
app.component('PvColumn', PvColumn);

app.component('RoarDataTable', RoarDataTable);
app.component('LanguageSelector', LanguageSelector);

app.directive('tooltip', PvTooltip);

// Register all components that begin with App
const appComponentFiles = import.meta.globEager('./components/App*.vue');

Object.entries(appComponentFiles).forEach(([path, m]) => {
  const componentName = path.split('/').pop().replace('.vue', '');
  app.component(componentName, m.default);
});

import { Buffer } from 'buffer';
// eslint-disable-next-line no-undef
globalThis.Buffer = Buffer;

app.mount('#app');
