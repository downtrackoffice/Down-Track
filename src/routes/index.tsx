import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { DownTrack } from "@/components/downtrack/DownTrack";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DownTrack — YouTube media downloader for Windows" },
      { name: "description", content: "Download YouTube audio and video as MP3/MP4 with a staged, safe workflow and a Windows 11 Fluent interface." },
      { property: "og:title", content: "DownTrack — YouTube media downloader" },
      { property: "og:description", content: "Staged downloads, 20 languages, Fluent design, silent yt-dlp + ffmpeg engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="h-screen" />}>
      <DownTrack />
    </ClientOnly>
  ),
});
