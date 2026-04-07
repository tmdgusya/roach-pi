---
name: agentic-deep-research-search
description: Search engine patterns and URL extraction logic for Deep Research. Contains autonomous engine selection, URL extraction from various search engines, and fallback strategies.
---

# Search Engine Patterns

This module handles autonomous search engine selection and URL extraction.

## Search Engine Selection

### Selection Algorithm

```bash
# Pseudocode
function select_engine(topic):
    # Korean-local topics → Naver
    if matches_category(topic, ["korean_food", "korean_brands", "korean_travel", 
                                 "korean_maps", "korean_news", "korean_shopping"]):
        return "naver"
    
    # Site-specific requests (always override)
    if contains(topic, "reddit"):
        return "reddit"
    if contains(topic, "arxiv"):
        return "arxiv"
    if contains(topic, "github"):
        return "github"
    
    # Academic focus
    if contains_any(topic, ["paper", "research", "study", "academic", "논문"]):
        return "google_scholar"
    
    # Default: Google (tech, coding, international)
    return "google"
```

### Korean-Local Categories (→ Naver)

| Category | Keywords | Why Naver |
|----------|----------|-----------|
| 맛집/음식 | "서울 맛집", "홍대 맛집", "한국 음식" | 리뷰, 블로그 많음 |
| 쇼핑/브랜드 | "한국 브랜드", "한국 쇼핑몰", "쿠팡" | 국내 쇼핑 sites |
| 여행/관광 | "서울 여행", "부산 여행", "한국 관광" | 한국 여행 정보 |
| 지도/위치 | "주변 맛집", "약국", "편의점" | 네이버 지도 |
| 한국 뉴스 | "오늘 뉴스", "대한민국" | 네이버 뉴스 |

### Engine URLs

| Engine | URL Template | Notes |
|--------|-------------|-------|
| Google | `https://www.google.com/search?q={q}` | Tech, coding, international |
| Naver | `https://search.naver.com/search.naver?query={q}` | Korean-local content |
| Bing | `https://www.bing.com/search?q={q}` | Alternative |
| DuckDuckGo | `https://duckduckgo.com/?q={q}` | Privacy |
| Reddit | `https://www.reddit.com/search/?q={q}` | Discussions |
| ArXiv | `https://arxiv.org/search/?search_query={q}` | Papers |
| Google Scholar | `https://scholar.google.com/scholar?q={q}` | Academic |

## URL Extraction Patterns

### Google

```bash
# Extract search result links
agent-browser snapshot -i
# Look for elements with links pointing to search results
```

### Naver

```bash
# Naver search result structure
agent-browser snapshot -s ".view_wrap"
# Extract from .title_link, .url_link
```

### Reddit

```bash
# Reddit search results
agent-browser snapshot -s ".search-result"
```

## Fallback Strategy

```bash
# If primary engine fails:
1. Try alternative engine from same category
2. If still failing, try generic search (Google)
3. Report partial results with warning
```

## Example: Multi-Engine Search

```bash
# Topic: "서울 맛집 추천"
topic="서울 맛집 추천"

# Step 1: Select engine (Korean-local → Naver)
engine="naver"

# Step 2: Search
agent-browser --session main open "https://search.naver.com/search.naver?query=${topic}"
agent-browser wait --load networkidle

# Step 3: Extract URLs
urls=$(extract_links)

# Topic: "React best practices"
topic="React best practices"

# Step 1: Select engine (tech → Google)
engine="google"

# Step 2: Search
agent-browser --session main open "https://www.google.com/search?q=${topic}"
agent-browser wait --load networkidle

# Step 3: Extract URLs
urls=$(extract_links)
```


