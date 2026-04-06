import { describe, it, expect } from "vitest";
import { getTurndownService } from "../webfetch/turndown.js";

describe("getTurndownService", () => {
  it("should return a turndown service instance", async () => {
    const service = await getTurndownService();
    expect(service).toBeDefined();
    expect(typeof service.turndown).toBe("function");
  });

  it("should convert simple HTML to markdown", async () => {
    const service = await getTurndownService();
    const html = "<h1>Hello</h1><p>This is a <strong>test</strong>.</p>";
    const md = service.turndown(html);
    expect(md).toContain("# Hello");
    expect(md).toContain("**test**");
  });

  it("should use ATX heading style (# style, not underline)", async () => {
    const service = await getTurndownService();
    const html = "<h1>H1</h1><h2>H2</h2><h3>H3</h3>";
    const md = service.turndown(html);
    expect(md).toContain("# H1");
    expect(md).toContain("## H2");
    expect(md).toContain("### H3");
  });

  it("should use fenced code blocks", async () => {
    const service = await getTurndownService();
    const html = "<pre><code>const x = 1;\nconsole.log(x);</code></pre>";
    const md = service.turndown(html);
    expect(md).toContain("```");
    expect(md).toContain("const x = 1;");
  });

  it("should use dash for bullet lists", async () => {
    const service = await getTurndownService();
    const html = "<ul><li>Item A</li><li>Item B</li></ul>";
    const md = service.turndown(html);
    expect(md).toContain("-   Item A");
    expect(md).toContain("-   Item B");
  });

  it("should support GFM tables", async () => {
    const service = await getTurndownService();
    const html = `
      <table>
        <thead><tr><th>Name</th><th>Value</th></tr></thead>
        <tbody><tr><td>A</td><td>1</td></tr></tbody>
      </table>
    `;
    const md = service.turndown(html);
    expect(md).toContain("Name");
    expect(md).toContain("Value");
  });

  it("should remove script, style, nav, header, footer, aside tags", async () => {
    const service = await getTurndownService();
    const html =
      "<p>Content</p><script>alert('xss')</script><style>.x{}</style>" +
      "<nav>Menu</nav><header>Top</header><footer>Bottom</footer><aside>Sidebar</aside>";
    const md = service.turndown(html);
    expect(md).toContain("Content");
    expect(md).not.toContain("alert");
    expect(md).not.toContain(".x{}");
    expect(md).not.toContain("Menu");
    expect(md).not.toContain("Top");
    expect(md).not.toContain("Bottom");
    expect(md).not.toContain("Sidebar");
  });

  it("should return the same instance on subsequent calls (singleton)", async () => {
    const a = await getTurndownService();
    const b = await getTurndownService();
    expect(a).toBe(b);
  });
});
