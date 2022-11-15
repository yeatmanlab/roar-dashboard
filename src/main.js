import { createApp } from "vue";
import { createPinia } from "pinia";
import { createHead } from '@vueuse/head'
import router from '@/router/index.js'
import App from "@/App.vue";

import PrimeVue from "primevue/config";

// PrimeVue components
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Dialog from 'primevue/dialog';
import Divider from "primevue/divider";
import InputText from "primevue/inputtext";
import Message from 'primevue/message';
import Panel from "primevue/panel";
import Password from "primevue/password";
import SplitButton from "primevue/splitbutton";
import TabPanel from "primevue/tabpanel";
import TabView from "primevue/tabview";
import Toolbar from "primevue/toolbar";

import "primevue/resources/themes/tailwind-light/theme.css"; // theme
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
app.component("Checkbox", Checkbox);
app.component("Dialog", Dialog);
app.component("Divider", Divider);
app.component("InputText", InputText);
app.component("Message", Message);
app.component("Panel", Panel);
app.component("Password", Password);
app.component("SplitButton", SplitButton);
app.component("TabPanel", TabPanel);
app.component("TabView", TabView);
app.component("Toolbar", Toolbar);

// Register all components that begin with App
const appComponentFiles = import.meta.globEager(
  './components/App*.vue'
);

Object.entries(appComponentFiles).forEach(([path, m]) => {
  const componentName = path.split('/').pop().replace('.vue', '');
  app.component(componentName, m.default);
});

app.mount("#app");
