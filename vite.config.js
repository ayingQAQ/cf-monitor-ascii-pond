import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    base: "./",
    plugins: [
      vue(),
      {
        name: "pond-runtime-config",
        transformIndexHtml(html) {
          const tags = [
            ["apiBase", env.API_BASE],
            ["pond:version", `v${version}`],
            ["pond:title", env.TITLE],
            ["pond:background", env.BACKGROUND_IMAGE],
          ]
            .filter(([, v]) => v)
            .map(([name, content]) => ({
              tag: "meta",
              attrs: { name, content },
              injectTo: "head",
            }));
          const origins = (value) =>
            (value || "")
              .split(/[\s,]+/)
              .filter(Boolean)
              .map((v) => {
                const u = new URL(v);
                if (!["https:", "http:"].includes(u.protocol))
                  throw Error("Invalid CSP origin");
                return u.origin;
              })
              .join(" ");
          if (env.CSP_API || env.CSP_STATIC) {
            const api = origins(
                [env.API_BASE, env.CSP_API].filter(Boolean).join(","),
              ),
              stat = origins(env.CSP_STATIC);
            tags.push({
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: `default-src 'self'; script-src 'self' https://challenges.cloudflare.com ${stat}; style-src 'self' 'unsafe-inline' ${stat}; img-src 'self' data: ${stat}; font-src 'self' ${stat}; connect-src 'self' ${api} ${api.replaceAll("https://", "wss://").replaceAll("http://", "ws://")}; frame-src https://challenges.cloudflare.com`,
              },
              injectTo: "head",
            });
          }
          return {
            html: env.TITLE
              ? html.replace(
                  "<title>Pond</title>",
                  `<title>${escape(env.TITLE)}</title>`,
                )
              : html,
            tags,
          };
        },
      },
    ],
  };
});
