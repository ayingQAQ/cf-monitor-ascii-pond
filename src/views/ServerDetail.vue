<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { t, revision } from "../utils/site.js";
import {
  bytes,
  rate,
  pct,
  percent,
  usage,
  quota,
  num,
  gpu,
  probeKeys,
  probeValue,
  probeName,
} from "../utils/format.js";
import { HOURS } from "../data/client.js";
import Meter from "../components/Meter.vue";
import PaperSelect from "../components/PaperSelect.vue";
import HistoryChart from "../components/HistoryChart.vue";
const props = defineProps(["client", "settings"]);
const router = useRouter(),
  tab = ref("resource"),
  loading = ref(false),
  error = ref("");
const s = computed(() => {
    revision.value;
    return props.client.detail;
  }),
  rows = computed(() => {
    revision.value;
    return props.client.history;
  }),
  sys = computed(() => props.client.sys),
  config = computed(() => props.client.config || {});
const ranges = computed(() =>
  HOURS.filter((h) => h <= 24 || config.value.authorization).map((h) => ({
    value: h,
    label:
      h === 0.167
        ? t("近 10 分钟", "10 minutes")
        : h < 1
          ? t("近 30 分钟", "30 minutes")
          : t(`近 ${h} 小时`, `${h} hours`),
  })),
);
const hours = ref(0.167);
async function change(v) {
  hours.value = v;
  loading.value = true;
  error.value = "";
  try {
    await props.client.range(v);
  } catch (e) {
    if (e.name !== "AbortError") error.value = e.message;
  } finally {
    loading.value = false;
  }
}
const probes = computed(() =>
  probeKeys
    .filter(
      (k) =>
        rows.value.some((r) => probeValue(r["ping_" + k]) !== false) ||
        probeValue(s.value?.["ping_" + k]) !== false,
    )
    .map((k) => ({ key: "ping_" + k, name: probeName(k, config.value) })),
);
const gpus = computed(() => gpu(s.value?.gpu_info));
const gpuSeries = computed(() => {
  const ids = new Map();
  for (const r of rows.value)
    for (const g of gpu(r.gpu_info)) ids.set(String(g.id), g.name);
  return [...ids].map(([id, name]) => ({
    key: id,
    name,
    get: (r) => gpu(r.gpu_info).find((g) => String(g.id) === id)?.info,
  }));
});
const diskSeries = [
  ["read_bps", "↓ B/s"],
  ["write_bps", "↑ B/s"],
].map(([key, name]) => ({ key, name, get: (r) => r.disk?.[key] }));
const memorySeries = [
  { key: "ram_used", name: "RAM" },
  { key: "swap_used", name: "SWAP" },
];
const price = computed(() => {
  const v = s.value?.price;
  if (v === "" || v == null) return "—";
  return ["0", "-1"].includes(String(v))
    ? t("免费", "Free")
    : `${s.value.currency || ""}${v} / ${s.value.billing_cycle || "—"}`;
});
</script>
<template>
  <article v-if="s" class="detail-panel cf-detail" data-pond-ignore>
    <div class="detail-navigation" data-pond-avoid>
      <span>NODE / {{ s.region || "—" }}</span
      ><RouterLink to="/">{{ t("返回名册", "Back to pond") }} ↶</RouterLink>
    </div>
    <div class="detail-content">
      <header class="ledger-identity" data-pond-avoid>
        <div>
          <div class="eyebrow">{{ s.server_group || "FIELD NOTES" }}</div>
          <h2 class="detail-title" data-pond-ink>{{ s.name || s.id }}</h2>
          <p>{{ s.tags }}</p>
        </div>
        <div class="ledger-imprint" aria-hidden="true">
          ≈<small>POND<br />OBSERVATIONS</small>
        </div>
      </header>
      <div class="detail-vitals" data-pond-avoid>
        <Meter label="CPU" :value="s.cpu" /><Meter
          label="MEM"
          :value="pct(s.ram_used, s.ram_total)"
        /><Meter label="DSK" :value="pct(s.disk_used, s.disk_total)" /><Meter
          v-if="sys.show_tf !== false"
          :label="t('流量', 'NET')"
          :value="
            sys.show_tf === false ? null : pct(usage(s), quota(s.traffic_limit))
          "
        />
      </div>
      <div class="ledger-live" data-pond-avoid>
        <span>↓ {{ rate(s.net_in_speed) }}</span
        ><span>↑ {{ rate(s.net_out_speed) }}</span
        ><span>TCP {{ s.tcp_conn ?? "—" }} / UDP {{ s.udp_conn ?? "—" }}</span>
      </div>
      <section class="detail-section">
        <h3 data-pond-avoid>
          <b>壱</b> {{ t("节点档案", "Machine notes") }} <small>MACHINE</small>
        </h3>
        <div class="machine-feature" data-pond-avoid>
          <span>{{ t("处理器", "PROCESSOR") }}</span
          ><strong>{{ s.cpu_info || "—" }}</strong
          ><span>{{ s.cpu_cores ?? "—" }} {{ t("核心", "cores") }}</span>
        </div>
        <dl class="facts" data-pond-avoid>
          <div>
            <dt>{{ t("系统", "System") }}</dt>
            <dd>{{ s.os || "—" }} · {{ s.arch || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("内核", "Kernel") }}</dt>
            <dd>{{ s.kernel_version || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("内存 / 磁盘", "Memory / disk") }}</dt>
            <dd>
              {{
                bytes(num(s.ram_total) === null ? null : s.ram_total * 1048576)
              }}
              /
              {{
                bytes(
                  num(s.disk_total) === null ? null : s.disk_total * 1048576,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t("探针版本", "Agent") }}</dt>
            <dd>{{ s.agent_version || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("启动时间", "Boot time") }}</dt>
            <dd>
              {{
                num(s.boot_time) !== null
                  ? new Date(Number(s.boot_time)).toLocaleString()
                  : "—"
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t("负载", "Load") }}</dt>
            <dd>{{ s.load_avg || "—" }}</dd>
          </div>
          <div v-for="g in gpus" :key="g.id">
            <dt>{{ g.name }}</dt>
            <dd>{{ percent(g.info) }}</dd>
          </div>
        </dl>
      </section>
      <section
        v-if="sys.show_tf !== false || sys.show_price !== false"
        class="detail-section"
      >
        <h3 data-pond-avoid>
          <b>弐</b> {{ t("用量与账期", "Usage & billing") }}
          <small>WATERLINE</small>
        </h3>
        <template v-if="sys.show_tf !== false"
          ><div class="cf-waterline" data-pond-avoid>
            <div>
              <span>{{ t("本期计费用量", "BILLED THIS PERIOD") }}</span
              ><strong>{{ bytes(usage(s)) }}</strong>
            </div>
            <div>
              <span>{{ t("占用额度", "OF QUOTA") }}</span
              ><strong>{{
                percent(pct(usage(s), quota(s.traffic_limit)))
              }}</strong>
            </div>
          </div>
          <div class="cf-tide" data-pond-avoid aria-hidden="true">
            <span
              :style="{
                width:
                  Math.min(100, pct(usage(s), quota(s.traffic_limit)) || 0) +
                  '%',
              }"
            />┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆
          </div></template
        >
        <dl class="facts" data-pond-avoid>
          <div v-if="sys.show_tf !== false">
            <dt>{{ t("下载 / 上传 · 本期", "Download / upload · period") }}</dt>
            <dd>
              {{ bytes(s.net_rx_monthly) }} / {{ bytes(s.net_tx_monthly) }}
            </dd>
          </div>
          <div v-if="sys.show_tf !== false">
            <dt>{{ t("下载 / 上传 · 累计", "Download / upload · total") }}</dt>
            <dd>{{ bytes(s.net_rx) }} / {{ bytes(s.net_tx) }}</dd>
          </div>
          <div v-if="sys.show_tf !== false">
            <dt>{{ t("额度 / 计费方式", "Quota / accounting") }}</dt>
            <dd>
              {{ bytes(quota(s.traffic_limit)) }} /
              {{ s.traffic_calc_type || "total" }}
            </dd>
          </div>
          <div v-if="sys.show_price !== false">
            <dt>{{ t("费用", "Price") }}</dt>
            <dd>{{ price }}</dd>
          </div>
          <div v-if="sys.show_expire !== false && settings.show_expiry">
            <dt>{{ t("到期", "Expires") }}</dt>
            <dd>{{ s.expire_date || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("流量重置日", "Monthly reset day") }}</dt>
            <dd>{{ s.reset_day ?? "—" }}</dd>
          </div>
        </dl>
      </section>
      <section class="detail-section">
        <h3 data-pond-avoid>
          <b>参</b> {{ t("水纹记录", "Traces over time") }}
          <small>HISTORY</small>
        </h3>
        <div class="history-controls" data-pond-avoid>
          <div role="tablist">
            <button
              role="tab"
              :aria-selected="tab === 'resource'"
              @click="tab = 'resource'"
            >
              {{ t("资源", "Resources") }}</button
            ><button
              role="tab"
              :aria-selected="tab === 'latency'"
              @click="tab = 'latency'"
            >
              {{ t("延迟", "Latency") }}
            </button>
          </div>
          <PaperSelect
            :model-value="hours"
            @update:model-value="change"
            :options="ranges"
            :label="t('时间范围', 'Time range')"
          />
        </div>
        <p v-if="loading" role="status">
          {{ t("正在读取水纹…", "Reading traces…") }}
        </p>
        <p v-if="error" role="alert">{{ error }}</p>
        <div v-if="tab === 'resource'">
          <HistoryChart
            title="CPU"
            unit="%"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="[{ key: 'cpu', name: 'CPU' }]"
          /><HistoryChart
            :title="t('内存 · MB', 'Memory · MB')"
            unit=" MB"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="memorySeries"
          /><HistoryChart
            :title="t('网络速度 · B/s', 'Network · B/s')"
            unit=" B/s"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="[
              { key: 'net_in_speed', name: t('下载', 'Download') },
              { key: 'net_out_speed', name: t('上传', 'Upload') },
            ]"
          /><HistoryChart
            v-if="rows.some((r) => r.disk)"
            :title="t('磁盘 IO · B/s', 'Disk IO · B/s')"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="diskSeries"
          /><HistoryChart
            v-if="gpuSeries.length"
            title="GPU"
            unit="%"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="gpuSeries"
          />
        </div>
        <div v-else>
          <HistoryChart
            v-if="probes.length"
            :title="t('线路延迟', 'Network latency')"
            unit=" ms"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="probes"
          />
          <p v-else>
            {{
              t("暂无已配置线路的延迟数据", "No configured probe observations")
            }}
          </p>
          <HistoryChart
            v-if="probes.length"
            :title="t('丢包率', 'Packet loss')"
            unit="%"
            :rows="rows"
            :cadence="client.historyCadence"
            :series="
              probes.map((p) => ({
                ...p,
                key: p.key.replace('ping_', 'loss_'),
              }))
            "
          />
        </div>
      </section>
      <p class="detail-colophon" data-pond-avoid>
        {{
          t(
            "· 观测至此，水面如常 ·",
            "· Observations end. The water remains. ·",
          )
        }}
      </p>
    </div>
  </article>
</template>
