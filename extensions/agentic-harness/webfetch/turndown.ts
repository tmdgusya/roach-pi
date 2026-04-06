/**
 * Lazy-initialized Turndown service with GFM plugin support.
 * Dynamic imports defer loading ~1.4MB+ of libraries until first use.
 */

type TurndownService = InstanceType<typeof import("turndown").default>;

let turndownPromise: Promise<TurndownService> | undefined;

/**
 * Get the shared Turndown service instance.
 * Configured with:
 * - ATX headings (# style)
 * - Fenced code blocks (```)
 * - Dash bullet lists (-)
 * - GFM plugin (tables, strikethrough, task lists)
 * - Removes script, style, nav, header, footer, aside tags
 */
export async function getTurndownService(): Promise<TurndownService> {
  return (turndownPromise ??= (async () => {
    const [turndownMod, gfmMod] = await Promise.all([
      import("turndown"),
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

    // Apply GFM plugin for tables, strikethrough, task lists
    service.use(gfm);

    // Strip noise elements
    service.remove(["script", "style", "nav", "header", "footer", "aside"]);

    return service;
  })());
}
