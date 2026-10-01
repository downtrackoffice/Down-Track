export type Lang =
  | "en" | "he" | "ar" | "es" | "fr" | "de" | "it" | "pt" | "ru" | "zh"
  | "ja" | "ko" | "hi" | "tr" | "nl" | "pl" | "uk" | "sv" | "id" | "vi";

export const LANGUAGES: { code: Lang; name: string; rtl?: boolean }[] = [
  { code: "he", name: "עברית", rtl: true },
  { code: "en", name: "English" },
  { code: "ar", name: "العربية", rtl: true },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "hi", name: "हिन्दी" },
  { code: "tr", name: "Türkçe" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "uk", name: "Українська" },
  { code: "sv", name: "Svenska" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "vi", name: "Tiếng Việt" },
];

export const isRtl = (l: Lang) => !!LANGUAGES.find((x) => x.code === l)?.rtl;

const en = {
  settings: "Settings", addRoot: "Add root folder", rootFolders: "Root folders",
  pending: "Pending changes", noPending: "No pending changes", discardAll: "Discard all",
  saveChanges: "Save changes", saving: "Saving…", addMedia: "Add media", newFolder: "New folder",
  rename: "Rename", delete: "Delete", name: "Name", type: "Type", duration: "Duration",
  size: "Size", status: "Status", saved: "Saved", pendingS: "Pending", downloading: "Downloading",
  home: "Home", back: "Back", forward: "Forward", theme: "Theme", dark: "Dark", light: "Light",
  system: "System", defaultFormat: "Default format", defaultQuality: "Default quality",
  language: "Language", checkUpdate: "Check & update download tools", updating: "Updating…",
  upToDate: "Download engine is up to date", pasteLink: "Paste a YouTube link…",
  fetch: "Fetch", playlistDetected: "Playlist detected", allMp3: "All MP3", allMp4: "All MP4",
  maxQuality: "Max quality for all", toggleAll: "Select / deselect all", addToQueue: "Add to pending queue",
  emptyFolder: "This folder is empty", emptyHint: "Add media or create a folder to get started",
  folder: "Folder", items: "items", opAdd: "Add", opRename: "Rename", opDelete: "Delete",
  folderName: "Folder name", newName: "New name", cancel: "Cancel", ok: "OK", open: "Open",
  savedAll: "All changes saved to disk", discarded: "Pending changes discarded",
  quality: "Quality", format: "Format", selected: "selected", silentEngine: "Engine runs silently in the background",
  close: "Close", audio: "Audio", video: "Video", undo: "Undo",
};
export type Dict = typeof en;

const he: Dict = {
  settings: "הגדרות", addRoot: "הוסף תיקיית שורש", rootFolders: "תיקיות שורש",
  pending: "שינויים ממתינים", noPending: "אין שינויים ממתינים", discardAll: "בטל הכל",
  saveChanges: "שמור שינויים", saving: "שומר…", addMedia: "הוסף מדיה", newFolder: "תיקייה חדשה",
  rename: "שנה שם", delete: "מחק", name: "שם", type: "סוג", duration: "משך",
  size: "גודל", status: "סטטוס", saved: "נשמר", pendingS: "ממתין", downloading: "מוריד",
  home: "בית", back: "אחורה", forward: "קדימה", theme: "ערכת נושא", dark: "כהה", light: "בהיר",
  system: "לפי המערכת", defaultFormat: "פורמט ברירת מחדל", defaultQuality: "איכות ברירת מחדל",
  language: "שפה", checkUpdate: "בדוק ועדכן כלי הורדה", updating: "מעדכן…",
  upToDate: "מנוע ההורדה מעודכן", pasteLink: "הדבק קישור יוטיוב…",
  fetch: "טען", playlistDetected: "זוהה פלייליסט", allMp3: "הכל MP3", allMp4: "הכל MP4",
  maxQuality: "איכות מקסימלית לכולם", toggleAll: "בחר / בטל הכל", addToQueue: "הוסף לתור השינויים",
  emptyFolder: "התיקייה ריקה", emptyHint: "הוסף מדיה או צור תיקייה כדי להתחיל",
  folder: "תיקייה", items: "פריטים", opAdd: "הוספה", opRename: "שינוי שם", opDelete: "מחיקה",
  folderName: "שם התיקייה", newName: "שם חדש", cancel: "ביטול", ok: "אישור", open: "פתח",
  savedAll: "כל השינויים נשמרו בדיסק", discarded: "השינויים הממתינים בוטלו",
  quality: "איכות", format: "פורמט", selected: "נבחרו", silentEngine: "המנוע רץ בשקט ברקע",
  close: "סגור", audio: "אודיו", video: "וידאו", undo: "בטל",
};

