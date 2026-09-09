import { useEffect, useState } from "react";
import { resolveSignatureDocumentUrl } from "@/lib/resolveSignatureDocumentUrl";

export function useSignatureDocumentUrl(fileUrlOrPath: string | null | undefined) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrlOrPath) {
      setResolvedUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    resolveSignatureDocumentUrl(fileUrlOrPath)
      .then((url) => {
        if (cancelled) return;
        if (!url) {
          setError("לא ניתן לטעון את המסמך");
          setResolvedUrl(null);
        } else {
          setResolvedUrl(url);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "שגיאה בטעינת המסמך");
        setResolvedUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrlOrPath]);

  return { resolvedUrl, loading, error };
}
