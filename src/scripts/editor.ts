// Behaviour of the "Editor" lab version (src/pages/lab/editor.astro).
import { reduced } from "./reveal";

type FileData = { id: string; name: string; path: string; lang: string; hidden: boolean; lines: string[] };
type Data = {
  files: FileData[];
  answers: Record<string, { text: string; file: string }>;
  topics: [string, string][];
  log: [string, string][];
  links: { email: string; linkedin: string; github: string; repo: string };
  versions: [string, string][];
  who: string;
  exp: [string, string, string][];
};
const D: Data = JSON.parse(document.getElementById("ed-data")!.textContent!);

const $ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s)!;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const app = $(".app");
const code = $(".code");
const isMobile = () => matchMedia("(max-width: 760px)").matches;
const isNarrow = () => matchMedia("(max-width: 1180px)").matches;
const fileOf = (id: string) => D.files.find((f) => f.id === id);
const findFile = (name: string) => {
  const n = name.toLowerCase().replace(/^\.\//, "");
  return D.files.find((f) => [f.name, f.path, f.name.replace(/\.\w+$/, ""), f.id].some((x) => x.toLowerCase() === n));
};

// ---------------------------------------------------------------- toasts
const toast = (msg: string, actions: [string, () => void][] = [], ms = 9000) => {
  const box = el("div", "toast");
  box.append(el("p", "", msg));
  const acts = el("div", "acts");
  const close = () => { box.classList.add("out-t"); setTimeout(() => box.remove(), 220); };
  for (const [label, fn] of [...actions, ["Cerrar", () => {}] as [string, () => void]]) {
    const b = el("button", "", label);
    b.type = "button";
    b.onclick = () => { fn(); close(); };
    acts.append(b);
  }
  box.append(acts);
  $("[data-toasts]").append(box);
  setTimeout(close, ms);
};

// ---------------------------------------------------------------- editor: files, tabs, cursor
let active = "";
const paneOf = (id: string) => $(`[data-pane="${id}"]`);
const linesOf = (id: string) => $$(".lines > .ln:not([hidden])", paneOf(id));

const setCursor = (ln: HTMLElement) => {
  $$(".ln.cur").forEach((l) => l.classList.remove("cur"));
  ln.classList.add("cur");
  const all = linesOf(active);
  $("[data-pos]").textContent = `Ln ${all.indexOf(ln) + 1}, Col ${(ln.textContent ?? "").length + 1}`;
};
const goToLine = (n: number, flash = true) => {
  const all = linesOf(active);
  const ln = all[Math.max(0, Math.min(all.length - 1, n - 1))];
  if (!ln) return;
  setCursor(ln);
  ln.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  if (flash) { ln.classList.remove("flash"); void ln.offsetWidth; ln.classList.add("flash"); }
};

const outline = (f: FileData) => {
  const items: [number, number, string][] = [];
  f.lines.forEach((l, i) => {
    let m: RegExpMatchArray | null;
    if (f.lang === "md" && (m = l.match(/^(#+) (.*)/))) items.push([i, m[1].length - 1, m[2]]);
    else if (f.lang === "yaml" && (m = l.match(/^([\w-]+):/))) items.push([i, 0, m[1]]);
    else if (f.lang === "yaml" && (m = l.match(/^\s+- id: (\w+)/))) items.push([i, 1, m[1]]);
    else if (f.lang === "json" && (m = l.match(/"rol": "(.*)"/))) items.push([i, 0, m[1]]);
    else if (f.lang === "ts" && (m = l.match(/export const (\w+)/))) items.push([i, 0, m[1]]);
    else if (f.lang === "ts" && (m = l.match(/^\s+(\w+):/))) items.push([i, 1, m[1]]);
  });
  const ul = $("[data-outline]");
  ul.replaceChildren(...items.map(([i, d, text]) => {
    const li = el("li");
    const b = el("button", "", text);
    b.type = "button";
    b.style.setProperty("--d", String(d));
    b.onclick = () => goToLine(i + 1);
    li.append(b);
    return li;
  }));
};

// Minimap viewport follows the scroll position of the code area.
let miniQueued = false;
const updateMini = () => {
  miniQueued = false;
  const pane = active && active !== "empty" ? paneOf(active) : null;
  const mini = pane?.querySelector<HTMLElement>(".mini");
  if (!mini) return;
  const H = mini.scrollHeight, S = code.scrollHeight, C = code.clientHeight;
  const view = mini.querySelector<HTMLElement>("[data-mini-view]")!;
  view.style.setProperty("--vh", `${S <= C ? H : (C / S) * H}px`);
  view.style.setProperty("--vy", `${(code.scrollTop / S) * H}px`);
};
code.addEventListener("scroll", () => { if (!miniQueued) { miniQueued = true; requestAnimationFrame(updateMini); } }, { passive: true });
document.addEventListener("click", (e) => {
  const mini = (e.target as Element).closest<HTMLElement>(".mini");
  if (!mini) return;
  const y = e.clientY - mini.getBoundingClientRect().top;
  code.scrollTop = (y / mini.scrollHeight) * code.scrollHeight - code.clientHeight / 2;
});

// Inline suggestion ("ghost text"): appears after a pause on files that have one.
let ghostTimer = 0;
let ghost: HTMLElement | null = null;
const hideGhost = (state: "dismissed" | "" = "") => {
  clearTimeout(ghostTimer);
  if (ghost && !ghost.dataset.state) { ghost.hidden = true; if (state) ghost.dataset.state = state; }
  ghost = null;
};
const acceptGhost = () => {
  if (!ghost) return;
  const g = ghost;
  ghost = null;
  g.dataset.state = "done";
  g.classList.remove("ghost");
  g.querySelector("kbd")?.remove();
  setCursor(g);
};
const scheduleGhost = (id: string) => {
  hideGhost();
  const g = paneOf(id).querySelector<HTMLElement>("[data-ghost]");
  if (!g || g.dataset.state) return;
  ghostTimer = window.setTimeout(() => {
    if (active !== id) return;
    g.hidden = false;
    ghost = g;
    setCursor(g);
  }, reduced ? 300 : 1600);
};

const open = (id: string, line?: number) => {
  if (!fileOf(id) && id !== "empty") return;
  active = id;
  if (id !== "empty") $(`[data-tab="${id}"]`).hidden = false;
  $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === id));
  $$(".tree [data-open]").forEach((b) => b.classList.toggle("on", b.dataset.open === id));
  $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== id));
  hideGhost();
  if (id === "empty") { $("[data-crumb]").textContent = ""; $("[data-outline]").replaceChildren(); return; }
  const f = fileOf(id)!;
  const pane = paneOf(id);
  $("[data-crumb]").textContent = f.path.replace("/", " › ");
  $("[data-status-lang]").textContent = pane.dataset.lang!;
  $(`[data-tab="${id}"]`).scrollIntoView({ block: "nearest", inline: "nearest" });
  // Restart the line-by-line reveal each time a file is shown.
  if (!reduced) { pane.classList.remove("typing"); void pane.offsetWidth; pane.classList.add("typing"); }
  outline(f);
  code.scrollTop = 0;
  const all = linesOf(id);
  if (line) goToLine(line); else setCursor(all[all.length - 1]);
  scheduleGhost(id);
  requestAnimationFrame(updateMini);
  if (isMobile()) app.classList.remove("show-side");
};
const close = (id: string) => {
  $(`[data-tab="${id}"]`).hidden = true;
  if (active !== id) return;
  const left = $$(".tab:not([hidden])");
  open(left.length ? left[left.length - 1].dataset.tab! : "empty");
};

// ---------------------------------------------------------------- layout and views
const toggleSide = (force?: boolean) => {
  if (isMobile()) app.classList.toggle("show-side", force);
  else app.classList.toggle("no-side", force === undefined ? undefined : !force);
};
const sideVisible = () => (isMobile() ? app.classList.contains("show-side") : !app.classList.contains("no-side"));
let view = "explorer";
const showView = (v: string, fromActivity = false) => {
  if (fromActivity && v === view && sideVisible()) return toggleSide(false);
  view = v;
  $$(".activity [data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  $$("[data-view-pane]").forEach((s) => (s.hidden = s.dataset.viewPane !== v));
  toggleSide(true);
  if (v === "search") $<HTMLInputElement>("[data-search]").focus();
};
const togglePanel = (force?: boolean) => app.classList.toggle("no-panel", force === undefined ? undefined : !force);
const toggleAssist = (force?: boolean) => {
  if (isNarrow()) app.classList.toggle("show-assist", force);
  else app.classList.toggle("no-assist", force === undefined ? undefined : !force);
};
const panelTab = (name: string) => {
  togglePanel(true);
  $$("[data-panel-tab]").forEach((b) => b.classList.toggle("on", b.dataset.panelTab === name));
  $$("[data-panel-view]").forEach((v) => (v.hidden = v.dataset.panelView !== name));
  if (name === "terminal") $<HTMLInputElement>("[data-prompt] input").focus({ preventScroll: true });
};
const syncTheme = () => {
  const dark = document.documentElement.dataset.theme === "dark";
  $$("[data-theme-label]").forEach((b) => {
    b.textContent = dark ? "☀ Claro" : "☾ Oscuro";
    b.setAttribute("aria-pressed", String(dark));
  });
};
const setTheme = (dark?: boolean) => {
  const on = dark ?? document.documentElement.dataset.theme !== "dark";
  if (on) document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("ed-theme", on ? "dark" : "light"); } catch {}
  syncTheme();
  return on;
};

// ---------------------------------------------------------------- search view
// Accent- and case-insensitive, keeping string length so match positions map back.
const norm = (s: string) => s.split("").map((ch) => ch.normalize("NFD")[0].toLowerCase()).join("");
let searchTimer = 0;
const runSearch = (q: string) => {
  const out = $("[data-results]");
  const count = $("[data-search-count]");
  const nq = norm(q.trim());
  if (nq.length < 2) { out.replaceChildren(); count.textContent = "Escribe al menos 2 letras. Prueba con «agentes» o «Angular»."; return; }
  let total = 0, filesHit = 0;
  const nodes: HTMLElement[] = [];
  for (const f of D.files) {
    const hits = f.lines.map((l, i) => [i, l] as const).filter(([, l]) => norm(l).includes(nq));
    if (!hits.length) continue;
    filesHit++; total += hits.length;
    const head = el("li", "file");
    head.append(el("span", "", f.name), el("small", "", String(hits.length)));
    nodes.push(head);
    for (const [i, l] of hits.slice(0, 20)) {
      const li = el("li");
      const b = el("button");
      b.type = "button";
      const at = norm(l).indexOf(nq);
      const start = Math.max(0, at - 18);
      b.append((start ? "…" : "") + l.slice(start, at).trimStart(), el("mark", "", l.slice(at, at + nq.length)), l.slice(at + nq.length));
      b.onclick = () => open(f.id, i + 1);
      li.append(b);
      nodes.push(li);
    }
  }
  out.replaceChildren(...nodes);
  count.textContent = total ? `${total} resultado${total === 1 ? "" : "s"} en ${filesHit} archivo${filesHit === 1 ? "" : "s"}` : "Sin resultados.";
};
$<HTMLInputElement>("[data-search]").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => runSearch((e.target as HTMLInputElement).value), 120);
});

