# GitHub Pages — Neo-Brutalist Website Implementation Plan

> **Worker note:** Execute this plan task-by-task using the agentic-run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Create a single-page GitHub Pages website for the pi-engineering-discipline-extension with a Neo-Brutalist design system, bilingual content (EN primary, KO secondary), and getting-started focused sections.

**Architecture:** Plain HTML + CSS single-page site served from `docs/` directory. GitHub Pages will serve `docs/` as the site root. The design system is Neo-Brutalist with MiSans font, 6-8px black borders, hard-edge shadows, white background, limited blue accent, and ASCII symbol icons. A language toggle (EN/KR) switches visible content blocks using a 5-line inline `<script>` that toggles a body class — no JavaScript frameworks or build tools.

**Tech Stack:** HTML5, CSS3, MiSans font (Google Fonts CDN), ASCII symbols for icons

**Work Scope:**
- **In scope:** Single-page site with Hero, Installation, Quick Start, Key Features, FAQ sections. Neo-Brutalist CSS design system. Bilingual content (EN primary, KO secondary). Responsive layout. Language toggle mechanism.
- **Out of scope:** Multi-page navigation, JavaScript frameworks, build tools, search functionality, comments system, analytics, animations beyond CSS transitions.

**Verification Strategy:**
- **Level:** build-only (no test framework for static HTML)
- **Command:** `open docs/index.html` (manual visual inspection) + `npx html-validate docs/index.html` (structural validation if available, otherwise manual)
- **What it validates:** Site renders correctly, all sections present, CSS classes match HTML, responsive at mobile/desktop widths

---

## File Structure Mapping

```
docs/
├── index.html          # Single-page site — all content, semantic HTML5
└── style.css           # Neo-Brutalist design system + responsive rules
```

No existing files are modified. Two new files are created.

---

### Task 1: Create Neo-Brutalist CSS Design System

**Dependencies:** None (can run in parallel with content drafting)
**Files:**
- Create: `docs/style.css`

- [ ] **Step 1: Create `docs/style.css` with the complete Neo-Brutalist design system**

Write the file `docs/style.css` with the following content (complete, no placeholders):

