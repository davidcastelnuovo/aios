import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { resolveSignatureDocumentUrl } from "@/lib/resolveSignatureDocumentUrl";

export function SignatureOriginalFileLink({
  fileUrl,
  label = "צפה בקובץ המקורי",
}: {
  fileUrl: string;
  label?: string;
}) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveSignatureDocumentUrl(fileUrl).then((url) => {
      if (!cancelled) setHref(url);
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (!href) {
    return <p className="text-sm text-muted-foreground">טוען קישור למסמך...</p>;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
      <ExternalLink className="h-4 w-4" />
      {label}
    </a>
  );
}
