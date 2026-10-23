import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, Search, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { browseYouTube, isTauri, type YouTubeMedia } from "@/lib/native";
import type { Dict } from "@/lib/i18n";
import { fmtDur } from "./data";

interface Props {
  t: Dict;
  selected: string[];
  onToggle: (media: YouTubeMedia) => void;
}
interface Location { query: string; channel: boolean; name: string }

export function YouTubeDiscovery({ t, selected, onToggle }: Props) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [history, setHistory] = useState<Location[]>([]);
  const [entries, setEntries] = useState<YouTubeMedia[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedPage, setFailedPage] = useState(0);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const available = isTauri();

  const load = async (next: Location, nextPage = 0) => {
    const id = ++request.current;
    setLocation(next); setLoading(true); setError("");
    if (!nextPage) { setEntries([]); setHasMore(false); }
    try {
      const result = await browseYouTube(next.query, next.channel, nextPage);
      if (id !== request.current) return;
      setEntries((prev) => {
        const all = nextPage ? [...prev, ...result.entries] : result.entries;
        return all.filter((item, i) => all.findIndex((x) => x.id === item.id) === i);
      });
      setPage(nextPage); setHasMore(result.has_more && nextPage < 49);
    } catch (e) {
      if (id === request.current) { setError(String(e)); setFailedPage(nextPage); }
    } finally { if (id === request.current) setLoading(false); }
  };
  const search = () => {
    if (!query.trim() || loading || !available) return;
    setHistory([]);
    void load({ query: query.trim(), channel: /^https:\/\/(www\.)?youtube\.com\//.test(query.trim()), name: query.trim() });
  };
  const openChannel = (item: YouTubeMedia) => {
    if (location) setHistory((prev) => [...prev, location]);
    void load({ query: item.channel_url, channel: true, name: item.channel || t.channel });
  };

  return <div className="space-y-3">
    <div className="flex min-w-0 gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          dir="auto" placeholder={t.searchPlaceholder} aria-label={t.searchYouTube} maxLength={300} className="h-10 ps-9" />
      </div>
      <Button disabled={!available || loading || !query.trim()} onClick={search} className="h-10 shrink-0"><Search />{t.search}</Button>
    </div>
    {!available && <p role="status" className="py-6 text-center text-sm text-muted-foreground">{t.discoveryUnavailable}</p>}
    {location && <div className="flex min-w-0 items-center gap-2">
      {history.length > 0 && <Button size="icon" variant="ghost" aria-label={t.back} title={t.back} disabled={loading} onClick={() => {
        const previous = history.at(-1);
        if (!previous) return;
        setHistory((prev) => prev.slice(0, -1)); void load(previous);
      }}><ArrowLeft className="rtl:rotate-180" /></Button>}
      {location.channel && <Tv className="size-4 shrink-0 text-primary" />}
      <span dir="auto" className="min-w-0 truncate text-sm font-medium">{location.name}</span>
    </div>}
    {error && <div role="alert" className="space-y-2 border-s-2 border-destructive ps-3 text-sm">
      <p dir="auto" className="break-words text-destructive">{error}</p>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => { if (location) void load(location, failedPage); }}>{t.retry}</Button>
    </div>}
    <div className="max-h-[36vh] space-y-2 overflow-y-auto pe-1" aria-busy={loading}>
      {entries.map((item) => {
        const picked = selected.includes(item.id);
        return <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <div className="relative w-20 shrink-0 sm:w-28">
            <img src={item.thumbnail} alt="" loading="lazy" className="aspect-video w-full rounded-md object-cover" />
            {item.duration > 0 && <span dir="ltr" className="absolute bottom-1 end-1 rounded bg-foreground/80 px-1 text-[10px] text-background">{fmtDur(item.duration)}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p dir="auto" className="line-clamp-2 break-words text-sm font-medium">{item.title}</p>
            {item.channel && <Button variant="link" size="sm" disabled={loading || !item.channel_url} onClick={() => openChannel(item)} className="h-auto max-w-full justify-start p-0 text-xs"><span dir="auto" className="truncate">{item.channel}</span></Button>}
          </div>
          <Button variant={picked ? "secondary" : "outline"} size="icon" aria-label={`${picked ? t.undo : t.opAdd}: ${item.title}`}
            title={picked ? t.undo : t.opAdd} aria-pressed={picked} onClick={() => onToggle(item)} className="shrink-0">{picked ? <Check /> : <Plus />}</Button>
        </div>;
      })}
      {loading && <div role="status" className="flex justify-center py-5"><Loader2 className="size-5 animate-spin text-primary" /><span className="sr-only">{t.fetch}</span></div>}
      {location && !loading && !error && !entries.length && <p role="status" className="py-5 text-center text-sm text-muted-foreground">{t.noResults}</p>}
    </div>
    {hasMore && !error && <Button variant="outline" className="w-full" disabled={loading} onClick={() => { if (location) void load(location, page + 1); }}>{t.loadMore}</Button>}
  </div>;
}