// ---------------------------------------------------------------- source control: message by email, career as history
$<HTMLFormElement>("[data-commit]").addEventListener("submit", (e) => {
  e.preventDefault();
  const box = (e.target as HTMLFormElement).elements.namedItem("msg") as HTMLTextAreaElement;
  const msg = box.value.trim();
  if (!msg) { box.focus(); toast("Escribe un mensaje primero."); return; }
  location.href = `mailto:${D.links.email}?subject=${encodeURIComponent("Hola Francisco (desde tu portfolio)")}&body=${encodeURIComponent(msg)}`;
  toast("Se abrió tu programa de correo con el mensaje.");
});
const openRole = (i: number) => {
  const f = fileOf("experiencia")!;
  const line = f.lines.findIndex((l) => l.includes(`"rol": "${D.exp[i][1]}"`));
  open("experiencia", line + 1);
};
$$("[data-commit-at]").forEach((b) => b.addEventListener("click", () => openRole(Number(b.dataset.commitAt))));

$<HTMLInputElement>("[data-ext-filter]").addEventListener("input", (e) => {
  const q = norm((e.target as HTMLInputElement).value.trim());
  $$("[data-ext]").forEach((li) => (li.hidden = !!q && !norm(li.textContent ?? "").includes(q)));
});

// ---------------------------------------------------------------- terminal
const out = $<HTMLOListElement>("[data-out]");
const print = (...parts: (string | Node)[]) => {
  const li = el("li", "new");
  li.append(...parts);
  out.append(li);
  while (out.children.length > 200) out.firstElementChild!.remove();
  out.scrollTop = out.scrollHeight;
  return li;
};
const promptLine = (cmd: string) => {
  const li = print();
  li.classList.add("cmd");
  li.append(el("b", "", "francisco@portfolio"), ` ~ $ ${cmd}`);
};
const link = (href: string, text: string) => {
  const a = el("a", "", text);
  a.href = href;
  if (href.startsWith("http")) a.rel = "noopener";
  return a;
};

