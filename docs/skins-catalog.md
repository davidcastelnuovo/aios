# קטלוג הסקינז של כרמן — מבוסס אופן-סורס

> כל סקין = שורה ב-`ai_skills` (scope='global'). מנגנון: ה-registry טוען מה-DB, מזהה לפי `triggers`, ומזריק `goal`+`system_prompt`+`constraints`+`output_template` ל-prompt של כרמן. הוספת סקין = הוספת שורה, בלי deploy.
>
> **עיקרון:** לא ממציאים. כל סקין נגזר מפרויקט אופן-סורס מוכח (MetaGPT / ChatDev / CrewAI / agency-agents / claude-legal-skill וכו'). העמודה "מקור" מצביעה לקוד לפורק ממנו.
>
> סטטוס: שיווק + הנדסה + HR + Legal מתועדים. הנהלה (CEO/CTO/CFO/COO/PM) — בהשלמה.

---

## דפוס הסקין (מאומת מול 5 frameworks)

הסכמה הקנונית של "תפקיד" מתכנסת לחמישה שדות שכולם חולקים. הטבלה שלנו `ai_skills` כבר מכסה ~90%; הוספנו `goal`/`constraints`/`handoff_slugs` (migration `20260624000001`).

| שדה מאוחד | עמודה ב-`ai_skills` | מקור |
|---|---|---|
| כותרת persona | `name` / `slug` | כולם |
| משפט ניתוב קצר | `description` | AutoGen `description`, CrewAI `role` |
| מטרה | **`goal`** ✨ | MetaGPT `goal`, CrewAI `goal` |
| זהות + קול + התנהגות | `system_prompt` | MetaGPT prefix, ChatDev RoleConfig, CrewAI backstory |
| חוקים קשיחים | **`constraints`** ✨ | MetaGPT `constraints` |
| פרוצדורה | `steps` | ChatDev phase_prompt, Devika plan |
| כלים מותרים | `allowed_tools[]` | MetaGPT actions, CrewAI/AutoGen tools |
| פורמט פלט | `output_template` | CrewAI `expected_output` |
| הפעלה | `triggers[]` / `trigger_phrases[]` | ChatDev chain, CrewAI task `agent:` |
| מודל פר-סקין | `model` | CrewAI/AutoGen `llm` |
| העברה לסקין אחר | **`handoff_slugs[]`** ✨ | MetaGPT `watch`, AutoGen `handoffs` |

מקורות: [MetaGPT role.py](https://github.com/geekan/MetaGPT/blob/main/metagpt/roles/role.py) · [ChatDev](https://github.com/OpenBMB/ChatDev) · [CrewAI Agents](https://docs.crewai.com/en/concepts/agents) · [AutoGen](https://github.com/microsoft/autogen) · [awesome-chatgpt-prompts](https://github.com/f/awesome-chatgpt-prompts)

---

## אשכול 1 — שיווק / תוכן / מכירות

| slug | סקין | מטרה (goal) | כלים מרכזיים | מקור OSS לפורק |
|---|---|---|---|---|
| `copywriter` | קופירייטרית | קופי ממיר לפרסום/מייל/לנדינג, מרובה וריאציות לפי מגבלות הערוץ | Facebook Ads, image-gen, Gmail, web-analytics | [agency-agents creative-strategist](https://github.com/msitarzewski/agency-agents) · [CrewAI marketing_strategy](https://github.com/crewAIInc/crewAI-examples/tree/main/crews/marketing_strategy) · [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) |
| `seo` | SEO | מחקר מילות מפתח, intent, brief, on-page + audit טכני | Ahrefs (keywords/SERP/site-audit), gen_text | [coreyhaines31 ai-seo](https://github.com/coreyhaines31/marketingskills) · Ahrefs MCP |
| `content_writer` | כותבת תוכן | מאמרים/ניוזלטרים/פוסטים מבוססי-מחקר, voice-aware, רב-פורמט | Ahrefs, image/video-gen, Gamma, Gmail, analytics | [gurezende/Crew_Writer](https://github.com/gurezende/Crew_Writer) · [ksm26 crewAI article crew](https://github.com/ksm26/Multi-AI-Agent-Systems-with-crewAI) |
| `campaigner` | קמפיינרית (paid) | אופטימיזציית ROAS/CPA full-funnel ב-Meta+Google עם guardrails | Facebook Ads (insights/create/toggle/budget), analyze_campaign_performance, web-analytics | [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads) (Ads Health Score) · [FinLens FB-ai-agents](https://github.com/FinLens/Facebook-ai-agents-public) · [pipeboard meta-ads-mcp](https://github.com/pipeboard-co/meta-ads-mcp) |
| `social_media` | מנהלת סושיאל | לוח תוכן + פרסום + engagement רב-פלטפורמי מתוך brand brief | image/video-gen, WhatsApp, analytics, Gmail | [langchain-ai/social-media-agent](https://github.com/langchain-ai/social-media-agent) (gold) · [blacktwist/social-media-skills](https://github.com/blacktwist/social-media-skills) |
| `analyst` | אנליסטית | תובנות cross-channel + דוחות מתועדפים | web-analytics, GSC, Ahrefs, campaign data | CrewAI data crews + GSC/Ahrefs MCP |
| `cs_manager` | מנהלת לקוח (CS) | בריאות לקוח, מניעת נטישה, עדכוני יומן | client health, add_client_update, send_message | קיים: סקין "בדיקת דופק" |
| `sdr` | SDR / מכירות | פתיחת ליד, ניקוד, nurture | lead enrich/score, send_message, create_task | CrewAI sales crews |

**guardrails חוצי-אשכול (constraints):** אסור להמציא מספרים/עובדות מותג; חובה אישור אנושי לפני פרסום/שינוי תקציב; כל המלצה = metric+benchmark+gap+פעולה אחת.

---

## אשכול 2 — הנדסה / טכנולוגיה

עיקרון מנחה (מהמחקר): **ליבת מתודולוגיה אחת משותפת** (OpenHands/SWE-agent: explore→test→implement→verify) שמתחתיה כל סקין מחליף רק זהות + allowlist כלים + פרוצדורה.

| slug | סקין | מטרה (goal) | כלים מרכזיים | מקור OSS לפורק |
|---|---|---|---|---|
| `engineer` | מתכנת | קוד קריא/מודולרי/פונקציונלי מלא — בלי placeholders | file write/edit, repo read, run/build | [MetaGPT engineer.py](https://github.com/FoundationAgents/MetaGPT/blob/main/metagpt/roles/engineer.py) · [ChatDev Coding phase](https://github.com/OpenBMB/ChatDev) · [GPT-Engineer](https://github.com/AntonOsika/gpt-engineer) |
| `qa` | QA | בדיקות מקיפות, איתור root-cause, תיקון וריצה חוזרת | test write, test runner, log reader, file edit | [MetaGPT qa_engineer.py](https://github.com/FoundationAgents/MetaGPT/blob/main/metagpt/roles/qa_engineer.py) · ChatDev Test phase |
| `web_builder` | בונה אתרים | לנדינג רספונסיבי ממיר מ-brief קצר (HTML/Tailwind/component-JSON) | file write, image-gen, deploy hook (Vercel) | [aipage.dev](https://github.com/zinedkaloc/aipage.dev) · [GrapesJS](https://grapesjs.com/) (adapt GPT-Engineer pattern) |
| `automator` | אוטומטור | בקשה עסקית → workflow אמין trigger→action עם idempotency | connector catalog, HTTP/webhook, workflow-builder API (Make/n8n), validator | [n8n AI Agents](https://n8n.io/ai-agents/) · [Make AI Agents](https://www.make.com/en/ai-agents) · Devika planner (adapt) |
| `devops` | DevOps | CI/CD + IaC idempotentי, least-privilege, עם rollback | bash, git, terraform/helm/kubectl, GH Actions writer | [aws-samples deploy-crewai-terraform](https://github.com/aws-samples/deploy-crewai-agents-terraform) · [kagent](https://kagent.dev/) · [awesome-devops-ai](https://github.com/hammadhaqqani/awesome-devops-ai) |
| `security` | סייבר/אבטחה | ממצאים אמיתיים מתועדפים (STRIDE + AI-risks), בלי רעש | repo read, dep/secret scanners, SAST hook, CVE lookup | [CrewAI AWS security audit crew](https://github.com/crewAIInc/crewAI-examples) · [GitHub Security Lab AI scanning](https://github.blog/security/) |
| `data` | מהנדס/אנליסט נתונים | שאלה עסקית → query → תובנות + המלצות עם caveats | SQL/warehouse, Python/pandas exec, charting | [porameht/data-analyst-agent](https://github.com/porameht/data-analyst-agent) · CrewAI BigQuery crew |

> **פער ידוע:** ל-`web_builder` ו-`automator` אין role-spec אופן-סורס בשל; מותאמים מדפוס GPT-Engineer/Devika + פלטפורמות no-code (GrapesJS/n8n/Make). **security ב-QA מריצים קוד שנוצר — חובה sandbox** ([MetaGPT #731](https://github.com/FoundationAgents/MetaGPT/issues/731)).

---

## אשכול 3 — הנהלה / אופרציה

| slug | סקין | מטרה (goal) | כלים | מקור OSS |
|---|---|---|---|---|
| `ceo` | מנכ"ל | מקבל-החלטות פעיל: כיוון, תיעדוף חד, האצלה לסקינז | — (orchestration; handoff לסקינז אחרים) | [ChatDev CEO RoleConfig v1.1.6](https://raw.githubusercontent.com/OpenBMB/ChatDev/v1.1.6/CompanyConfig/Default/RoleConfig.json) |
| `cto` | סמנכ"ל טכנולוגיה | החלטות תשתית/ארכיטקטורה מיושרות-מטרה, פיקוח על מימוש | repo read, design docs, handoff→engineer | [ChatDev CTO RoleConfig v1.1.6](https://raw.githubusercontent.com/OpenBMB/ChatDev/v1.1.6/CompanyConfig/Default/RoleConfig.json) |
| `cfo` | איש כספים | תקצוב, variance, ניתוח spend, ROI, דיווח | client billing, spend reports, analyze_campaign_performance | [daniel-st3/ai-cfo-agent](https://github.com/daniel-st3/ai-cfo-agent) · [FinRobot](https://github.com/AI4Finance-Foundation/FinRobot) · [CrewAI stock_analysis](https://github.com/crewAIInc/crewAI-examples) |
| `coo` | אופרציה | תהליך, תיאום, מעקב/האצלת משימות | task management, workflow ops | [MetaGPT Project Manager](https://github.com/FoundationAgents/MetaGPT) |
| `pm` | מנהל מוצר | PRD, roadmap, תיעדוף דרישות | docs, task management | [MetaGPT Product Manager](https://github.com/FoundationAgents/MetaGPT) |

**עיקרון להנהלה:** CEO/CTO הם תפקידי **תזמור** (decision+delegation), כמעט בלי כלים חיצוניים משלהם — הם משתמשים ב-`handoff_slugs` כדי להפעיל סקינז מבצעים (engineer, campaigner וכו'). זה בדיוק דפוס ChatDev: persona מחליט, phase מבצע.

---

## אשכול 4 — ארגון (משאבי אנוש / משפטי)

| slug | סקין | מטרה (goal) | כלים | מקור OSS |
|---|---|---|---|---|
| `hr` | משאבי אנוש / גיוס | sourcing→screen→score→outreach→report; כתיבת JD | ATS, resume DB (vector), Calendar, Gmail | [CrewAI recruitment](https://github.com/crewAIInc/crewAI-examples/tree/main/crews/recruitment) + [job-posting](https://github.com/crewAIInc/crewAI-examples/tree/main/crews/job-posting) · [NirDiamant HR Assistant](https://github.com/NirDiamant/GenAI_Agents) |
| `legal` | משפטי / ציות | סקירת חוזים, חילוץ סעיפים (CUAD 41), דירוג סיכון 🔴🟡🟢, redline | Drive/Supabase contract store, RAG, redline gen | [evolsb/claude-legal-skill](https://github.com/evolsb/claude-legal-skill) (skill.md מוכן) · [CUAD](https://www.atticusprojectai.org/cuad/) · [ContractEval](https://github.com/olivialiu121/ContractEval) |

**constraints קריטי ל-`legal` (לא נדרס לעולם):** "סקירה זו אינפורמטיבית בלבד; תנאים מהותיים מחייבים בדיקת עו"ד מוסמך." הסלמה לאנוש על ממצא 🔴. אסור להמציא — "אין סעיף רלוונטי" כשאין.
**guardrail ל-`hr`:** אסור להמציא נתוני מועמד או לטעון גישה למערכת שאין (כמו scraping של LinkedIn); הערכה רק לפי כישורים רלוונטיים.

---

## מיפוי כלים → אינטגרציות (MCP מחוברים)

| כלי לוגי | MCP / מקור | סקינז שצורכים |
|---|---|---|
| Facebook Ads | `facebook_ads` MCP | campaigner, copywriter, social |
| Ahrefs (SEO/analytics) | `Ahrefs` MCP | seo, content_writer, analyst |
| image/video gen | `higgsfield` MCP + gpt-image-1 | social, content_writer, copywriter, web_builder |
| מצגות/דפים | `Gamma` MCP | content_writer, analyst |
| Email | `Gmail` MCP | copywriter, content_writer, hr, social |
| Calendar | `Google_Calendar` MCP | hr, cs_manager |
| מסמכים | `Google_Drive` MCP | legal, content_writer |
| workflow build | `Make` MCP + n8n | automator |
| DB/SQL | `Supabase` MCP | data, security |
| deploy | `Vercel` MCP | web_builder, devops |
| WhatsApp | Manus/Green API (קיים) | social, cs_manager, sdr |

---

*נכתב כשלב תכנון+seed. ה-seed בפועל (INSERT ל-`ai_skills`) במיגרציה נפרדת לאחר השלמת אשכול ההנהלה.*