```css
/* ============================================
   ROACH PI — Neo-Brutalist Design System
   ============================================ */

/* --- Reset & Base --- */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --black: #000000;
  --white: #FFFFFF;
  --blue: #0000FF;
  --gray-light: #F5F5F5;
  --gray: #CCCCCC;
  --border: 6px solid var(--black);
  --border-thick: 8px solid var(--black);
  --shadow: 6px 6px 0 var(--black);
  --shadow-sm: 4px 4px 0 var(--black);
  --shadow-lg: 8px 8px 0 var(--black);
  --font: 'MiSans', sans-serif;
  --max-width: 960px;
  --radius: 0px;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font);
  background-color: var(--white);
  color: var(--black);
  line-height: 1.7;
  min-height: 100vh;
}

/* --- MiSans Font Import --- */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');

/* Fallback stack: MiSans is loaded by the HTML <link>; Noto Sans KR as fallback */
body {
  font-family: 'MiSans', 'Noto Sans KR', sans-serif;
}

/* --- Layout --- */
.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.section {
  padding: 3rem 0;
  border-bottom: 3px solid var(--black);
}

.section:last-of-type {
  border-bottom: none;
}

/* --- Typography --- */
h1, h2, h3, h4 {
  font-weight: 900;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: -0.02em;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

h2 {
  font-size: 2rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 4px solid var(--black);
  display: inline-block;
}

h3 {
  font-size: 1.4rem;
  margin-bottom: 1rem;
}

p {
  margin-bottom: 1rem;
}

a {
  color: var(--black);
  text-decoration: none;
  border-bottom: 3px solid var(--blue);
  transition: border-color 0.1s;
}

a:hover {
  border-bottom-color: var(--black);
}

strong {
  font-weight: 900;
}

/* --- Neo-Brutalist Components --- */

.card {
  background: var(--white);
  border: var(--border);
  box-shadow: var(--shadow);
  padding: 1.5rem;
  transition: transform 0.1s, box-shadow 0.1s;
}

.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-lg);
}

.card-blue {
  border-color: var(--blue);
  box-shadow: 6px 6px 0 var(--blue);
}

.badge {
  display: inline-block;
  background: var(--black);
  color: var(--white);
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  border: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-blue {
  background: var(--blue);
  color: var(--white);
}

.btn {
  display: inline-block;
  background: var(--black);
  color: var(--white);
  border: var(--border);
  box-shadow: var(--shadow-sm);
  padding: 0.75rem 1.5rem;
  font-family: var(--font);
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  letter-spacing: 0.03em;
  transition: transform 0.1s, box-shadow 0.1s;
}

.btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow);
  border-bottom-color: var(--black);
}

.btn-blue {
  background: var(--blue);
  box-shadow: 4px 4px 0 var(--black);
}

.btn-blue:hover {
  box-shadow: 6px 6px 0 var(--black);
}

/* --- Code Blocks --- */
pre {
  background: var(--black);
  color: var(--white);
  padding: 1.25rem 1.5rem;
  overflow-x: auto;
  border: var(--border);
  box-shadow: var(--shadow-sm);
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 1rem 0;
}

code {
  font-family: 'Courier New', Courier, monospace;
}

p code, li code {
  background: var(--gray-light);
  border: 2px solid var(--black);
  padding: 0.1rem 0.4rem;
  font-size: 0.85em;
}

/* --- ASCII Icons --- */
.icon {
  font-family: monospace;
  font-size: 1.2em;
  margin-right: 0.5rem;
  display: inline-block;
}

/* --- Grid System --- */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;
}

/* --- Hero Section --- */
.hero {
  padding: 4rem 0 3rem;
  text-align: center;
  border-bottom: 4px solid var(--black);
}

.hero-ascii {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  line-height: 1.1;
  white-space: pre;
  display: inline-block;
  text-align: left;
  margin-bottom: 2rem;
  color: var(--black);
}

.hero-subtitle {
  font-size: 1.2rem;
  font-weight: 400;
  margin-bottom: 2rem;
  color: var(--black);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-install {
  margin-top: 2rem;
}

/* --- Language Toggle --- */
.lang-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 100;
  display: flex;
  gap: 0;
  border: var(--border);
  box-shadow: var(--shadow-sm);
}

.lang-toggle button {
  background: var(--white);
  border: none;
  border-right: 3px solid var(--black);
  padding: 0.4rem 0.8rem;
  font-family: var(--font);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  transition: background 0.1s;
}

.lang-toggle button:last-child {
  border-right: none;
}

.lang-toggle button.active {
  background: var(--black);
  color: var(--white);
}

.lang-toggle button:hover:not(.active) {
  background: var(--gray-light);
}

/* Language content switching */
[data-lang="ko"] {
  display: none;
}

body.lang-ko [data-lang="en"] {
  display: none;
}

body.lang-ko [data-lang="ko"] {
  display: block;
}

body.lang-ko [data-lang="ko-inline"] {
  display: inline;
}

/* Keep inline elements working */
[data-lang="ko-inline"] {
  display: none;
}

body.lang-ko [data-lang="ko-inline"] {
  display: inline;
}

/* --- Feature Cards --- */
.feature-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  display: block;
}

.feature-title {
  font-weight: 900;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
}

.feature-desc {
  font-size: 0.95rem;
  color: var(--black);
  line-height: 1.6;
}

/* --- FAQ Accordion --- */
details {
  border: var(--border);
  box-shadow: var(--shadow-sm);
  margin-bottom: 1rem;
  background: var(--white);
}

details[open] {
  box-shadow: var(--shadow);
}

summary {
  padding: 1rem 1.5rem;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: '▶';
  font-family: monospace;
  transition: transform 0.2s;
}

details[open] summary::before {
  transform: rotate(90deg);
}

details .faq-body {
  padding: 0 1.5rem 1.5rem;
  line-height: 1.7;
}

/* --- Step List (Quick Start) --- */
.step-list {
  list-style: none;
  counter-reset: step;
}

.step-list li {
  counter-increment: step;
  padding: 1.5rem;
  border: var(--border);
  box-shadow: var(--shadow-sm);
  margin-bottom: 1.5rem;
  position: relative;
  padding-left: 4rem;
}

.step-list li::before {
  content: counter(step);
  position: absolute;
  left: -0.5rem;
  top: -0.5rem;
  width: 2.5rem;
  height: 2.5rem;
  background: var(--black);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1.2rem;
  border: 3px solid var(--black);
}

/* --- Navigation --- */
nav {
  position: sticky;
  top: 0;
  background: var(--white);
  border-bottom: var(--border-thick);
  z-index: 50;
  padding: 0.75rem 0;
}

nav ul {
  display: flex;
  gap: 1.5rem;
  list-style: none;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1.5rem;
  flex-wrap: wrap;
}

nav a {
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: uppercase;
  border-bottom: none;
  padding: 0.25rem 0;
  position: relative;
}

nav a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 3px;
  background: var(--blue);
  transition: width 0.15s;
}

nav a:hover::after {
  width: 100%;
}

/* --- Footer --- */
footer {
  border-top: var(--border-thick);
  padding: 2rem 1.5rem;
  text-align: center;
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  margin-top: 2rem;
}

footer a {
  border-bottom: 3px solid var(--blue);
}

/* --- Responsive --- */
@media (max-width: 768px) {
  :root {
    --border: 4px solid var(--black);
    --border-thick: 6px solid var(--black);
    --shadow: 4px 4px 0 var(--black);
    --shadow-sm: 3px 3px 0 var(--black);
    --shadow-lg: 6px 6px 0 var(--black);
  }

  h1 {
    font-size: 2rem;
  }

  h2 {
    font-size: 1.5rem;
  }

  .grid-2, .grid-3 {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 2.5rem 0 2rem;
  }

  .hero-ascii {
    font-size: 0.45rem;
  }

  nav ul {
    gap: 1rem;
  }

  nav a {
    font-size: 0.8rem;
  }

  .lang-toggle {
    position: static;
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }
}

@media (max-width: 480px) {
  html {
    font-size: 14px;
  }

  .hero-ascii {
    font-size: 0.35rem;
  }

  .step-list li {
    padding-left: 3.5rem;
  }
}

/* --- Print --- */
@media print {
  .lang-toggle, nav {
    display: none;
  }

  .card, details {
    box-shadow: none;
    break-inside: avoid;
  }
}
```

