import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./styles.css";
import "./pond-page.css";
import "./cf.css";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: {} },
    { path: "/server/:id", name: "server", component: {} },
    { path: "/:pathMatch(.*)*", name: "missing", component: {} },
  ],
});
const app = createApp(App).use(router);
router.isReady().then(() => app.mount("#root"));
