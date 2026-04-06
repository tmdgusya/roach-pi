# WebFetch includeScripts 옵션 추가

> **Worker note:** Execute this plan task-by-task using the agentic-run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** webfetch 툴에 `includeScripts: true` 옵션 추가 — 기본은 script/style 제거, 옵션 켜면 포함

**Architecture:** `getTurndownService()`에 `removeTags` 매개변수를 추가하여, 호출 시점에 script/style 제거 여부를 결정. 캐시 키에 옵션 포함. 기본 동작은 변경 없음.

**Tech Stack:** turndown, turndown-plugin-gfm, TypeBox (pi 툴 파라미터 스키마)

**Work Scope:**
- **In scope:**
  - `turndown.ts`에 `removeTags` 옵션 추가
  - `utils.ts`에 `includeScripts` 옵션 전달
  - `index.ts` 툴 파라미터에 `includeScripts` 추가
  - `render.ts`에 `--scripts` 플래그 표시
  - 관련 테스트 업데이트
- **Out of scope:**
  - 캐시 구조 변경
  - 새로운 툴 분리 (webfetch 내 옵션으로 처리)

---

**Verification Strategy:**
- **Level:** test-suite
- **Command:** `cd extensions/agentic-harness && npx vitest run`
- **What it validates:** 175개 테스트 전체 통과, 회귀 없음

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `webfetch/turndown.ts` | **MODIFY** | `removeTags` 옵션 추가 |
| `webfetch/utils.ts` | **MODIFY** | `includeScripts` 옵션 전달, 캐시 키 포함 |
| `index.ts` | **MODIFY** | 툴 파라미터 스키마에 `includeScripts` 추가, 설명 업데이트 |
| `webfetch/render.ts` | **MODIFY** | `--scripts` 플래그 표시 |
| `tests/webfetch-turndown.test.ts` | **MODIFY** | `removeTags` 옵션 테스트 추가 |
| `tests/webfetch-utils.test.ts` | **MODIFY** | `includeScripts` 테스트 추가 |

---

### Task 1: turndown.ts에 removeTags 옵션 추가

**Dependencies:** None
**Files:**
- Modify: `extensions/agentic-harness/webfetch/turndown.ts`
- Modify: `extensions/agentic-harness/tests/webfetch-turndown.test.ts`

- [ ] **Step 1: turndown.ts 수정**

`getTurndownService`가 `removeTags` 매개변수를 받도록 변경. 기본값은 `["script", "style"]`:

```typescript
import type TurndownService from "turndown";

const cache = new Map<string, Promise<TurndownService>>();

export async function getTurndownService(
  removeTags: string[] = ["script", "style"],
): Promise<TurndownService> {
  const key = removeTags.join(",");
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const [turndownMod, gfmMod] = await Promise.all([
      import("turndown"),
      // @ts-expect-error no type declarations for turndown-plugin-gfm
      import("turndown-plugin-gfm"),
    ]);

    const Turndown = (turndownMod as any).default;
    const gfm = (gfmMod as any).gfm ?? gfmMod;

    const service = new Turndown({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      fence: "```",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
      linkReferenceStyle: "full",
    });

    service.use(gfm);
    if (removeTags.length > 0) {
      service.remove(removeTags);
    }

    return service;
  })();

  cache.set(key, promise);
  return promise;
}
```

핵심 변화:
- 기존 `turndownPromise` 싱글톤 → `Map<string, Promise>` 캐시
- `removeTags` 파라미터로 제거할 태그 지정
- `["script", "style"]` (기본) 과 `[]` (빈 배열, 제거 안함) 두 가지 인스턴스가 캐시됨

- [ ] **Step 2: webfetch-turndown.test.ts 업데이트**

기존 테스트는 `getTurndownService()` 기본 호출이므로 그대로 통과됨. 다음 테스트 추가:

```typescript
  it("should include script/style content when removeTags is empty", async () => {
    const service = await getTurndownService([]);
    const html =
      "<p>Content</p><script>alert('xss')</script><style>.x{color:red}</style>";
    const md = service.turndown(html);
    expect(md).toContain("Content");
    expect(md).toContain("alert('xss')");
    expect(md).toContain(".x{color:red}");
  });

  it("should use default removeTags when called without arguments", async () => {
    const service = await getTurndownService();
    const html = "<p>Content</p><script>alert('xss')</script>";
    const md = service.turndown(html);
    expect(md).toContain("Content");
    expect(md).not.toContain("alert");
  });
