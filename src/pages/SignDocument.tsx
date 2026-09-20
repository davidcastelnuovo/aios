import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText, Eraser, ChevronLeft } from "lucide-react";
import { type DocumentField, parseDocumentFields, getFieldLabel, getFieldFontSizePx,
  isSignatureFieldType, isStampSignatureType } from "@/components/signatures/signatureFieldTypes";
import type { SignaturePosition } from "@/components/signatures/SignatureFieldPlacer";
import { SignatureDocumentViewer } from "@/components/signatures/SignatureDocumentViewer";
import { SignaturePageNavigation } from "@/components/signatures/SignaturePageNavigation";
import { SignatureCanvas } from "@/components/signatures/SignatureCanvas";
import { detectMediaKind } from "@/components/signatures/signatureDocumentMedia";
import { getSignatureStamp, applySignatureStamp } from "@/lib/signatureStamp";
import {
  fieldFillLabel,
  isFieldRequired,
  missingRequiredForSubmit,
  nextFieldToFill,
} from "@/lib/signatureFieldGuide";

interface SigningRecipient {
  id: string;
  name: string;
  status: string;
  sign_order: number;
  signature_position: SignaturePosition | null;
  field_values: Record<string, string> | null;
  business_stamp?: { name?: string | null; company_id?: string | null };
  signature_documents: {
    title: string; status: string; file_url: string | null; content: string | null;
    document_type: string; document_fields: unknown;
  };
}

