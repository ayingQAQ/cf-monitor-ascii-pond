import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  dest = join(root, "dist/assets/licenses");
await mkdir(dest, { recursive: true });
await copyFile(join(root, "LICENSE"), join(dest, "POND-MIT.txt"));
for (const n of await readdir(join(root, "licenses")))
  await copyFile(join(root, "licenses", n), join(dest, n));
const lock = JSON.parse(
    await readFile(join(root, "package-lock.json"), "utf8"),
  ),
  texts = ["CF POND — third-party runtime licenses"];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const folder = join(root, path),
    pkg = JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
  const names = (await readdir(folder)).filter((n) =>
    /^licen[sc]e(\.|$)/i.test(n),
  );
  if (!names.length) {
    if (pkg.name === "@vue/devtools-api") {
      texts.push(
        await readFile(join(root, "licenses/VUE-DEVTOOLS-MIT.txt"), "utf8"),
      );
      continue;
    }
    throw Error("Missing license: " + pkg.name);
  }
  texts.push(`\n${pkg.name}@${pkg.version}\n`);
  for (const n of names) texts.push(await readFile(join(folder, n), "utf8"));
}
await writeFile(join(dest, "DEPENDENCIES.txt"), texts.join("\n"));
const entries = await readdir(join(root, "dist"));
if (entries.some((n) => !["index.html", "assets"].includes(n)))
  throw Error("Unexpected output root");
console.log("Verified output: index.html + assets/; licenses included.");
