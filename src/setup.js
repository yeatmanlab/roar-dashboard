import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@unhead/vue';
import { initSentry } from '@/sentry';
import router from '@/router/index.js';
import App from '@/App.vue';
import { surveyPlugin } from 'survey-vue3-ui';

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
import PvChart from 'primevue/chart';
import PvCheckbox from 'primevue/checkbox';
import PvChip from 'primevue/chip';
import PvColumn from 'primevue/column';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvConfirmPopup from 'primevue/confirmpopup';
import PvDataTable from 'primevue/datatable';
import PvDataView from 'primevue/dataview';
import PvDialog from 'primevue/dialog';
import PvDivider from 'primevue/divider';
import PvDropdown from 'primevue/dropdown';
import PvFileUpload from 'primevue/fileupload';
import PvImage from 'primevue/image';
import PvInlineMessage from 'primevue/inlinemessage';
import PvInputGroup from 'primevue/inputgroup';
import PvInputNumber from 'primevue/inputnumber';
import PvInputSwitch from 'primevue/inputswitch';
import PvInputText from 'primevue/inputtext';
import PvKnob from 'primevue/knob';
import PvListbox from 'primevue/listbox';
import PvMenu from 'primevue/menu';
import PvMenubar from 'primevue/menubar';
import PvMessage from 'primevue/message';
import PvMultiSelect from 'primevue/multiselect';
import PvOverlayPanel from 'primevue/overlaypanel';
import PvPanel from 'primevue/panel';
import PvPassword from 'primevue/password';
import PvPickList from 'primevue/picklist';
import PvProgressBar from 'primevue/progressbar';
import PvRadioButton from 'primevue/radiobutton';
import PvScrollPanel from 'primevue/scrollpanel';
import PvSelectButton from 'primevue/selectbutton';
import PvSidebar from 'primevue/sidebar';
import PvSkeleton from 'primevue/skeleton';
import PvSpeedDial from 'primevue/speeddial';
import PvSplitter from 'primevue/splitter';
import PvSplitterPanel from 'primevue/splitterpanel';
import PvSteps from 'primevue/steps';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import PvTag from 'primevue/tag';
import PvToast from 'primevue/toast';
import PvToggleButton from 'primevue/togglebutton';
import PvTreeTable from 'primevue/treetable';
import PvTriStateCheckbox from 'primevue/tristatecheckbox';
import PvFieldset from 'primevue/fieldset';
import PvColumnGroup from 'primevue/columngroup';
import PvRow from 'primevue/row';

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

import { VueRecaptchaPlugin } from 'vue-recaptcha';

import { Buffer } from 'buffer';

export const initApp = () => {
  // Begin the app!
  const app = createApp(App);
  const pinia = createPinia();
  const head = createHead();

  // eslint-disable-next-line no-undef
  globalThis.Buffer = Buffer;

  pinia.use(piniaPluginPersistedState);

  app.use(VueRecaptchaPlugin, {
    v3SiteKey: '6Lc-LXsnAAAAAHGha6zgn0DIzgulf3TbGDhnZMAd',
  });

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
  app.use(head);
  app.use(TextClamp);
  app.use(VueQueryPlugin);
  app.use(i18n);
  app.use(surveyPlugin);

  app.component('PvAccordion', PvAccordion);
  app.component('PvAccordionTab', PvAccordionTab);
  app.component('PvAutoComplete', PvAutoComplete);
  app.component('PvBadge', PvBadge);
  app.component('PvBlockUI', PvBlockUI);
  app.component('PvButton', PvButton);
  app.component('PvCalendar', PvCalendar);
  app.component('PvCard', PvCard);
  app.component('PvChart', PvChart);
  app.component('PvCheckbox', PvCheckbox);
  app.component('PvChip', PvChip);
  app.component('PvColumn', PvColumn);
  app.component('PvConfirmDialog', PvConfirmDialog);
  app.component('PvConfirmPopup', PvConfirmPopup);
  app.component('PvDataTable', PvDataTable);
  app.component('PvDataView', PvDataView);
  app.component('PvDialog', PvDialog);
  app.component('PvDivider', PvDivider);
  app.component('PvDropdown', PvDropdown);
  app.component('PvFileUpload', PvFileUpload);
  app.component('PvImage', PvImage);
  app.component('PvInlineMessage', PvInlineMessage);
  app.component('PvInputGroup', PvInputGroup);
  app.component('PvInputNumber', PvInputNumber);
  app.component('PvInputSwitch', PvInputSwitch);
  app.component('PvInputText', PvInputText);
  app.component('PvKnob', PvKnob);
  app.component('PvListbox', PvListbox);
  app.component('PvMenu', PvMenu);
  app.component('PvMenubar', PvMenubar);
  app.component('PvMessage', PvMessage);
  app.component('PvMultiSelect', PvMultiSelect);
  app.component('PvOverlayPanel', PvOverlayPanel);
  app.component('PvPanel', PvPanel);
  app.component('PvPassword', PvPassword);
  app.component('PvPickList', PvPickList);
  app.component('PvProgressBar', PvProgressBar);
  app.component('PvRadioButton', PvRadioButton);
  app.component('PvScrollPanel', PvScrollPanel);
  app.component('PvSelectButton', PvSelectButton);
  app.component('PvSidebar', PvSidebar);
  app.component('PvSkeleton', PvSkeleton);
  app.component('PvSpeedDial', PvSpeedDial);
  app.component('PvSplitter', PvSplitter);
  app.component('PvSplitterPanel', PvSplitterPanel);
  app.component('PvSteps', PvSteps);
  app.component('PvTabPanel', PvTabPanel);
  app.component('PvTabView', PvTabView);
  app.component('PvTag', PvTag);
  app.component('PvToast', PvToast);
  app.component('PvToggleButton', PvToggleButton);
  app.component('PvTreeTable', PvTreeTable);
  app.component('PvTriStateCheckbox', PvTriStateCheckbox);
  app.component('PvColumnGroup', PvColumnGroup);
  app.component('PvRow', PvRow);

  app.component('RoarDataTable', RoarDataTable);
  app.component('LanguageSelector', LanguageSelector);
  app.component('PvFieldset', PvFieldset);

  app.directive('tooltip', PvTooltip);

  // Register all components that begin with App
  const appComponentFiles = import.meta.glob('./components/App*.vue', { eager: true });

  Object.entries(appComponentFiles).forEach(([path, m]) => {
    const componentName = path.split('/').pop().replace('.vue', '');
    app.component(componentName, m.default);
  });

  app.mount('#app');
  console.log('App mounted');
};
