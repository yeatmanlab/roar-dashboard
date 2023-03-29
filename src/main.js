import { createApp } from "vue";
import { createPinia } from "pinia";
import { createHead } from '@vueuse/head'
import router from '@/router/index.js'
import App from "@/App.vue";

import PrimeVue from "primevue/config";

// PrimeVue components
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Badge from 'primevue/badge';
import Button from "primevue/button";
import Calendar from 'primevue/calendar';
import Card from "primevue/card";
import Carousel from "primevue/carousel"
import Checkbox from "primevue/checkbox";
import Chip from "primevue/chip";
import Dialog from 'primevue/dialog';
import Divider from "primevue/divider";
import Dropdown from "primevue/dropdown";
import FileUpload from 'primevue/fileupload';
import FocusTrap from "primevue/focustrap";
import InputText from "primevue/inputtext";
import InlineMessage from 'primevue/inlinemessage';
import Message from "primevue/message";
import MultiSelect from "primevue/multiselect";
import Panel from "primevue/panel";
import Password from "primevue/password";
import ProgressBar from 'primevue/progressbar';
import Skeleton from "primevue/skeleton";
import SplitButton from "primevue/splitbutton";
import TabPanel from "primevue/tabpanel";
import TabView from "primevue/tabview";
import Tag from "primevue/tag";
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import Toolbar from "primevue/toolbar";
import Tooltip from "primevue/tooltip";
import TreeSelect from "primevue/treeselect";
import TriStateCheckbox from 'primevue/tristatecheckbox'

// PrimeVue data table imports
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';     //optional for column grouping
import Row from 'primevue/row';

// Internal Roar components
import RoarDataTable from '@/components/RoarDataTable.vue'

import "primevue/resources/themes/tailwind-light/theme.css"; // theme
// import "./assets/styles/theme.css" // theme
import "primevue/resources/primevue.min.css"; // core css
import "primeicons/primeicons.css"; // icons
import "primeflex/primeflex.scss";

const app = createApp(App);
const pinia = createPinia()

app.use(PrimeVue, {ripple: true});
app.use(ToastService);
app.use(pinia);
app.use(router);
app.use(createHead());

app.component("Accordion", Accordion);
app.component("AccordionTab", AccordionTab);
app.component("Badge", Badge);
app.component("Button", Button);
app.component("Calendar", Calendar);
app.component("Card", Card);
app.component("Carousel", Carousel);
app.component("Checkbox", Checkbox);
app.component("Chip", Chip);
app.component("Dialog", Dialog);
app.component("Divider", Divider);
app.component("Dropdown", Dropdown);
app.component("FileUpload", FileUpload);
app.component("InlineMessage", InlineMessage);
app.component("InputText", InputText);
app.component("Message", Message);
app.component("MultiSelect", MultiSelect);
app.component("Panel", Panel);
app.component("Password", Password);
app.component("ProgressBar", ProgressBar);
app.component("Skeleton", Skeleton);
app.component("SplitButton", SplitButton);
app.component("TabPanel", TabPanel);
app.component("TabView", TabView);
app.component("Tag", Tag);
app.component("Toast", Toast);
app.component("Toolbar", Toolbar);
app.component("TreeSelect", TreeSelect);
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

app.mount("#app");
