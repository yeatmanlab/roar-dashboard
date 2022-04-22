import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

import PrimeVue from "primevue/config";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Toolbar from "primevue/toolbar";
import Divider from "primevue/divider";
import Password from "primevue/password";
import Checkbox from "primevue/checkbox";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";

import "primevue/resources/themes/tailwind-light/theme.css"; // theme
import "primevue/resources/primevue.min.css"; // core css
import "primeicons/primeicons.css"; // icons
import "primeflex/primeflex.scss";

const app = createApp(App);
app.use(PrimeVue);
app.use(createPinia());

app.component("Button", Button);
app.component("InputText", InputText);
app.component("Toolbar", Toolbar);
app.component("Divider", Divider);
app.component("Password", Password);
app.component("Checkbox", Checkbox);
app.component("TabView", TabView);
app.component("TabPanel", TabPanel);

app.mount("#app");