const ar: Dict = {
  settings: "الإعدادات", addRoot: "إضافة مجلد جذر", rootFolders: "المجلدات الجذرية",
  pending: "تغييرات معلّقة", noPending: "لا توجد تغييرات معلّقة", discardAll: "إلغاء الكل",
  saveChanges: "حفظ التغييرات", saving: "جارٍ الحفظ…", addMedia: "إضافة وسائط", newFolder: "مجلد جديد",
  rename: "إعادة تسمية", delete: "حذف", name: "الاسم", type: "النوع", duration: "المدة",
  size: "الحجم", status: "الحالة", saved: "محفوظ", pendingS: "معلّق", downloading: "جارٍ التنزيل",
  home: "الرئيسية", back: "رجوع", forward: "تقدّم", theme: "السمة", dark: "داكن", light: "فاتح",
  system: "حسب النظام", defaultFormat: "الصيغة الافتراضية", defaultQuality: "الجودة الافتراضية",
  language: "اللغة", checkUpdate: "فحص وتحديث أدوات التنزيل", updating: "جارٍ التحديث…",
  upToDate: "محرك التنزيل محدّث", pasteLink: "الصق رابط يوتيوب…",
  fetch: "جلب", playlistDetected: "تم اكتشاف قائمة تشغيل", allMp3: "الكل MP3", allMp4: "الكل MP4",
  maxQuality: "أعلى جودة للجميع", toggleAll: "تحديد / إلغاء الكل", addToQueue: "أضف إلى قائمة التغييرات",
  emptyFolder: "هذا المجلد فارغ", emptyHint: "أضف وسائط أو أنشئ مجلدًا للبدء",
  folder: "مجلد", items: "عناصر", opAdd: "إضافة", opRename: "إعادة تسمية", opDelete: "حذف",
  folderName: "اسم المجلد", newName: "اسم جديد", cancel: "إلغاء", ok: "موافق", open: "فتح",
  savedAll: "تم حفظ جميع التغييرات", discarded: "تم إلغاء التغييرات المعلّقة",
  quality: "الجودة", format: "الصيغة", selected: "محدد", silentEngine: "المحرك يعمل بصمت في الخلفية",
  close: "إغلاق", audio: "صوت", video: "فيديو", undo: "تراجع",
};

