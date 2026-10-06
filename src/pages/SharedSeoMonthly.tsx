import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoMonthlyLandingPage, SeoMonthlyLandingPageCapture } from "@/components/seo/SeoMonthlyLandingPage";
import { isSeoMonthlyShareSnapshot, SeoMonthlyShareSnapshot } from "@/lib/seoMonthlyShareSnapshot";
import { downloadSeoMonthlySlideshowPdf } from "@/lib/seoMonthlyPdf";
import { toast } from "sonner";

type LocationState = {
  fromApp?: boolean;
  returnTo?: string;
};

export default function SharedSeoMonthly() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state || {}) as LocationState;
  const [exporting, setExporting] = useState(false);
  const stackRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["shared-seo-monthly", shareToken],
    queryFn: async () => {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-seo-monthly`;
      const res = await fetch(`${baseUrl}?token=${encodeURIComponent(shareToken || "")}`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed (${res.status})`);
      }
      return res.json() as Promise<{
        snapshot: unknown;
        month: string;
        updated_at: string;
        live?: boolean;
      }>;
    },
    enabled: !!shareToken,
    retry: 1,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const snapshot = useMemo<SeoMonthlyShareSnapshot | null>(() => {
    if (!data?.snapshot) return null;
    return isSeoMonthlyShareSnapshot(data.snapshot) ? data.snapshot : null;
  }, [data, dataUpdatedAt]);

  const canCloseToApp = Boolean(locationState.fromApp || locationState.returnTo);

  const handleClose = () => {
    if (locationState.returnTo) {
      navigate(locationState.returnTo);
      return;
    }
    if (locationState.fromApp && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const onExportPdf = async () => {
    if (!stackRef.current) return;
    setExporting(true);
    try {
      // Refresh once more so PDF includes the newest work items/links.
      const fresh = await refetch();
      const freshSnapshot = isSeoMonthlyShareSnapshot(fresh.data?.snapshot)
        ? fresh.data.snapshot
        : snapshot;
      if (!freshSnapshot) throw new Error("אין מצגת ליצוא");
      await new Promise((r) => setTimeout(r, 120));
      const safeName = `${freshSnapshot.clientName}-${freshSnapshot.monthLabel}`
        .replace(/[^\w\u0590-\u05FF-]+/g, "-")
        .slice(0, 60);
      await downloadSeoMonthlySlideshowPdf(stackRef.current, `seo-${safeName}.pdf`);
      toast.success("ה־PDF הורד (כולל קישורים לחיצים)");
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
        className="flex min-h-screen items-center justify-center bg-[#f6f8f5] text-[#172a32]"
        dir="rtl"
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#0f766e]" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f8f5] px-6 text-center text-[#172a32]"
        dir="rtl"
      >
        <p className="text-xl font-semibold">הקישור לא נמצא או פג תוקף</p>
        <p className="text-sm text-slate-500">בקשו מהסוכנות קישור שיתוף מעודכן לדוח SEO.</p>
        {canCloseToApp && (
          <Button variant="secondary" className="mt-2" onClick={handleClose}>
            חזרה לדשבורד
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#f6f8f5]" dir="rtl">
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 p-4">
        <div className="flex gap-2">
          {canCloseToApp && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 border border-slate-200 bg-white text-[#172a32] shadow-sm hover:bg-slate-50"
              onClick={handleClose}
            >
              <X className="h-3.5 w-3.5" />
              סגור · חזרה לדשבורד
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {isFetching && (
            <span className="inline-flex items-center gap-1.5 self-center text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              מעדכן…
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 border border-slate-200 bg-white text-[#172a32] shadow-sm hover:bg-slate-50"
            disabled={exporting}
            onClick={onExportPdf}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF
          </Button>
        </div>
      </div>
      <SeoMonthlyLandingPage key={snapshot.generatedAt} snapshot={snapshot} />
      {/* Always mounted for PDF capture */}
      <SeoMonthlyLandingPageCapture snapshot={snapshot} reportRef={stackRef} />
    </div>
  );
}