const LEGACY_SIGNATURE = "__signature";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signingError(data: { error?: string } | null, error: Error | null) {
  let message = data?.error;
  // Function errors carry the validation response in their Response context.
  const context = (error as { context?: Response } | null)?.context;
  if (!message && context) message = (await context.clone().json().catch(() => ({}))).error;
  const labels: Record<string, string> = {
    document_not_signable: "המסמך בוטל או שאינו זמין עוד לחתימה. רענן את העמוד.",
    missing_required_field: "יש למלא את כל שדות החובה במסמך.",
    missing_stamp_details: "יש לאשר שם חברה וח.פ / ת.ז בחותמת.",
    invalid_signature: "נא לצייר חתימה לפני האישור.",
    not_found_or_already_signed: "הקישור כבר טופל או שאינו תקין. רענן את העמוד.",
    not_found_or_already_processed: "הקישור כבר טופל או שאינו תקין. רענן את העמוד.",
  };
  if (message || error) throw new Error(labels[message ?? ""] || message || error?.message || "הפעולה נכשלה");
}

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const [docContainerHeight, setDocContainerHeight] = useState(700);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<"signed" | "declined" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(null);
  const [draftSignature, setDraftSignature] = useState("");
  const [draftCompanyName, setDraftCompanyName] = useState("");
  const [draftCompanyId, setDraftCompanyId] = useState("");
  const [guideFieldId, setGuideFieldId] = useState<string | null>(null);
  const [guideStarted, setGuideStarted] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const initializedToken = useRef<string | null>(null);
  const guidedToken = useRef<string | null>(null);
  const documentTop = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sign-recipient", token],
    queryFn: async () => {
      if (!token || !UUID.test(token)) return null;
      const response = await supabase.functions.invoke("get-signature-document", { body: { token } });
      await signingError(response.data, response.error);
      return response.data as { recipient: SigningRecipient | null; fileUrl: string | null; fileError?: string };
    },
    enabled: !!token,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const recipient = data?.recipient;
  const doc = recipient?.signature_documents;
  const docFileUrl = data?.fileUrl;
  const recipientIndex = Math.max(0, (recipient?.sign_order ?? 1) - 1);
  const myFields = useMemo(() => parseDocumentFields(doc?.document_fields)
    .filter((field) => (field.recipient_index ?? 0) === recipientIndex), [doc?.document_fields, recipientIndex]);
  const pageFields = myFields.filter((field) => (field.position.page ?? 1) === currentPage);
  const signatureFields = myFields.filter((field) => isSignatureFieldType(field.type));
  const hasSignatureFields = signatureFields.length > 0;
  const signaturePosition = recipient?.signature_position;
  const legacyOnCurrentPage = !hasSignatureFields && (!signaturePosition || (signaturePosition.page ?? 1) === currentPage);
  const stamp = getSignatureStamp(myFields, fieldValues, recipient?.business_stamp);
  const activeField = myFields.find((field) => field.id === activeSignatureId);
  const editingStamp = isStampSignatureType(activeField?.type);

  const missingRequired = useMemo(
    () => missingRequiredForSubmit(myFields, fieldValues, stamp),
    [myFields, fieldValues, stamp],
  );
  const nextFill = nextFieldToFill(myFields, fieldValues, guideStarted ? guideFieldId : null);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(numPages, page)));
    documentTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToField = useCallback((fieldId: string) => {
    let attempts = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-sig-fill="${fieldId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.matches("input, textarea, button")
          ? el
          : el.querySelector<HTMLElement>("input, textarea");
        focusable?.focus({ preventScroll: true });
        return;
      }
      if (attempts++ < 24) window.setTimeout(tick, 50);
    };
    tick();
  }, []);

  const openSignature = (id: string) => {
    setDraftSignature(fieldValues[id] || "");
    setDraftCompanyName(stamp.name);
    setDraftCompanyId(stamp.companyId);
    setActiveSignatureId(id);
    setGuideFieldId(id);
    setGuideStarted(true);
  };

  const goToField = useCallback((field: DocumentField) => {
    const page = field.position.page ?? 1;
    setGuideFieldId(field.id);
    setGuideStarted(true);
    setCurrentPage(page);
    if (isSignatureFieldType(field.type)) {
      setDraftSignature(fieldValues[field.id] || "");
      setDraftCompanyName(stamp.name);
      setDraftCompanyId(stamp.companyId);
      setActiveSignatureId(field.id);
    } else {
      setActiveSignatureId(null);
    }
    window.setTimeout(() => scrollToField(field.id), 60);
  }, [fieldValues, scrollToField, stamp.companyId, stamp.name]);

  const goToNextFill = () => {
    const next = nextFieldToFill(myFields, fieldValues, guideFieldId);
    if (next) goToField(next);
  };

  useEffect(() => {
    if (!recipient || initializedToken.current === token) return;
    initializedToken.current = token ?? null;
    guidedToken.current = null;
    setFieldValues(recipient.field_values ?? {});
    setOutcome(null);
    setActiveSignatureId(null);
    setShowMissing(false);
    setGuideStarted(false);
    setCurrentPage(1);
  }, [recipient, token]);

  useEffect(() => {
    if (!recipient || !myFields.length || guidedToken.current === token) return;
    const first = nextFieldToFill(myFields, fieldValues);
    guidedToken.current = token ?? null;
    if (!first) return;
    setGuideFieldId(first.id);
    setCurrentPage(first.position.page ?? 1);
    window.setTimeout(() => scrollToField(first.id), 120);
  }, [recipient, token, myFields, fieldValues, scrollToField]);

  const saveSignature = () => {
    if (!activeSignatureId || !draftSignature) return;
    if (editingStamp && (!draftCompanyName.trim() || !draftCompanyId.trim())) return;
    const savedId = activeSignatureId;
    const nextValues = editingStamp
      ? applySignatureStamp(myFields, fieldValues, draftCompanyName, draftCompanyId)
      : { ...fieldValues };
    nextValues[savedId] = draftSignature;
    setFieldValues(nextValues);
    setActiveSignatureId(null);
    const next = nextFieldToFill(myFields, nextValues, savedId);
    if (next) goToField(next);
    else setGuideFieldId(null);
  };

  const primarySignature = signatureFields.map((field) => fieldValues[field.id]).find(Boolean) || fieldValues[LEGACY_SIGNATURE] || "";
  const fileBlocked = !!doc?.file_url && !docFileUrl;

  const signMutation = useMutation({
    mutationFn: async () => {
      if (missingRequired.length || !primarySignature) throw new Error("יש למלא את כל שדות החובה ולחתום");
      const response = await supabase.functions.invoke("submit-signature", {
        body: { token, signatureData: primarySignature, fieldValues, action: "sign" },
      });
      await signingError(response.data, response.error);
      if (!response.data?.ok) throw new Error("החתימה לא נשמרה. נסה שוב.");
    },
    onSuccess: () => { setOutcome("signed"); toast.success("החתימה נשמרה בהצלחה!"); },
    onError: (failure: Error) => toast.error(failure.message),
  });
  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("submit-signature", { body: { token, action: "decline" } });
      await signingError(response.data, response.error);
      if (!response.data?.ok) throw new Error("הסירוב לא נשמר. נסה שוב.");
    },
    onSuccess: () => { setOutcome("declined"); toast.info("סירבת לחתום על המסמך"); },
    onError: (failure: Error) => toast.error(failure.message),
  });
  const busy = signMutation.isPending || declineMutation.isPending;
  const trySign = () => {
    if (fileBlocked) return;
    if (missingRequired.length) {
      setShowMissing(true);
      goToField(missingRequired[0]);
      toast.error("יש למלא את השדות החסרים — לחץ על שדה כדי לעבור אליו");
      return;
    }
    signMutation.mutate();
  };

  const terminal = outcome || (recipient?.status === "signed" ? "signed" : recipient?.status === "declined" ? "declined" : null);
  const unavailable = doc && !["pending", "partially_signed"].includes(doc.status);
  if (isLoading) return <div className="min-h-screen grid place-items-center" dir="rtl">טוען מסמך...</div>;
  if (isError || !recipient || terminal || unavailable) {
    const title = isError ? "שגיאה בטעינת המסמך" : !recipient ? "קישור לא תקין" : terminal === "signed" ? "תודה!" : terminal === "declined" ? "הסירוב נשמר" : "המסמך אינו זמין לחתימה";
    const message = isError ? (error as Error)?.message : !recipient ? "הקישור לחתימה אינו תקין או שפג תוקפו." : terminal === "signed" ? "החתימה נשמרה בהצלחה." : terminal === "declined" ? "סירבת לחתום על המסמך." : doc?.status === "cancelled" ? "המסמך בוטל." : "פנה לשולח לקבלת קישור מעודכן.";
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
          {terminal === "signed" ? <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" /> : <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />}
          <h2 className="text-xl font-bold mb-2">{title}</h2><p className="text-muted-foreground">{message}</p>
        </CardContent></Card>
      </div>
    );
  }

  const renderSignature = (id: string, position: SignaturePosition, withStamp = false, label = "חתימה") => (
    <button key={id} type="button" data-sig-fill={id} aria-label={`פתח ${label}`} onClick={() => openSignature(id)}
      className={`absolute border border-primary rounded bg-white/80 overflow-hidden z-10 focus-visible:ring-2 focus-visible:ring-primary ${
        guideFieldId === id ? "ring-2 ring-primary ring-offset-2 shadow-md" : ""
      }`}
      style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%` }}>
      {withStamp && stamp.name && (
        <div className="absolute inset-0 grid content-center text-gray-500 opacity-70 px-1 leading-tight" aria-hidden="true">
          <div className="font-bold truncate" style={{ fontSize: getFieldFontSizePx(position, docContainerHeight) }}>{stamp.name}</div>
          <div className="truncate" style={{ fontSize: Math.max(6, getFieldFontSizePx(position, docContainerHeight) - 2) }}>ח.פ / ת.ז {stamp.companyId}</div>
        </div>
      )}
      {fieldValues[id] ? <img src={fieldValues[id]} alt="החתימה שלך" className="relative w-full h-full object-fill" />
        : <span className="relative text-primary font-medium leading-none" style={{ fontSize: getFieldFontSizePx(position, docContainerHeight) }}>{label}</span>}
    </button>
  );

  const renderField = (field: DocumentField) => {
    if (isSignatureFieldType(field.type)) return renderSignature(field.id, field.position, isStampSignatureType(field.type), getFieldLabel(field.type));
    const style = { left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.position.width}%`, height: `${field.position.height}%` };
    const fontSize = getFieldFontSizePx(field.position, docContainerHeight);
    const advance = () => {
      const next = nextFieldToFill(myFields, fieldValues, field.id);
      if (next) goToField(next);
    };
    const props = {
      value: fieldValues[field.id] ?? "",
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setFieldValues((values) => ({ ...values, [field.id]: value }));
        setGuideFieldId(field.id);
        setGuideStarted(true);
        if (field.type === "date" && value) {
          window.setTimeout(() => {
            const next = nextFieldToFill(myFields, { ...fieldValues, [field.id]: value }, field.id);
            if (next) goToField(next);
          }, 0);
        }
      },
      onFocus: () => {
        setGuideFieldId(field.id);
        setGuideStarted(true);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key !== "Enter") return;
        if (field.type === "address" && !event.metaKey && !event.ctrlKey) return;
        event.preventDefault();
        advance();
      },
      placeholder: `${field.label || getFieldLabel(field.type)}${isFieldRequired(field) ? " *" : ""}`,
      "aria-label": field.label || getFieldLabel(field.type),
      required: isFieldRequired(field),
      className: "w-full h-full min-h-0 rounded-sm resize-none bg-white/95 border-primary px-1 py-0 leading-tight",
      style: { fontSize },
      dir: field.type === "phone" || field.type === "id_number" ? "ltr" : "rtl",
    };
    return (
      <div
        key={field.id}
        data-sig-fill={field.id}
        className={`absolute ${guideFieldId === field.id ? "z-20 ring-2 ring-primary ring-offset-1 rounded-sm" : ""}`}
        style={style}
      >
        {field.type === "address" ? <Textarea {...props} /> : <Input {...props} type={field.type === "phone" ? "tel" : field.type === "date" ? "date" : "text"} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-3 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center"><h1 className="text-2xl font-bold mb-1">חתימה דיגיטלית</h1>
          <p className="text-muted-foreground">שלום {recipient.name}, אנא מלא את השדות וחתום על המסמך</p></div>
        <Card ref={documentTop} className="scroll-mt-4">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{doc?.title}</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-4">
            {doc?.file_url ? (
              <>
                <SignaturePageNavigation page={currentPage} count={numPages} onChange={goToPage} />
                {docFileUrl ? <SignatureDocumentViewer fileUrl={docFileUrl}
                  mediaKind={detectMediaKind(doc.file_url)} forcePdf={!/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(doc.file_url) && doc.document_type === "uploaded"}
                  page={currentPage} onNumPagesChange={setNumPages} onHeightChange={setDocContainerHeight} className="bg-white">
                  {pageFields.map(renderField)}
                  {legacyOnCurrentPage && signaturePosition && renderSignature(LEGACY_SIGNATURE, signaturePosition)}
                </SignatureDocumentViewer> : <p className="py-8 text-center text-destructive">{data?.fileError || "לא ניתן לטעון את הקובץ. רענן את העמוד או פנה לשולח."}</p>}
                <SignaturePageNavigation page={currentPage} count={numPages} onChange={goToPage} />
              </>
            ) : <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg border">{doc?.content}</div>}
            {(!doc?.file_url || (!hasSignatureFields && !signaturePosition)) && (
              <div className="space-y-3 mt-4">
                {!doc?.file_url && myFields.filter((field) => !isSignatureFieldType(field.type)).map((field) => (
                  <div key={field.id} data-sig-fill={field.id}>
                    <Label htmlFor={field.id}>
                      {field.label || getFieldLabel(field.type)}
                      {isFieldRequired(field) ? " *" : ""}
                    </Label>
                    <Input
                      id={field.id}
                      value={fieldValues[field.id] || ""}
                      onFocus={() => setGuideFieldId(field.id)}
                      onChange={(event) => setFieldValues((values) => ({ ...values, [field.id]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const next = nextFieldToFill(myFields, fieldValues, field.id);
                        if (next) goToField(next);
                      }}
                    />
                  </div>
                ))}
                {(hasSignatureFields ? signatureFields.map((field) => field.id) : [LEGACY_SIGNATURE]).map((id) => (
                  <Button key={id} type="button" data-sig-fill={id} variant="outline" onClick={() => openSignature(id)}>
                    {fieldValues[id] ? "ערוך חתימה" : "פתח חתימה"}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="sticky bottom-3 z-30 rounded-xl border bg-background/95 shadow-lg backdrop-blur-sm p-3 space-y-3">
          {showMissing && missingRequired.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">
                חסרים {missingRequired.length} שדות — לחץ כדי לעבור אליהם
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingRequired.map((field) => (
                  <Button
                    key={field.id}
                    type="button"
                    size="sm"
                    variant={guideFieldId === field.id ? "default" : "outline"}
                    className="h-8"
                    onClick={() => goToField(field)}
                  >
                    {fieldFillLabel(field)}
                    <span className="text-xs opacity-70">ע{field.position.page ?? 1}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={goToNextFill} disabled={!nextFill}>
              <ChevronLeft className="h-4 w-4" />
              {nextFill
                ? `קח אותי למילוי הבא · ${fieldFillLabel(nextFill)}`
                : "כל השדות מולאו"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {myFields.filter((field) => fieldValues[field.id]?.trim()).length}/{myFields.length || 0} שדות
            </span>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="destructive" onClick={() => declineMutation.mutate()} disabled={busy}>
              <XCircle className="h-4 w-4 ml-2" />סירוב
            </Button>
            <Button onClick={trySign} disabled={busy || fileBlocked} className="min-w-32">
              <CheckCircle className="h-4 w-4 ml-2" />{signMutation.isPending ? "חותם..." : "חתום"}
            </Button>
          </div>
        </div>
        <Dialog open={activeSignatureId !== null} onOpenChange={(open) => { if (!open) setActiveSignatureId(null); }}>
          <DialogContent dir="rtl" className="max-w-lg max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingStamp ? "חתימה עם חותמת" : "חתימה"}</DialogTitle>
              <DialogDescription>{editingStamp ? "בדוק את פרטי החברה, השלם במידת הצורך וצייר את חתימתך." : "צייר את חתימתך באזור למטה ואשר כדי להוסיף אותה למסמך."}</DialogDescription></DialogHeader>
            {editingStamp && <div className="space-y-3">
              <div><Label htmlFor="stamp-company-name">שם חברה</Label><Input id="stamp-company-name" value={draftCompanyName} onChange={(event) => setDraftCompanyName(event.target.value)} required /></div>
              <div><Label htmlFor="stamp-company-id">ח.פ / ת.ז</Label><Input id="stamp-company-id" value={draftCompanyId} onChange={(event) => setDraftCompanyId(event.target.value)} dir="ltr" required /></div>
            </div>}
            <div className="relative border-2 border-dashed rounded-lg bg-white overflow-hidden">
              {editingStamp && <div className="absolute inset-0 grid content-center text-center text-gray-400 opacity-60 pointer-events-none select-none">
                <div className="text-xl font-bold">{draftCompanyName}</div><div>ח.פ / ת.ז {draftCompanyId}</div></div>}
              <div className="relative"><SignatureCanvas value={draftSignature} onChange={setDraftSignature} /></div>
            </div>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraftSignature("")}><Eraser className="h-4 w-4 ml-1" />נקה חתימה</Button>
              <Button type="button" onClick={saveSignature} disabled={!draftSignature || (editingStamp && (!draftCompanyName.trim() || !draftCompanyId.trim()))}>אישור והוספה למסמך</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
