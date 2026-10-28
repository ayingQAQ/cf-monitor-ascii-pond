<script setup>
import { computed } from "vue";
import { percent, num } from "../utils/format.js";
const props = defineProps(["label", "value"]);
const filled = computed(() =>
  Math.round((Math.max(0, Math.min(100, num(props.value) || 0)) * 8) / 100),
);
</script>
<template>
  <span class="meter"
    ><span class="meter-label">{{ label }}</span
    ><span class="meter-track" aria-hidden="true"
      ><span class="meter-fill">{{ "∿".repeat(filled) }}</span
      >{{ "·".repeat(8 - filled) }}</span
    ><span class="meter-value">{{ percent(value) }}</span></span
  >
</template>
