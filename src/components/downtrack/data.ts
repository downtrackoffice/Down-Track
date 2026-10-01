export type Format = "mp3" | "mp4";
export type AudioQ = "128k" | "192k" | "320k";
export type VideoQ = "720p" | "1080p" | "4K";
export type Quality = AudioQ | VideoQ;
export type Status = "saved" | "pending" | "downloading";
export type PendingOp = "add" | "rename" | "delete";

export interface Node {
  id: string;
  parentId: string | null;
  name: string;
  kind: "folder" | Format;
  ytId?: string;
  duration?: number; // seconds
  size?: number; // bytes
  quality?: Quality;
  status: Status;
  op?: PendingOp;
  originalName?: string;
  progress?: number;
}

export const AUDIO_Q: AudioQ[] = ["128k", "192k", "320k"];
export const VIDEO_Q: VideoQ[] = ["720p", "1080p", "4K"];

export const thumb = (ytId?: string) => (ytId ? `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg` : "");

export const fmtDur = (s?: number) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};
export const fmtSize = (b?: number) => {
  if (!b) return "—";
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  return `${(b / 1e6).toFixed(1)} MB`;
};

const RATE: Record<Quality, number> = {
  "128k": 16e3, "192k": 24e3, "320k": 40e3, "720p": 330e3, "1080p": 600e3, "4K": 2.6e6,
};
export const estSize = (dur: number, q: Quality) => Math.round(dur * RATE[q]);

let n = 0;
export const uid = () => `n${Date.now().toString(36)}${(n++).toString(36)}`;

export const CATALOG: { ytId: string; title: string; duration: number }[] = [
  { ytId: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", duration: 213 },
  { ytId: "kJQP7kiw5Fk", title: "Luis Fonsi - Despacito ft. Daddy Yankee", duration: 282 },
  { ytId: "JGwWNGJdvx8", title: "Ed Sheeran - Shape of You", duration: 263 },
  { ytId: "9bZkp7q19f0", title: "PSY - GANGNAM STYLE", duration: 252 },
  { ytId: "OPf0YbXqDm0", title: "Mark Ronson - Uptown Funk ft. Bruno Mars", duration: 270 },
  { ytId: "fJ9rUzIMcZQ", title: "Queen - Bohemian Rhapsody", duration: 355 },
  { ytId: "hT_nvWreIhg", title: "OneRepublic - Counting Stars", duration: 283 },
  { ytId: "RgKAFK5djSk", title: "Wiz Khalifa - See You Again ft. Charlie Puth", duration: 237 },
  { ytId: "60ItHLz5WEA", title: "Alan Walker - Faded", duration: 212 },
  { ytId: "YQHsXMglC9A", title: "Adele - Hello", duration: 367 },
];

const media = (parentId: string, i: number, kind: Format, quality: Quality): Node => {
  const c = CATALOG[i];
  return {
    id: uid(), parentId, name: `${c.title}.${kind}`, kind, ytId: c.ytId,
    duration: c.duration, quality, size: estSize(c.duration, quality), status: "saved",
  };
};

export function seed(): Node[] {
  const songs: Node = { id: "songs", parentId: null, name: "שירים", kind: "folder", status: "saved" };
  const music: Node = { id: "music", parentId: null, name: "מוזיקה", kind: "folder", status: "saved" };
  const videos: Node = { id: "videos", parentId: null, name: "סרטונים", kind: "folder", status: "saved" };
  const pop: Node = { id: "pop", parentId: "music", name: "Pop Hits", kind: "folder", status: "saved" };
  const classics: Node = { id: "classics", parentId: "music", name: "Classics", kind: "folder", status: "saved" };
  return [
    songs, music, videos, pop, classics,
    media("songs", 0, "mp3", "320k"),
    media("songs", 2, "mp3", "192k"),
    media("songs", 8, "mp3", "320k"),
    media("pop", 1, "mp3", "320k"),
    media("pop", 6, "mp3", "192k"),
    media("pop", 7, "mp3", "128k"),
    media("classics", 5, "mp3", "320k"),
    media("classics", 9, "mp3", "320k"),
    media("videos", 3, "mp4", "1080p"),
    media("videos", 4, "mp4", "4K"),
    media("videos", 0, "mp4", "720p"),
  ];
}
