import type { App, TFile } from "obsidian";
import type { AnkiConnectClient } from "./anki-connect";
import { createBinaryHash } from "./sync-utils";

const EXTERNAL_SOURCE_PATTERN = /^(?:https?:|data:|anki:)/i;

export function extractEmbeddedLinks(markdown: string): string[] {
  const links: string[] = [];
  const wikiPattern = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/g;
  const markdownPattern = /!\[[^\]]*]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g;
  for (const match of markdown.matchAll(wikiPattern)) {
    if (match[1]) links.push(match[1].trim());
  }
  for (const match of markdown.matchAll(markdownPattern)) {
    const link = (match[1] ?? match[2])?.trim();
    if (link && !EXTERNAL_SOURCE_PATTERN.test(link)) {
      try {
        links.push(decodeURIComponent(link));
      } catch {
        links.push(link);
      }
    }
  }
  return [...new Set(links)];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function safeMediaName(name: string): string {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function decodeMediaSource(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isExactMediaSourceMatch(
  source: string,
  dataPath: string,
  resourcePath: string,
  filePath: string
): boolean {
  return (
    source === resourcePath ||
    decodeMediaSource(source) === decodeMediaSource(resourcePath) ||
    dataPath === filePath ||
    decodeMediaSource(dataPath) === filePath
  );
}

export interface MediaRewriteResult {
  html: string;
  mediaCount: number;
}

export async function rewriteEmbeddedMediaForAnki(
  app: App,
  sourceFile: TFile,
  markdown: string,
  container: HTMLElement,
  client: AnkiConnectClient | null
): Promise<MediaRewriteResult> {
  if (!client) {
    return { html: container.innerHTML, mediaCount: 0 };
  }

  const links = extractEmbeddedLinks(markdown);
  const files = links
    .map((link) => app.metadataCache.getFirstLinkpathDest(link, sourceFile.path))
    .filter((file): file is TFile => file !== null && file.extension.toLowerCase() !== "md");
  const mediaElements = Array.from(container.querySelectorAll<HTMLElement>(
    "img[src], audio[src], video[src], source[src]"
  ));
  const used = new Set<HTMLElement>();
  let mediaCount = 0;
  const fileNameCounts = new Map<string, number>();
  for (const file of files) {
    const name = file.name.toLowerCase();
    fileNameCounts.set(name, (fileNameCounts.get(name) ?? 0) + 1);
  }

  for (const mediaFile of files) {
    const resourcePath = app.vault.getResourcePath(mediaFile);
    const linkName = mediaFile.name.toLowerCase();
    let elements = mediaElements.filter(
      (candidate) =>
        !used.has(candidate) &&
        isExactMediaSourceMatch(
          candidate.getAttribute("src") ?? "",
          candidate.getAttribute("data-path") ?? "",
          resourcePath,
          mediaFile.path
        )
    );
    if (elements.length === 0 && fileNameCounts.get(linkName) === 1) {
      elements = mediaElements.filter((candidate) => {
        if (used.has(candidate)) return false;
        const source = decodeMediaSource(candidate.getAttribute("src") ?? "").toLowerCase();
        const dataPath = decodeMediaSource(candidate.getAttribute("data-path") ?? "").toLowerCase();
        return (
          source.endsWith(`/${mediaFile.path.toLowerCase()}`) ||
          dataPath === mediaFile.path.toLowerCase() ||
          source.endsWith(`/${linkName}`)
        );
      });
    }

    if (elements.length === 0) continue;
    const binary = await app.vault.readBinary(mediaFile);
    const hash = await createBinaryHash(binary);
    const filename = `obsidian_${hash.slice(0, 12)}_${safeMediaName(mediaFile.name)}`;
    await client.storeMediaFile(filename, arrayBufferToBase64(binary));
    for (const element of elements) {
      element.setAttribute("src", filename);
      element.removeAttribute("data-path");
      used.add(element);
      mediaCount += 1;
    }
  }

  return { html: container.innerHTML, mediaCount };
}
