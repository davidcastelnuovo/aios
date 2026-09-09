import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText, ExternalLink, Eraser } from "lucide-react";
import {
  type DocumentField,
  parseDocumentFields,
  getFieldLabel,
  getFieldFontSizePx,
} from "@/components/signatures/signatureFieldTypes";
import { useSignatureDocumentUrl } from "@/hooks/useSignatureDocumentUrl";
import { SignatureDocumentViewer } from "@/components/signatures/SignatureDocumentViewer";
import { detectMediaKind } from "@/components/signatures/signatureDocumentMedia";

interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [docContainerHeight, setDocContainerHeight] = useState(700);
  const signatureCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [isDrawing, setIsDrawing] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureFieldSigned, setSignatureFieldSigned] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signed, setSigned] = useState(false);

  const {
    data: recipient,
    isLoading: loadingRecipient,
    isError: recipientQueryFailed,
    error: recipientQueryError,
  } = useQuery({
    queryKey: ["sign-recipient", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase.rpc("get_signature_by_token", { _token: token });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
    retry: 1,
  });

  useEffect(() => {
    if (!recipient?.field_values || typeof recipient.field_values !== "object") return;
    const existing = recipient.field_values as Record<string, string>;
    if (Object.keys(existing).length > 0) {
      setFieldValues(existing);
    }
  }, [recipient?.field_values]);

  const doc = recipient?.signature_documents as any;
  const { resolvedUrl: docFileUrl, loading: loadingDocFile } = useSignatureDocumentUrl(doc?.file_url);
  const signaturePosition = recipient?.signature_position as unknown as SignaturePosition | null;
  const recipientIndex = Math.max(0, (recipient?.sign_order ?? 1) - 1);
  const allDocFields = parseDocumentFields(doc?.document_fields);
  const myFields = allDocFields.filter((f) => (f.recipient_index ?? 0) === recipientIndex);
  const hasDocumentFields = myFields.length > 0;
  const useOverlay = !!docFileUrl && (hasDocumentFields || !!signaturePosition);

  const businessStamp = (recipient?.business_stamp ?? {}) as { name?: string | null; company_id?: string | null };
  const idNumberFromFields = myFields
    .filter((f) => f.type === "id_number")
    .map((f) => fieldValues[f.id]?.trim())
    .find(Boolean);
  const stampCompanyId = (idNumberFromFields || businessStamp.company_id || "").trim();
  const stampBusinessName = (businessStamp.name || recipient?.name || "").trim();
  const companyIdLabel = stampCompanyId
    ? (/^\d+$/.test(stampCompanyId) ? `ח.פ/ע.מ ${stampCompanyId}` : stampCompanyId)
    : "";

  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const nextW = Math.round(rect.width * dpr);
    const nextH = Math.round(rect.height * dpr);
    if (canvas.width === nextW && canvas.height === nextH) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      return;
    }
    canvas.width = nextW;
    canvas.height = nextH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
  }, []);

  useEffect(() => {
    if (useOverlay || !recipient) return;
    setupCanvas(canvasRef.current);
  }, [recipient, useOverlay, setupCanvas]);

  useEffect(() => {
    if (!useOverlay) return;
    const ids = hasDocumentFields
      ? myFields.filter((f) => f.type === "signature").map((f) => f.id)
      : signaturePosition
        ? ["legacy"]
        : [];
    for (const id of ids) {
      const canvas = id === "legacy" ? canvasRef.current : signatureCanvasRefs.current[id];
      setupCanvas(canvas);
    }

    const observers: ResizeObserver[] = [];
    for (const id of ids) {
      const canvas = id === "legacy" ? canvasRef.current : signatureCanvasRefs.current[id];
      if (!canvas) continue;
      const ro = new ResizeObserver(() => setupCanvas(canvas));
      ro.observe(canvas);
      observers.push(ro);
    }
    return () => observers.forEach((ro) => ro.disconnect());
  }, [useOverlay, hasDocumentFields, myFields, setupCanvas, docContainerHeight, signaturePosition]);

  const getPos = (
    e: React.MouseEvent | React.TouchEvent | React.PointerEvent,
    canvas: HTMLCanvasElement,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const point =
      "touches" in e && e.touches[0]
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as React.PointerEvent).clientX, y: (e as React.PointerEvent).clientY };
    return {
      x: point.x - rect.left,
      y: point.y - rect.top,
    };
  };

  const startDraw = (fieldId: string | null) => (
    e: React.MouseEvent | React.TouchEvent | React.PointerEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = fieldId
      ? signatureCanvasRefs.current[fieldId]
      : canvasRef.current;
    if (!canvas) return;
    setupCanvas(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if ("pointerId" in e) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    setIsDrawing(fieldId ?? "legacy");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (fieldId: string | null) => (
    e: React.MouseEvent | React.TouchEvent | React.PointerEvent,
  ) => {
    e.preventDefault();
    if (isDrawing !== (fieldId ?? "legacy")) return;
    const canvas = fieldId
      ? signatureCanvasRefs.current[fieldId]
      : canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (fieldId) {
      setSignatureFieldSigned((prev) => ({ ...prev, [fieldId]: true }));
    } else {
      setHasSignature(true);
    }
  };

  const endDraw = () => setIsDrawing(null);

  const clearSignature = (fieldId?: string) => {
    const canvas = fieldId ? signatureCanvasRefs.current[fieldId] : canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setupCanvas(canvas);
    if (fieldId) {
      setSignatureFieldSigned((prev) => ({ ...prev, [fieldId]: false }));
    } else {
      setHasSignature(false);
    }
  };

  const validateFields = (): boolean => {
    if (!hasDocumentFields) return hasSignature;

    for (const field of myFields) {
      if (!field.required) continue;
      if (field.type === "signature") {
        if (!signatureFieldSigned[field.id]) {
          toast.error(`נא למלא שדה: ${getFieldLabel(field.type)}`);
          return false;
        }
      } else if (!fieldValues[field.id]?.trim()) {
        toast.error(`נא למלא שדה: ${field.label || getFieldLabel(field.type)}`);
        return false;
      }
    }
    return true;
  };

  const collectFieldValues = (): Record<string, string> => {
    const values = { ...fieldValues };
    for (const field of myFields.filter((f) => f.type === "signature")) {
      const canvas = signatureCanvasRefs.current[field.id];
      if (canvas && signatureFieldSigned[field.id]) {
        values[field.id] = canvas.toDataURL("image/png");
      }
    }
    return values;
  };

  const getPrimarySignatureData = (values: Record<string, string>): string => {
    const sigField = myFields.find((f) => f.type === "signature");
    if (sigField && values[sigField.id]) return values[sigField.id];
    if (canvasRef.current && hasSignature) return canvasRef.current.toDataURL("image/png");
    const legacyCanvas = signatureCanvasRefs.current["legacy"];
    if (legacyCanvas) return legacyCanvas.toDataURL("image/png");
    return "";
  };

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!recipient || !token) throw new Error("Missing data");
      if (!validateFields()) throw new Error("validation_failed");

      const values = collectFieldValues();
      const signatureData = getPrimarySignatureData(values);
      if (!signatureData) throw new Error("missing_signature");

      const { data, error } = await supabase.functions.invoke("submit-signature", {
        body: { token, signatureData, fieldValues: values, action: "sign" },
      });
      const payload = (data ?? {}) as { error?: string; success?: boolean; ok?: boolean };
      const message = payload.error || (error as Error | null)?.message || "";
      if (message.includes("not_found_or_already_signed")) {
        // Signature may already be saved while PDF generation failed previously.
        return;
      }
      if (error && !payload.success && !payload.ok) throw error;
      if (payload.error) throw new Error(payload.error);
    },
    onSuccess: () => {
      setSigned(true);
      toast.success("החתימה נשמרה בהצלחה!");
    },
    onError: (err: any) => {
      if (err.message !== "validation_failed") {
        toast.error("שגיאה בשמירת החתימה: " + err.message);
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing data");
      const { data, error } = await supabase.functions.invoke("submit-signature", {
        body: { token, action: "decline" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setSigned(true);
      toast.info("סירבת לחתום על המסמך");
    },
  });

  const canSubmit = hasDocumentFields
    ? myFields.some((f) => f.type === "signature")
      ? myFields.filter((f) => f.required).every((f) =>
          f.type === "signature" ? signatureFieldSigned[f.id] : !!fieldValues[f.id]?.trim(),
        )
      : myFields.filter((f) => f.required).every((f) => !!fieldValues[f.id]?.trim())
    : hasSignature;

  const renderFieldOverlay = (field: DocumentField) => {
    const style = {
      left: `${field.position.x}%`,
      top: `${field.position.y}%`,
      width: `${field.position.width}%`,
      height: `${field.position.height}%`,
    };
    const fontSize = getFieldFontSizePx(field.position, docContainerHeight);

    if (field.type === "signature") {
      return (
        <div
          key={field.id}
          className="absolute border-2 border-primary rounded bg-white/80 z-10 overflow-hidden"
          style={style}
        >
          {stampBusinessName && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-1"
              style={{ color: "#6B7280", opacity: 0.72, transform: "rotate(-2deg)" }}
              aria-hidden
            >
              <div
                className="font-bold text-center leading-tight truncate max-w-full"
                style={{ fontSize: Math.max(10, fontSize + 2) }}
              >
                {stampBusinessName}
              </div>
              {companyIdLabel && (
                <div className="text-center leading-tight truncate max-w-full mt-0.5" style={{ fontSize: Math.max(8, fontSize - 1) }}>
                  {companyIdLabel}
                </div>
              )}
            </div>
          )}
          {field.label ? (
            <div
              className="absolute top-0 right-0 bg-primary text-primary-foreground px-1 py-0.5 rounded-bl z-10 pointer-events-none"
              style={{ fontSize: Math.max(8, fontSize - 2) }}
            >
              {field.label}
            </div>
          ) : null}
          <canvas
            ref={(el) => { signatureCanvasRefs.current[field.id] = el; }}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-[1] bg-transparent"
            onPointerDown={startDraw(field.id)}
            onPointerMove={draw(field.id)}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            onPointerCancel={endDraw}
          />
        </div>
      );
    }

    if (field.type === "address") {
      return (
        <div key={field.id} className="absolute" style={style}>
          <Textarea
            value={fieldValues[field.id] ?? ""}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
            placeholder={field.label}
            className="w-full h-full resize-none bg-white/95 border-primary"
            style={{ fontSize }}
            dir="rtl"
          />
        </div>
      );
    }

    if (field.type === "text") {
      return (
        <div key={field.id} className="absolute" style={style}>
          <Input
            type="text"
            value={fieldValues[field.id] ?? ""}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
            placeholder=""
            aria-label="שדה מילוי"
            className="w-full h-full bg-white/90 border-primary/70 px-1 shadow-none"
            style={{ fontSize }}
            dir="rtl"
          />
        </div>
      );
    }

    const inputType = field.type === "phone" ? "tel" : field.type === "date" ? "date" : "text";

    return (
      <div key={field.id} className="absolute" style={style}>
        <Input
          type={inputType}
          value={fieldValues[field.id] ?? ""}
          onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
          placeholder={field.label}
          className="w-full h-full bg-white/95 border-primary px-1"
          style={{ fontSize }}
          dir={field.type === "phone" || field.type === "id_number" ? "ltr" : "rtl"}
        />
      </div>
    );
  };

  if (loadingRecipient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  if (recipientQueryFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">שגיאה בטעינת המסמך</h2>
            <p className="text-muted-foreground">
              {(recipientQueryError as Error)?.message || "לא ניתן לטעון את קישור החתימה כרגע. נסו שוב."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!recipient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">קישור לא תקין</h2>
            <p className="text-muted-foreground">הקישור לחתימה אינו תקין או שפג תוקפו.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (recipient.status === "signed" || signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">תודה!</h2>
            <p className="text-muted-foreground">
              {recipient.status === "declined" ? "סירבת לחתום על המסמך." : "החתימה נשמרה בהצלחה."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-1">חתימה דיגיטלית</h1>
          <p className="text-muted-foreground">שלום {recipient.name}, אנא מלא את השדות וחתום על המסמך</p>
        </div>

        {useOverlay ? (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {doc?.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <SignatureDocumentViewer
                fileUrl={docFileUrl}
                mediaKind={detectMediaKind(doc?.file_url)}
                forcePdf={
                  !!doc?.file_url &&
                  !/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(doc.file_url) &&
                  doc.document_type === "uploaded"
                }
                loading={loadingDocFile}
                error={!docFileUrl && !loadingDocFile ? "לא ניתן לטעון את המסמך" : null}
                onHeightChange={setDocContainerHeight}
                className="bg-white"
              >
                {hasDocumentFields
                  ? myFields.map(renderFieldOverlay)
                  : signaturePosition && (
                    <div
                      className="absolute border-2 border-primary rounded bg-white/80 z-10 overflow-hidden"
                      style={{
                        left: `${signaturePosition.x}%`,
                        top: `${signaturePosition.y}%`,
                        width: `${signaturePosition.width}%`,
                        height: `${signaturePosition.height}%`,
                      }}
                    >
                      {stampBusinessName && (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-1"
                          style={{ color: "#6B7280", opacity: 0.72, transform: "rotate(-2deg)" }}
                          aria-hidden
                        >
                          <div className="font-bold text-center leading-tight truncate max-w-full text-sm">
                            {stampBusinessName}
                          </div>
                          {companyIdLabel && (
                            <div className="text-center leading-tight truncate max-w-full text-xs mt-0.5">
                              {companyIdLabel}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-bl z-10 pointer-events-none">
                        חתום כאן
                      </div>
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-[1] bg-transparent"
                        onPointerDown={startDraw(null)}
                        onPointerMove={draw(null)}
                        onPointerUp={endDraw}
                        onPointerLeave={endDraw}
                        onPointerCancel={endDraw}
                      />
                    </div>
                  )}
              </SignatureDocumentViewer>

              <div className="flex justify-end mt-2 gap-2">
                {hasDocumentFields && myFields.some((f) => f.type === "signature") && (
                  myFields.filter((f) => f.type === "signature").map((f) => (
                    <Button key={f.id} variant="ghost" size="sm" onClick={() => clearSignature(f.id)}>
                      <Eraser className="h-4 w-4 ml-1" />
                      נקה {f.label}
                    </Button>
                  ))
                )}
                {!hasDocumentFields && (
                  <Button variant="ghost" size="sm" onClick={() => clearSignature()}>
                    <Eraser className="h-4 w-4 ml-1" />
                    נקה חתימה
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {doc?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {doc?.document_type === "created" && doc?.content && (
                  <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg max-h-96 overflow-y-auto border">
                    {doc.content}
                  </div>
                )}
                {doc?.document_type === "uploaded" && doc?.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    צפה בקובץ המקורי
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">חתימה</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => clearSignature()}>
                    <Eraser className="h-4 w-4 ml-1" />
                    נקה
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: "200px" }}
                    onPointerDown={startDraw(null)}
                    onPointerMove={draw(null)}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                    onPointerCancel={endDraw}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  צייר את חתימתך בתוך המלבן למעלה
                </p>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            variant="destructive"
            onClick={() => declineMutation.mutate()}
            disabled={declineMutation.isPending}
          >
            <XCircle className="h-4 w-4 ml-2" />
            סירוב
          </Button>
          <Button
            onClick={() => signMutation.mutate()}
            disabled={!canSubmit || signMutation.isPending}
            className="min-w-32"
          >
            <CheckCircle className="h-4 w-4 ml-2" />
            {signMutation.isPending ? "חותם..." : "חתום"}
          </Button>
        </div>
      </div>
    </div>
  );
}
