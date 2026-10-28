<script setup>
import { computed } from "vue";
import Meter from "./Meter.vue";
import {
  bytes,
  rate,
  pct,
  online,
  usage,
  quota,
  num,
} from "../utils/format.js";
import { t, routeFor } from "../utils/site.js";
const props = defineProps(["node", "index", "sys", "settings", "now"]);
const live = computed(() => online(props.node, props.now));
const values = computed(() =>
  [
    props.node.cpu,
    pct(props.node.ram_used, props.node.ram_total),
    pct(props.node.disk_used, props.node.disk_total),
  ].map((v) => (live.value ? num(v) : null)),
);
const mark = computed(() =>
  Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 19 }, (_, x) => {
      const dx = (x - 9) / 9,
        dy = (y - 4) / 4,
        d = Math.hypot(dx, dy),
        ring =
          Math.abs(d - 0.33) < 0.15
            ? 0
            : Math.abs(d - 0.65) < 0.12
              ? 1
              : Math.abs(d - 0.95) < 0.1
                ? 2
                : -1;
      return ring < 0
        ? " "
        : values.value[ring] === null
          ? "·"
          : ((Math.atan2(dy, dx) + Math.PI * 2 + props.index * 0.4) %
                (Math.PI * 2)) /
                (Math.PI * 2) <
              values.value[ring] / 100
            ? "≈"
            : ".";
    }).join(""),
  ).join("\n"),
);
</script>
<template>
  <RouterLink
    :to="routeFor(node)"
    class="node-row"
    :class="live ? 'online' : 'offline'"
    data-testid="node-row"
    data-pond-ignore
    :data-node-id="node.id"
  >
    <div class="node-water-sign" data-pond-avoid>
      <span class="node-sign-number">{{
        String(index + 1).padStart(2, "0")
      }}</span>
      <pre class="node-watermark" aria-hidden="true">{{ mark }}</pre>
      <span class="node-sign-country">{{ node.region || "NODE" }}</span>
    </div>
    <div class="node-letter">
      <div class="node-heading" data-pond-avoid>
        <span class="node-name" data-pond-ink>{{ node.name || node.id }}</span
        ><span class="node-status" :class="live ? 'online' : 'offline'"
          ><i />{{ live ? t("在线", "Online") : t("离线", "Offline") }}</span
        ><span class="node-arrow">↗</span>
      </div>
      <div class="node-resources" data-pond-avoid>
        <Meter label="CPU" :value="values[0]" /><Meter
          label="MEM"
          :value="values[1]"
        /><Meter label="DSK" :value="values[2]" />
        <div class="traffic-line">
          <Meter
            v-if="sys.show_tf !== false"
            :label="t('流量', 'NET')"
            :value="
              sys.show_tf === false
                ? null
                : pct(usage(node), quota(node.traffic_limit))
            "
          /><span class="node-network"
            ><span>↓ {{ rate(live ? node.net_in_speed : null) }}</span
            ><span>↑ {{ rate(live ? node.net_out_speed : null) }}</span></span
          >
        </div>
      </div>
      <div class="node-bottom" data-pond-avoid>
        <span class="node-meta"
          ><span v-if="sys.show_tf !== false"
            >{{ t("本期", "Used") }} {{ bytes(usage(node))
            }}<template v-if="quota(node.traffic_limit) > 0">
              / {{ bytes(quota(node.traffic_limit)) }}</template
            ></span
          ><span
            v-if="
              sys.show_expire !== false &&
              settings.show_expiry &&
              node.expire_date
            "
            >{{ t("到期", "Due") }} {{ node.expire_date.split("T")[0] }}</span
          ></span
        >
      </div>
    </div>
    <span class="node-ripple-edge" aria-hidden="true"
      >﹏ ﹏ ﹏ ﹏ ﹏</span
    ></RouterLink
  >
</template>
