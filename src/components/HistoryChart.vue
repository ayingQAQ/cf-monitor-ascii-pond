<script setup>
import { computed, ref } from "vue";
import { tracePath, plotFraction } from "../utils/chart.js";
import { num, probeValue } from "../utils/format.js";
import { t } from "../utils/site.js";
const props = defineProps(["rows", "series", "title", "unit", "cadence"]);
const hover = ref(-1);
const rows = computed(() =>
  [...props.rows]
    .filter((r) => num(r.timestamp) !== null)
    .sort((a, b) => a.timestamp - b.timestamp),
);
const colors = [
  "var(--probe-1)",
  "var(--probe-2)",
  "var(--probe-3)",
  "var(--probe-4)",
  "var(--probe-5)",
  "var(--probe-6)",
  "#a78c5d",
  "#829b86",
];
const max = computed(
  () =>
    Math.max(
      1,
      ...rows.value.flatMap((r) =>
        props.series.map((s) => num(s.get ? s.get(r) : r[s.key]) || 0),
      ),
    ) * 1.1,
);
const first = computed(() => rows.value[0]?.timestamp || 0),
  span = computed(() =>
    Math.max(1, (rows.value.at(-1)?.timestamp || 0) - first.value),
  );
const x = (ts) => 60 + ((ts - first.value) / span.value) * 720,
  y = (v) => 218 - (v / max.value) * 190;
function path(s) {
  return tracePath(rows.value, r => s.get ? s.get(r) : r[s.key], x, y, props.cadence);
}
function move(e) {
  const r = e.currentTarget.getBoundingClientRect(),
    target =
      first.value +
      plotFraction(e.clientX - r.left, r.width) * span.value;
  let best = 0;
  rows.value.forEach((r, i) => {
    if (
      Math.abs(r.timestamp - target) <
      Math.abs(rows.value[best].timestamp - target)
    )
      best = i;
  });
  hover.value = best;
}
const time = (v) =>
  new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function value(r, s) {
  const v = probeValue(s.get ? s.get(r) : r[s.key]);
  return v === false
    ? "—"
    : v === null
      ? (s.key.startsWith("ping_") || s.key.startsWith("loss_") ? t("超时", "Timeout") : "—")
      : Number(v.toFixed(2)) + (props.unit || "");
}
</script>
<template>
  <section class="cf-chart" :aria-label="title" data-pond-ignore>
    <div class="chart-caption" data-pond-avoid>
      <h4>{{ title }}</h4>
      <div class="chart-legend">
        <span
          v-for="(s, i) in series"
          :key="s.key"
          :style="{ color: colors[i % colors.length] }"
          >— {{ s.name }}</span
        >
      </div>
    </div>
    <p v-if="!rows.length" class="empty">
      {{ t("这个时间范围内暂无观测数据", "No observations in this period") }}
    </p>
    <template v-else
      ><svg
        viewBox="0 0 800 255"
        role="img"
        :aria-label="title"
        tabindex="0"
        @pointermove="move"
        @pointerleave="hover = -1"
        @keydown.right.prevent="hover = Math.min(rows.length - 1, hover + 1)"
        @keydown.left.prevent="hover = Math.max(0, hover - 1)"
      >
        <g v-for="i in 5" :key="i">
          <path :d="`M60 ${y((max * (i - 1)) / 4)}H780`" class="chart-grid" />
          <text x="50" :y="y((max * (i - 1)) / 4) + 4" text-anchor="end">
            {{ Number(((max * (i - 1)) / 4).toFixed(1)) }}
          </text>
        </g>
        <path
          v-for="(s, i) in series"
          :key="s.key"
          :d="path(s)"
          fill="none"
          :stroke="colors[i % colors.length]"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
        <text
          v-for="i in 4"
          :key="'x' + i"
          :x="60 + (i - 1) * 240"
          y="247"
          :text-anchor="i === 1 ? 'start' : i === 4 ? 'end' : 'middle'"
        >
          {{ time(first + ((i - 1) * span) / 3) }}
        </text>
      </svg>
      <div class="chart-readout" data-pond-avoid>
        <template v-if="rows[hover]"
          ><time>{{ time(rows[hover].timestamp) }}</time
          ><span v-for="s in series" :key="s.key"
            >{{ s.name }} {{ value(rows[hover], s) }}</span
          ></template
        ><span v-else>{{
          t(
            "空白为缺失或超时；移入查看读数，键盘左右键逐点查看。",
            "Gaps indicate missing data or timeouts. Hover or use arrow keys to inspect.",
          )
        }}</span>
      </div></template
    >
  </section>
</template>
