/** Collect files from a paste/drop clipboard, including screenshot blobs. */

function namedClipboardFile(file: File): File {
  if (file.name && file.name !== "blob") return file;
  const subtype = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const ext = subtype.split("+")[0] || "png";
  return new File([file], `screenshot.${ext}`, {
    type: file.type || "image/png",
    lastModified: file.lastModified,
  });
}

export function filesFromClipboardData(
  data: {
    items?: Iterable<{ kind?: string; getAsFile?: () => File | null }>;
    files?: Iterable<File> | FileList | null;
  } | null,
): File[] {
  if (!data) return [];
  const files: File[] = [];
  const seen = new Set<string>();
  const push = (file: File | null | undefined) => {
    if (!file) return;
    const named = namedClipboardFile(file);
    const key = `${named.name}:${named.size}:${named.type}:${named.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(named);
  };
  if (data.items) {
    for (const item of Array.from(data.items)) {
      if (item.kind === "file" && typeof item.getAsFile === "function") {
        push(item.getAsFile());
      }
    }
  }
  if (data.files) {
    for (const file of Array.from(data.files)) push(file);
  }
  return files;
}

export function isClipboardTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.isContentEditable);
}

let clipboardPasteLock = false;

/** Prevent notes + files cubes from uploading the same Ctrl+V twice. */
export function claimClipboardPaste(): boolean {
  if (clipboardPasteLock) return false;
  clipboardPasteLock = true;
  queueMicrotask(() => {
    clipboardPasteLock = false;
  });
  return true;
}
