export const num = (v) =>
  v === null ||
  v === undefined ||
  v === "" ||
  typeof v === "boolean" ||
  !Number.isFinite(Number(v))
    ? null
    : Number(v);
export const on = (v) => v === true || v === "true";
export function bytes(v) {
  v = num(v);
  if (v === null || v < 0) return "—";
  const i = Math.max(0, Math.min(5, Math.floor(Math.log2(v || 1) / 10)));
  return `${Number((v / 1024 ** i).toFixed(i ? 1 : 0))} ${["B", "KB", "MB", "GB", "TB", "PB"][i]}`;
}
export const rate = (v) => (num(v) === null ? "—" : bytes(v) + "/s");
export const pct = (v, total) =>
  num(v) === null || !(num(total) > 0) ? null : (num(v) / num(total)) * 100;
export const percent = (v) => (num(v) === null ? "—" : num(v).toFixed(1) + "%");
export const online = (s, now = Date.now()) =>
  num(s.last_updated) !== null && now - num(s.last_updated) < 300000;
export function usage(s) {
  const rx = num(s.net_rx_monthly),
    tx = num(s.net_tx_monthly);
  if (s.traffic_calc_type === "dl") return rx;
  if (s.traffic_calc_type === "ul") return tx;
  if (rx === null || tx === null) return null;
  return s.traffic_calc_type === "max" ? Math.max(rx, tx) : rx + tx;
}
// Current backend stores bare quotas in GB; also accept unit-bearing legacy values.
export function quota(v) {
  const m = String(v ?? "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  return m
    ? Number(m[1]) *
        1024 **
          (m[2] ? ["B", "KB", "MB", "GB", "TB"].indexOf(m[2].toUpperCase()) : 3)
    : null;
}
export function gpu(v) {
  try {
    const a = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(a) ? a.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
}
export const probeKeys = [
  "ct",
  "cu",
  "cm",
  "bd",
  "node_1",
  "node_2",
  "node_3",
  "node_4",
];
export const probeName = (key, c) =>
  c[key.startsWith("node_") ? key + "_name" : "custom_" + key + "_name"] ||
  { ct: "CT", cu: "CU", cm: "CM", bd: "BGP" }[key] ||
  key.replace("node_", "Node ");
export const probeValue = (v) =>
  v === null
    ? null
    : v === false || v === undefined || v === ""
      ? false
      : (num(v) ?? false);
export const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const write = (key, v) => {
  try {
    v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v);
  } catch {}
};