- [ ] **Step 2: Verify the CSS file was created**

Run: `ls -la docs/style.css`
Expected: File exists, non-empty

- [ ] **Step 3: Commit**

```bash
git add docs/style.css
git commit -m "style: add Neo-Brutalist design system CSS"
```

---

### Task 2: Create HTML Content Page

**Dependencies:** Task 1 (must reference CSS class names from the design system)
**Files:**
- Create: `docs/index.html`

- [ ] **Step 1: Create `docs/index.html` with all bilingual content sections**

Write the file `docs/index.html` with the following content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ROACH PI — Pi Engineering Discipline Extension</title>
  <meta name="description" content="Strict engineering discipline and agentic orchestration for the pi coding agent. Multi-agent workflows, plan execution, and milestone planning.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪳</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- Language Toggle -->
  <div class="lang-toggle" id="langToggle">
    <button class="active" onclick="setLang('en')">EN</button>
    <button onclick="setLang('ko')">KR</button>
  </div>

  <script>
    function setLang(lang) {
      if (lang === 'ko') {
        document.body.classList.add('lang-ko');
      } else {
        document.body.classList.remove('lang-ko');
      }
      var btns = document.querySelectorAll('#langToggle button');
      btns.forEach(function(b) { b.classList.remove('active'); });
      document.querySelector('#langToggle button[onclick="setLang(\'' + lang + '\')"]').classList.add('active');
    }
  </script>

  <!-- Navigation -->
  <nav>
    <div class="container">
      <ul>
        <li><a href="#install">★ <span data-lang="en">Install</span><span data-lang="ko">설치</span></a></li>
        <li><a href="#quickstart">▶ <span data-lang="en">Quick Start</span><span data-lang="ko">빠른 시작</span></a></li>
        <li><a href="#features">■ <span data-lang="en">Features</span><span data-lang="ko">기능</span></a></li>
        <li><a href="#faq">● <span data-lang="en">FAQ</span><span data-lang="ko">FAQ</span></a></li>
        <li><a href="https://github.com/tmdgusya/pi-engineering-discipline-extension" target="_blank">→ GitHub</a></li>
      </ul>
    </div>
  </nav>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <div class="hero-ascii">
 ██████╗ ███████╗████████╗██████╗  ██████╗     ██████╗ ██╗   ██╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗    ██╔══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║   ██████╔╝██║   ██║    ██████╔╝ ╚████╔╝ █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║   ██╔══██╗██║   ██║    ██╔══██╗  ╚██╔╝  ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║   ██║  ██║╚██████╔╝    ██████╔╝   ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝     ╚═════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝
  </div>
      <h1>
        <span data-lang="en">Engineering Discipline Extension</span>
        <span data-lang="ko">엔지니어링 디사이플린 익스텐션</span>
      </h1>
      <p class="hero-subtitle">
        <span data-lang="en">Strict engineering discipline and agentic orchestration for the <strong>pi coding agent</strong>. Multi-agent workflows, executable plans, and milestone-level decomposition.</span>
        <span data-lang="ko"><strong>pi 코딩 에이전트</strong>를 위한 엄격한 엔지니어링 디사이플린과 에이전트 오케스트레이션. 다중 에이전트 워크플로, 실행 가능한 계획, 마일스톤 분해.</span>
      </p>
      <div class="hero-install">
        <span class="badge">MIT License</span>
      </div>
    </div>
  </section>

  <div class="container">

    <!-- Installation -->
    <section class="section" id="install">
      <h2>
        <span class="icon">★</span>
        <span data-lang="en">Installation</span>
        <span data-lang="ko">설치</span>
      </h2>

      <div data-lang="en">
        <p>Install the extension with a single command:</p>
      </div>
      <div data-lang="ko">
        <p>단일 명령어로 익스텐션을 설치합니다:</p>
      </div>

      <pre><code>pi install git:github.com/tmdgusya/pi-engineering-discipline-extension</code></pre>

      <div class="card" style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.75rem;">
          <span class="icon">●</span>
          <span data-lang="en">Prerequisite</span>
          <span data-lang="ko">사전 요구사항</span>
        </h3>
        <p data-lang="en">
          This extension relies on the core engineering discipline skills. Before using this extension, install the skills:
        </p>
        <p data-lang="ko">
          이 익스텐션은 핵심 엔지니어링 디사이플린 스킬에 의존합니다. 사용 전에 스킬을 설치하세요:
        </p>
        <a class="btn btn-blue" href="https://github.com/tmdgusya/engineering-discipline" target="_blank" style="display: inline-block; margin-top: 0.5rem;">
          → <span data-lang="en">Engineering Discipline Skills</span><span data-lang="ko">엔지니어링 디사이플린 스킬</span>
        </a>
      </div>

      <div class="card" style="margin-top: 1rem;">
        <h3 style="margin-bottom: 0.75rem;">
          <span class="icon">★</span>
          <span data-lang="en">Recommended Setting</span>
          <span data-lang="ko">권장 설정</span>
        </h3>
        <p data-lang="en">
          Add <code>"quietStartup": true</code> to <code>~/.pi/agent/settings.json</code> to hide the default startup listing. The extension provides its own custom ROACH PI banner.
        </p>
        <p data-lang="ko">
          <code>~/.pi/agent/settings.json</code>에 <code>"quietStartup": true</code>를 추가하여 기본 시작 목록을 숨기세요. 익스텐션이 자체 ROACH PI 배너를 제공합니다.
        </p>
        <pre style="margin-top: 0.75rem;"><code>{
  "quietStartup": true
}</code></pre>
      </div>
    </section>

    <!-- Quick Start -->
    <section class="section" id="quickstart">
      <h2>
        <span class="icon">▶</span>
        <span data-lang="en">Quick Start</span>
        <span data-lang="ko">빠른 시작</span>
      </h2>

      <p data-lang="en">
        The extension provides a three-phase workflow: <strong>clarify → plan → execute</strong>. Each phase is driven by a slash command.
      </p>
      <p data-lang="ko">
        익스텐션은 3단계 워크플로를 제공합니다: <strong>명확화 → 계획 → 실행</strong>. 각 단계는 슬래시 명령으로 구동됩니다.
      </p>

      <ol class="step-list" style="margin-top: 1.5rem;">

        <li>
          <h3>
            <code>/clarify</code>
            <span data-lang="en"> — Resolve Ambiguity</span>
            <span data-lang="ko"> — 모호성 해결</span>
          </h3>
          <p data-lang="en">
            The agent asks dynamic, context-aware questions one at a time while exploring the codebase in parallel. Ends with a structured <strong>Context Brief</strong> that defines scope, constraints, and success criteria.
          </p>
          <p data-lang="ko">
            에이전트가 코드베이스를 병렬로 탐색하면서 동적이고 문맥에 맞는 질문을 하나씩 묻습니다. 범위, 제약, 성공 기준을 정의하는 구조화된 <strong>컨텍스트 브리프</strong>로 끝납니다.
          </p>
        </li>

        <li>
          <h3>
            <code>/plan</code>
            <span data-lang="en"> — Create an Executable Plan</span>
            <span data-lang="ko"> — 실행 가능한 계획 생성</span>
          </h3>
          <p data-lang="en">
            Transforms the Context Brief into an implementation plan with exact file paths, code blocks, commands, and expected outputs. No placeholders — every step is immediately executable by a worker agent.
          </p>
          <p data-lang="ko">
            컨텍스트 브리프를 정확한 파일 경로, 코드 블록, 명령어, 예상 출력이 포함된 구현 계획으로 변환합니다. 플레이스홀더 없음 — 모든 단계가 워커 에이전트가 즉시 실행할 수 있습니다.
          </p>
        </li>

        <li>
          <h3>
            <code>/ultraplan</code>
            <span data-lang="en"> — Milestone Decomposition</span>
            <span data-lang="ko"> — 마일스톤 분해</span>
          </h3>
          <p data-lang="en">
            For complex multi-day tasks. Dispatches 5 independent reviewer agents in parallel (Feasibility, Architecture, Risk, Dependency, User Value), then synthesizes findings into an optimized milestone DAG.
          </p>
          <p data-lang="ko">
            복잡한 며칠짜리 작업을 위해. 5개의 독립적인 리뷰어 에이전트를 병렬로 디스패치(타당성, 아키텍처, 리스크, 의존성, 사용자 가치)한 후, 최적화된 마일스톤 DAG로 종합합니다.
          </p>
        </li>

      </ol>

      <div class="card card-blue" style="margin-top: 2rem;">
        <p data-lang="en" style="margin-bottom: 0;">
          <strong>💡 Tip:</strong> The <code>ask_user_question</code> tool is always available — the agent will ask clarifying questions autonomously whenever it detects ambiguity, even outside <code>/clarify</code> mode.
        </p>
        <p data-lang="ko" style="margin-bottom: 0;">
          <strong>💡 팁:</strong> <code>ask_user_question</code> 도구는 항상 사용 가능합니다 — <code>/clarify</code> 모드 외에서도 모호성을 감지하면 자동으로 질문합니다.
        </p>
      </div>
    </section>

    <!-- Features -->
    <section class="section" id="features">
      <h2>
        <span class="icon">■</span>
        <span data-lang="en">Key Features</span>
        <span data-lang="ko">주요 기능</span>
      </h2>

      <div class="grid-2" style="margin-top: 1.5rem;">

        <div class="card">
          <span class="feature-icon">★</span>
          <div class="feature-title">
            <span data-lang="en">Multi-Agent Orchestration</span>
            <span data-lang="ko">다중 에이전트 오케스트레이션</span>
          </div>
          <div class="feature-desc">
            <p data-lang="en">
              12 bundled agents for exploration, execution, planning, and review. Delegate tasks via single, parallel (max 8 tasks, 4 concurrent), or chain modes with cycle detection and depth guards.
            </p>
            <p data-lang="ko">
              탐색, 실행, 계획, 리뷰를 위한 12개 번들 에이전트. 사이클 감지 및 깊이 가드와 함께 단일, 병렬(최대 8개 작업, 4개 동시), 체인 모드로 작업을 위임하세요.
            </p>
          </div>
        </div>

        <div class="card">
          <span class="feature-icon">●</span>
          <div class="feature-title">
            <span data-lang="en">Engineering Discipline</span>
            <span data-lang="ko">엔지니어링 디사이플린</span>
          </div>
          <div class="feature-desc">
            <p data-lang="en">
              Karpathy rules auto-injected into code-writing agents. Automatic slop-cleaner spawns after successful runs to remove LLM-specific patterns while preserving behavior.
            </p>
            <p data-lang="ko">
              Karpathy 규칙이 코드 작성 에이전트에 자동 주입됩니다. 성공적인 실행 후 동작을 유지하면서 LLM 특정 패턴을 제거하는 자동 슬롭 클리너가 실행됩니다.
            </p>
          </div>
        </div>

        <div class="card">
          <span class="feature-icon">■</span>
          <div class="feature-title">
            <span data-lang="en">Plan Execution Pipeline</span>
            <span data-lang="ko">계획 실행 파이프라인</span>
          </div>
          <div class="feature-desc">
            <p data-lang="en">
              <strong>plan-compliance</strong> → <strong>plan-worker</strong> → <strong>plan-validator</strong> pipeline with information barriers. Validators never see execution context — they judge solely from the plan document and codebase.
            </p>
            <p data-lang="ko">
              정보 장벽이 있는 <strong>plan-compliance</strong> → <strong>plan-worker</strong> → <strong>plan-validator</strong> 파이프라인. 검증자는 실행 컨텍스트를 보지 않습니다 — 계획 문서와 코드베이스만으로 판단합니다.
            </p>
          </div>
        </div>

        <div class="card">
          <span class="feature-icon">▶</span>
          <div class="feature-title">
            <span data-lang="en">TUI Customization</span>
            <span data-lang="ko">TUI 커스터마이제이션</span>
          </div>
          <div class="feature-desc">
            <p data-lang="en">
              Custom ROACH PI ASCII banner, branded footer with directory, branch, model, context bar, cache hit rate, and active tools display.
            </p>
            <p data-lang="ko">
              디렉토리, 브랜치, 모델, 컨텍스트 바, 캐시 적중률, 활성 도구 표시가 있는 커스텀 ROACH PI ASCII 배너 및 브랜디드 푸터.
            </p>
          </div>
        </div>

        <div class="card">
          <span class="feature-icon">●</span>
          <div class="feature-title">
            <span data-lang="en">Context Management</span>
            <span data-lang="ko">컨텍스트 관리</span>
          </div>
          <div class="feature-desc">
            <p data-lang="en">
              Microcompaction truncates old tool results. Phase-aware summarization preserves workflow state across compaction. Phase and goal document survive context limits.
            </p>
            <p data-lang="ko">
              마이크로컴팩션이 오래된 도구 결과를 자릅니다. 단계 인식 요약이 컴팩션 전반에 걸쳐 워크플로 상태를 보존합니다. 단계 및 목표 문서가 컨텍스트 한계를 초과합니다.
            </p>
          </div>
        </div>

        <div class="card">
          <span class="feature-icon">★</span>
          <div class="feature-title">
            <span data-lang="en">11 Behavioral Skills</span>
            <span data-lang="ko">11개 행동 스킬</span>
          </div>
          <div class="feature-desc">
            <p data-lang="en">
              Bundled LLM skill rulesets: clarification, plan crafting, run plan, review work, simplify, systematic debugging, Karpathy discipline, Rob Pike optimization, and more.
            </p>
            <p data-lang="ko">
              번들 LLM 스킬 룰셋: 명확화, 계획 작성, 계획 실행, 작업 리뷰, 단순화, 체계적 디버깅, Karpathy 디사이플린, Rob Pike 최적화 등.
            </p>
          </div>
        </div>

      </div>
    </section>

    <!-- FAQ -->
    <section class="section" id="faq">
      <h2>
        <span class="icon">●</span>
        FAQ
      </h2>

      <div style="margin-top: 1.5rem;">

        <details>
          <summary>
            <span data-lang="en">What is the pi coding agent?</span>
            <span data-lang="ko">pi 코딩 에이전트란 무엇인가요?</span>
          </summary>
          <div class="faq-body">
            <p data-lang="en">
              <strong>pi</strong> is a terminal-based AI coding agent that helps you read, write, and debug code directly from your terminal. It supports extensions, custom tools, themes, and multiple AI providers. <a href="https://github.com/badlogic/pi-mono" target="_blank">GitHub →</a>
            </p>
            <p data-lang="ko">
              <strong>pi</strong>는 터미널에서 직접 코드를 읽고, 쓰고, 디버깅하는 터미널 기반 AI 코딩 에이전트입니다. 익스텐션, 커스텀 도구, 테마 및 여러 AI 프로바이더를 지원합니다. <a href="https://github.com/badlogic/pi-mono" target="_blank">GitHub →</a>
            </p>
          </div>
        </details>

        <details>
          <summary>
            <span data-lang="en">Do I need to install the engineering-discipline skills separately?</span>
            <span data-lang="ko">엔지니어링 디사이플린 스킬을 별도로 설치해야 하나요?</span>
          </summary>
          <div class="faq-body">
            <p data-lang="en">
              Yes. The extension depends on the <a href="https://github.com/tmdgusya/engineering-discipline" target="_blank">engineering-discipline</a> skills repository. Install it first, then install this extension. The extension registers the skill paths automatically via <code>resources_discover</code>.
            </p>
            <p data-lang="ko">
              네. 익스텐션은 <a href="https://github.com/tmdgusya/engineering-discipline" target="_blank">engineering-discipline</a> 스킬 저장소에 의존합니다. 먼저 설치한 후 이 익스텐션을 설치하세요. 익스텐션이 <code>resources_discover</code>를 통해 스킬 경로를 자동으로 등록합니다.
            </p>
          </div>
        </details>

        <details>
          <summary>
            <span data-lang="en">How do the subagent modes work?</span>
            <span data-lang="ko">서브에이전트 모드는 어떻게 작동하나요?</span>
          </summary>
          <div class="faq-body">
            <p data-lang="en">
              <strong>Single:</strong> One-off tasks sent to a specific agent.<br>
              <strong>Parallel:</strong> Dispatch multiple agents at once (max 8 tasks, 4 concurrent). Each runs independently.<br>
              <strong>Chain:</strong> Sequential pipeline where each step receives the previous step's output via <code>{previous}</code> placeholder.<br>
              All modes include cycle detection, depth limits (max 3), and concurrency control.
            </p>
            <p data-lang="ko">
              <strong>단일:</strong> 특정 에이전트에 보내는 일회성 작업.<br>
              <strong>병렬:</strong> 여러 에이전트를 한 번에 디스패치(최대 8개 작업, 4개 동시). 각각 독립적으로 실행.<br>
              <strong>체인:</strong> 각 단계가 이전 단계의 출력을 <code>{previous}</code> 플레이스홀더로 받는 순차 파이프라인.<br>
              모든 모드에 사이클 감지, 깊이 제한(최대 3), 동시성 제어가 포함됩니다.
            </p>
          </div>
        </details>

        <details>
          <summary>
            <span data-lang="en">What does the slop-cleaner do?</span>
            <span data-lang="ko">슬롭 클리너는 무엇을 하나요?</span>
          </summary>
          <div class="faq-body">
            <p data-lang="en">
              The slop-cleaner automatically runs after successful <code>worker</code> or <code>plan-worker</code> executions. It detects and removes LLM-specific code patterns (unnecessary comments, over-verbose logging, redundant type assertions, etc.) while preserving the original behavior.
            </p>
            <p data-lang="ko">
              슬롭 클리너는 <code>worker</code> 또는 <code>plan-worker</code> 실행 성공 후 자동으로 실행됩니다. 원래 동작을 유지하면서 LLM 특정 코드 패턴(불필요한 주석, 과도한 로깅, 중복 타입 단언 등)을 감지하고 제거합니다.
            </p>
          </div>
        </details>

        <details>
          <summary>
            <span data-lang="en">Can I use this extension without the /ultraplan command?</span>
            <span data-lang="ko">/ultraplan 명령 없이 이 익스텐션을 사용할 수 있나요?</span>
          </summary>
          <div class="faq-body">
            <p data-lang="en">
              Absolutely. The three slash commands are independent. Use <code>/clarify</code> + <code>/plan</code> for single-session tasks. Use <code>/ultraplan</code> only when you need milestone-level decomposition for complex, multi-day projects.
            </p>
            <p data-lang="ko">
              물론입니다. 세 개의 슬래시 명령은 독립적입니다. 단일 세션 작업에는 <code>/clarify</code> + <code>/plan</code>을 사용하세요. 복잡한 며칠짜리 프로젝트에 마일스톤 수준 분해가 필요할 때만 <code>/ultraplan</code>을 사용하세요.
            </p>
          </div>
        </details>

      </div>
    </section>

  </div>

  <!-- Footer -->
  <footer>
    <div class="container">
      <p>
        <span data-lang="en">ROACH PI — Pi Engineering Discipline Extension</span>
        <span data-lang="ko">ROACH PI — Pi 엔지니어링 디사이플린 익스텐션</span>
      </p>
      <p style="margin-top: 0.5rem;">
        <span data-lang="en">Built with ■ terminal aesthetics and ● ASCII vibes</span>
        <span data-lang="ko">■ 터미널 미학과 ● ASCII 무드로 구축</span>
      </p>
      <p style="margin-top: 0.5rem;">
        <a href="https://github.com/tmdgusya/pi-engineering-discipline-extension" target="_blank">→ GitHub</a>
        &nbsp;&nbsp;
        <a href="https://github.com/tmdgusya/engineering-discipline" target="_blank">→ Skills Repo</a>
      </p>
    </div>
  </footer>

