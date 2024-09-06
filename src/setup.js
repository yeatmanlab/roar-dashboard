import { createApp } from 'vue';
import { VueRecaptchaPlugin } from 'vue-recaptcha';
import { Buffer } from 'buffer';
import { initSentry } from '@/sentry';

import App from '@/App.vue';
import plugins from './plugins';

import './styles.css';

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

// Internal Roar components
import RoarDataTable from '@/components/RoarDataTable.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';

/**
 * Create a new Vue app instance with all the necessary plugins and components registered that can be used in the main
 * app or in Cypress component tests.
 *
 * @returns {App<Element>}
 */
export const createAppInstance = () => {
  const app = createApp(App);

  // Register all default app plugins
  plugins.forEach((plugin) => {
    if (Array.isArray(plugin)) {
      app.use(...plugin);
    } else {
      app.use(plugin);
    }
  });

  // Not adding this to default plugins for now, it is causing issues with Cypress component tests
  app.use(VueRecaptchaPlugin, {
    v3SiteKey: '6Lc-LXsnAAAAAHGha6zgn0DIzgulf3TbGDhnZMAd',
  });

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

  // eslint-disable-next-line no-undef
  globalThis.Buffer = Buffer;

  if (process.env.NODE_ENV === 'production') {
    initSentry(app);
  }

  return app;
};

/**
 * Initialize the main app instance and mount it to the DOM.
 * Do not call this function in Cypress tests as the testing environment mounts the app differently.
 * @returns {void}
 */
export const mountApp = () => {
  const app = createAppInstance();
  app.mount('#app');
};
