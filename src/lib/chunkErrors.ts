/** True for Vite/webpack failures loading a lazy route chunk (often after a deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : String(error ?? ""),
    error instanceof Error ? error.name : "",
    error instanceof Error ? error.stack ?? "" : "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("error loading dynamically imported module") ||
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("loading css chunk")
  );
}