// Agents run: replays the illustrative log in the terminal and the agents view.
let running = false;
const agentRows = $$("[data-agent]");
const mark = (who: string, state: "busy" | "done") => agentRows.forEach((a) => {
  if (a.dataset.agent === who) { a.classList.remove("busy", "done"); a.classList.add(state); }
  else if (state === "busy" && a.classList.contains("busy")) a.classList.replace("busy", "done");
});
const runAgents = () => {
  if (running) return;
  running = true;
  promptLine("npm run agentes -- --simulacion");
  agentRows.forEach((a) => a.classList.remove("busy", "done"));
  const dot = $(".activity [data-view='agents'] em");
  const status = $("[data-agents-status]");
  const bar = $("[data-progress]");
  dot.hidden = false;
  let i = 0;
  const step = () => {
    if (document.hidden) { setTimeout(step, 400); return; }
    const [who, msg] = D.log[i];
    const last = i === D.log.length - 1;
    const li = print(el("b", "who", who), msg);
    if (last) li.classList.add("ok");
    mark(who, last ? "done" : "busy");
    bar.style.setProperty("--p", String((i + 1) / D.log.length));
    status.textContent = last ? "● 5 agentes" : `◌ ${who}…`;
    i++;
    if (!last) { setTimeout(step, reduced ? 0 : 900); return; }
    running = false;
    dot.hidden = true;
    agentRows.forEach((a) => a.classList.contains("busy") && a.classList.replace("busy", "done"));
    toast("Simulación terminada: los agentes entregaron con evidencia y una persona aprobó.", [["Ver contacto", () => open("contacto")]]);
  };
  setTimeout(step, reduced ? 0 : 500);
};

