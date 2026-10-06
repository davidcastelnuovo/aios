/** Stored object paths are tenant-owned; an external URL is represented by null. */
export function signatureStoragePath(fileUrl: string, tenantId: string): string | null {
  let path = fileUrl;
  if (/^https?:\/\//i.test(fileUrl)) {
    const url = new URL(fileUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/signature-documents\/(.+)$/);
    if (!match) return null;
    path = decodeURIComponent(match[1]);
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(fileUrl)) {
    throw new Error('invalid_document_url');
  }
  path = path.replace(/^\/+/, '').replace(/^signature-documents\//, '');
  if (!path.startsWith(`${tenantId}/`) || path.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('invalid_document_path');
  }
  return path;
}
