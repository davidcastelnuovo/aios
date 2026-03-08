import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText, ExternalLink, Eraser } from "lucide-react";

interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signed, setSigned] = useState(false);

  // Fetch recipient by token
  const { data: recipient, isLoading: loadingRecipient } = useQuery({
    queryKey: ["sign-recipient", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from("signature_recipients")
        .select("*, signature_documents(*)")
        .eq("sign_token", token)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const signaturePosition = recipient?.signature_position as SignaturePosition | null;
  const useOverlay = !!signaturePosition && recipient?.signature_documents?.file_url;

  // Setup standalone canvas (fallback)
  useEffect(() => {
    if (useOverlay) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
  }, [recipient, useOverlay]);

  // Setup overlay canvas
  useEffect(() => {
    if (!useOverlay) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
  }, [useOverlay, signaturePosition]);

  const getActiveCanvas = () => useOverlay ? overlayCanvasRef.current : canvasRef.current;

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = getActiveCanvas()!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getActiveCanvas()?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = getActiveCanvas()?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      const canvas = getActiveCanvas();
      if (!canvas || !recipient) throw new Error("Missing data");
      const signatureData = canvas.toDataURL("image/png");
      
      const { error: recError } = await supabase
        .from("signature_recipients")
        .update({
          status: "signed",
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          ip_address: "client-side",
        })
        .eq("id", recipient.id);
      if (recError) throw recError;

      const { data: allRecipients } = await supabase
        .from("signature_recipients")
        .select("status")
        .eq("document_id", recipient.document_id);

      const unsignedCount = (allRecipients || []).filter(r => r.status === "pending").length;
      const newStatus = unsignedCount <= 1 ? "completed" : "partially_signed";

      await supabase
        .from("signature_documents")
        .update({ 
          status: newStatus,
          ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq("id", recipient.document_id);
    },
    onSuccess: () => {
      setSigned(true);
      toast.success("החתימה נשמרה בהצלחה!");
    },
    onError: (err: any) => toast.error("שגיאה בשמירת החתימה: " + err.message),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!recipient) throw new Error("Missing data");
      await supabase
        .from("signature_recipients")
        .update({ status: "declined" })
        .eq("id", recipient.id);
    },
    onSuccess: () => {
      setSigned(true);
      toast.info("סירבת לחתום על המסמך");
    },
  });

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

  const doc = recipient.signature_documents as any;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-1">חתימה דיגיטלית</h1>
          <p className="text-muted-foreground">שלום {recipient.name}, אנא חתום על המסמך הבא</p>
        </div>

        {/* Document with overlay signature */}
        {useOverlay ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {doc?.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={documentContainerRef} className="relative">
                {/* Document preview */}
                {/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(doc.file_url) ? (
                  <img src={doc.file_url} alt="Document" className="w-full h-auto rounded" />
                ) : (
                  <iframe src={doc.file_url} className="w-full border-0 rounded" style={{ height: 700 }} title="Document" />
                )}

                {/* Signature overlay area */}
                <div
                  className="absolute border-2 border-primary rounded bg-white/90 overflow-hidden"
                  style={{
                    left: `${signaturePosition!.x}%`,
                    top: `${signaturePosition!.y}%`,
                    width: `${signaturePosition!.width}%`,
                    height: `${signaturePosition!.height}%`,
                  }}
                >
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-bl z-10">
                    חתום כאן
                  </div>
                  <canvas
                    ref={overlayCanvasRef}
                    className="w-full h-full cursor-crosshair touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <Button variant="ghost" size="sm" onClick={clearSignature}>
                  <Eraser className="h-4 w-4 ml-1" />
                  נקה חתימה
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Document (no overlay) */}
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

            {/* Standalone Signature Pad */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">חתימה</CardTitle>
                  <Button variant="ghost" size="sm" onClick={clearSignature}>
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
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
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

        {/* Actions */}
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
            disabled={!hasSignature || signMutation.isPending}
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
