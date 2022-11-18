import { createApp } from "vue";
import { createPinia } from "pinia";
import { createHead } from '@vueuse/head'
import router from '@/router/index.js'
import App from "@/App.vue";

import PrimeVue from "primevue/config";

// PrimeVue components
import Button from "primevue/button";
import Calendar from 'primevue/calendar';
import Checkbox from "primevue/checkbox";
import Dialog from 'primevue/dialog';
import Divider from "primevue/divider";
import Dropdown from "primevue/dropdown";
import InputText from "primevue/inputtext";
import Message from 'primevue/message';
import MultiSelect from 'primevue/multiselect';
import Panel from "primevue/panel";
import Password from "primevue/password";
import Skeleton from 'primevue/skeleton';
import SplitButton from "primevue/splitbutton";
import TabPanel from "primevue/tabpanel";
import TabView from "primevue/tabview";
import Toolbar from "primevue/toolbar";
import Tooltip from 'primevue/tooltip';
import TreeSelect from 'primevue/treeselect';

import "primevue/resources/themes/tailwind-light/theme.css"; // theme
import "./assets/styles/theme.css" // theme
import "primevue/resources/primevue.min.css"; // core css
import "primeicons/primeicons.css"; // icons
import "primeflex/primeflex.scss";

const app = createApp(App);
const pinia = createPinia()

app.use(PrimeVue);
app.use(pinia);
app.use(router);
app.use(createHead());

app.component("Button", Button);
app.component("Calendar", Calendar);
app.component("Checkbox", Checkbox);
app.component("Dialog", Dialog);
app.component("Divider", Divider);
app.component("Dropdown", Dropdown);
app.component("InputText", InputText);
app.component("Message", Message);
app.component("MultiSelect", MultiSelect);
app.component("Panel", Panel);
app.component("Password", Password);
app.component("Skeleton", Skeleton);
app.component("SplitButton", SplitButton);
app.component("TabPanel", TabPanel);
app.component("TabView", TabView);
app.component("Toolbar", Toolbar);
app.component("TreeSelect", TreeSelect);

app.directive("tooltip", Tooltip);

// Register all components that begin with App
const appComponentFiles = import.meta.globEager(
  './components/App*.vue'
);

Object.entries(appComponentFiles).forEach(([path, m]) => {
  const componentName = path.split('/').pop().replace('.vue', '');
  app.component(componentName, m.default);
});

app.mount("#app");
