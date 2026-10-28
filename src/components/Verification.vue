<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { t } from "../utils/site.js";
const props = defineProps(["client"]);
const emit = defineEmits(["verified"]);
const root = ref(),
  error = ref("");
let id,
  disposed = false;
let scriptPromise;
function load() {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(Error("Turnstile could not load"));
    document.head.append(script);
  });
}
async function mount() {
  try {
    await (scriptPromise ||= load());
    if (disposed) return;
    id = window.turnstile.render(root.value, {
      sitekey: props.client.config.turnstile_site_key,
      callback: async (token) => {
        try {
          await props.client.verify(token);
          emit("verified");
        } catch (e) {
          error.value = e.message;
          window.turnstile.reset(id);
        }
      },
      "error-callback": () => {
        error.value = t("验证加载失败，请重试", "Verification failed. Retry.");
      },
    });
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(mount);
onUnmounted(() => {
  disposed = true;
  if (id !== undefined) window.turnstile?.remove(id);
});
function retry() {
  error.value = "";
  if (id !== undefined) window.turnstile.reset(id);
  else {
    scriptPromise = null;
    mount();
  }
}
</script>
<template>
  <section class="verification" data-pond-ignore>
    <p>{{ t("完成验证，继续观测", "Verify to continue observing") }}</p>
    <div ref="root" />
    <p role="alert">{{ error }}</p>
    <button v-if="error" @click="retry">{{ t("重试", "Retry") }}</button>
  </section>
</template>
