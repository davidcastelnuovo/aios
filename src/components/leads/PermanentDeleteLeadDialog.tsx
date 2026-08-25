import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMANENT_DELETE_PHRASE } from "@/lib/leadArchive";

interface Props {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function PermanentDeleteLeadDialog({ open, count, onOpenChange, onConfirm }: Props) {
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canDelete = phrase.trim() === PERMANENT_DELETE_PHRASE;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPhrase("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקה לצמיתות</AlertDialogTitle>
          <AlertDialogDescription>
            {count === 1
              ? "הליד יימחק מהמסד ולא ניתן לשחזר אותו. אם צריך רק להוריד מה-Pipeline — בטל ושמור בארכיון."
              : `${count} לידים יימחקו מהמסד ולא ניתן לשחזר אותם.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="permanent-delete-phrase">
            הקלד <span className="font-bold">{PERMANENT_DELETE_PHRASE}</span> כדי לאשר
          </Label>
          <Input
            id="permanent-delete-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={PERMANENT_DELETE_PHRASE}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel disabled={submitting}>ביטול</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!canDelete || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm();
                setPhrase("");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            מחק לצמיתות
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
