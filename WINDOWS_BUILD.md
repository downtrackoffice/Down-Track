# בניית DownTrack לווינדוס — בלחיצת כפתור

GitHub בונה עבורכם קובץ התקנה (`.exe` / `.msi`) באופן אוטומטי, כולל הורדת הגרסאות העדכניות של yt-dlp, ffmpeg ו-ffprobe. אין צורך להתקין שום דבר במחשב.

## שלב 1 — חיבור ל-GitHub (פעם אחת)
1. ב-Lovable: כפתור **+** בתיבת הצ'אט ← **GitHub** ← **Connect project**.
2. אשרו את Lovable ב-GitHub ולחצו **Create Repository**.

## שלב 2 — הפעלת הבנייה
1. היכנסו ל-repository ב-GitHub ולחצו על הלשונית **Actions**.
2. בצד בחרו **Build DownTrack for Windows**.
3. לחצו **Run workflow** ← **Run workflow** (הירוק).
4. המתינו כ-10–15 דקות עד שמופיע וי ירוק ✔.

## שלב 3 — הורדה והתקנה
- **Releases**: בעמוד הראשי של ה-repository, בצד ימין ← **Releases** ← הורידו את `DownTrack_x.x.x_x64-setup.exe`.
- לחלופין: בתוך הריצה ב-Actions, בתחתית העמוד ← **Artifacts** ← `DownTrack-Windows-Installer`.

הפעילו את קובץ ההתקנה. אם ווינדוס מציג "Windows protected your PC" — לחצו **More info** ← **Run anyway** (הקובץ אינו חתום דיגיטלית).

## גרסה חדשה
שנו את `version` בקובץ `src-tauri/tauri.conf.json` (למשל ל-`1.0.1`) והריצו שוב את הבנייה. אפשר גם לדחוף תגית `v1.0.1` והבנייה תתחיל לבד.

---

### למפתחים — בנייה מקומית
דרישות: Rust, Bun, ו-WebView2 (מותקן בווינדוס 11).
1. הניחו ב-`src-tauri/binaries/` את הקבצים:
   `yt-dlp-x86_64-pc-windows-msvc.exe`, `ffmpeg-x86_64-pc-windows-msvc.exe`, `ffprobe-x86_64-pc-windows-msvc.exe`
2. `bun install` ← `bunx tauri icon src-tauri/app-icon.png`
3. פיתוח: `bunx tauri dev` · בנייה: `bunx tauri build`
