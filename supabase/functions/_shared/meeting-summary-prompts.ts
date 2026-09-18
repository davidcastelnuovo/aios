export const LONG_TRANSCRIPT_THRESHOLD = 18_000;
export const TRANSCRIPT_CHUNK_SIZE = 14_000;

const SUMMARY_STRUCTURE = `מבנה הסיכום (בסדר הזה):
## תקציר מנהלים
5–8 משפטים שמסכמים את מטרת הפגישה, הנושאים המרכזיים והתוצאות בפועל.

## נושאים שנדונו
לכל נושא מהותי: כותרת קצרה (###) ופירוט של העובדות, הנתונים, הסטטוסים, החלופות והעמדות השונות שעלו. אל תאחד פריטים שונים לכותרת כללית אם האיחוד משמיט פרטים.

## החלטות
רק החלטות שהתקבלו במפורש. ציין מי קיבל/אישר אותן כאשר הדבר ברור מהמקור. הצעה, התלבטות או שאלה פתוחה אינן החלטה.

## משימות לביצוע
טבלה: | משימה | אחראי | דדליין |
כל פעולה שהתחייבו לבצע בשורה נפרדת. אם אחראי או דדליין לא נאמרו במפורש, כתוב "לא צוין" — לעולם אל תשלים אותם לפי ההיגיון.

## שאלות פתוחות ונושאים להכרעה
התלבטויות, בדיקות שטרם הושלמו והחלטות שנדחו.

## נקודות חשובות
נקודות כאב, הזדמנויות, סיכונים, תלות בחומרים או דגשים מקצועיים שעלו.

## ציטוטים מרכזיים
עד 4 ציטוטים קצרים ורק אם ניתן לשחזר את הניסוח מהתמלול בביטחון. כל ציטוט עם שם הדובר; אין לנסח ציטוט חדש.

## שלבים הבאים
מה קורה אחרי הפגישה, כולל מועדים ופגישות המשך רק אם נאמרו במפורש.`;

export const MEETING_SUMMARY_SYSTEM_PROMPT = `אתה עוזר מקצועי לסיכום פגישות עסקיות. כתוב סיכום מפורט, ברור ומאורגן בעברית, בפורמט Markdown.

כללי דיוק ושלמות מחייבים:
- אל תמציא, תשלים או תנחש מידע. השתמש רק במה שמופיע בתמלול או בפרטי הפגישה.
- שמור כל פרט אופרטיבי מהותי: שמות פריטים/מוצרים/קמפיינים, תאריכים, מספרים, סטטוס נוכחי, פעולות להמשך, אחראים, דדליינים, תלות בחומרים והחלטות שנותרו פתוחות.
- הפרד בין מצב קיים, החלטה שהתקבלה, הצעה שנבחנה ושאלה שעדיין פתוחה.
- אל תהפוך תאריך פגישה, תאריך הקלטה או תאריך של מוצר לדדליין של משימה.
- אם התמלול סותר את עצמו, ציין את הגרסה האחרונה שסוכמה ואת הסתירה הרלוונטית במקום לבחור גרסה ללא הסבר.
- אם יש תוויות דוברים או חותמות זמן, השתמש בהן כדי לשייך אמירות ומשימות לאדם הנכון. אל תנחש זהות של דובר משובש.
- התעלם משיחות חולין אלא אם יש להן משמעות אופרטיבית.
- לפני החזרת התשובה, בצע בקרת שלמות פנימית: ודא שכל נושא מהותי, החלטה, משימה ושאלה פתוחה מן המקור מופיעים פעם אחת בסיכום.
- אם סעיף לא רלוונטי, השמט אותו לגמרי; אל תכתוב "אין".

${SUMMARY_STRUCTURE}`;

export function buildSummaryUserPrompt(
  source: string,
  recordingInfo: string,
  focusPrompt: string,
): string {
  return `צור סיכום מלא של הפגישה על בסיס המקור הבא.

${recordingInfo ? `פרטי הפגישה:\n${recordingInfo}\n\n` : ""}תמלול או ממצאים שחולצו ממנו:
${source}${focusPrompt}

כתוב סיכום מקצועי ומפורט. העדף שלמות ודיוק על פני קיצור, אך אל תחזור על אותו פרט בכמה סעיפים.`;
}

export function buildExtractionSystemPrompt(chunkNumber: number, totalChunks: number): string {
  return `אתה מבצע שלב חילוץ עובדות מתוך חלק ${chunkNumber} מתוך ${totalChunks} של תמלול פגישה. אל תסכם באופן כללי ואל תדלג על פרטים אופרטיביים.

חלץ בעברית, בנקודות מפורטות:
1. כל נושא מהותי והפרטים הקונקרטיים שנאמרו עליו.
2. סטטוס נוכחי של כל פריט, קמפיין, מוצר או תהליך שהוזכר.
3. כל החלטה מפורשת, בנפרד מהצעה או דעה.
4. כל משימה או התחייבות, עם אחראי ודדליין רק אם נאמרו במפורש.
5. כל שאלה פתוחה, התלבטות, בדיקה או תלות בחומרים.
6. מספרים, תאריכים, שמות ויעדים כפי שנאמרו.
7. עד שני ציטוטים מילוליים חשובים, עם דובר וחותמת זמן אם קיימת.

אל תמציא מידע, אל תסיק דדליין מתאריך אחר ואל תפתור סתירות. כשיש תיקון בתוך השיחה, תעד את התיקון. הפלט ישמש לסיכום סופי ולכן עדיף לכלול פרט מהותי מאשר לקצר.`;
}

export function splitTranscript(
  transcript: string,
  maxChars = TRANSCRIPT_CHUNK_SIZE,
): string[] {
  if (transcript.length <= maxChars) return [transcript];

  const lines = transcript.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join("\n"));
    current = [];
    currentLength = 0;
  };

  for (const line of lines) {
    const additions = line.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && currentLength + additions > maxChars) flush();

    if (line.length <= maxChars) {
      current.push(line);
      currentLength += line.length + (current.length > 1 ? 1 : 0);
      continue;
    }

    flush();
    for (let offset = 0; offset < line.length; offset += maxChars) {
      chunks.push(line.slice(offset, offset + maxChars));
    }
  }

  flush();
  return chunks;
}

export type SummaryCompletion = (
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
) => Promise<string>;

export async function prepareDetailedSummarySource(
  transcript: string,
  complete: SummaryCompletion,
): Promise<string> {
  if (transcript.length <= LONG_TRANSCRIPT_THRESHOLD) return transcript;

  const chunks = splitTranscript(transcript);
  const extractedChunks = await Promise.all(
    chunks.map((chunk, index) =>
      complete(
        buildExtractionSystemPrompt(index + 1, chunks.length),
        `חלק ${index + 1} מתוך ${chunks.length}:\n\n${chunk}`,
        4_000,
      )
    ),
  );

  return extractedChunks
    .map((notes, index) => `### ממצאים מחלק ${index + 1}\n${notes}`)
    .join("\n\n");
}
