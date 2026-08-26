import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { resolveCreativeImageUrl } from "@/components/marketing/lib/resolveCreativeImageUrl";
import {
  applyEraseMarks,
  createKeepMask,
  maskHasCoverage,
  type EraseMark,
  type ErasePoint,
} from "./eraseMask";
import type { ImageSize } from "./imageCost";
import type { CreativeVariation } from "./types";
import { aspectRatioClass } from "./utils";
import { cn } from "@/lib/utils";
import { Eraser, Loader2, Square, Undo2 } from "lucide-react";

export type EraseJob = {
  maskPngBase64: string;
  imagePngBase64: string;
  markedFile: File;
  hint: string;
};

interface Props {
  variation: CreativeVariation | null;
  size: ImageSize;
  liveTextLayers?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (job: EraseJob) => void;
}

const parseSize = (size: ImageSize) => {
  const [width, height] = size.split("x").map(Number);
  return { width: width || 1024, height: height || 1024 };
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      resolve(raw.slice(raw.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png failed"))), "image/png");
  });

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
    image.src = url;
  });

export function CreativeEraseDialog({
  variation,
  size,
  liveTextLayers,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const { width, height } = parseSize(size);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState("");
  const [tool, setTool] = useState<"brush" | "rect">("brush");
  const [radius, setRadius] = useState(0.045);
  const [marks, setMarks] = useState<EraseMark[]>([]);
  const [draft, setDraft] = useState<EraseMark | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const painting = useRef(false);
  const rectOrigin = useRef<ErasePoint | null>(null);

  useEffect(() => {
    if (!variation?.imageUrl) {
      setPhoto(null);
      setMarks([]);
      setDraft(null);
      setHint("");
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMarks([]);
    setDraft(null);
    setHint("");
    void resolveCreativeImageUrl(variation.imageUrl)
      .then((url) => loadImage(url ?? variation.imageUrl!))
      .then((image) => {
        if (!cancelled) setPhoto(image);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "טעינת התמונה נכשלה");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [variation?.id, variation?.imageUrl]);

  const allMarks = draft ? [...marks, draft] : marks;
  const coverage = maskHasCoverage(applyEraseMarks(createKeepMask(64, 64), 64, 64, allMarks));

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (photo) ctx.drawImage(photo, 0, 0, width, height);
    ctx.fillStyle = "rgba(225, 29, 72, 0.55)";
    ctx.strokeStyle = "rgba(225, 29, 72, 0.8)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const mark of allMarks) {
      if (mark.type === "rect") {
        ctx.fillRect(mark.x * width, mark.y * height, mark.width * width, mark.height * height);
        continue;
      }
      if (mark.points.length === 0) continue;
      ctx.lineWidth = Math.max(2, mark.radius * 2 * Math.min(width, height));
      ctx.beginPath();
      mark.points.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [photo, allMarks, width, height]);

  const pointFromEvent = (event: React.PointerEvent): ErasePoint | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const box = frame.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    painting.current = true;
    if (tool === "rect") {
      rectOrigin.current = point;
      setDraft({ type: "rect", x: point.x, y: point.y, width: 0, height: 0 });
    } else {
      rectOrigin.current = null;
      setDraft({ type: "stroke", points: [point], radius });
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!painting.current || !draft) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (draft.type === "rect") {
      const origin = rectOrigin.current ?? { x: draft.x, y: draft.y };
      setDraft({
        type: "rect",
        x: Math.min(origin.x, point.x),
        y: Math.min(origin.y, point.y),
        width: Math.abs(point.x - origin.x),
        height: Math.abs(point.y - origin.y),
      });
      return;
    }
    setDraft({ ...draft, points: [...draft.points, point] });
  };

  const onPointerUp = () => {
    painting.current = false;
    rectOrigin.current = null;
    if (!draft) return;
    const keep = draft.type === "rect"
      ? draft.width > 0.004 && draft.height > 0.004
      : draft.points.length > 0;
    if (keep) setMarks((current) => [...current, draft]);
    setDraft(null);
  };

  const exportJob = async (): Promise<EraseJob> => {
    if (!photo) throw new Error("אין תמונה");
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = width;
    imageCanvas.height = height;
    const imageCtx = imageCanvas.getContext("2d");
    if (!imageCtx) throw new Error("canvas");
    imageCtx.drawImage(photo, 0, 0, width, height);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) throw new Error("canvas");
    const mask = applyEraseMarks(createKeepMask(width, height), width, height, marks);
    maskCtx.putImageData(new ImageData(mask, width, height), 0, 0);

    const markedCanvas = document.createElement("canvas");
    markedCanvas.width = width;
    markedCanvas.height = height;
    const markedCtx = markedCanvas.getContext("2d");
    if (!markedCtx) throw new Error("canvas");
    markedCtx.drawImage(imageCanvas, 0, 0);
    markedCtx.fillStyle = "rgba(225, 29, 72, 0.7)";
    markedCtx.strokeStyle = "rgba(225, 29, 72, 0.95)";
    markedCtx.lineCap = "round";
    markedCtx.lineJoin = "round";
    for (const mark of marks) {
      if (mark.type === "rect") {
        markedCtx.fillRect(mark.x * width, mark.y * height, mark.width * width, mark.height * height);
        continue;
      }
      if (mark.points.length === 0) continue;
      markedCtx.lineWidth = Math.max(2, mark.radius * 2 * Math.min(width, height));
      markedCtx.beginPath();
      mark.points.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) markedCtx.moveTo(x, y);
        else markedCtx.lineTo(x, y);
      });
      markedCtx.stroke();
    }

    const [imageBlob, maskBlob, markedBlob] = await Promise.all([
      canvasToBlob(imageCanvas),
      canvasToBlob(maskCanvas),
      canvasToBlob(markedCanvas),
    ]);
    const [imagePngBase64, maskPngBase64] = await Promise.all([
      blobToBase64(imageBlob),
      blobToBase64(maskBlob),
    ]);
    return {
      imagePngBase64,
      maskPngBase64,
      markedFile: new File([markedBlob], "erase-mark.png", { type: "image/png" }),
      hint: hint.trim(),
    };
  };

  return (
    <Dialog open={!!variation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>מחק אזור מהתמונה</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          סמנו את מה שצריך להיעלם — למשל המילה «פרומו». ה־AI ממלא את החור מהצילום מסביב ולא מוסיף טקסט חדש.
          {liveTextLayers ? " אם זו שכבת טקסט חיה, מחקו אותה ב«שכבות»." : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={tool === "brush" ? "default" : "outline"} className="h-8 gap-1" onClick={() => setTool("brush")}>
            <Eraser className="h-3.5 w-3.5" />מברשת
          </Button>
          <Button size="sm" variant={tool === "rect" ? "default" : "outline"} className="h-8 gap-1" onClick={() => setTool("rect")}>
            <Square className="h-3.5 w-3.5" />מלבן
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setMarks((current) => current.slice(0, -1))} disabled={marks.length === 0}>
            <Undo2 className="h-3.5 w-3.5" />בטל
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setMarks([]); setDraft(null); }} disabled={marks.length === 0}>
            נקה
          </Button>
        </div>
        {tool === "brush" && (
          <div className="space-y-1.5">
            <Label>עובי מברשת</Label>
            <Slider min={0.02} max={0.12} step={0.005} value={[radius]} onValueChange={(value) => setRadius(value[0] ?? 0.045)} />
          </div>
        )}
        <div
          ref={frameRef}
          className={cn("relative overflow-hidden rounded-xl border bg-muted", aspectRatioClass(variation?.format))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={overlayRef} className="absolute inset-0 h-full w-full touch-none cursor-crosshair object-fill" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="erase-hint">מה מסומן? (רשות, עוזר לדיוק)</Label>
          <Textarea
            id="erase-hint"
            className="min-h-16"
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            placeholder="למשל: המילה פרומו"
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            disabled={!coverage || loading || submitting || !photo}
            onClick={() => {
              void exportJob().then(onSubmit).catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "ייצוא הסימון נכשל");
              });
            }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            מחק את הסימון
          </Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
