import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Emulates the Max [js] host: one context per script, Global/Dict shared across them.
export function createMax({ seed = 1 } = {}) {
  const globals = new Map();
  const dicts = new Map();
  const sent = [];
  const outlets = [];
  const posts = [];
  const random = seededRandom(seed);
  const scripts = new Map();
  const receivers = new Map();

  function Global(name) {
    if (!globals.has(name)) globals.set(name, {});
    return globals.get(name);
  }

  function Dict(name) {
    if (!dicts.has(name)) dicts.set(name, { value: null, parse(json) { this.value = JSON.parse(json); } });
    return dicts.get(name);
  }

  function load(file, extraGlobals = {}) {
    const context = vm.createContext({
      ...extraGlobals,
      Global,
      Dict,
      post: (...a) => posts.push(a.join(" ")),
      outlet: (...a) => outlets.push({ script: file, args: a }),
      messnamed: (receiver, ...a) => {
        sent.push({ receiver, args: a });
        const script = receivers.get(receiver);
        if (script) script[a[0]](...a.slice(1));
      },
    });
    vm.runInContext("Math", context).random = random;
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
    scripts.set(file, context);
    return context;
  }

  // Routes messnamed(receiver, fn, ...args) to fn in a loaded script, like a [receive] wired to [js].
  function connect(receiver, file) {
    receivers.set(receiver, scripts.get(file));
  }

  return { load, connect, scripts, state: Global("GLOBAL_STATE"), dicts, sent, outlets, posts };
}