const COMMANDS = ["help", "ls", "cat", "open", "code", "git log", "npm run agentes", "agentes", "contacto", "whoami", "theme", "chat", "plano", "bento", "clear", "echo", "pwd", "date"];
const help: [string, string][] = [
  ["help", "esta ayuda"], ["ls", "lista los archivos"], ["cat <archivo>", "muestra un archivo"], ["open <archivo>", "lo abre en el editor"],
  ["git log", "historial de experiencia"], ["npm run agentes", "corre la simulación de agentes"], ["contacto", "correo, LinkedIn y GitHub"],
  ["whoami", "quién es"], ["theme oscuro|claro", "cambia el tema"], ["chat | plano | bento", "abre otra versión del sitio"], ["clear", "limpia la terminal"],
];
const exec = (raw: string) => {
  const line = raw.trim();
  promptLine(line);
  if (!line) return;
  const [cmd, ...rest] = line.split(/\s+/);
  const arg = rest.join(" ");
  switch (cmd.toLowerCase()) {
    case "help": help.forEach(([c, d]) => print(c.padEnd(22), d)); break;
    case "ls": print(D.files.filter((f) => !f.hidden && !f.path.includes("/")).map((f) => f.name).join("   ") + "   lab/"); break;
    case "pwd": print("/home/francisco/portfolio"); break;
    case "date": print(new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" }) + " (Temuco)"); break;
    case "echo": print(arg); break;
    case "whoami": print(D.who); break;
    case "clear": out.replaceChildren(); break;
    case "cat": {
      const f = findFile(arg);
      if (!f) { print(el("span", "err", `cat: ${arg || "falta el archivo"}: no existe`)); break; }
      f.lines.forEach((l) => print(l || " "));
      break;
    }
    case "open": case "code": {
      const f = findFile(arg);
      if (!f) { print(el("span", "err", `${cmd}: ${arg || "falta el archivo"}: no existe`)); break; }
      open(f.id);
      print(`abriendo ${f.path}`);
      break;
    }
    case "git":
      if (rest[0] !== "log") { print(el("span", "err", "solo está disponible: git log")); break; }
      D.exp.forEach(([dates, role, company], i) => print(el("b", "who", i === 0 ? "HEAD" : "·"), `${role} @ ${company} — ${dates}`));
      break;
    case "npm": if (line.includes("agentes")) runAgents(); else print(el("span", "err", "prueba: npm run agentes")); break;
    case "agentes": runAgents(); break;
    case "contacto":
      print("correo    ", link(`mailto:${D.links.email}`, D.links.email));
      print("linkedin  ", link(D.links.linkedin, D.links.linkedin.replace("https://www.", "")));
      print("github    ", link(D.links.github, D.links.github.replace("https://", "")));
      break;
    case "theme": {
      const dark = /^(oscuro|dark)$/i.test(arg) ? true : /^(claro|light)$/i.test(arg) ? false : undefined;
      print(`tema ${setTheme(dark) ? "oscuro" : "claro"}`);
      break;
    }
    case "chat": case "plano": case "bento": {
      const href = D.versions.find(([n]) => n === cmd.toLowerCase())?.[1];
      if (href) { print(`abriendo ${cmd}…`); setTimeout(() => (location.href = href), 300); }
      break;
    }
    default: print(el("span", "err", `comando no encontrado: ${cmd}. Escribe help.`));
  }
};
const history: string[] = [];
let hIdx = 0;
const promptForm = $<HTMLFormElement>("[data-prompt]");
const promptInput = promptForm.querySelector("input")!;
promptForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = promptInput.value;
  if (v.trim()) history.push(v);
  hIdx = history.length;
  promptInput.value = "";
  exec(v);
});
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" && history.length) { e.preventDefault(); hIdx = Math.max(0, hIdx - 1); promptInput.value = history[hIdx]; }
  else if (e.key === "ArrowDown") { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); promptInput.value = history[hIdx] ?? ""; }
  else if (e.key === "Tab") {
    e.preventDefault();
    const v = promptInput.value;
    const m = v.match(/^(cat|open|code)\s+(\S*)$/);
    const pool = m ? D.files.map((f) => f.path) : COMMANDS;
    const stem = m ? m[2] : v;
    const hits = pool.filter((x) => x.toLowerCase().startsWith(stem.toLowerCase()));
    if (hits.length === 1) promptInput.value = m ? `${m[1]} ${hits[0]}` : hits[0] + " ";
    else if (hits.length > 1) print(hits.join("   "));
  }
});
$(".panel-body[data-panel-view='terminal']").addEventListener("click", (e) => {
  if (!(e.target as Element).closest("a") && !getSelection()?.toString()) promptInput.focus({ preventScroll: true });
});

