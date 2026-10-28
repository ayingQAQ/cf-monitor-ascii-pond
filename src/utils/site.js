import { ref } from "vue";
import { Client } from "../data/client.js";
export const revision = ref(0),
  lang = ref("zh");
export const t = (zh, en) => (lang.value === "en" ? en : zh);
const configured = document.querySelector('meta[name="apiBase"]')?.content;
export const bases = [
  ...new Set(
    (configured || location.origin).split(",").map((s) => {
      const u = new URL(s.trim());
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        throw Error("Invalid API base");
      return u.origin;
    }),
  ),
];
export const clients = bases.map(
  (b, i) => new Client(b, i, () => revision.value++),
);
export const defaults = {
  display_mode: "ambient",
  pond_enabled: true,
  feeding_enabled: true,
  show_expiry: true,
  hero_title: "",
  hero_eyebrow: "",
  hero_subtitle: "",
  notice: "",
};
export function options(config) {
  const v = config?.theme_options?.pond;
  const o = { ...defaults };
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const k of Object.keys(o))
      if (typeof v[k] === typeof o[k]) o[k] = v[k];
  if (!["ambient", "garden"].includes(o.display_mode))
    o.display_mode = "ambient";
  return o;
}
export function routeFor(s) {
  return {
    name: "server",
    params: { id: s.id },
    query: s._source ? { source: String(s._source) } : {},
  };
}
