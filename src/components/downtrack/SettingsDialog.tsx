import { useEffect, useState } from "react";
import { engineVersion, isTauri, updateEngine } from "@/lib/native";
import { Moon, Sun, Monitor, RefreshCw, Check, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, type Dict, type Lang } from "@/lib/i18n";
import { AUDIO_Q, VIDEO_Q, type AudioQ, type Format, type VideoQ } from "./data";
import { cn } from "@/lib/utils";

export type Theme = "dark" | "light" | "system";
export interface Settings { theme: Theme; format: Format; audio: AudioQ; video: VideoQ; lang: Lang }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={cn("flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition", value === o.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange, t, s, set }: { open: boolean; onOpenChange: (o: boolean) => void; t: Dict; s: Settings; set: (p: Partial<Settings>) => void }) {
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState("2026.09.14");

  useEffect(() => { if (open) engineVersion().then((v) => v && setVer(v)).catch(() => {}); }, [open]);

  const update = () => {
    setBusy(true);
    if (isTauri()) {
      updateEngine()
        .then((out) => { toast.success(t.upToDate, { description: out.trim().split("\n").pop() }); return engineVersion(); })
        .then((v) => v && setVer(v))
        .catch((e) => toast.error(String(e)))
        .finally(() => setBusy(false));
      return;
    }
    setTimeout(() => { setBusy(false); setVer("2026.09.28"); toast.success(t.upToDate, { description: "yt-dlp 2026.09.28 · ffmpeg 7.1 · ffprobe 7.1" }); }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl border-border bg-popover/95 backdrop-blur-2xl" style={{ boxShadow: "var(--shadow-flyout)" }}>
        <DialogHeader className="text-start"><DialogTitle>{t.settings}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Row label={t.theme}>
            <Seg value={s.theme} onChange={(v) => set({ theme: v })} options={[
              { v: "light", label: <><Sun className="size-3.5" />{t.light}</> },
              { v: "dark", label: <><Moon className="size-3.5" />{t.dark}</> },
              { v: "system", label: <><Monitor className="size-3.5" />{t.system}</> },
            ]} />
          </Row>
          <Row label={t.defaultFormat}>
            <Seg value={s.format} onChange={(v) => set({ format: v })} options={[{ v: "mp3", label: "MP3" }, { v: "mp4", label: "MP4" }]} />
          </Row>
          <Row label={`${t.defaultQuality} · ${t.audio}`}>
            <Seg value={s.audio} onChange={(v) => set({ audio: v })} options={AUDIO_Q.map((q) => ({ v: q, label: q }))} />
          </Row>
          <Row label={`${t.defaultQuality} · ${t.video}`}>
            <Seg value={s.video} onChange={(v) => set({ video: v })} options={VIDEO_Q.map((q) => ({ v: q, label: q }))} />
          </Row>
          <Row label={t.language}>
            <Select value={s.lang} onValueChange={(v) => set({ lang: v as Lang })}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">yt-dlp · ffmpeg · ffprobe</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Terminal className="size-3" />{t.silentEngine} · <span dir="ltr">v{ver}</span></p>
              </div>
              <Button size="sm" variant="outline" onClick={update} disabled={busy}>
                {busy ? <RefreshCw className="size-3.5 animate-spin" /> : ver === "2026.09.28" ? <Check className="size-3.5 text-success" /> : <RefreshCw className="size-3.5" />}
                {busy ? t.updating : t.checkUpdate}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