// Core UI strings for the remaining languages; anything missing falls back to English.
type Core = Partial<Dict>;
const core = (a: string[]): Core => {
  const k: (keyof Dict)[] = ["settings", "addRoot", "pending", "discardAll", "saveChanges", "addMedia",
    "newFolder", "rename", "delete", "name", "type", "duration", "size", "status", "saved", "pendingS",
    "home", "theme", "language", "dark", "light", "system"];
  return Object.fromEntries(k.map((key, i) => [key, a[i]]));
};
const partial: Partial<Record<Lang, Core>> = {
  es: core(["Ajustes", "Añadir carpeta raíz", "Cambios pendientes", "Descartar todo", "Guardar cambios", "Añadir medios", "Nueva carpeta", "Renombrar", "Eliminar", "Nombre", "Tipo", "Duración", "Tamaño", "Estado", "Guardado", "Pendiente", "Inicio", "Tema", "Idioma", "Oscuro", "Claro", "Sistema"]),
  fr: core(["Paramètres", "Ajouter un dossier racine", "Modifications en attente", "Tout annuler", "Enregistrer", "Ajouter un média", "Nouveau dossier", "Renommer", "Supprimer", "Nom", "Type", "Durée", "Taille", "Statut", "Enregistré", "En attente", "Accueil", "Thème", "Langue", "Sombre", "Clair", "Système"]),
  de: core(["Einstellungen", "Stammordner hinzufügen", "Ausstehende Änderungen", "Alle verwerfen", "Änderungen speichern", "Medien hinzufügen", "Neuer Ordner", "Umbenennen", "Löschen", "Name", "Typ", "Dauer", "Größe", "Status", "Gespeichert", "Ausstehend", "Start", "Design", "Sprache", "Dunkel", "Hell", "System"]),
  it: core(["Impostazioni", "Aggiungi cartella radice", "Modifiche in sospeso", "Annulla tutto", "Salva modifiche", "Aggiungi media", "Nuova cartella", "Rinomina", "Elimina", "Nome", "Tipo", "Durata", "Dimensione", "Stato", "Salvato", "In sospeso", "Home", "Tema", "Lingua", "Scuro", "Chiaro", "Sistema"]),
  pt: core(["Configurações", "Adicionar pasta raiz", "Alterações pendentes", "Descartar tudo", "Salvar alterações", "Adicionar mídia", "Nova pasta", "Renomear", "Excluir", "Nome", "Tipo", "Duração", "Tamanho", "Status", "Salvo", "Pendente", "Início", "Tema", "Idioma", "Escuro", "Claro", "Sistema"]),
  ru: core(["Настройки", "Добавить корневую папку", "Ожидающие изменения", "Отменить все", "Сохранить изменения", "Добавить медиа", "Новая папка", "Переименовать", "Удалить", "Имя", "Тип", "Длительность", "Размер", "Статус", "Сохранено", "Ожидает", "Главная", "Тема", "Язык", "Тёмная", "Светлая", "Системная"]),
  zh: core(["设置", "添加根文件夹", "待保存更改", "全部放弃", "保存更改", "添加媒体", "新建文件夹", "重命名", "删除", "名称", "类型", "时长", "大小", "状态", "已保存", "待处理", "主页", "主题", "语言", "深色", "浅色", "跟随系统"]),
  ja: core(["設定", "ルートフォルダーを追加", "保留中の変更", "すべて破棄", "変更を保存", "メディアを追加", "新しいフォルダー", "名前の変更", "削除", "名前", "種類", "長さ", "サイズ", "状態", "保存済み", "保留中", "ホーム", "テーマ", "言語", "ダーク", "ライト", "システム"]),
  ko: core(["설정", "루트 폴더 추가", "보류 중인 변경", "모두 취소", "변경 사항 저장", "미디어 추가", "새 폴더", "이름 바꾸기", "삭제", "이름", "유형", "길이", "크기", "상태", "저장됨", "대기 중", "홈", "테마", "언어", "다크", "라이트", "시스템"]),
  hi: core(["सेटिंग्स", "रूट फ़ोल्डर जोड़ें", "लंबित परिवर्तन", "सभी रद्द करें", "परिवर्तन सहेजें", "मीडिया जोड़ें", "नया फ़ोल्डर", "नाम बदलें", "हटाएँ", "नाम", "प्रकार", "अवधि", "आकार", "स्थिति", "सहेजा गया", "लंबित", "होम", "थीम", "भाषा", "डार्क", "लाइट", "सिस्टम"]),
  tr: core(["Ayarlar", "Kök klasör ekle", "Bekleyen değişiklikler", "Tümünü iptal et", "Değişiklikleri kaydet", "Medya ekle", "Yeni klasör", "Yeniden adlandır", "Sil", "Ad", "Tür", "Süre", "Boyut", "Durum", "Kaydedildi", "Bekliyor", "Ana sayfa", "Tema", "Dil", "Koyu", "Açık", "Sistem"]),
  nl: core(["Instellingen", "Hoofdmap toevoegen", "Wijzigingen in behandeling", "Alles verwerpen", "Wijzigingen opslaan", "Media toevoegen", "Nieuwe map", "Hernoemen", "Verwijderen", "Naam", "Type", "Duur", "Grootte", "Status", "Opgeslagen", "In behandeling", "Start", "Thema", "Taal", "Donker", "Licht", "Systeem"]),
  pl: core(["Ustawienia", "Dodaj folder główny", "Oczekujące zmiany", "Odrzuć wszystko", "Zapisz zmiany", "Dodaj multimedia", "Nowy folder", "Zmień nazwę", "Usuń", "Nazwa", "Typ", "Czas", "Rozmiar", "Status", "Zapisano", "Oczekuje", "Start", "Motyw", "Język", "Ciemny", "Jasny", "Systemowy"]),
  uk: core(["Налаштування", "Додати кореневу папку", "Зміни, що очікують", "Скасувати все", "Зберегти зміни", "Додати медіа", "Нова папка", "Перейменувати", "Видалити", "Назва", "Тип", "Тривалість", "Розмір", "Статус", "Збережено", "Очікує", "Головна", "Тема", "Мова", "Темна", "Світла", "Системна"]),
  sv: core(["Inställningar", "Lägg till rotmapp", "Väntande ändringar", "Ignorera alla", "Spara ändringar", "Lägg till media", "Ny mapp", "Byt namn", "Ta bort", "Namn", "Typ", "Längd", "Storlek", "Status", "Sparad", "Väntar", "Hem", "Tema", "Språk", "Mörkt", "Ljust", "System"]),
  id: core(["Pengaturan", "Tambah folder akar", "Perubahan tertunda", "Batalkan semua", "Simpan perubahan", "Tambah media", "Folder baru", "Ganti nama", "Hapus", "Nama", "Jenis", "Durasi", "Ukuran", "Status", "Tersimpan", "Tertunda", "Beranda", "Tema", "Bahasa", "Gelap", "Terang", "Sistem"]),
  vi: core(["Cài đặt", "Thêm thư mục gốc", "Thay đổi đang chờ", "Hủy tất cả", "Lưu thay đổi", "Thêm phương tiện", "Thư mục mới", "Đổi tên", "Xóa", "Tên", "Loại", "Thời lượng", "Kích thước", "Trạng thái", "Đã lưu", "Đang chờ", "Trang chủ", "Giao diện", "Ngôn ngữ", "Tối", "Sáng", "Hệ thống"]),
};

export function getDict(l: Lang): Dict {
  if (l === "en") return en;
  if (l === "he") return he;
  if (l === "ar") return ar;
  return { ...en, ...partial[l] } as Dict;
}