// ---------------------------------------------------------------- assistant
const KEYS: [RegExp, string][] = [
  [/contact|correo|mail|linkedin|github|escrib/i, "contacto"],
  [/agent|rol|\bia\b|claude|mcp/i, "agentes"],
  [/experienc|empresa|\bcv\b|trayectoria|trabaj[oó] en/i, "experiencia"],
  [/proyecto|public|lab|repo|c[oó]digo|portfolio|versi/i, "lab"],
  [/m[eé]tod|trabaja|c[oó]mo|proces|regla/i, "metodo"],
  [/qui[eé]n|sobre|perfil|francisco/i, "quien"],
];
const thread = $("[data-thread]");
const ask = (topic: string, question: string) => {
  toggleAssist(true);
  thread.append(el("div", "bubble user", question));
  const bot = el("div", "bubble bot thinking", "leyendo archivos…");
  thread.append(bot);
  thread.scrollTop = thread.scrollHeight;
  const a = D.answers[topic] ?? D.answers.nose;
  setTimeout(() => {
    bot.classList.remove("thinking");
    bot.textContent = "";
    const words = a.text.split(" ");
    const txt = document.createTextNode("");
    bot.append(txt);
    let i = 0;
    const done = () => {
      txt.data = a.text;
      if (a.file) {
        const f = fileOf(a.file)!;
        const b = el("button", "open", `Abrir ${f.name} →`);
        b.type = "button";
        b.onclick = () => open(f.id);
        bot.append(el("br"), b);
      }
      thread.scrollTop = thread.scrollHeight;
    };
    if (reduced) return done();
    const id = setInterval(() => {
      i += 2;
      txt.data = words.slice(0, i).join(" ");
      thread.scrollTop = thread.scrollHeight;
      if (i >= words.length) { clearInterval(id); done(); }
    }, 45);
  }, reduced ? 0 : 650);
};
$$("[data-ask]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.ask!, b.dataset.q!)));
$<HTMLFormElement>("[data-ask-form]").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const input = form.elements.namedItem("q") as HTMLInputElement;
  const q = input.value.trim();
  if (!q) return;
  ask(KEYS.find(([re]) => re.test(q))?.[1] ?? "nose", q);
  input.value = "";
});

