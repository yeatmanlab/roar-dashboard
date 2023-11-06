import { createApp } from "vue";
import { createPinia } from "pinia";
import { createHead } from '@vueuse/head'
import router from '@/router/index.js'
import App from "@/App.vue";

import piniaPluginPersistedState from "pinia-plugin-persistedstate";
import TextClamp from 'vue3-text-clamp';

import PrimeVue from "primevue/config";

// PrimeVue components
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import AutoComplete from "primevue/autocomplete";
import Badge from 'primevue/badge';
import BlockUI from "primevue/blockui";
import Button from "primevue/button";
import Calendar from 'primevue/calendar';
import Card from "primevue/card";
import Carousel from "primevue/carousel"
import Checkbox from "primevue/checkbox";
import Chart from 'primevue/chart'
import Chip from "primevue/chip";
import ConfirmPopup from "primevue/confirmpopup";
import ConfirmDialog from "primevue/confirmdialog";
import DataView from 'primevue/dataview';
import Dialog from 'primevue/dialog';
import Divider from "primevue/divider";
import Dropdown from "primevue/dropdown";
import FileUpload from 'primevue/fileupload';
import FocusTrap from "primevue/focustrap";
import InputNumber from "primevue/inputnumber";
import InputSwitch from "primevue/inputswitch";
import InputText from "primevue/inputtext";
import InlineMessage from 'primevue/inlinemessage';
import Message from "primevue/message";
import Menu from "primevue/menu"
import MultiSelect from "primevue/multiselect";
import OverlayPanel from "primevue/overlaypanel";
import Panel from "primevue/panel";
import Password from "primevue/password";
import PickList from 'primevue/picklist';
import ProgressBar from 'primevue/progressbar';
import SelectButton from "primevue/selectbutton";
import Sidebar from "primevue/sidebar";
import Skeleton from "primevue/skeleton";
import SpeedDial from "primevue/speeddial";
import SplitButton from "primevue/splitbutton";
import TabPanel from "primevue/tabpanel";
import TabView from "primevue/tabview";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import Toolbar from "primevue/toolbar";
import Tooltip from "primevue/tooltip";
import ToggleButton from "primevue/togglebutton";
import TreeSelect from "primevue/treeselect";
import TreeTable from "primevue/treetable";
import TriStateCheckbox from 'primevue/tristatecheckbox'

// PrimeVue confirmation service import
import ConfirmationService from 'primevue/confirmationservice';

// PrimeVue data table imports
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';     //optional for column grouping
import Row from 'primevue/row';

import { VueQueryPlugin } from "@tanstack/vue-query";

// Internal Roar components
import RoarDataTable from '@/components/RoarDataTable.vue'

import VueGoogleMaps from 'vue-google-maps-community-fork'

// Style assets
import "primevue/resources/primevue.css"; // primevue css
import "primeicons/primeicons.css"; // icons
import "primeflex/primeflex.scss"; // primeflex

import "./assets/styles/theme-tailwind.css"; // base theme (pulled from Primevue)
import "./assets/styles/theme.scss" // ROAR theme

// Begin the app!
const app = createApp(App);
const pinia = createPinia()
pinia.use(piniaPluginPersistedState);

app.use(PrimeVue, {ripple: true});
app.use(ToastService);
app.use(ConfirmationService);
app.use(pinia);
app.use(router);
app.use(VueGoogleMaps, {
  load: {
    key: 'AIzaSyA2Q2Wq5na79apugFwoTXKyj-RTDDR1U34',
    libraries: 'places',
  },
})
app.use(createHead());
app.use(TextClamp);
app.use(VueQueryPlugin);

app.component("Accordion", Accordion);
app.component("AccordionTab", AccordionTab);
app.component("AutoComplete", AutoComplete);
app.component("Badge", Badge);
app.component("BlockUI", BlockUI);
app.component("Button", Button);
app.component("Calendar", Calendar);
app.component("Card", Card);
app.component("Carousel", Carousel);
app.component("Checkbox", Checkbox);
app.component("Chart", Chart);
app.component("Chip", Chip);
app.component("ConfirmPopup", ConfirmPopup);
app.component("ConfirmDialog", ConfirmDialog);
app.component("DataView", DataView);
app.component("Dialog", Dialog);
app.component("Divider", Divider);
app.component("Dropdown", Dropdown);
app.component("FileUpload", FileUpload);
app.component("InlineMessage", InlineMessage);
app.component("InputNumber", InputNumber);
app.component("InputSwitch", InputSwitch);
app.component("InputText", InputText);
app.component("Message", Message);
app.component("Menu", Menu);
app.component("MultiSelect", MultiSelect);
app.component("OverlayPanel", OverlayPanel);
app.component("Panel", Panel);
app.component("Password", Password);
app.component("PickList", PickList);
app.component("ProgressBar", ProgressBar);
app.component("SelectButton", SelectButton);
app.component("Sidebar", Sidebar);
app.component("Skeleton", Skeleton);
app.component("SpeedDial", SpeedDial);
app.component("SplitButton", SplitButton);
app.component("TabPanel", TabPanel);
app.component("TabView", TabView);
app.component("Tag", Tag);
app.component("Textarea", Textarea);
app.component("Toast", Toast);
app.component("ToggleButton", ToggleButton);
app.component("Toolbar", Toolbar);
app.component("TreeSelect", TreeSelect);
app.component("TreeTable", TreeTable);
app.component("TriStateCheckbox", TriStateCheckbox)
app.component("DataTable", DataTable);
app.component("Column", Column);
app.component("ColumnGroup", ColumnGroup);
app.component("Row", Row);

app.component("RoarDataTable", RoarDataTable);

app.directive("tooltip", Tooltip);
app.directive("focustrap", FocusTrap);

// Register all components that begin with App
const appComponentFiles = import.meta.globEager(
  './components/App*.vue'
);

Object.entries(appComponentFiles).forEach(([path, m]) => {
  const componentName = path.split('/').pop().replace('.vue', '');
  app.component(componentName, m.default);
});

import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

app.mount("#app");
