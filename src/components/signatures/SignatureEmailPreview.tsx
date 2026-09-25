import {
  applySignatureEmailTemplate,
  resolveSignatureEmailColors,
  signatureRequestSubject,
  type SignatureEmailColors,
  type SignatureEmailVars,
} from "../../../supabase/functions/_shared/signature-email-template.ts";

const COLOR_FIELDS: Array<{ key: keyof SignatureEmailColors; label: string }> = [
  { key: "headerColor", label: "כותרת" },
  { key: "headerText", label: "טקסט כותרת" },
  { key: "buttonColor", label: "כפתור" },
  { key: "buttonText", label: "טקסט כפתור" },
  { key: "pageBackground", label: "רקע" },
  { key: "cardBackground", label: "כרטיס" },
  { key: "textColor", label: "טקסט" },
];

export function SignatureEmailColorFields({
  colors,
  disabled,
  onChange,
}: {
  colors: SignatureEmailColors;
  disabled?: boolean;
  onChange: (colors: SignatureEmailColors) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {COLOR_FIELDS.map((field) => (
        <label key={field.key} className="flex items-center gap-2 text-xs min-w-0">
          <input
            type="color"
            aria-label={field.label}
            value={colors[field.key]}
            disabled={disabled}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border bg-transparent p-0"
            onChange={(event) => onChange({ ...colors, [field.key]: event.target.value })}
          />
          <span className="truncate">{field.label}</span>
        </label>
      ))}
    </div>
  );
}

export function SignatureEmailPreview({
  colors,
  logoUrl,
  subject,
  body,
  vars,
}: {
  colors: Partial<SignatureEmailColors>;
  logoUrl?: string | null;
  subject: string;
  body: string;
  vars: SignatureEmailVars;
}) {
  const palette = resolveSignatureEmailColors(colors);
  const renderedSubject = signatureRequestSubject({ subject }, vars);
  const renderedBody = body.trim()
    ? applySignatureEmailTemplate(body, vars)
    : `${vars.sender ? `${vars.sender} שלח/ה לך` : "נשלח לך"} מסמך לחתימה דיגיטלית: ${vars.title || ""}`;

  return (
    <div className="space-y-2 min-w-0">
      <p className="text-sm font-medium">תצוגה מקדימה</p>
      <p className="text-xs text-muted-foreground truncate">נושא: {renderedSubject}</p>
      <div className="rounded-md border p-3" style={{ backgroundColor: palette.pageBackground }} dir="rtl">
        <div className="mx-auto max-w-[420px] overflow-hidden shadow-sm" style={{ backgroundColor: palette.cardBackground }}>
          <div className="px-4 py-5 text-center" style={{ backgroundColor: palette.headerColor, color: palette.headerText }}>
            {logoUrl && (
              <img src={logoUrl} alt="" className="mx-auto mb-3 h-10 max-w-[120px] object-contain" />
            )}
            <p className="text-base font-bold">בקשה לחתימה דיגיטלית</p>
          </div>
          <div className="space-y-3 px-4 py-4 text-sm leading-6" style={{ color: palette.textColor }}>
            <p>שלום {vars.name || "החותם"},</p>
            <p className="whitespace-pre-wrap">{renderedBody}</p>
            <div className="text-center">
              <span
                className="inline-block rounded-md px-5 py-2 text-sm font-bold"
                style={{ backgroundColor: palette.buttonColor, color: palette.buttonText }}
              >
                לחץ כאן לחתימה
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
