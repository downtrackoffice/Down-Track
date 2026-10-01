import { useState } from "react";
import { Link2, ListMusic, Loader2, Sparkles, CheckSquare, Music2, Film } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIO_Q, CATALOG, VIDEO_Q, fmtDur, thumb, type Format, type Quality, type AudioQ, type VideoQ } from "./data";
import type { Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface Draft {
  key: string; ytId: string; title: string; duration: number;
  format: Format; quality: Quality; selected: boolean;
}

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void; t: Dict;
  defFormat: Format; defAudio: AudioQ; defVideo: VideoQ;
  folders: { id: string; path: string }[]; defaultFolder?: string;
  onAdd: (items: Draft[], folderId: string) => void;
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function AddMediaDialog({ open, onOpenChange, t, defFormat, defAudio, defVideo, folders, defaultFolder, onAdd }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isList, setIsList] = useState(false);
  const [folder, setFolder] = useState<string>("");
  const target = folder || defaultFolder || folders[0]?.id || "";

  const reset = () => { setUrl(""); setDrafts([]); setIsList(false); setFolder(""); };
  const defQ = (f: Format): Quality => (f === "mp3" ? defAudio : defVideo);

  const fetchInfo = () => {
    if (!url.trim()) return;
    setLoading(true);
    setDrafts([]);
    setTimeout(() => {
      const list = /[?&]list=/.test(url);
      const mk = (i: number): Draft => {
        const c = CATALOG[i % CATALOG.length];
        return { key: `${c.ytId}-${i}`, ytId: c.ytId, title: c.title, duration: c.duration, format: defFormat, quality: defQ(defFormat), selected: true };
      };
      if (list) {
        const start = hash(url) % CATALOG.length;
        setDrafts(Array.from({ length: 6 }, (_, i) => mk(start + i)));
      } else {
        const id = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1];
        const idx = CATALOG.findIndex((c) => c.ytId === id);
        setDrafts([mk(idx >= 0 ? idx : hash(url) % CATALOG.length)]);
      }
      setIsList(list);
      setLoading(false);
    }, 750);
  };

  const patch = (key: string, p: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const all = (p: (d: Draft) => Partial<Draft>) => setDrafts((d) => d.map((x) => ({ ...x, ...p(x) })));
  const selCount = drafts.filter((d) => d.selected).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-xl border-border bg-popover/95 p-0 backdrop-blur-2xl" style={{ boxShadow: "var(--shadow-flyout)" }}>
        <DialogHeader className="px-6 pt-6 pb-4 text-start">
          <DialogTitle className="text-lg font-semibold">{t.addMedia}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchInfo()}
                placeholder={t.pasteLink} className="h-10 ps-9 rtl:text-right" autoFocus />
            </div>
            <Button onClick={fetchInfo} disabled={loading || !url.trim()} className="h-10 min-w-20">
              {loading ? <Loader2 className="size-4 animate-spin" /> : t.fetch}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {["https://youtu.be/fJ9rUzIMcZQ", "https://www.youtube.com/playlist?list=PLDownTrackDemo"].map((s) => (
              <button key={s} onClick={() => setUrl(s)} dir="ltr" className="rounded-md border border-border px-2 py-1 hover:bg-accent">{s.replace("https://", "")}</button>
            ))}
          </div>

          {loading && (
            <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>
          )}

          {drafts.length > 0 && (
            <>
              {isList && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
                  <span className="flex items-center gap-1.5 px-2 text-sm font-medium text-primary"><ListMusic className="size-4" />{t.playlistDetected} · {selCount}/{drafts.length}</span>
                  <div className="ms-auto flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => all(() => ({ format: "mp3", quality: defAudio }))}><Music2 className="size-3.5" />{t.allMp3}</Button>
                    <Button size="sm" variant="ghost" onClick={() => all(() => ({ format: "mp4", quality: defVideo }))}><Film className="size-3.5" />{t.allMp4}</Button>
                    <Button size="sm" variant="ghost" onClick={() => all((d) => ({ quality: d.format === "mp3" ? "320k" : "4K" }))}><Sparkles className="size-3.5" />{t.maxQuality}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { const v = selCount !== drafts.length; all(() => ({ selected: v })); }}><CheckSquare className="size-3.5" />{t.toggleAll}</Button>
                  </div>
                </div>
              )}
              <div className="max-h-[42vh] space-y-2 overflow-y-auto pe-1">
                {drafts.map((d) => (
                  <div key={d.key} className={cn("flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-opacity", !d.selected && "opacity-50")}>
                    {isList && <Checkbox checked={d.selected} onCheckedChange={(v) => patch(d.key, { selected: !!v })} />}
                    <div className="relative shrink-0">
                      <img src={thumb(d.ytId)} alt="" className={cn("h-14 rounded-md object-cover", isList ? "w-24" : "w-32 h-[72px]")} />
                      <span dir="ltr" className="absolute bottom-1 end-1 rounded bg-foreground/80 px-1 text-[10px] text-background">{fmtDur(d.duration)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="truncate text-sm font-medium">{d.title}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                          {(["mp3", "mp4"] as Format[]).map((f) => (
                            <button key={f} onClick={() => patch(d.key, { format: f, quality: defQ(f) })}
                              className={cn("rounded px-2.5 py-0.5 text-xs font-semibold uppercase transition", d.format === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>{f}</button>
                          ))}
                        </div>
                        <Select value={d.quality} onValueChange={(v) => patch(d.key, { quality: v as Quality })}>
                          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{(d.format === "mp3" ? AUDIO_Q : VIDEO_Q).map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex-row items-center gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:justify-between">
          <Select value={target} onValueChange={setFolder}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button disabled={!selCount || !target} onClick={() => { onAdd(drafts.filter((d) => d.selected), target); onOpenChange(false); reset(); }}>
              {t.addToQueue}{selCount > 1 && ` (${selCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
