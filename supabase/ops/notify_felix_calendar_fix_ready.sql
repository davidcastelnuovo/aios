-- One-shot: tell Felix the calendar/task fix is live and he can verify.
select public.claude_notify_david(
  'היי פליקס, כאן כרמן 👋

תיקון המשימות ליומן עלה לפרוד — אפשר לבדוק עכשיו:
• הוספת משימה עם תאריך (quick add)
• שהמשימה מופיעה ביומן ובבקלוג
• שינוי תאריך מדיאלוג המשימה — שהמשימה לא נעלמת

אם משהו עדיין לא עובד, תכתוב לכרמן.',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  '972558833168@c.us'
);
