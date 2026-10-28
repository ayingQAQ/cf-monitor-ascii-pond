<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { clients, revision, lang, t, options } from "./utils/site.js";
import { on, read, write, num, rate, online } from "./utils/format.js";
import PondLayer from "./components/PondLayer.vue";
import PondStage from "./components/PondStage.vue";
import PaperSelect from "./components/PaperSelect.vue";
import NodeRow from "./components/NodeRow.vue";
import ServerDetail from "./views/ServerDetail.vue";
import Verification from "./components/Verification.vue";
const dialog = ref(null);
const route = useRoute(),
  search = ref(""),
  group = ref("*"),
  status = ref("*"),
  now = ref(Date.now()),
  failed = ref(false),
  settingsOpen = ref(false),
  settingsError = ref(""),
  saving = ref(false),
  draft = ref({});
watch(settingsOpen, (value) => {
  if (value) dialog.value?.showModal();
  else dialog.value?.close();
});
const selected = computed(() => {
  const i = Number(route.query.source || 0);
  return Number.isInteger(i) && i >= 0 && i < clients.length
    ? clients[i]
    : null;
});
const detail = computed(() => route.name === "server"),
  active = computed(() =>
    detail.value ? (selected.value ? [selected.value] : []) : clients,
  ),
  config = computed(() => {
    revision.value;
    return (detail.value ? selected.value : clients[0])?.config || {};
  }),
  settings = computed(() => options(config.value));
const personalMode = ref(read("cf-pond:color")),
  personalDisplay = ref(read("cf-pond:display")),
  paused = ref(read("cf-pond:paused") === "true"),
  systemDark = ref(matchMedia("(prefers-color-scheme: dark)").matches),
  origin = ref(null);
const theme = computed(() => {
  const mode = ["light", "dark", "auto"].includes(personalMode.value)
    ? personalMode.value
    : config.value.preferred_theme;
  return mode === "dark" || (mode !== "light" && systemDark.value)
    ? "dark"
    : "light";
});
const display = computed(() =>
    ["garden", "ambient"].includes(personalDisplay.value)
      ? personalDisplay.value
      : settings.value.display_mode,
  ),
  ambient = computed(() => detail.value || display.value === "ambient"),
  ready = computed(() => {
    revision.value;
    return active.value.some((c) => c.config);
  }),
  enabled = computed(
    () => ready.value && settings.value.pond_enabled && !failed.value,
  );
const servers = computed(() => {
  revision.value;
  return clients.flatMap((c) =>
    (c.servers || []).map((s) => ({ ...s, _source: c.index, _sys: c.sys })),
  );
});
const groups = computed(() => [
  { value: "*", label: t("全部分组", "All groups") },
  ...[...new Set(servers.value.map((s) => s.server_group).filter(Boolean))].map(
    (g) => ({ value: g, label: g }),
  ),
]);
const shown = computed(() =>
  servers.value.filter(
    (s) =>
      (group.value === "*" || s.server_group === group.value) &&
      `${s.name} ${s.tags || ""}`
        .toLowerCase()
        .includes(search.value.toLowerCase()) &&
      (status.value === "*" ||
        online(s, now.value) === (status.value === "online")),
  ),
);
const totals = computed(() => {
  revision.value;
  const known = clients.filter((c) => c.servers);
  const sum = (k) =>
    known.length && known.every(c => num(c.stats[k]) !== null) ? known.reduce((v, c) => v + num(c.stats[k]), 0) : null;
  return {
    online: sum("online"),
    total: sum("total"),
    rx: sum("globalSpeedIn"),
    tx: sum("globalSpeedOut"),
  };
});
const labels = {
  connecting: ["正在连接", "Connecting"],
  live: ["实时更新", "Live"],
  reconnecting: ["正在重连", "Reconnecting"],
  paused: ["已暂停", "Paused"],
  timeout: ["实时连接已到时", "Session limit reached"],
  verification: ["等待验证", "Verification required"],
  error: ["连接失败", "Connection failed"],
};
const statusText = (c) => t(...(labels[c.status] || labels.error));
function skip() {
  document.getElementById("main")?.focus();
}
function switchTheme(e) {
  origin.value = { x: e.clientX, y: e.clientY };
  personalMode.value = theme.value === "light" ? "dark" : "light";
  write("cf-pond:color", personalMode.value);
}
function switchDisplay() {
  personalDisplay.value = display.value === "garden" ? "ambient" : "garden";
  write("cf-pond:display", personalDisplay.value);
}
function togglePause() {
  paused.value = !paused.value;
  write("cf-pond:paused", String(paused.value));
}
watch(theme, (v) => (document.documentElement.dataset.theme = v), {
  immediate: true,
});
watch(
  config,
  (c) => {
    lang.value =
      c.default_language === "en" ||
      (c.default_language !== "zh" && navigator.language.startsWith("en"))
        ? "en"
        : "zh";
    document.documentElement.lang = lang.value === "zh" ? "zh-CN" : "en";
    document.title =
      c.site_title ||
      document.querySelector('meta[name="pond:title"]')?.content ||
      "Pond";
  },
  { immediate: true },
);
const background = computed(
  () =>
    config.value.background_image ||
    document.querySelector('meta[name="pond:background"]')?.content ||
    "",
);
let homeScroll = 0,
  homeFocus = "",
  clock;
