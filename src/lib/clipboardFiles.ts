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

export function isClipboardImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|avif)$/i.test(file.name);
}

export function filesFromClipboardData(
  data: {
    items?: Iterable<{ kind?: string; type?: string; getAsFile?: () => File | null }>;
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
      const imageItem = (item.type || "").startsWith("image/");
      if (typeof item.getAsFile === "function" && (item.kind === "file" || imageItem)) {
        push(item.getAsFile());
      }
    }
  }
  if (data.files) {
    for (const file of Array.from(data.files)) push(file);
  }
  return files;
}

/** The files drop zone is a real field, but Ctrl+V there is an upload — not notes text. */
export function isFilePasteField(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    dataset?: { filePaste?: string };
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => EventTarget | null;
  };
  if (el.dataset?.filePaste === "true") return true;
  if (typeof el.getAttribute === "function" && el.getAttribute("data-file-paste") === "true") return true;
  if (typeof el.closest === "function" && el.closest("[data-file-paste]")) return true;
  return false;
}

/** Page-level Ctrl+V: images leave notes and become attachments; other text stays in the field. */
export function shouldUploadClipboardPaste(target: EventTarget | null, files: File[]): boolean {
  if (!files.length) return false;
  if (isClipboardTypingTarget(target) && !files.some(isClipboardImage)) return false;
  return true;
}

export function isClipboardTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  if (isFilePasteField(target)) return false;
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
