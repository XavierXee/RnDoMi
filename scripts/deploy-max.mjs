import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["src/core", "src/max"].map((dir) => path.join(root, dir));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const dest = process.env.RNDOMI_MAX_DIR || pkg.config.maxDeployDir;
const args = new Set(process.argv.slice(2));
const force = args.has("--force");

function sourceFiles() {
  const files = new Map();
  for (const dir of sources) {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      if (files.has(name)) throw new Error(`Duplicate file name across targets: ${name}`);
      files.set(name, path.join(dir, name));
    }
  }
  return files;
}

const isDevice = (name) => name.endsWith(".amxd");

function copy(name, from) {
  const to = path.join(dest, name);
  if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) return;
  // Max saves edits to the deployed copies; never clobber them silently.
  if (!force && fs.existsSync(to) && fs.statSync(to).mtimeMs > fs.statSync(from).mtimeMs) {
    const hint = isDevice(name) ? "npm run pull:device" : "copy it back to src";
    console.warn(`skip ${name}: deployed copy is newer (${hint}, or --force)`);
    return;
  }
  fs.copyFileSync(from, to);
  console.log(`copied ${name}`);
}

function deploy() {
  fs.mkdirSync(dest, { recursive: true });
  const files = sourceFiles();
  for (const [name, from] of files) copy(name, from);
  for (const name of fs.readdirSync(dest)) {
    if (name.startsWith(".") || files.has(name)) continue;
    fs.rmSync(path.join(dest, name), { recursive: true });
    console.log(`removed ${name}`);
  }
}

function pull() {
  for (const [name, to] of sourceFiles()) {
    const from = path.join(dest, name);
    if (!isDevice(name) || !fs.existsSync(from)) continue;
    fs.copyFileSync(from, to);
    console.log(`pulled ${name} -> ${path.relative(root, to)}`);
  }
}

function watch() {
  deploy();
  const pending = new Map();
  for (const dir of sources) {
    fs.watch(dir, (_, name) => {
      if (!name || name.startsWith(".")) return;
      clearTimeout(pending.get(name));
      pending.set(name, setTimeout(() => {
        const from = path.join(dir, name);
        if (fs.existsSync(from)) copy(name, from);
        else if (fs.existsSync(path.join(dest, name))) {
          fs.rmSync(path.join(dest, name));
          console.log(`removed ${name}`);
        }
      }, 100));
    });
  }
  console.log(`watching src -> ${dest}`);
}

if (args.has("--pull")) pull();
else if (args.has("--watch")) watch();
else deploy();
