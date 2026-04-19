
The user has two issues:

1. **"טיול אינדונזיה" not displaying correctly** — looking at image-302, form `356` is named "טיול לאינדונזיה אלמנטור - ECO TRIP" and appears multiple times. From earlier context: form 356 is currently mapped to Madagascar PMax campaign (`23571578760`), which is wrong — it should be mapped to the Indonesia campaign.

2. **Remove the "-7", "+2", "-3" badges** in the "לידים באתר" column — these delta badges (showing diff between Google Ads reported leads vs site verified leads) are confusing the user.

Let me locate the badge rendering in DynamicTableView.tsx.

For issue 1 — this is a data/mapping issue, not a code issue. The user needs to remap form 356 to the Indonesia campaign in WordPress Settings. But the user is reporting "doesn't display correctly" — could mean the form mapping UI is wrong, OR the campaign isn't being matched. Need to clarify what "not displaying correctly" means but the user already gave context — they mapped it but it shows wrong. Most likely the mapping needs updating, OR the Indonesia campaign doesn't exist as separate and only Madagascar/etc do.

Actually re-reading: the user says "טיול אינדונזיה לא מציג נכון" — the Indonesia trip is not displaying correctly. Combined with the screenshots showing form 356 ("אינדונזיה אלמנטור") generating leads — the issue is that those leads aren't being attributed to the Indonesia campaign in the report.

Best approach: I need to check what's actually in the campaign mapping and what Indonesia campaign exists. But this is plan mode — I'll propose:
- Investigate the current mapping for form 356 and which campaign Indonesia should map to
- Fix the mapping (or surface it clearly in UI so the user can remap)
- Remove the delta badges from the "לידים באתר" column

Plan focus:
1. Remove the +/- delta badges from the verified leads column
2. Investigate Indonesia mapping and either auto-fix or guide user

Keep concise.
