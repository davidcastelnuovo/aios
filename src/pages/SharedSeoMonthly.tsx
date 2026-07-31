import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoMonthlySlideshow, SeoMonthlySlideshowCaptureStack } from "@/components/seo/SeoMonthlySlideshow";
import { isSeoMonthlyShareSnapshot, SeoMonthlyShareSnapshot } from "@/lib/seoMonthlyShareSnapshot";
import { downloadSeoMonthlySlideshowPdf } from "@/lib/seoMonthlyPdf";
import { toast } from "sonner";

export default function SharedSeoMonthly() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [exporting, setExporting] = useState(false);
  const stackRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-seo-monthly", shareToken],
    queryFn: async () => {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-seo-monthly`;
      const res = await fetch(`${baseUrl}?token=${encodeURIComponent(shareToken || "")}`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      return res.json() as Promise<{ snapshot: unknown; month: string; updated_at: string }>;
    },
    enabled: !!shareToken,
    retry: 1,
  });

  const snapshot = useMemo<SeoMonthlyShareSnapshot | null>(() => {
    if (!data?.snapshot) return null;
    return isSeoMonthlyShareSnapshot(data.snapshot) ? data.snapshot : null;
  }, [data]);

  const onExportPdf = async () => {
    if (!snapshot || !stackRef.current) return;
    setExporting(true);
    try {
      // Let capture stack mount/paint
      await new Promise((r) => setTimeout(r, 80));
      const safeName = `${snapshot.clientName}-${snapshot.monthLabel}`
        .replace(/[^\w\u0590-\u05FF-]+/g, "-")
        .slice(0, 60);
      await downloadSeoMonthlySlideshowPdf(stackRef.current, `seo-${safeName}.pdf`);
      toast.success("ה־PDF הורד");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "שגיאה ביצוא PDF");
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#071820] text-[#F4F0E6]"
        dir="rtl"
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#2DA89E]" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#071820] px-6 text-center text-[#F4F0E6]"
        dir="rtl"
      >
        <p className="text-xl font-semibold">הקישור לא נמצא או פג תוקף</p>
        <p className="text-sm text-[#F4F0E6]/60">בקשו מהסוכנות קישור שיתוף מעודכן לדוח SEO.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-[#071820]" dir="rtl">
      <div className="absolute left-4 top-4 z-30 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 bg-white/10 text-[#F4F0E6] hover:bg-white/20"
          disabled={exporting}
          onClick={onExportPdf}
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          PDF
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <SeoMonthlySlideshow snapshot={snapshot} className="h-full" />
      </div>
      {/* Always mounted for PDF capture */}
      <SeoMonthlySlideshowCaptureStack snapshot={snapshot} stackRef={stackRef} />
    </div>
  );
}
