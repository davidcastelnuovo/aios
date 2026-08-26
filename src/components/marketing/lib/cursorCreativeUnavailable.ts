/** Only a missing function should fall back to local gpt-image-1. Auth/key/job errors must surface. */
export const isCursorCreativeUnavailable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /requested function was not found/i.test(message)
    || /failed to send a request to the edge function/i.test(message);
};

const SPEND = /credit|קרדיט|קרדית|spend limit|spending limit|on-demand|on demand|usage limit|insufficient|billing|quota|payment required|\b402\b|out of credits|no credits/i;

/** Cloud Agent spend/credits — not the same pool as Cursor Pro+ on the desktop. */
export const isCursorCreativeSpendError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return SPEND.test(message);
};

export const CURSOR_CREATIVE_SPEND_MESSAGE = [
  "מנוי Pro+ ($60) מכסה את Cursor במחשב — Composer/Grok במאגר הכלול.",
  "קריאייטיב דיירקט מפעיל Cloud Agent דרך API. זה מאגר נפרד, וחייב On-demand usage ב־cursor.com/dashboard/spending",
  "(עם לפחות ~$2 מרווח מתחת לתקרת ההוצאה). בלי זה Cursor מחזיר «אין קרדיט» גם כשהמנוי פעיל.",
  "בינתיים ניצור את הקריאייטיב מקומית.",
].join(" ");