// ---------------------------------------------------------------- command palette
type Item = { label: string; desc?: string; keys?: string; run: () => void };
const commands: Item[] = [
  { label: "Ver: alternar barra lateral", keys: "Ctrl+B", run: () => toggleSide() },
  { label: "Ver: alternar panel", keys: "Ctrl+J", run: () => togglePanel() },
  { label: "Ver: alternar asistente", keys: "Ctrl+I", run: () => toggleAssist() },
  { label: "Ver: alternar minimapa", run: () => app.classList.toggle("no-mini") },
  { label: "Ver: explorador", keys: "Ctrl+Shift+E", run: () => showView("explorer") },
  { label: "Ver: buscar en los archivos", keys: "Ctrl+Shift+F", run: () => showView("search") },
  { label: "Ver: historial de experiencia", keys: "Ctrl+Shift+G", run: () => showView("scm") },
  { label: "Ver: extensiones (stack)", keys: "Ctrl+Shift+X", run: () => showView("ext") },
  { label: "Ver: agentes", run: () => showView("agents") },
  { label: "Agentes: ejecutar simulación", run: () => { panelTab("terminal"); runAgents(); } },
  { label: "Preferencias: alternar tema claro u oscuro", run: () => setTheme() },
  { label: "Ir a línea…", keys: "Ctrl+G", run: () => openPalette(":") },
  { label: "Terminal: enfocar", keys: "Ctrl+`", run: () => panelTab("terminal") },
  { label: "Terminal: limpiar", run: () => out.replaceChildren() },
  { label: "Ayuda: atajos de teclado", run: () => open("atajos") },
  { label: "Contacto: escribir un correo", run: () => (location.href = `mailto:${D.links.email}`) },
  ...D.versions.map(([name, href]) => ({ label: `Abrir versión: ${name[0].toUpperCase()}${name.slice(1)}`, run: () => (location.href = href) })),
];
const palette = $("[data-palette]");
const pInput = $<HTMLInputElement>("[data-palette-input]");
const pList = $("[data-palette-list]");
let pItems: Item[] = [];
let pSel = 0;
// A literal substring always outranks a scattered match; among scattered ones, earlier and tighter wins.
const fuzzy = (q: string, s: string) => {
  const ns = norm(s), nq = norm(q);
  const lit = ns.indexOf(nq);
  if (lit >= 0) return { score: lit / 100, at: [...Array(nq.length).keys()].map((k) => lit + k) };
  const at: number[] = [];
  let j = 0;
  for (let i = 0; i < ns.length && j < nq.length; i++) if (ns[i] === nq[j]) { at.push(i); j++; }
  if (j < nq.length) return null;
  let score = 1000 + (at[0] ?? 0);
  for (let k = 1; k < at.length; k++) score += at[k] - at[k - 1] - 1;
  return { score, at };
};
const renderPalette = () => {
  const v = pInput.value;
  let items: Item[];
  let q = v;
  if (v.startsWith(":")) {
    const n = parseInt(v.slice(1), 10);
    const max = active && active !== "empty" ? linesOf(active).length : 0;
    items = max ? [{ label: Number.isFinite(n) ? `Ir a la línea ${Math.min(Math.max(n, 1), max)}` : `Escribe un número de línea (1–${max})`, run: () => Number.isFinite(n) && goToLine(n) }] : [{ label: "No hay un archivo abierto", run: () => {} }];
    q = "";
  } else if (v.startsWith(">")) {
    items = commands; q = v.slice(1).trim();
  } else {
    items = D.files.map((f) => ({ label: f.name, desc: f.path, run: () => open(f.id) }));
  }
  const scored = items.map((it) => ({ it, m: q ? fuzzy(q, it.label) : { score: 0, at: [] as number[] } })).filter((x) => x.m);
  scored.sort((a, b) => a.m!.score - b.m!.score);
  pItems = scored.map((x) => x.it);
  pSel = Math.min(pSel, Math.max(0, pItems.length - 1));
  pList.replaceChildren(...scored.map(({ it, m }, i) => {
    const li = el("li");
    li.setAttribute("role", "option");
    if (i === pSel) li.classList.add("sel");
    const label = el("span");
    [...it.label].forEach((ch, k) => label.append(m!.at.includes(k) ? el("u", "", ch) : ch));
    li.append(label);
    if (it.desc) li.append(el("small", "", it.desc));
    if (it.keys) li.append(el("kbd", "", it.keys));
    li.onclick = () => { closePalette(); it.run(); };
    return li;
  }));
  if (!scored.length) pList.append(el("li", "", "Sin coincidencias"));
};
const openPalette = (prefix = ">") => {
  palette.hidden = false;
  pInput.value = prefix;
  pSel = 0;
  renderPalette();
  pInput.focus();
};
const closePalette = () => { palette.hidden = true; };
pInput.addEventListener("input", () => { pSel = 0; renderPalette(); });
pInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); pSel = Math.min(pItems.length - 1, pSel + 1); renderPalette(); pList.querySelector(".sel")?.scrollIntoView({ block: "nearest" }); }
  else if (e.key === "ArrowUp") { e.preventDefault(); pSel = Math.max(0, pSel - 1); renderPalette(); pList.querySelector(".sel")?.scrollIntoView({ block: "nearest" }); }
  else if (e.key === "Enter") { e.preventDefault(); const it = pItems[pSel]; closePalette(); it?.run(); }
  else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
});
palette.addEventListener("mousedown", (e) => { if (e.target === palette) closePalette(); });

