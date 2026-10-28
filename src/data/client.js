import { historyCadence } from "../utils/chart.js";
import { on, read, write, online, num } from "../utils/format.js";
export const HOURS = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168];
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fields = new Set(
  (
    "cpu ram_total ram_used swap_total swap_used net_in_speed net_out_speed net_rx net_tx net_rx_monthly net_tx_monthly disk_total disk_used disk gpu_info processes tcp_conn udp_conn cpu_cores cpu_info arch os kernel_version agent_version boot_time load_avg last_updated timestamp ping_ct ping_cu ping_cm ping_bd loss_ct loss_cu loss_cm loss_bd " +
    Array.from(
      { length: 4 },
      (_, i) => `ping_node_${i + 1} loss_node_${i + 1}`,
    ).join(" ")
  ).split(" "),
);
export function mergeSamples(old, samples, clocks = {}) {
  const next = { ...old };
  for (const sample of [...samples].sort((a, b) => a.ts - b.ts)) {
    const ts = Number(sample.ts),
      data = sample.data || sample.payload || sample.metrics;
    if (!Number.isFinite(ts) || !data || typeof data !== "object") continue;
    for (const [k, v] of Object.entries(data))
      if (fields.has(k) && v !== undefined && ts >= (clocks[k] ?? -Infinity)) {
        next[k] = v;
        clocks[k] = ts;
      }
    next.last_updated = Math.max(Number(next.last_updated) || 0, ts);
  }
  return next;
}
export class Client {
  constructor(base, index, changed = () => {}) {
    this.base = base;
    this.index = index;
    this.changed = changed;
    this.config = null;
    this.configPromise = null;
    this.servers = null;
    this.detail = null;
    this.history = [];
    this.stats = {};
    this.sys = {};
    this.status = "connecting";
    this.error = "";
    this.gate = false;
    this.controllers = new Set();
    this.scope = null;
    this.generation = 0;
    this.retryCount = 0;
    this.pending = new Map();
    this.clocks = new Map();
    this.stopped = false;
    this.timedOut = false;
  }
  token() {
    return (
      read(`cf-pond:jwt:${this.base}`) ||
      (this.index === 0 ? read("jwt_token") : null)
    );
  }
  credentialKey() {
    return `cf-pond:verified:${this.base}`;
  }
  admin() {
    return this.base + "/admin#/admin";
  }
  emit() {
    this.changed(this);
  }
  async request(path, { signal, body, challenge, initial = false } = {}) {
    const controller = new AbortController();
    this.controllers.add(controller);
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, 15000),
      headers = {};
    const token = this.token();
    if (token) headers.Authorization = "Bearer " + token;
    if (!initial && on(this.config?.turnstile_enabled)) {
      const verified = read(this.credentialKey());
      if (challenge) headers["X-Turnstile-Token"] = challenge;
      else if (verified) headers["X-Turnstile-Verified"] = verified;
    }
    if (body) headers["Content-Type"] = "application/json";
    try {
      const res = await fetch(this.base + path, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          write(`cf-pond:jwt:${this.base}`, null);
          if (this.index === 0) write("jwt_token", null);
          this.stop();
          location.assign(this.admin());
        }
        if (res.status === 403) {
          write(this.credentialKey(), null);
          this.gate = true;
          this.stop();
          this.emit();
        }
        throw new ApiError(
          res.status,
          data.error || data.message || `HTTP ${res.status}`,
        );
      }
      if (data?.turnstile_verified)
        write(this.credentialKey(), data.turnstile_verified);
      return data;
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
      signal?.removeEventListener("abort", abort);
    }
  }
  async init() {
    if (!this.configPromise)
      this.configPromise = this.request("/api/config", { initial: true })
        .then((c) => {
          this.config = c;
          this.gate = on(c.turnstile_enabled) && !read(this.credentialKey());
          this.emit();
          if (!on(c.is_public) && !on(c.authorization)) {
            this.stop();
            location.assign(this.admin());
            throw new ApiError(401, "Login required");
          }
          return c;
        })
        .catch((e) => {
          this.configPromise = null;
          throw e;
        });
    return this.configPromise;
  }
  async verify(token) {
    const c = await this.request("/api/config", { challenge: token });
    if (!c.verified || !c.turnstile_verified)
      throw new Error("Verification failed");
    this.config = c;
    this.configPromise = Promise.resolve(c);
    this.gate = false;
    this.error = "";
  }
  async save(options) {
    const result = await this.request("/api/theme_options", {
      body: { theme_options: options },
    });
    this.config = { ...this.config, theme_options: result.theme_options };
    this.emit();
  }
  abort() {
    for (const c of this.controllers) c.abort();
  }
  stop() {
    this.stopped = true;
    this.generation++;
    clearTimeout(this.retry);
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    clearTimeout(this.limitTimer);
    this.pending.clear();
    this.liveRows = [];
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
  async enter(id = null, hours = 0.167, refresh = false) {
    this.stop();
    this.abort();
    if (this.scope !== id) {
      this.detail = null;
      this.history = [];
    }
    this.scope = id;
    this.hours = hours;
    this.stopped = false;
    const epoch = this.generation;
    if (this.timedOut) {
      this.status = "timeout";
      this.emit();
      return;
    }
    this.error = "";
    this.status = "connecting";
    this.emit();
    try {
      await this.init();
      if (epoch !== this.generation) return;
      if (this.gate) {
        this.status = "verification";
        this.emit();
        return;
      }
      if (id) {
        const [s, h] = await Promise.all([
          this.request("/api/server?id=" + encodeURIComponent(id)),
          this.request(
            `/api/history/all?id=${encodeURIComponent(id)}&hours=${hours}`,
          ),
        ]);
        if (epoch !== this.generation) return;
        this.detail = s;
        this.history = Array.isArray(h) ? h : [];
        this.historyCadence = historyCadence(this.history);
        this.sys = s.sysConfig || {};
        this.seedClocks(s);
      } else if (!this.servers || refresh) {
        const d = await this.request("/api/servers");
        if (epoch !== this.generation) return;
        this.servers = Array.isArray(d.servers) ? d.servers : [];
        this.stats = d.stats || {};
        this.sys = d.sysConfig || {};
        this.clocks.clear();
        for (const server of this.servers) this.seedClocks(server);
        this.statsSnapshot = this.snapshotTotals();
      }
      this.retryCount = 0;
      this.emit();
      if (!this.stopped && !this.timedOut) this.connect();
      else {
        this.status = "timeout";
        this.emit();
      }
    } catch (e) {
      if (epoch !== this.generation) return;
      this.error = e.message;
      this.status = this.gate ? "verification" : "error";
      this.emit();
    }
  }
  async range(hours) {
    if (!HOURS.includes(hours) || !this.scope) return;
    this.historyController?.abort();
    const controller = (this.historyController = new AbortController()),
      epoch = this.generation;
    const id = this.scope;
    this.hours = hours;
    const rows = await this.request(
      `/api/history/all?id=${encodeURIComponent(id)}&hours=${hours}`,
      { signal: controller.signal },
    );
    if (epoch === this.generation && !controller.signal.aborted) {
      this.history = Array.isArray(rows) ? rows : [];
      this.historyCadence = historyCadence(this.history);
      this.emit();
    }
  }
  connect() {
    if (this.stopped || this.timedOut || document.hidden) return;
    const url = new URL(this.base + "/api/ws");
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("subscribe", this.scope || "all");
    if (new URL(this.base).origin !== location.origin && this.token())
      url.searchParams.set("token", this.token());
    if (!this.scope && this.servers?.length > 500) {
      this.status = "error";
      this.error = "This backend exceeds the 500-node subscription limit";
      this.emit();
      return;
    }
    const ws = (this.ws = new WebSocket(url));
    this.status = "connecting";
    this.emit();
    ws.onopen = () => {
      if (ws !== this.ws) return;
      if (!this.scope)
        ws.send(
          JSON.stringify({
            type: "subscribe",
            scope: "all",
            ids: (this.servers || []).map((s) => String(s.id)),
          }),
        );
      this.status = "live";
      this.emit();
      const minutes = Number(this.config.frontend_ws_timeout_minutes);
      if (minutes > 0)
        this.limitTimer = setTimeout(() => {
          this.timedOut = true;
          this.stop();
          this.status = "timeout";
          this.emit();
        }, minutes * 60000);
    };
    ws.onmessage = (event) => {
      if (ws !== this.ws) return;
      try {
        const m = JSON.parse(event.data);
        if (m.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", ts: m.ts }));
          return;
        }
        if (m.type !== "batchUpdate" || !Array.isArray(m.updates)) return;
        for (const u of m.updates) {
          const id = String(u.serverId);
          const old =
            this.pending.get(id) ||
            (this.scope
              ? this.detail
              : this.servers?.find((s) => String(s.id) === id));
          if (!old || String(old.id) !== id) continue;
          const clocks = this.clocks.get(id) || {};
          this.clocks.set(id, clocks);
          this.pending.set(
            id,
            mergeSamples(
              old,
              Array.isArray(u.samples) ? u.samples : [],
              clocks,
            ),
          );
          if (this.scope === id) {
            this.liveRows ??= [];
            this.liveRows.push(
              ...(u.samples || []).map((s) => ({
                ...(s.data || s.payload || s.metrics || {}),
                timestamp: s.ts,
              })),
            );
          }
        }
        if (!this.flushTimer)
          this.flushTimer = setTimeout(() => this.flush(), 1000);
      } catch {
        /* malformed frames never replace the last good state */
      }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (ws !== this.ws) return;
      clearTimeout(this.limitTimer);
      this.ws = null;
      if (this.stopped || document.hidden) return;
      if (this.retryCount >= 8) {
        this.status = "error";
        this.error = "WebSocket disconnected";
        this.emit();
        return;
      }
      this.status = "reconnecting";
      this.emit();
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(30000, 1000 * 2 ** this.retryCount++) + Math.random() * 400,
      );
    };
  }
  flush() {
    this.flushTimer = null;
    if (this.stopped) return;
    if (this.scope) {
      this.detail = this.pending.get(this.scope) || this.detail;
      if (this.liveRows?.length) {
        const map = new Map(this.history.map((r) => [r.timestamp, r]));
        for (const r of this.liveRows)
          map.set(r.timestamp, { ...map.get(r.timestamp), ...r });
        const since = Date.now() - this.hours * 3600000;
        this.history = [...map.values()]
          .filter((r) => r.timestamp >= since)
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-1500);
        this.liveRows = [];
      }
    } else
      this.servers = (this.servers || []).map(
        (s) => this.pending.get(String(s.id)) || s,
      );
    this.pending.clear();
    if (!this.scope) this.updateTotals();
    this.emit();
  }
  seedClocks(server) {
    const timestamp = num(server.last_updated) ?? num(server.timestamp) ?? 0;
    this.clocks.set(String(server.id), Object.fromEntries(Object.keys(server).filter(k => fields.has(k)).map(k => [k, timestamp])));
  }
  snapshotTotals() {
    const live = (this.servers || []).filter((s) => online(s));
    return {
      online: live.length,
      offline: (this.servers || []).length - live.length,
      globalSpeedIn: live.reduce((n, s) => n + (num(s.net_in_speed) || 0), 0),
      globalSpeedOut: live.reduce((n, s) => n + (num(s.net_out_speed) || 0), 0),
    };
  }
  updateTotals() {
    if (!this.servers || !this.statsSnapshot) return;
    const next = this.snapshotTotals();
    for (const k of Object.keys(next))
      if (num(this.stats[k]) !== null)
        this.stats[k] = Math.max(
          0,
          Number(this.stats[k]) + next[k] - this.statsSnapshot[k],
        );
    this.statsSnapshot = next;
  }
  resume() {
    this.timedOut = false;
    this.stopped = false;
    this.retryCount = 0;
    if (this.scope ? !this.detail : !this.servers) {
      void this.enter(this.scope, this.hours || 0.167, true);
      return;
    }
    this.connect();
  }
}
