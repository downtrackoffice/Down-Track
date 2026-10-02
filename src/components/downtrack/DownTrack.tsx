import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Home, ChevronRight, Plus, FolderPlus, PencilLine, Trash2, Settings as Gear,
  Folder, FolderOpen, MoreHorizontal, Undo2, Save, X, Music2, Film, Download, Minus, Square, CircleCheck, Clock, Loader2, FolderInput,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getDict, isRtl } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { estSize, fmtDur, fmtSize, thumb, uid, type Node } from "./data";

const ROOTS_KEY = "downtrack.roots";
import { AddMediaDialog, type Draft } from "./AddMediaDialog";
import { SettingsDialog, type Settings } from "./SettingsDialog";
import {
  isTauri, hasFsAccess, pickFolder, scan, diskPath, sanitize, windowAction,
  mkdir as nativeMkdir, remove as nativeRemove, rename as nativeRename, download as nativeDownload,
  type RootRef, type ScanEntry,
} from "@/lib/native";

const DEFAULT_SETTINGS: Settings = { theme: "system", format: "mp3", audio: "320k", video: "1080p", lang: "he" };

function descendants(nodes: Node[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; }
  }
  return out;
}

export function DownTrack() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [hIdx, setHIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folderDlg, setFolderDlg] = useState<{ parent: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [realBusy, setRealBusy] = useState(false);
  const rootsRef = useRef(new Map<string, RootRef>());
  const t = getDict(settings.lang);
  const rtl = isRtl(settings.lang);
  const current = history[hIdx] ?? null;

  // settings persistence (app preferences only)
  useEffect(() => {
    try { const raw = localStorage.getItem("downtrack.settings"); if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); } catch { /* ignore */ }
  }, []);
  useEffect(() => { localStorage.setItem("downtrack.settings", JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.documentElement.lang = settings.lang;
  }, [rtl, settings.lang]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const roots = nodes.filter((n) => n.parentId === null);
  const items = nodes
    .filter((n) => n.parentId === current)
    .sort((a, b) => (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1) || a.name.localeCompare(b.name));
  const pending = nodes.filter((n) => n.status === "pending");
  const downloading = nodes.filter((n) => n.status === "downloading");

  const pathOf = (id: string | null): Node[] => {
    const out: Node[] = [];
    let n = id ? byId.get(id) : undefined;
    while (n) { out.unshift(n); n = n.parentId ? byId.get(n.parentId) : undefined; }
    return out;
  };
  const allFolders = nodes.filter((n) => n.kind === "folder" && n.op !== "delete")
    .map((f) => ({ id: f.id, path: pathOf(f.id).map((p) => p.name).join(" / ") }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const navigate = (id: string | null) => {
    if (id === current) return;
    const h = [...history.slice(0, hIdx + 1), id];
    setHistory(h); setHIdx(h.length - 1); setSelected(null); setEditing(null);
  };

  // ---------- staging operations ----------
  const addMedia = (drafts: Draft[], folderId: string) => {
    const created: Node[] = drafts.map((d) => ({
      id: uid(), parentId: folderId, name: `${d.title}.${d.format}`, kind: d.format, ytId: d.ytId, url: d.url, thumbUrl: d.thumb,
      duration: d.duration, quality: d.quality, size: estSize(d.duration, d.quality), status: "pending", op: "add",
    }));
    setNodes((ns) => [...ns, ...created]);
    if (folderId !== current) navigate(folderId);
  };

  const addFolder = (name: string, parent: string | null) => {
    setNodes((ns) => [...ns, { id: uid(), parentId: parent, name, kind: "folder", status: "pending", op: "add" }]);
  };

  const rename = (id: string, name: string) => {
    name = name.trim();
    setEditing(null);
    if (!name) return;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id || n.name === name) return n;
      if (n.op === "add") return { ...n, name };
      const original = n.originalName ?? n.name;
      if (name === original) return { ...n, name, originalName: undefined, op: undefined, status: "saved" };
      return { ...n, name, originalName: original, op: "rename", status: "pending" };
    }));
  };

  const remove = (id: string) => {
    setNodes((ns) => {
      const n = ns.find((x) => x.id === id);
      if (!n) return ns;
      if (n.op === "add") { const d = descendants(ns, id); return ns.filter((x) => !d.has(x.id)); }
      return ns.map((x) => (x.id === id ? { ...x, name: x.originalName ?? x.name, originalName: undefined, op: "delete", status: "pending" } : x));
    });
    if (selected === id) setSelected(null);
  };

  const revert = (id: string) => {
    setNodes((ns) => {
      const n = ns.find((x) => x.id === id);
      if (!n) return ns;
      if (n.op === "add") { const d = descendants(ns, id); return ns.filter((x) => !d.has(x.id)); }
      return ns.map((x) => (x.id === id ? { ...x, name: x.originalName ?? x.name, originalName: undefined, op: undefined, status: "saved" } : x));
    });
  };

  const discardAll = () => {
    setNodes((ns) => {
      const drop = new Set<string>();
      ns.filter((n) => n.op === "add").forEach((n) => descendants(ns, n.id).forEach((d) => drop.add(d)));
      return ns.filter((n) => !drop.has(n.id)).map((n) => n.status === "pending"
        ? { ...n, name: n.originalName ?? n.name, originalName: undefined, op: undefined, status: "saved" } : n);
    });
    if (current && !byId.has(current)) navigate(null);
    toast(t.discarded);
  };

  // ---------- disk-backed folders (Tauri path or browser directory handle) ----------
  const rootRefOf = (n: Node, map: Map<string, Node>): { ref: RootRef; root: Node } | null => {
    let cur: Node | undefined = n;
    while (cur?.parentId) cur = map.get(cur.parentId);
    const ref = cur ? rootsRef.current.get(cur.id) : undefined;
    return cur && ref ? { ref, root: cur } : null;
  };
  /** Names below the root folder; `original` uses pre-rename names of ancestors. */
  const partsOf = (n: Node, map: Map<string, Node>, original: boolean) => {
    const out: string[] = [];
    let cur: Node | undefined = n;
    while (cur?.parentId) { out.unshift(original ? cur.originalName ?? cur.name : cur.name); cur = map.get(cur.parentId); }
    return out;
  };

  const loadRoot = async (name: string, ref: RootRef): Promise<{ id: string; created: Node[] }> => {
    const id = uid();
    rootsRef.current.set(id, ref);
    const created: Node[] = [{ id, parentId: null, name, kind: "folder", status: "saved" }];
    let entries: ScanEntry[] = [];
    try { entries = await scan(ref); } catch (e) { toast.error(String(e)); }
    const idByPath = new Map<string, string>([["", id]]);
    for (const e of entries) {
      const pid = idByPath.get(e.parts.join("/"));
      if (!pid) continue;
      const nid = uid();
      if (e.isDir) {
        idByPath.set([...e.parts, e.name].join("/"), nid);
        created.push({ id: nid, parentId: pid, name: e.name, kind: "folder", status: "saved" });
      } else {
        created.push({ id: nid, parentId: pid, name: e.name, kind: /\.mp4$/i.test(e.name) ? "mp4" : "mp3", size: e.size, status: "saved" });
      }
    }
    return { id, created };
  };

  const addRoot = async () => {
    if (!isTauri() && !hasFsAccess()) { setFolderDlg({ parent: null }); return; }
    const picked = await pickFolder();
    if (!picked) return;
    const { id, created } = await loadRoot(picked.name, picked.ref);
    setNodes((ns) => [...ns, ...created]);
    navigate(id);
  };

  // Restore saved root folders on startup.
  const [rootsLoaded, setRootsLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(ROOTS_KEY) ?? "[]") as { name: string; path?: string }[];
        const all: Node[] = [];
        for (const r of saved) {
          if (r.path && isTauri()) all.push(...(await loadRoot(r.name, { path: r.path })).created);
          else all.push({ id: uid(), parentId: null, name: r.name, kind: "folder", status: "saved" });
        }
        if (all.length) setNodes((ns) => [...all, ...ns]);
      } catch { /* ignore */ }
      setRootsLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!rootsLoaded) return;
    const roots = nodes.filter((n) => n.parentId === null && !(n.op === "add" && n.status === "pending") && n.op !== "delete")
      .map((n) => ({ name: n.originalName ?? n.name, path: rootsRef.current.get(n.id)?.path }));
    localStorage.setItem(ROOTS_KEY, JSON.stringify(roots));
  }, [nodes, rootsLoaded]);

  const finish = (id: string, patch: Partial<Node> = {}) =>
    setNodes((ns) => ns.map((x) => (x.id === id ? { ...x, status: "saved", op: undefined, originalName: undefined, progress: undefined, real: undefined, ...patch } : x)));

  const saveAll = async () => {
    if (!pending.length) return;
    setSaving(true);
    const map = new Map(nodes.map((n) => [n.id, n]));
    const tauri = isTauri();
    // Items executed for real on disk; everything else uses the in-app simulation.
    const asyncOps = pending.filter((n) => {
      const r = rootRefOf(n, map);
      if (!r) return false;
      if (n.op === "add" && n.kind !== "folder") return tauri && !!r.ref.path && !!n.url;
      return true;
    });
    const asyncIds = new Set(asyncOps.map((n) => n.id));
    setNodes((ns) => {
      const drop = new Set<string>();
      ns.filter((n) => n.op === "delete" && !asyncIds.has(n.id)).forEach((n) => descendants(ns, n.id).forEach((d) => drop.add(d)));
      return ns.filter((n) => !drop.has(n.id)).map((n) => {
        if (n.status !== "pending") return n;
        if (asyncIds.has(n.id)) return n.op === "add" && n.kind !== "folder" ? { ...n, status: "downloading", progress: 0, real: true } : n;
        if (n.op === "add" && n.kind !== "folder") return { ...n, status: "downloading", progress: 0 };
        return { ...n, status: "saved", op: undefined, originalName: undefined };
      });
    });
    if (!asyncOps.length) return;

    setRealBusy(true);
    const fail = (n: Node, e: unknown) => toast.error(`${n.name}: ${e instanceof Error ? e.message : String(e)}`);
    const depth = (n: Node) => partsOf(n, map, false).length;

    for (const n of asyncOps.filter((x) => x.op === "delete")) {
      const r = rootRefOf(n, map)!;
      try {
        await nativeRemove(r.ref, partsOf(n, map, true));
        setNodes((ns) => { const d = descendants(ns, n.id); return ns.filter((x) => !d.has(x.id)); });
      } catch (e) { fail(n, e); }
    }
    for (const n of asyncOps.filter((x) => x.op === "rename").sort((a, b) => depth(b) - depth(a))) {
      const r = rootRefOf(n, map)!;
      const parent = n.parentId ? map.get(n.parentId) : undefined;
      try {
        await nativeRename(r.ref, parent ? partsOf(parent, map, true) : [], n.originalName ?? n.name, n.name);
        finish(n.id);
      } catch (e) { fail(n, e); }
    }
    for (const n of asyncOps.filter((x) => x.op === "add" && x.kind === "folder").sort((a, b) => depth(a) - depth(b))) {
      const r = rootRefOf(n, map)!;
      try { await nativeMkdir(r.ref, partsOf(n, map, false)); finish(n.id); } catch (e) { fail(n, e); }
    }
    const downloads = asyncOps.filter((x) => x.op === "add" && x.kind !== "folder");
    const worker = async () => {
      for (let n = downloads.shift(); n; n = downloads.shift()) {
        const item = n;
        const r = rootRefOf(item, map)!;
        const parent = map.get(item.parentId!)!;
        try {
          await nativeDownload({
            jobId: item.id, url: item.url!, format: item.kind as "mp3" | "mp4", quality: item.quality ?? "320k",
            dir: diskPath(r.ref, partsOf(parent, map, false)), name: sanitize(item.name.replace(/\.(mp3|mp4)$/i, "")),
          }, (p) => setNodes((ns) => ns.map((x) => (x.id === item.id ? { ...x, progress: p } : x))));
          finish(item.id, { name: `${sanitize(item.name.replace(/\.(mp3|mp4)$/i, ""))}.${item.kind}` });
        } catch (e) {
          fail(item, e);
          setNodes((ns) => ns.map((x) => (x.id === item.id ? { ...x, status: "pending", progress: undefined, real: undefined } : x)));
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setRealBusy(false);
  };

  // simulated download / ffmpeg processing for demo folders and the browser preview
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const simulated = downloading.filter((n) => !n.real).length;
    if (!simulated) {
      if (tick.current) { clearInterval(tick.current); tick.current = null; }
      if (saving && !realBusy && !downloading.length) { setSaving(false); toast.success(t.savedAll); }
      return;
    }
    if (tick.current) return;
    tick.current = setInterval(() => {
      setNodes((ns) => ns.map((n) => {
        if (n.status !== "downloading" || n.real) return n;
        const p = Math.min(100, (n.progress ?? 0) + 4 + Math.random() * 12);
        return p >= 100 ? { ...n, status: "saved", op: undefined, progress: undefined } : { ...n, progress: p };
      }));
    }, 260);
  }, [downloading, saving, realBusy, t.savedAll]);
  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  // keyboard: F2 rename, Delete
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editing || (e.target as HTMLElement).tagName === "INPUT") return;
      if (!selected) return;
      if (e.key === "F2") { e.preventDefault(); setEditing(selected); }
      if (e.key === "Delete") remove(selected);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const sel = selected ? byId.get(selected) : undefined;
  const crumbs = pathOf(current);
  const totalProgress = downloading.length
    ? downloading.reduce((a, n) => a + (n.progress ?? 0), 0) / downloading.length : 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden text-foreground">
      {/* Title bar */}
      <div data-tauri-drag-region className="flex h-9 shrink-0 items-center gap-2 ps-3 text-xs select-none">
        <Logo className="pointer-events-none size-4" />
        <span className="pointer-events-none font-medium">DownTrack</span>
        {saving && <span className="ms-3 flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3 animate-spin" />{t.downloading} {Math.round(totalProgress)}%</span>}
        <div className="ms-auto flex h-full">
          {([[Minus, "minimize"], [Square, "maximize"], [X, "close"]] as const).map(([I, a], i) => (
            <button key={a} onClick={() => windowAction(a)} aria-label={a} className={cn("flex w-11 items-center justify-center text-muted-foreground", i === 2 ? "hover:bg-destructive hover:text-destructive-foreground" : "hover:bg-accent")}>
              <I className={i === 1 ? "size-3" : "size-3.5"} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-72 shrink-0 flex-col bg-sidebar/60 px-3 pb-3">
          <div className="flex items-center gap-2.5 px-2 py-3">
            <Logo className="size-8" />
            <div className="leading-tight">
              <p className="text-base font-semibold tracking-tight">DownTrack</p>
              <p className="text-[11px] text-muted-foreground">yt-dlp · ffmpeg</p>
            </div>
            <Button variant="ghost" size="icon" className="ms-auto size-8" onClick={() => setSettingsOpen(true)} aria-label={t.settings}>
              <Gear className="size-4" />
            </Button>
          </div>

          <Button variant="outline" className="mx-1 mb-3 justify-start gap-2 bg-card/60" onClick={addRoot}>
            <FolderPlus className="size-4" />{t.addRoot}
          </Button>

          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t.rootFolders}</p>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            <SideItem active={current === null} onClick={() => navigate(null)} icon={<Home className="size-4" />} label={t.home} />
            {roots.map((r) => (
              <FolderTree key={r.id} node={r} nodes={nodes} depth={0} current={current} onOpen={navigate} />
            ))}
          </nav>

          {/* Pending changes */}
          <div className="mt-3 rounded-xl border border-border bg-card/80 p-3 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-flyout)" }}>
            <div className="mb-2 flex items-center gap-2">
              <span className={cn("size-2 rounded-full", pending.length ? "bg-warning" : saving ? "bg-primary animate-pulse" : "bg-success")} />
              <p className="text-sm font-semibold">{t.pending}</p>
              <span className="ms-auto rounded-full bg-muted px-2 text-xs font-medium tabular-nums">{pending.length}</span>
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {pending.length === 0 && !saving && <p className="py-2 text-center text-xs text-muted-foreground">{t.noPending}</p>}
              {saving && downloading.map((n) => (
                <div key={n.id} className="px-1 py-1">
                  <p dir="auto" className="truncate text-xs">{n.name}</p>
                  <Progress value={n.progress} className="mt-1 h-1" />
                </div>
              ))}
              {pending.map((n) => (
                <div key={n.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
                  <OpBadge op={n.op} t={t} />
                  <span dir="auto" className={cn("min-w-0 flex-1 truncate text-xs", n.op === "delete" && "line-through opacity-60")}>{n.name}</span>
                  <button onClick={() => revert(n.id)} className="opacity-0 transition group-hover:opacity-100" aria-label={t.undo}><Undo2 className="size-3.5 text-muted-foreground" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={!pending.length || saving} onClick={discardAll}><X className="size-3.5" />{t.discardAll}</Button>
              <Button size="sm" disabled={!pending.length || saving} onClick={saveAll}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{saving ? t.saving : t.saveChanges}
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="me-2 mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card backdrop-blur-xl" style={{ boxShadow: "var(--shadow-flyout)" }}>
          {/* Top bar */}
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            <Button variant="ghost" size="icon" className="size-8" disabled={hIdx === 0} onClick={() => { setHIdx(hIdx - 1); setSelected(null); }} aria-label={t.back}>
              <ArrowLeft className="size-4 rtl:-scale-x-100" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" disabled={hIdx >= history.length - 1} onClick={() => { setHIdx(hIdx + 1); setSelected(null); }} aria-label={t.forward}>
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(null)} aria-label={t.home}><Home className="size-4" /></Button>
            <div className="ms-2 flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-md border border-border bg-background/50 px-1.5 text-sm">
              <Crumb onClick={() => navigate(null)} active={!crumbs.length}>DownTrack</Crumb>
              {crumbs.map((c, i) => (
                <span key={c.id} className="flex items-center gap-0.5">
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" />
                  <Crumb onClick={() => navigate(c.id)} active={i === crumbs.length - 1}>{c.name}</Crumb>
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
            <Button onClick={() => setAddOpen(true)} className="gap-1.5 shadow-sm"><Plus className="size-4" />{t.addMedia}</Button>
            <div className="mx-1 h-6 w-px bg-border" />
            <Button variant="ghost" className="gap-1.5" onClick={() => setFolderDlg({ parent: current })}><FolderPlus className="size-4" />{t.newFolder}</Button>
            <Button variant="ghost" className="gap-1.5" disabled={!sel || sel.op === "delete"} onClick={() => sel && setEditing(sel.id)}><PencilLine className="size-4" />{t.rename}</Button>
            <Button variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" disabled={!sel || sel.op === "delete"} onClick={() => sel && remove(sel.id)}><Trash2 className="size-4" />{t.delete}</Button>
            <span className="ms-auto text-xs text-muted-foreground tabular-nums">{items.length} {t.items}</span>
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="rounded-2xl bg-muted p-5"><FolderOpen className="size-10 text-muted-foreground" /></div>
                <p className="font-medium">{t.emptyFolder}</p>
                <p className="text-sm text-muted-foreground">{t.emptyHint}</p>
                <Button onClick={() => setAddOpen(true)} className="mt-1"><Plus className="size-4" />{t.addMedia}</Button>
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-y-0.5 text-sm">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <tr className="text-xs text-muted-foreground">
                    <th className="w-full py-2 ps-3 text-start font-medium">{t.name}</th>
                    <th className="px-3 text-start font-medium">{t.type}</th>
                    <th className="px-3 text-start font-medium">{t.duration}</th>
                    <th className="px-3 text-start font-medium whitespace-nowrap">{t.size}</th>
                    <th className="px-3 text-start font-medium">{t.status}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((n) => {
                    const isSel = selected === n.id;
                    const count = n.kind === "folder" ? nodes.filter((x) => x.parentId === n.id).length : 0;
                    return (
                      <tr key={n.id}
                        onClick={() => setSelected(n.id)}
                        onDoubleClick={() => n.kind === "folder" && n.op !== "delete" && navigate(n.id)}
                        className={cn("group cursor-default transition-colors [&>td]:py-1.5 [&>td:first-child]:rounded-s-lg [&>td:last-child]:rounded-e-lg",
                          isSel ? "bg-primary/10" : "hover:bg-accent", n.op === "delete" && "opacity-55")}>
                        <td className="ps-2">
                          <div className="flex items-center gap-3">
                            {isSel && <span className="-ms-2 h-5 w-[3px] rounded-full bg-primary" />}
                            {n.kind === "folder" ? (
                              <div className="flex h-10 w-16 items-center justify-center"><Folder className="size-7 fill-warning/40 text-warning" /></div>
                            ) : (
                              <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                                {n.thumbUrl || n.ytId ? (
                                  <img src={n.thumbUrl ?? thumb(n.ytId)} alt="" loading="lazy" className="size-full object-cover" />
                                ) : (
                                  <div className="flex size-full items-center justify-center text-muted-foreground">{n.kind === "mp4" ? <Film className="size-5" /> : <Music2 className="size-5" />}</div>
                                )}
                                {n.status === "downloading" && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><Download className="size-4 animate-bounce text-primary" /></div>}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              {editing === n.id ? (
                                <RenameInput initial={n.name} onDone={(v) => (v === null ? setEditing(null) : rename(n.id, v))} />
                              ) : (
                                <>
                                  <p dir="auto" className={cn("truncate font-medium", n.op === "delete" && "line-through")} title={n.name}
                                    onDoubleClick={(e) => { if (n.kind !== "folder") { e.stopPropagation(); setEditing(n.id); } }}>{n.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {n.originalName ? <span dir="auto" className="line-through">{n.originalName}</span> : n.kind === "folder" ? `${count} ${t.items}` : n.quality}
                                  </p>
                                </>
                              )}
                              {n.status === "downloading" && <Progress value={n.progress} className="mt-1 h-1" />}
                            </div>
                          </div>
                        </td>
                        <td className="px-3">
                          {n.kind === "folder" ? <span className="text-xs text-muted-foreground">{t.folder}</span> : (
                            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase", n.kind === "mp3" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                              {n.kind === "mp3" ? <Music2 className="size-3" /> : <Film className="size-3" />}{n.kind}
                            </span>
                          )}
                        </td>
                        <td className="px-3 text-muted-foreground tabular-nums" dir="ltr">{fmtDur(n.duration)}</td>
                        <td className="px-3 whitespace-nowrap text-muted-foreground tabular-nums" dir="ltr">{fmtSize(n.size)}</td>
                        <td className="px-3"><StatusPill n={n} t={t} /></td>
                        <td className="pe-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                              {n.kind === "folder" && <DropdownMenuItem disabled={n.op === "delete"} onClick={() => navigate(n.id)}><FolderInput className="size-4" />{t.open}</DropdownMenuItem>}
                              <DropdownMenuItem disabled={n.op === "delete" || n.status === "downloading"} onClick={() => { setSelected(n.id); setEditing(n.id); }}><PencilLine className="size-4" />{t.rename}</DropdownMenuItem>
                              {n.status === "pending" && <DropdownMenuItem onClick={() => revert(n.id)}><Undo2 className="size-4" />{t.undo}</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled={n.op === "delete" || n.status === "downloading"} className="text-destructive focus:text-destructive" onClick={() => remove(n.id)}><Trash2 className="size-4" />{t.delete}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      <AddMediaDialog open={addOpen} onOpenChange={setAddOpen} t={t} defFormat={settings.format} defAudio={settings.audio} defVideo={settings.video}
        folders={allFolders} defaultFolder={current ?? undefined} onAdd={addMedia} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} t={t} s={settings} set={(p) => setSettings((s) => ({ ...s, ...p }))} />
      <NewFolderDialog state={folderDlg} onClose={() => setFolderDlg(null)} t={t} onCreate={addFolder} />
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs><linearGradient id="dtg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--destructive)" /></linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="url(#dtg)" />
      <path d="M16 8v11m0 0-4.5-4.5M16 19l4.5-4.5M10 23.5h12" stroke="var(--primary-foreground)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SideItem({ active, onClick, icon, label, depth = 0, pending, deleted }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; depth?: number; pending?: boolean; deleted?: boolean }) {
  return (
    <button onClick={onClick} style={{ paddingInlineStart: 12 + depth * 14 }}
      className={cn("relative flex w-full items-center gap-2.5 rounded-md py-1.5 pe-3 text-sm transition-colors", active ? "bg-sidebar-accent font-medium" : "hover:bg-sidebar-accent/70", deleted && "line-through opacity-50")}>
      {active && <span className="absolute start-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary" />}
      {icon}<span dir="auto" className="truncate">{label}</span>
      {pending && <span className="ms-auto size-1.5 shrink-0 rounded-full bg-warning" />}
    </button>
  );
}

function FolderTree({ node, nodes, depth, current, onOpen }: { node: Node; nodes: Node[]; depth: number; current: string | null; onOpen: (id: string) => void }) {
  const kids = nodes.filter((n) => n.parentId === node.id && n.kind === "folder");
  return (
    <>
      <SideItem depth={depth} active={current === node.id} onClick={() => node.op !== "delete" && onOpen(node.id)} label={node.name}
        pending={node.status === "pending"} deleted={node.op === "delete"}
        icon={<Folder className={cn("size-4 shrink-0", current === node.id ? "fill-warning/50 text-warning" : "text-warning")} />} />
      {kids.map((k) => <FolderTree key={k.id} node={k} nodes={nodes} depth={depth + 1} current={current} onOpen={onOpen} />)}
    </>
  );
}

function Crumb({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active: boolean }) {
  return <button onClick={onClick} className={cn("shrink-0 rounded px-1.5 py-0.5 hover:bg-accent", active ? "font-medium" : "text-muted-foreground")}>{children}</button>;
}

function StatusPill({ n, t }: { n: Node; t: ReturnType<typeof getDict> }) {
  if (n.status === "downloading") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums"><Loader2 className="size-3 animate-spin" />{Math.round(n.progress ?? 0)}%</span>;
  if (n.status === "pending") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground"><Clock className="size-3 text-warning" />{t.pendingS}</span>;
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success"><CircleCheck className="size-3" />{t.saved}</span>;
}

function OpBadge({ op, t }: { op?: Node["op"]; t: ReturnType<typeof getDict> }) {
  const map = { add: [Plus, t.opAdd], rename: [PencilLine, t.opRename], delete: [Trash2, t.opDelete] } as const;
  if (!op) return null;
  const [I, label] = map[op];
  return <span title={label} className={cn("flex size-5 shrink-0 items-center justify-center rounded bg-warning/20", op === "delete" && "bg-destructive/15 text-destructive")}><I className="size-3" /></span>;
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  return (
    <Input ref={ref} dir="auto" value={v} onChange={(e) => setV(e.target.value)} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter") onDone(v); if (e.key === "Escape") onDone(null); }}
      onBlur={() => onDone(v)} className="h-7 text-sm" />
  );
}

function NewFolderDialog({ state, onClose, t, onCreate }: { state: { parent: string | null } | null; onClose: () => void; t: ReturnType<typeof getDict>; onCreate: (name: string, parent: string | null) => void }) {
  const [name, setName] = useState("");
  const submit = () => { if (!name.trim() || !state) return; onCreate(name.trim(), state.parent); setName(""); onClose(); };
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) { setName(""); onClose(); } }}>
      <DialogContent className="max-w-sm rounded-xl bg-popover/95 backdrop-blur-2xl" style={{ boxShadow: "var(--shadow-flyout)" }}>
        <DialogHeader className="text-start"><DialogTitle>{state?.parent === null ? t.addRoot : t.newFolder}</DialogTitle></DialogHeader>
        <Input dir="auto" autoFocus placeholder={t.folderName} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t.cancel}</Button>
          <Button onClick={submit} disabled={!name.trim()}>{t.ok}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