```

- [ ] **Step 3: turndown 테스트 실행**

```bash
cd extensions/agentic-harness && npx vitest run tests/webfetch-turndown.test.ts
```

Expected: ALL PASS

---

### Task 2: utils.ts에 includeScripts 옵션 추가

**Dependencies:** Runs after Task 1
**Files:**
- Modify: `extensions/agentic-harness/webfetch/utils.ts`
- Modify: `extensions/agentic-harness/tests/webfetch-utils.test.ts`

- [ ] **Step 1: utils.ts 수정**

두 곳 변경:

1. `fetchUrlToMarkdown` 옵션 타입에 `includeScripts` 추가:

```typescript
export async function fetchUrlToMarkdown(
  url: string,
  options: { raw?: boolean; maxLength?: number; includeScripts?: boolean; signal?: AbortSignal } = {},
): Promise<{ content: string; details: WebFetchDetails }> {
```

2. 캐시 키에 `includeScripts` 포함:

```typescript
  const cacheKey = JSON.stringify({ url, mode: options.raw ? "full" : "auto", scripts: !!options.includeScripts });
```

3. HTML 변환 시 `includeScripts`에 따라 `getTurndownService` 호출 변경:

```typescript
  const turndown = await getTurndownService(options.includeScripts ? [] : ["script", "style"]);
```

- [ ] **Step 2: webfetch-utils.test.ts에 테스트 추가**

기존 "should fetch HTML and convert to markdown" 테스트 아래에 추가:

```typescript
  it("should include script/style when includeScripts is true", async () => {
    mockFetch.mockResolvedValue(
      mockHtmlResponse(
        "<html><body><p>Content</p><script>alert('hi')</script><style>.x{}</style></body></html>",
      ),
    );

    const result = await fetchUrlToMarkdown("https://example.com", {
      includeScripts: true,
    });
    expect(result.content).toContain("Content");
    expect(result.content).toContain("alert('hi')");
    expect(result.content).toContain(".x{}");
  });

  it("should exclude script/style by default", async () => {
    mockFetch.mockResolvedValue(
      mockHtmlResponse(
        "<html><body><p>Content</p><script>alert('hi')</script></body></html>",
      ),
    );

    const result = await fetchUrlToMarkdown("https://example.com");
    expect(result.content).toContain("Content");
    expect(result.content).not.toContain("alert");
  });
```

- [ ] **Step 3: utils 테스트 실행**

```bash
cd extensions/agentic-harness && npx vitest run tests/webfetch-utils.test.ts tests/webfetch-turndown.test.ts
```

Expected: ALL PASS

---

### Task 3: 툴 파라미터 및 렌더링 업데이트

**Dependencies:** Runs after Task 2
**Files:**
- Modify: `extensions/agentic-harness/index.ts`
- Modify: `extensions/agentic-harness/webfetch/render.ts`
- Modify: `extensions/agentic-harness/tests/webfetch-render.test.ts`

- [ ] **Step 1: index.ts 파라미터 스키마에 includeScripts 추가**

`WebFetchParams`에 새 필드 추가:

```typescript
  const WebFetchParams = Type.Object({
    url: Type.String({
      description: "The URL to fetch and convert to Markdown",
    }),
    raw: Type.Optional(
      Type.Boolean({
        description:
          "Convert the full HTML page to Markdown without filtering",
        default: false,
      }),
    ),
    includeScripts: Type.Optional(
      Type.Boolean({
        description:
          "Include <script> and <style> tag content in the output. Default: false (stripped)",
        default: false,
      }),
    ),
    maxLength: Type.Optional(
      Type.Number({
        description:
          "Maximum number of characters to return. Content beyond this limit is truncated.",
      }),
    ),
  });
```

execute 핸들러에서 `includeScripts` 전달:

```typescript
      const { url, raw, maxLength, includeScripts } = params;
      try {
        const { content, details } = await fetchUrlToMarkdown(url, {
          raw,
          maxLength,
          includeScripts,
          signal,
        });
```

설명 및 가이드라인 업데이트:

```typescript
    description:
      "Fetch a URL and convert its HTML content to clean Markdown. Uses Turndown + GFM for Markdown conversion. Results are cached for 15 minutes.",
    promptSnippet: "Fetch a URL and convert to Markdown",
    promptGuidelines: [
      "Use webfetch to retrieve and read web pages, documentation, or any URL content.",
      "Script and style tags are stripped by default. Use includeScripts: true when you need CSS/JS source code.",
      "Use raw: true when you need the full HTML page converted without any filtering.",
      "Use maxLength to limit output size for very large pages.",
      "Results are cached for 15 minutes — repeated requests for the same URL return instantly.",
    ],
```

- [ ] **Step 2: render.ts에 --scripts 플래그 표시**

`renderWebfetchCall` 함수에서 `includeScripts` 플래그 표시:

```typescript
  if (args.raw) text += theme.fg("dim", " --raw");
  if (args.includeScripts) text += theme.fg("dim", " --scripts");
  if (args.maxLength) text += theme.fg("dim", ` --max ${args.maxLength}`);
```

- [ ] **Step 3: 전체 테스트 실행**

```bash
cd extensions/agentic-harness && npx vitest run
```

Expected: ALL PASS

---

### Task 4 (Final): End-to-End Verification

**Dependencies:** All preceding tasks
**Files:** None (read-only verification)

- [ ] **Step 1: 전체 테스트 스위트 실행**

```bash
cd extensions/agentic-harness && npx vitest run
```

Expected: ALL PASS

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd extensions/agentic-harness && npx tsc --noEmit 2>&1 | grep -v node_modules
```

Expected: webfetch/ 내부 파일은 에러 없음

- [ ] **Step 3: Commit & Push**

```bash
git add -A
git commit -m "feat: add includeScripts option to webfetch tool

- Add includeScripts parameter (default: false)
- getTurndownService now accepts removeTags option
- Cache key includes scripts flag
- Render shows --scripts flag when enabled"
git push
```
