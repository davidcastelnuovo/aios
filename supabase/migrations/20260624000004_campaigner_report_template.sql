-- Give the campaigner skin a structured status-report output_template that handles
-- all three states the analyze_campaign_performance tool now returns: synced
-- (historical), newly_connected_clients (pulled live this run) and
-- still_not_connected_clients (couldn't auto-connect → surface to the user, never
-- fabricate). Idempotent: only updates the campaigner skin.
UPDATE public.ai_skills
SET output_template = $tmpl$דוח מצב קמפיינים — שורה אחת לכל לקוח, ממוין מהדחוף (🔴) לרגוע (🟢):
🔴/🟠/🟢 <לקוח> — ₪<spend> | CPL ₪<X> / ROAS <Y> (Δ% מול קודם אם יש) | <פעולה אחת מתועדפת>
• לקוח שנמשך חי עכשיו (newly_connected_clients): הוסיפי "(חי)". אם חובר בהתאמת-שם (matched_by="name"): "(חי — התאמת שם, לאשר)".
• בסוף, אם יש still_not_connected_clients: בלוק "⚠️ לא הצלחתי לחבר:" עם שם הלקוח + הסיבה + הצעת חיבור ידני. אסור להמציא מספרים עבורם.$tmpl$
WHERE slug = 'campaigner';