</body>
</html>
```

- [ ] **Step 2: Verify the HTML file was created**

Run: `ls -la docs/index.html`
Expected: File exists, non-empty

- [ ] **Step 3: Open in browser for visual inspection**

Run: `open docs/index.html`
Expected: Browser opens with the Neo-Brutalist styled page

- [ ] **Step 4: Validate HTML structure**

Run: `grep -c 'data-lang=' docs/index.html`
Expected: A count > 20 (many bilingual content blocks)

- [ ] **Step 5: Verify all sections are present**

Run: `grep -oE 'id="(install|quickstart|features|faq)"' docs/index.html | sort -u`
Expected: Four section IDs listed

- [ ] **Step 6: Verify CSS file is referenced**

Run: `grep 'style.css' docs/index.html`
Expected: Match found in `<link>` tag

- [ ] **Step 7: Commit**

```bash
git add docs/index.html
git commit -m "docs: add Neo-Brutalist GitHub Pages site (EN/KR bilingual)"
```

---

### Task 3 (Final): End-to-End Verification

**Dependencies:** Task 1, Task 2
**Files:** None (read-only verification)

- [ ] **Step 1: Verify both files exist and are non-empty**

Run: `wc -l docs/index.html docs/style.css`
Expected: index.html > 200 lines, style.css > 200 lines

- [ ] **Step 2: Verify design system compliance**

Check the following in `docs/style.css`:
- [ ] `--border: 6px solid` or `8px solid` (bold black borders)
- [ ] `--shadow` uses `0` blur (hard-edge shadows, e.g., `6px 6px 0`)
- [ ] `--black: #000000`, `--white: #FFFFFF`, `--blue: #0000FF` (correct palette)
- [ ] `MiSans` font referenced
- [ ] ASCII symbols ▶ ● ■ ★ → used in HTML (check index.html)