// ---------------------------------------------------------------- clicks and keys
document.addEventListener("click", (e) => {
  const t = e.target as Element;
  const x = t.closest<HTMLElement>("[data-close]");
  if (x) return close(x.dataset.close!);
  const o = t.closest<HTMLElement>("[data-open]");
  if (o) return open(o.dataset.open!);
  const v = t.closest<HTMLElement>("[data-view]");
  if (v) return showView(v.dataset.view!, !!v.closest(".activity"));
  const p = t.closest<HTMLElement>("[data-panel-tab]");
  if (p) return panelTab(p.dataset.panelTab!);
  const cmd = t.closest<HTMLElement>("[data-cmd]")?.dataset.cmd;
  if (cmd === "palette") return openPalette(">");
  if (cmd === "sidebar") return toggleSide();
  if (cmd === "panel") return togglePanel();
  if (cmd === "assist") return toggleAssist();
  if (cmd === "theme") return void setTheme();
  if (cmd === "goto") return openPalette(":");
  if (cmd === "run") { panelTab("terminal"); return runAgents(); }
  const ln = t.closest<HTMLElement>(".lines > .ln");
  if (ln && !t.closest("a")) { if (ln === ghost) acceptGhost(); else setCursor(ln); }
  // Tapping outside a floating sidebar or assistant closes it on small screens.
  if (isMobile() && !t.closest(".side, .activity")) app.classList.remove("show-side");
  if (isNarrow() && !t.closest(".assist, [data-ask], .layout")) app.classList.remove("show-assist");
});
// Middle click closes a tab, as in the real thing.
document.addEventListener("auxclick", (e) => {
  const tab = (e.target as Element).closest<HTMLElement>(".tab");
  if (e.button === 1 && tab) { e.preventDefault(); close(tab.dataset.tab!); }
});

