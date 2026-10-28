<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { rate } from "../utils/format.js";
import { t } from "../utils/site.js";
defineProps(["rx", "tx", "paused"]);
const stage = ref();
let observer;
function align() {
  const r = stage.value?.parentElement.getBoundingClientRect();
  if (r) {
    stage.value.style.setProperty("--pond-left", r.left + "px");
    stage.value.style.setProperty("--pond-width", r.width + "px");
  }
}
onMounted(() => {
  observer = new ResizeObserver(align);
  observer.observe(stage.value.parentElement);
  observer.observe(document.documentElement);
  addEventListener("resize", align);
  align();
});
onUnmounted(() => {
  observer?.disconnect();
  removeEventListener("resize", align);
});
</script>
<template>
  <section
    ref="stage"
    class="pond-stage"
    data-pond-habitat
    data-pond-overflow="visible"
    :aria-label="t('锦鲤水庭', 'Koi garden')"
  >
    <div class="pond-stage-heading">
      <span data-pond-avoid>{{ t("弐 / 水庭", "II / WATER GARDEN") }}</span
      ><span data-pond-avoid
        >{{
          paused ? t("鱼群小憩", "Resting") : t("锦鲤漫游", "Koi wandering")
        }}
        <i class="stage-dot"
      /></span>
    </div>
    <div class="pond-basin">
      <svg
        class="pond-shore"
        viewBox="0 0 700 530"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <path
            id="pond-rim"
            d="M110 86 C210 4 530 18 613 140 C702 267 603 446 458 487 C283 543 72 448 51 310 C25 205 46 145 110 86Z"
          />
        </defs>
        <path
          class="shore-outer"
          d="M104 65 C231 -3 551 -9 640 141 C728 304 607 473 457 507 C258 562 48 461 32 307 C17 176 44 115 104 65Z"
        />
        <text class="shore-glyphs">
          <textPath href="#pond-rim" textLength="1790" lengthAdjust="spacing">
            {{ ". : · ".repeat(85) }}
          </textPath>
        </text>
        <path
          class="shore-inner"
          d="M120 108 C232 36 513 42 584 153 C660 271 576 421 446 460 C283 507 102 419 81 302 C61 208 70 155 120 108Z"
        />
        <g class="shore-stones">
          <path data-pond-collider d="M72 129l19-17 30 5 10 19-29 16-25-5Z" />
          <path data-pond-collider d="M45 167l12-19 22 3 7 18-19 10Z" />
          <path data-pond-collider d="M550 435l28-14 23 8-4 19-36 10Z" />
        </g>
      </svg>
      <span class="pond-poem" data-pond-avoid
        ><span>{{ t("一池", "STILL") }}</span
        ><span>{{ t("闲意", "WATER") }}</span
        ><small>POND<br />NO. 01</small></span
      >
      <pre class="pond-reeds reeds-top" aria-hidden="true">
 /|  /&#10;/ | / /&#10;~:~:~:~</pre>
      <span class="water-cross cross-one">+</span
      ><span class="water-cross cross-two">+</span>
    </div>
    <div class="pond-flow" data-pond-ignore>
      <div class="flow-title" data-pond-avoid>
        <span>{{ t("水流读数", "Water readings") }}</span
        ><small>LIVE TRAFFIC</small>
      </div>
      <div class="flow-reading">
        <span data-pond-avoid>↓ {{ t("入流 / 下载", "IN / DOWNLOAD") }}</span
        ><strong data-pond-avoid>{{ rate(rx) }}</strong>
      </div>
      <div class="flow-reading">
        <span data-pond-avoid>↑ {{ t("出流 / 上传", "OUT / UPLOAD") }}</span
        ><strong data-pond-avoid>{{ rate(tx) }}</strong>
      </div>
    </div>
    <div class="pond-stage-foot">
      <span data-pond-avoid>{{
        t("游鱼自有去处，节点各有回声。", "Fish wander. Nodes respond.")
      }}</span
      ><span data-pond-avoid>{{
        t("点水 · 投喂 ↘", "TOUCH WATER · FEED ↘")
      }}</span>
    </div>
  </section>
</template>