- [ ] **Step 3: Verify bilingual content**

Run: `grep -c 'data-lang="ko"' docs/index.html`
Expected: At least 20 Korean content blocks present

Run: `grep -c 'data-lang="en"' docs/index.html`
Expected: Same or greater number of English content blocks

- [ ] **Step 4: Verify responsive design**

Check in `docs/style.css`:
- [ ] `@media (max-width: 768px)` breakpoint exists
- [ ] Grid layouts collapse to single column on mobile
- [ ] `@media (max-width: 480px)` breakpoint exists

- [ ] **Step 5: Verify no JavaScript framework dependencies**

Run: `grep -c 'react\|vue\|angular\|svelte\|import.*from' docs/index.html`
Expected: 0 matches (plain HTML + minimal JS for language toggle only)

- [ ] **Step 6: Verify all content sections match README**

Cross-reference with `README.md`:
- [ ] Installation command matches: `pi install git:github.com/tmdgusya/pi-engineering-discipline-extension`
- [ ] All 5 slash commands mentioned (`/clarify`, `/plan`, `/ultraplan`, `/ask`, `/reset-phase`)
- [ ] Agent types mentioned (12 agents, subagent modes)
- [ ] Skills count matches (11 behavioral skills)
- [ ] Prerequisite link to engineering-discipline repo present

- [ ] **Step 7: Run existing test suite for regressions**

Run: `cd extensions/agentic-harness && npm test`
Expected: All 32 tests pass — no regressions from adding docs files