document.addEventListener("keydown", (e) => {
  const typing = (e.target as Element).closest("input, textarea");
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const go = (fn: () => void) => { e.preventDefault(); fn(); };
  if (!palette.hidden) return;
  if (mod && e.shiftKey && k === "p") return go(() => openPalette(">"));
  if (e.key === "F1") return go(() => openPalette(">"));
  if (mod && e.shiftKey && k === "e") return go(() => showView("explorer"));
  if (mod && e.shiftKey && k === "f") return go(() => showView("search"));
  if (mod && e.shiftKey && k === "g") return go(() => showView("scm"));
  if (mod && e.shiftKey && k === "x") return go(() => showView("ext"));
  if (mod && !e.shiftKey && k === "p") return go(() => openPalette(""));
  if (mod && !e.shiftKey && k === "g") return go(() => openPalette(":"));
  if (mod && !e.shiftKey && k === "b") return go(() => toggleSide());
  if (mod && !e.shiftKey && (k === "j" || k === "`")) return go(() => togglePanel());
  if (mod && !e.shiftKey && k === "i") return go(() => toggleAssist());
  if (typing) return;
  if (e.key === "Tab" && ghost) return go(acceptGhost);
  if (e.key === "Escape") { if (ghost) return go(() => hideGhost("dismissed")); app.classList.remove("show-side", "show-assist"); return; }
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && active && active !== "empty") {
    const all = linesOf(active);
    const cur = all.findIndex((l) => l.classList.contains("cur"));
    const next = all[Math.max(0, Math.min(all.length - 1, cur + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) go(() => { setCursor(next); next.scrollIntoView({ block: "nearest" }); });
  }
});

// ---------------------------------------------------------------- start
syncTheme();
open("readme");
print("Bienvenido. Escribe ", el("b", "", "help"), " para ver los comandos.");
setTimeout(runAgents, reduced ? 0 : 1400);
if (!isMobile()) {
  let seen = false;
  try { seen = sessionStorage.getItem("ed-tip") === "1"; sessionStorage.setItem("ed-tip", "1"); } catch {}
  if (!seen) setTimeout(() => toast("Consejo: Ctrl+Shift+P abre la paleta de comandos. Prueba también la terminal y el asistente.", [["Ver atajos", () => open("atajos")]], 12000), 2600);
}
