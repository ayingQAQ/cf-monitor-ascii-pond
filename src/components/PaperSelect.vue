<script setup>
import { ref, onMounted, onUnmounted } from "vue";
defineProps(["modelValue", "options", "label"]);
const emit = defineEmits(["update:modelValue"]);
const root = ref();
const close = (e) => {
  if (!root.value?.contains(e.target)) root.value?.removeAttribute("open");
};
onMounted(() => document.addEventListener("pointerdown", close));
onUnmounted(() => document.removeEventListener("pointerdown", close));
function choose(v) {
  emit("update:modelValue", v);
  root.value.removeAttribute("open");
  root.value.querySelector("summary").focus();
}
</script>
<template>
  <details
    ref="root"
    class="cf-select"
    data-pond-ignore
    @keydown.esc="root.removeAttribute('open')"
  >
    <summary :aria-label="label">
      {{ options.find((o) => o.value === modelValue)?.label || label
      }}<span aria-hidden="true">⌄</span>
    </summary>
    <div class="cf-options">
      <button
        v-for="o in options"
        :key="o.value"
        :aria-pressed="o.value === modelValue"
        @click="choose(o.value)"
      >
        {{ o.label }}<span v-if="o.value === modelValue"> ·</span>
      </button>
    </div>
  </details>
</template>
