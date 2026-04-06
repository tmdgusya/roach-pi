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
