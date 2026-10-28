<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
const props = defineProps(["enabled", "paused", "feeding", "theme", "origin"]);
const emit = defineEmits(["failed"]);
const canvas = ref(null);
let pond,
  disposed = false,
  frame = 0,
  idle = 0,
  timer,
  starting = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
  forced = matchMedia("(forced-colors: active)");
function sync() {
  if (pond) {
    props.paused || document.hidden || reduced.matches || forced.matches
      ? pond.pause()
      : pond.resume();
    pond.setFeeding(props.feeding);
    canvas.value.dataset.state = pond.paused ? "paused" : "running";
  }
}
async function start() {
  if (
    disposed ||
    starting ||
    pond ||
    !props.enabled ||
    document.hidden ||
    forced.matches
  )
    return;
  starting = true;
  try {
    const { mount } = await import("../vendor/ascii-pond/pond.js");
    if (disposed || !props.enabled || document.hidden || !canvas.value) return;
    const mobile = innerWidth < 640;
    pond = mount(canvas.value, {
      species: [{ type: "koi", count: mobile ? 2 : 4, young: mobile ? 1 : 2 }],
      theme: props.theme,
      paused: props.paused || reduced.matches,
      feed: props.feeding,
      maxFps: mobile ? 24 : 30,
      maxDpr: mobile ? 1 : 1.5,
      contentRoot: document.getElementById("root"),
    });
    sync();
  } catch (e) {
    console.error(e);
    emit("failed");
  } finally {
    starting = false;
  }
}
function schedule() {
  sync();
  if (!pond && !disposed && !document.hidden) {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (window.requestIdleCallback)
        idle = requestIdleCallback(start, { timeout: 500 });
      else timer = setTimeout(start, 0);
    });
  }
}
watch(() => [props.paused, props.feeding], sync);
watch(
  () => props.theme,
  () => pond?.setTheme(props.theme === "light", props.origin || undefined),
);
watch(
  () => props.enabled,
  (value) => {
    if (!value) {
      pond?.destroy();
      pond = null;
    } else schedule();
  },
  { flush: "post" },
);
onMounted(() => {
  schedule();
  document.addEventListener("visibilitychange", schedule);
  reduced.addEventListener("change", sync);
  forced.addEventListener("change", schedule);
});
onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  if (idle) cancelIdleCallback(idle);
  clearTimeout(timer);
  pond?.destroy();
  document.removeEventListener("visibilitychange", schedule);
  reduced.removeEventListener("change", sync);
  forced.removeEventListener("change", schedule);
});
</script>
<template>
  <canvas v-if="enabled" ref="canvas" class="pond-canvas" aria-hidden="true" />
</template>
