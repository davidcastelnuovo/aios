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
} from "@/components/signatures/signatureFieldTypes";

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
  const signatureCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [isDrawing, setIsDrawing] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureFieldSigned, setSignatureFieldSigned] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signed, setSigned] = useState(false);

  const { data: recipient, isLoading: loadingRecipient } = useQuery({
    queryKey: ["sign-recipient", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase.rpc("get_signature_by_token", { _token: token });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (!recipient?.field_values || typeof recipient.field_values !== "object") return;
    const existing = recipient.field_values as Record<string, string>;
    if (Object.keys(existing).length > 0) {
      setFieldValues(existing);
    }
  }, [recipient?.field_values]);

  const doc = recipient?.signature_documents as any;
  const signaturePosition = recipient?.signature_position as unknown as SignaturePosition | null;
  const recipientIndex = Math.max(0, (recipient?.sign_order ?? 1) - 1);
  const allDocFields = parseDocumentFields(doc?.document_fields);
  const myFields = allDocFields.filter((f) => (f.recipient_index ?? 0) === recipientIndex);
  const hasDocumentFields = myFields.length > 0;
  const useOverlay = !!doc?.file_url && (hasDocumentFields || !!signaturePosition);

  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
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
    if (!useOverlay || !hasDocumentFields) return;
    for (const field of myFields.filter((f) => f.type === "signature")) {
      setupCanvas(signatureCanvasRefs.current[field.id]);
    }
  }, [useOverlay, hasDocumentFields, myFields, setupCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (fieldId: string | null) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = fieldId
      ? signatureCanvasRefs.current[fieldId]
      : canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    setIsDrawing(fieldId ?? "legacy");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (fieldId: string | null) => (e: React.MouseEvent | React.TouchEvent) => {
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        toast.error(`נא למלא שדה: ${field.label}`);
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
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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

    if (field.type === "signature") {
      return (
        <div
          key={field.id}
          className="absolute border-2 border-primary rounded bg-white/95 overflow-hidden"
          style={style}
        >
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] px-1 py-0.5 rounded-bl z-10">
            {field.label}
          </div>
          <canvas
            ref={(el) => { signatureCanvasRefs.current[field.id] = el; }}
            className="w-full h-full cursor-crosshair touch-none"
            onMouseDown={startDraw(field.id)}
            onMouseMove={draw(field.id)}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw(field.id)}
            onTouchMove={draw(field.id)}
            onTouchEnd={endDraw}
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
            className="w-full h-full text-[11px] resize-none bg-white/95 border-primary"
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
          className="w-full h-full text-[11px] bg-white/95 border-primary px-1"
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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-1">חתימה דיגיטלית</h1>
          <p className="text-muted-foreground">שלום {recipient.name}, אנא מלא את השדות וחתום על המסמך</p>
        </div>

        {useOverlay ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {doc?.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(doc.file_url) ? (
                  <img src={doc.file_url} alt="Document" className="w-full h-auto rounded" />
                ) : (
                  <iframe src={doc.file_url} className="w-full border-0 rounded" style={{ height: 700 }} title="Document" />
                )}

                {hasDocumentFields
                  ? myFields.map(renderFieldOverlay)
                  : signaturePosition && (
                    <div
                      className="absolute border-2 border-primary rounded bg-white/90 overflow-hidden"
                      style={{
                        left: `${signaturePosition.x}%`,
                        top: `${signaturePosition.y}%`,
                        width: `${signaturePosition.width}%`,
                        height: `${signaturePosition.height}%`,
                      }}
                    >
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-bl z-10">
                        חתום כאן
                      </div>
                      <canvas
                        ref={canvasRef}
                        className="w-full h-full cursor-crosshair touch-none"
                        onMouseDown={startDraw(null)}
                        onMouseMove={draw(null)}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw(null)}
                        onTouchMove={draw(null)}
                        onTouchEnd={endDraw}
                      />
                    </div>
                  )}
              </div>

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
                    onMouseDown={startDraw(null)}
                    onMouseMove={draw(null)}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw(null)}
                    onTouchMove={draw(null)}
                    onTouchEnd={endDraw}
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