async function load(refresh = false) {
  if (document.hidden) return;
  for (const c of clients)
    if (!active.value.includes(c)) {
      c.stop();
      c.abort();
    }
  await Promise.all(
    active.value.map((c) =>
      c.enter(detail.value ? String(route.params.id) : null, refresh ? c.hours || 0.167 : 0.167, refresh),
    ),
  );
}
watch(
  () => route.fullPath,
  async (_, old) => {
    if (old?.startsWith("/") && !old.startsWith("/server/") && detail.value) {
      homeScroll = scrollY;
      homeFocus =
        document.activeElement?.closest("[data-node-id]")?.dataset.nodeId || "";
    }
    await load();
    await nextTick();
    if (!detail.value && old?.startsWith("/server/")) {
      scrollTo(0, homeScroll);
      if (homeFocus)
        document
          .querySelector(`[data-node-id="${CSS.escape(homeFocus)}"]`)
          ?.focus({ preventScroll: true });
    } else scrollTo(0, 0);
  },
  { immediate: true },
);
function visible() {
  if (document.hidden) {
    for (const c of clients) {
      c.stop();
      c.abort();
      c.status = "paused";
      c.emit();
    }
  } else load(true);
}
function tick() {
  now.value = Date.now();
  for (const c of clients)
    if (!c.stopped && !c.scope) {
      c.updateTotals();
      c.emit();
    }
  clock = setTimeout(tick, 60000);
}
onMounted(() => {
  document.addEventListener("visibilitychange", visible);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", system);
  tick();
});
function system(e) {
  systemDark.value = e.matches;
}
onUnmounted(() => {
  clearTimeout(clock);
  document.removeEventListener("visibilitychange", visible);
  matchMedia("(prefers-color-scheme: dark)").removeEventListener(
    "change",
    system,
  );
  for (const c of clients) {
    c.stop();
    c.abort();
  }
});
function openSettings() {
  draft.value = { ...settings.value };
  settingsError.value = "";
  settingsOpen.value = true;
}
async function save() {
  saving.value = true;
  settingsError.value = "";
  try {
    const c = detail.value ? selected.value : clients[0];
    await c.save({ ...c.config.theme_options, pond: { ...draft.value } });
    settingsOpen.value = false;
  } catch (e) {
    settingsError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <div
    v-if="background"
    class="site-background"
    :style="{ backgroundImage: `url(${JSON.stringify(background)})` }"
  />
  <PondLayer
    :enabled="enabled"
    :paused="paused"
    :feeding="settings.feeding_enabled"
    :theme="theme"
    :origin="origin"
    @failed="failed = true"
  />
  <div
    v-if="ambient"
    class="ambient-water"
    data-pond-habitat
    data-pond-scene="ambient"
    data-pond-overflow="visible"
    aria-hidden="true"
  />
  <div
    class="site-shell"
    :data-live-revision="revision"
    :class="{
      'has-detail': detail,
      'ambient-scene': ambient,
      'home-ambient': !detail && ambient,
      'home-compact': !detail && !settings.hero_title.trim(),
    }"
  >
    <a class="skip-link" href="#main" @click.prevent="skip">{{
      t("跳到主要内容", "Skip to content")
    }}</a>
    <header class="site-header">
      <RouterLink to="/" class="brand" data-pond-avoid data-pond-ignore
        ><span class="brand-mark">≈</span
        ><span
          ><b data-pond-ink>POND<span class="brand-dot">.</span></b
          ><small>{{
            config.site_title || t("池畔观测", "Pond observations")
          }}</small></span
        ></RouterLink
      >
      <nav
        class="header-actions"
        data-pond-avoid
        data-pond-ignore
        :aria-label="t('页面控制', 'Page controls')"
      >
        <button
          v-if="!detail"
          class="icon-button display-toggle"
          :aria-label="t('切换显示模式', 'Switch layout')"
          :aria-pressed="ambient"
          @click="switchDisplay"
        >
          {{ ambient ? "≈" : "▥" }}</button
        ><button
          class="icon-button theme-toggle"
          :aria-label="t('切换深浅色', 'Switch color theme')"
          @click="switchTheme"
        >
          {{ theme === "light" ? "◐" : "◑" }}</button
        ><button
          v-if="enabled"
          class="icon-button"
          :aria-label="
            paused ? t('继续锦鲤', 'Resume koi') : t('暂停锦鲤', 'Pause koi')
          "
          :aria-pressed="paused"
          @click="togglePause"
        >
          {{ paused ? "▷" : "Ⅱ" }}</button
        ><button
          v-if="config.authorization"
          class="icon-button"
          :aria-label="t('主题设置', 'Theme settings')"
          @click="openSettings"
        >
          ⚙</button
        ><a class="admin-link" :href="(selected || clients[0]).admin()"
          >{{ t("后台", "Admin") }} ↗</a
        >
      </nav>
    </header>
    <template v-if="!detail && route.name === 'home'"
      ><section
        class="scene-heading"
        :aria-label="t('池畔概览', 'Pond overview')"
      >
        <div
          v-if="
            settings.hero_eyebrow.trim() ||
            settings.hero_title.trim() ||
            settings.hero_subtitle.trim()
          "
          class="intro"
          data-pond-avoid
        >
          <div v-if="settings.hero_eyebrow.trim()" class="eyebrow">
            <span class="tiny-line" />{{ settings.hero_eyebrow }}
          </div>
          <h1 v-if="settings.hero_title.trim()" data-pond-ink>
            {{ settings.hero_title }}
          </h1>
          <p v-if="settings.hero_subtitle.trim()">
            {{ settings.hero_subtitle }}
          </p>
        </div>
        <p v-if="settings.notice" class="notice" data-pond-avoid>
          {{ settings.notice }}
        </p>
        <div
          class="summary"
          data-pond-avoid
          :aria-label="t('站点汇总', 'Site totals')"
        >
          <div>
            <span>{{ t("在线节点", "Online") }}</span
            ><strong>{{
              totals.total === null ? "—" : `${totals.online} / ${totals.total}`
            }}</strong>
          </div>
          <div>
            <span>↓ {{ t("下载", "Download") }}</span
            ><strong>{{ rate(totals.rx) }}</strong>
          </div>
          <div>
            <span>↑ {{ t("上传", "Upload") }}</span
            ><strong>{{ rate(totals.tx) }}</strong>
          </div>
        </div>
      </section></template
    >
    <section
      v-for="c in active"
      :key="c.index"
      class="connection-notice"
      data-pond-ignore
      data-pond-avoid
    >
      <Verification v-if="c.gate" :client="c" @verified="load(true)" /><template
        v-else-if="c.status === 'timeout'"
        ><span>{{
          t(
            "实时观测已达到站点设置的时限。",
            "The site’s live session limit has been reached.",
          )
        }}</span
        ><button @click="c.resume()">
          {{ t("继续观测", "Continue") }}
        </button></template
      ><template v-else-if="c.error"
        ><span role="alert"
          >{{ clients.length > 1 ? c.base + ": " : "" }}{{ c.error }}</span
        ><button @click="load(true)">{{ t("重试", "Retry") }}</button></template
      >
    </section>
    <p v-if="failed" role="status" data-pond-avoid>
      {{
        t(
          "池塘画布未能加载，监控数据仍可查看。",
          "The pond canvas could not load. Monitoring remains available.",
        )
      }}
    </p>
    <main id="main" tabindex="-1" class="observation-layout">
      <section v-if="!detail && route.name === 'home'" class="roster-column">
        <section class="node-roster">
          <div class="roster-caption" data-pond-avoid>
            <h2>
              {{ t("壱 / 节点观测签", "I / NODE OBSERVATIONS") }}
              <span>/ {{ String(shown.length).padStart(2, "0") }}</span>
            </h2>
            <span class="connection" :class="clients[0].status"
              ><i />{{ statusText(clients[0]) }}</span
            >
          </div>
          <div class="filters" data-pond-ignore data-pond-avoid>
            <label class="search"
              ><span>⌕</span
              ><input
                v-model="search"
                :aria-label="t('搜索节点', 'Search nodes')"
                :placeholder="t('寻找一个节点…', 'Find a node…')" /></label
            ><PaperSelect
              v-model="group"
              :options="groups"
              :label="t('分组', 'Group')"
            /><PaperSelect
              v-model="status"
              :options="[
                { value: '*', label: t('全部状态', 'All states') },
                { value: 'online', label: t('在线', 'Online') },
                { value: 'offline', label: t('离线', 'Offline') },
              ]"
              :label="t('状态', 'Status')"
            />
          </div>
          <div class="node-list">
            <NodeRow
              v-for="(s, i) in shown"
              :key="s._source + ':' + s.id"
              :node="s"
              :index="i"
              :sys="s._sys"
              :settings="settings"
              :now="now"
            />
          </div>
          <p v-if="!shown.length" class="empty" data-pond-avoid>
            {{
              servers.length
                ? t("没有匹配的节点", "No matching nodes")
                : clients.some((c) => !c.servers)
                  ? t("正在连接观测站", "Connecting to the observatory")
                  : t("暂无节点", "No nodes yet")
            }}
          </p>
          <p class="roster-colophon" data-pond-avoid>
            —　{{
              t("一切变化，皆有所见。", "Every change leaves a trace.")
            }}　—
          </p>
        </section>
      </section>
      <aside v-if="!detail && !ambient" class="water-column">
        <PondStage :rx="totals.rx" :tx="totals.tx" :paused="paused" />
      </aside>
      <p v-if="detail && selected && !selected.detail && selected.status === 'connecting'" class="empty" role="status" data-pond-avoid>
        {{ t("正在读取节点档案…", "Loading node details…") }}
      </p>
      <ServerDetail
        v-if="detail && selected"
        :key="route.fullPath"
        :client="selected"
        :settings="settings"
      />
      <p v-if="route.name === 'missing' || (detail && !selected)" class="empty">
        {{ t("找不到这一页", "Page not found") }}
        <RouterLink to="/">{{ t("返回", "Return") }}</RouterLink>
      </p>
    </main>
    <footer class="site-footer" data-pond-avoid data-pond-ignore>
      <span class="footer-brand">池　 POND</span
      ><a
        href="https://github.com/huilang-me/CF-Server-Monitor/"
        target="_blank"
        rel="noopener noreferrer"
        :title="config.version || ''"
        >Powered by CF-Server-Monitor</a
      ><small>{{
        t("轻点水面，投一把鱼食。", "Touch the water. Feed the koi.")
      }}</small>
    </footer>
  </div>
  <dialog
    ref="dialog"
    @close="settingsOpen = false"
    class="settings-dialog"
    data-pond-ignore
    @keydown.esc="settingsOpen = false"
  >
    <form @submit.prevent="save">
      <div class="settings-title">
        <h2>{{ t("池畔设置", "Pond settings") }}</h2>
        <button
          type="button"
          :aria-label="t('关闭', 'Close')"
          @click="settingsOpen = false"
        >
          ×
        </button>
      </div>
      <label
        >{{ t("默认显示模式", "Default layout")
        }}<PaperSelect
          v-model="draft.display_mode"
          :options="[
            { value: 'ambient', label: t('游鱼背景', 'Ambient koi') },
            { value: 'garden', label: t('水庭', 'Water garden') },
          ]"
          :label="t('默认显示模式', 'Default layout')" /></label
      ><label
        v-for="(label, key) in {
          hero_eyebrow: t('小标题', 'Eyebrow'),
          hero_title: t('标题', 'Title'),
          hero_subtitle: t('副标题', 'Subtitle'),
          notice: t('公告', 'Notice'),
        }"
        :key="key"
        >{{ label }}<input v-model="draft[key]" /></label
      ><label
        v-for="(label, key) in {
          pond_enabled: t('显示锦鲤', 'Show koi'),
          feeding_enabled: t('允许投喂', 'Allow feeding'),
          show_expiry: t('显示到期信息', 'Show expiry'),
        }"
        :key="key"
        class="check-label"
        ><input type="checkbox" v-model="draft[key]" />{{ label }}</label
      >
      <p role="alert">{{ settingsError }}</p>
      <button type="submit" class="save-button" :disabled="saving">
        {{ saving ? t("保存中…", "Saving…") : t("保存到站点", "Save to site") }}
      </button>
    </form>
  </dialog>
</template>
