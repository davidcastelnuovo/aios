

## הבעיה

ההקלטה מ-16/04 עדיין מציגה "מתמלל..." (סטטוס `processing`) למרות שהתהליך כנראה כבר נכשל מזמן. בקוד הנוכחי:

1. **מנגנון ה-stale detection קיים אבל רק ב-Dialog** (`SummarizeRecordingDialog.tsx` שורות 227-245) — הוא מסמן `failed` רק אם המשתמש פותח את ה-Dialog והפולינג רץ. אם הוא לא פתוח, הסטטוס נשאר תקוע על `processing` לנצח.
2. **אין כפתור "עצור"/"בטל"** בטבלה הראשית (`Recordings.tsx`) ליד הבדג' "מתמלל...".
3. **אין ניקוי אוטומטי ברענון העמוד** של רשומות ישנות שתקועות.

## הפתרון

### 1. ניקוי אוטומטי של הקלטות תקועות בטעינת העמוד (`Recordings.tsx`)

ב-`useQuery` של ה-recordings, אחרי שליפת הנתונים — לסמן כ-`failed` כל רשומה שעומדת ב:
- `transcription_status === 'processing'`
- AND `updated_at` ישן יותר מ-10 דקות
- AND `transcription` ריק

```ts
// אחרי השליפה, לפני ההחזרה:
const stale = data.filter(r => 
  r.transcription_status === 'processing' &&
  !r.transcription &&
  Date.now() - new Date(r.updated_at).getTime() > 10 * 60 * 1000
);
if (stale.length > 0) {
  await supabase.from('zoom_recordings')
    .update({ 
      transcription_status: 'failed', 
      transcription_error: 'תהליך התמלול נתקע (timeout)' 
    })
    .in('id', stale.map(r => r.id));
  // refetch
}
```

### 2. כפתור "עצור" ידני בטבלה (`Recordings.tsx` שורה 514)

ליד ה-badge של "מתמלל..." להוסיף כפתור X קטן שמסמן ידנית כ-`failed`:

```tsx
{rec.transcription_status === 'processing' && !rec.transcription && (
  <Button variant="ghost" size="icon" className="h-6 w-6"
    onClick={() => cancelTranscriptionMutation.mutate(rec._group?.map(r => r.id) || [rec.id])}>
    <X className="h-3 w-3" />
  </Button>
)}
```

עם mutation שמסמן את כל הרשומות בקבוצה כ-`failed` ומאפס את ה-status:
```ts
const cancelTranscriptionMutation = useMutation({
  mutationFn: async (ids: string[]) => {
    await supabase.from('zoom_recordings')
      .update({ transcription_status: 'failed', transcription_error: 'בוטל ידנית' })
      .in('id', ids);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['recordings'] });
    toast({ title: "התמלול בוטל" });
  },
});
```

### 3. הקטנת זמן ה-stale detection ב-Dialog (`SummarizeRecordingDialog.tsx` שורה 231)

מ-5 דקות ל-3 דקות — Whisper על קובץ זום ממוצע אמור להסתיים תוך פחות מזה. ערכים גבוהים גורמים לתחושת "תקוע".

### 4. הצגת תלת־מצב חזותית של הסטטוס בטבלה

כשהסטטוס `failed`, להוסיף ליד ה-badge "נכשל" כפתור 🔄 ל-retry שייפתח את ה-`SummarizeRecordingDialog` עם הקלטה זו.

## קבצים שיתעדכנו

- `src/pages/Recordings.tsx` — auto-cleanup ב-useQuery, כפתור עצור ידני, כפתור retry
- `src/components/SummarizeRecordingDialog.tsx` — הקטנת timeout מ-5 ל-3 דקות

## תוצאה

- ההקלטה מ-16/04 תסומן אוטומטית כ-`failed` ברענון הבא של העמוד.
- המשתמש יוכל בכל רגע ללחוץ X ידני כדי לעצור תהליך תקוע מבלי לחכות.
- תהליכים תקועים יתגלו תוך 3 דקות במקום 5.

