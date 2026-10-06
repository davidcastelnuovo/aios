import { useState } from "react";
import { Facebook, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatPulseMoney } from "@/lib/pulseDashboard";
import {
  buildPlatformTargetPatch,
  platformTargetFieldKey,
  type PulseAttentionIssue,
  type PulseAttentionRow,
} from "@/lib/pulseAttentionMatrix";
import type { PulseCampaignGoal } from "@/lib/pulseCampaignGoals";

type PulseAttentionTableProps = {
  rows: PulseAttentionRow[];
  onOpenClient: (clientId: string) => void;
  onSaveTarget: (input: {
    tableId: string;
    goal: PulseCampaignGoal;
    value: number | null;
    existingSettings: Record<string, unknown>;
  }) => Promise<void>;
  tableSettingsById: Map<string, Record<string, unknown>>;
  savingTableId: string | null;
};

const platformLabel = (platform: PulseAttentionRow["platform"]) =>
  platform === "meta" ? "Meta" : "Google Ads";

const targetKindLabel = (goal: PulseCampaignGoal) => {
  if (goal === "ecommerce") return "ROAS";
  if (goal === "engagement") return "עלות לתוצאה";
  return "CPL";
};

function IssueCell({ issue }: { issue: PulseAttentionIssue | null }) {
  if (!issue) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const variant =
    issue.level === "alert"
      ? "destructive"
      : issue.level === "watch"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant} className="whitespace-normal text-right leading-snug max-w-[220px]">
      {issue.label}
    </Badge>
  );
}

function formatTargetValue(goal: PulseCampaignGoal, value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (goal === "ecommerce") return value.toFixed(2);
  return formatPulseMoney(value);
}

export function PulseAttentionTable({
  rows,
  onOpenClient,
  onSaveTarget,
  tableSettingsById,
  savingTableId,
}: PulseAttentionTableProps) {
  const [editRow, setEditRow] = useState<PulseAttentionRow | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const openEdit = (row: PulseAttentionRow) => {
    const approved = row.target?.source === "approved" ? row.target.value : null;
    setDraftValue(approved ? String(approved) : "");
    setEditRow(row);
  };

  const handleSave = async () => {
    if (!editRow?.tableId) return;
    const parsed = draftValue.trim() ? Number(draftValue.replace(",", ".")) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) return;
    const existing = tableSettingsById.get(editRow.tableId) ?? {};
    await onSaveTarget({
      tableId: editRow.tableId,
      goal: editRow.primaryGoal,
      value: parsed,
      existingSettings: existing,
    });
    setEditRow(null);
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        אין כרגע לקוחות/פלטפורמות שדורשים תשומת לב בטווח ובסינון שנבחרו
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right min-w-[140px]">לקוח</TableHead>
              <TableHead className="text-right min-w-[100px]">פלטפורמה</TableHead>
              <TableHead className="text-right min-w-[120px]">יעד</TableHead>
              <TableHead className="text-right min-w-[140px]">מגע בקמפיין</TableHead>
              <TableHead className="text-right min-w-[160px]">יעילות / CPL</TableHead>
              <TableHead className="text-right min-w-[140px]">תקשורת אחרונה</TableHead>
              <TableHead className="text-right min-w-[140px]">תלונה / עדכון</TableHead>
              <TableHead className="text-right min-w-[140px]">שביעות רצון</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const targetLabel = row.target
                ? `${formatTargetValue(row.primaryGoal, row.target.value)} (${row.target.source === "approved" ? "מאושר" : "בסיס 30י"})`
                : "—";
              return (
                <TableRow key={`${row.clientId}:${row.platform}`}>
                  <TableCell className="align-top">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline text-right"
                      onClick={() => onOpenClient(row.clientId)}
                    >
                      {row.clientName}
                    </button>
                    <div className="text-xs text-muted-foreground mt-0.5">{row.campaignerName}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-1.5">
                      {row.platform === "meta" ? (
                        <Facebook className="h-4 w-4 text-blue-600 shrink-0" />
                      ) : (
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle cx="6" cy="18" r="3.5" fill="#34A853" />
                        </svg>
                      )}
                      <span>{platformLabel(row.platform)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0">
                        <div className="text-sm">{targetLabel}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {targetKindLabel(row.primaryGoal)}
                          {row.currentEfficiency !== null
                            ? ` · נוכחי ${formatTargetValue(row.primaryGoal, row.currentEfficiency)}`
                            : ""}
                        </div>
                      </div>
                      {row.tableId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label="עריכת יעד"
                          disabled={savingTableId === row.tableId}
                          onClick={() => openEdit(row)}
                        >
                          {savingTableId === row.tableId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <IssueCell issue={row.issues.campaignTouch} />
                  </TableCell>
                  <TableCell className="align-top">
                    <IssueCell issue={row.issues.efficiency} />
                  </TableCell>
                  <TableCell className="align-top">
                    <IssueCell issue={row.issues.lastCommunication} />
                  </TableCell>
                  <TableCell className="align-top">
                    <IssueCell issue={row.issues.complaintUpdate} />
                  </TableCell>
                  <TableCell className="align-top">
                    <IssueCell issue={row.issues.satisfaction} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              יעד {editRow ? targetKindLabel(editRow.primaryGoal) : ""} — {editRow?.clientName}
            </DialogTitle>
          </DialogHeader>
          {editRow ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                יעד מאושר ל{platformLabel(editRow.platform)}. אם ריק — נשתמש במגמת 7 ימים ובבסיס 30 יום.
              </p>
              <div className="space-y-1">
                <Label htmlFor="pulse-target-value">{targetKindLabel(editRow.primaryGoal)}</Label>
                <Input
                  id="pulse-target-value"
                  inputMode="decimal"
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  placeholder={
                    editRow.target?.source === "baseline_30d"
                      ? String(editRow.target.value)
                      : "לדוגמה: 90"
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={!editRow?.tableId}>
              שמור יעד
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
