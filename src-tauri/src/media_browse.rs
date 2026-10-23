use serde::Serialize;
use serde_json::Value;

pub const PAGE_SIZE: u32 = 20;

pub fn browse_target(query: &str, channel: bool, page: u32) -> Result<(String, u32, u32), String> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 300 || page > 49 {
        return Err("Invalid search or page".into());
    }
    let start = page * PAGE_SIZE + 1;
    let end = start + PAGE_SIZE; // One extra entry tells us whether another page exists.
    let target = if channel {
        let path = query.strip_prefix("https://www.youtube.com/")
            .or_else(|| query.strip_prefix("https://youtube.com/"))
            .ok_or("Invalid YouTube channel")?;
        let parts: Vec<_> = path.trim_end_matches('/').split('/').collect();
        let valid = (parts.len() == 1 && parts[0].starts_with('@') && parts[0].len() > 1)
            || (parts.len() == 2 && matches!(parts[0], "channel" | "c" | "user") && !parts[1].is_empty());
        if !valid || path.chars().any(|c| c.is_whitespace() || matches!(c, '?' | '#' | '\\')) {
            return Err("Invalid YouTube channel".into());
        }
        format!("https://www.youtube.com/{}/videos", parts.join("/"))
    } else {
        format!("ytsearch{end}:{query}")
    };
    Ok((target, start, end))
}

#[derive(Serialize)]
pub struct BrowseItem {
    pub id: String,
    pub title: String,
    pub duration: u64,
    pub thumbnail: String,
    pub url: String,
    pub channel: String,
    pub channel_url: String,
}

#[derive(Serialize)]
pub struct BrowseResults {
    pub entries: Vec<BrowseItem>,
    pub has_more: bool,
}

pub fn parse_results(json: &Value) -> BrowseResults {
    let raw = json["entries"].as_array().cloned().unwrap_or_default();
    let has_more = raw.len() > PAGE_SIZE as usize;
    let entries = raw.iter().take(PAGE_SIZE as usize).filter_map(|v| {
        let id = v["id"].as_str()?;
        if id.len() != 11 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') { return None; }
        let channel_url = v["channel_url"].as_str().or(v["uploader_url"].as_str())
            .map(String::from).or_else(|| v["channel_id"].as_str().map(|id| format!("https://www.youtube.com/channel/{id}")))
            .unwrap_or_default();
        let thumbnail = v["thumbnail"].as_str().map(String::from)
            .or_else(|| v["thumbnails"].as_array().and_then(|t| t.last()).and_then(|t| t["url"].as_str()).map(String::from))
            .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{id}/mqdefault.jpg"));
        Some(BrowseItem {
            id: id.into(), title: v["title"].as_str().unwrap_or("Untitled").into(),
            duration: v["duration"].as_f64().unwrap_or(0.0) as u64, thumbnail,
            url: format!("https://www.youtube.com/watch?v={id}"),
            channel: v["channel"].as_str().or(v["uploader"].as_str()).unwrap_or_default().into(), channel_url,
        })
    }).collect();
    BrowseResults { entries, has_more }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn search_uses_real_youtube_and_page_ranges() {
        assert_eq!(browse_target("מוזיקה", false, 0).unwrap(), ("ytsearch21:מוזיקה".into(), 1, 21));
        assert_eq!(browse_target("Queen", false, 1).unwrap(), ("ytsearch41:Queen".into(), 21, 41));
    }
    #[test]
    fn channels_are_youtube_only() {
        assert_eq!(browse_target("https://www.youtube.com/@Queen", true, 0).unwrap().0, "https://www.youtube.com/@Queen/videos");
        assert!(browse_target("https://evil.test/@Queen", true, 0).is_err());
        assert!(browse_target("https://www.youtube.com/watch?v=abc", true, 0).is_err());
    }
    #[test]
    fn results_keep_video_urls_and_channel_navigation() {
        let r = parse_results(&serde_json::json!({"entries":[{"id":"fJ9rUzIMcZQ","title":"Queen","channel_id":"UCQueen"}, null]}));
        assert_eq!(r.entries.len(), 1);
        assert_eq!(r.entries[0].url, "https://www.youtube.com/watch?v=fJ9rUzIMcZQ");
        assert_eq!(r.entries[0].channel_url, "https://www.youtube.com/channel/UCQueen");
        assert!(!r.has_more);
    }
}