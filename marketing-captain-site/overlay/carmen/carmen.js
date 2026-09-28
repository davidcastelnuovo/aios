(function () {
  const portraitSrc = "/carmen/carmen-portrait.webp";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function pageKey() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/index.html") return "home";
    const seg = path.split("/").filter(Boolean)[0];
    return seg || "home";
  }

  function heroBlock() {
    return (
      '<section class="carmen-block carmen-block--hero" aria-labelledby="carmen-hero-title">' +
      '<div class="carmen-inner">' +
      '<div class="carmen-hero-grid">' +
      '<div class="carmen-copy">' +
      '<div class="carmen-badge"><span class="carmen-badge-dot" aria-hidden="true"></span>כרמן · Marketing Agency OS</div>' +
      '<h1 class="carmen-title" id="carmen-hero-title">אני כרמן — <em>הקפטן</em> של השיווק שלך</h1>' +
      '<p class="carmen-lead">אני מנהלת השיווק שלך בעבודה מלאה עם הבעלים. אני מתזמרת אנשי מקצוע, שומרת על קו אחיד, ומפעילה את מערכת ההפעלה שמחברת הכל — כדי שהעסק שלך יצמח.</p>' +
      '<p class="carmen-note"><strong>היעד שלי:</strong> לעזור לך לשגשג — צמיחה של עד <strong>פי 10</strong> תוך שנה עד שלוש, לפי בשלות לסקייל ומורכבות השירות או המוצר.</p>' +
      '<div class="carmen-actions">' +
      '<a class="carmen-btn carmen-btn--primary" href="/contact/">בוא נדבר על הצמיחה שלך</a>' +
      '<a class="carmen-btn carmen-btn--ghost" href="/packages/">מה אני מנהלת עבורך</a>' +
      "</div>" +
      '<p class="carmen-powered">Marketing Agency OS · <span>Powered by AIOS</span></p>' +
      "</div>" +
      '<div class="carmen-visual">' +
      '<div class="carmen-visual-frame">' +
      '<img src="' +
      esc(portraitSrc) +
      '" alt="כרמן — מנהלת השיווק שלך" width="640" height="480" loading="eager" decoding="async" />' +
      "</div>" +
      '<p class="carmen-visual-caption">אני כאן כדי לנהל, לדווח ולצמוח איתך — לא במקומך.</p>' +
      "</div>" +
      "</div>" +
      '<div class="carmen-steps" aria-label="איך אני עובדת">' +
      '<article class="carmen-step"><h3>שותפות עם הבעלים</h3><p>אני עובדת איתך — מגדירים יחד יעדים, סדר עדיפויות ומה הצלחה נראית אצלך.</p></article>' +
      '<article class="carmen-step"><h3>אני + אנשי מקצוע</h3><p>אני מנהלת קמפיינים, תוכן, SEO וקריאייטיב — הצוות מבצע, אני שומרת על תוצאה אחת.</p></article>' +
      '<article class="carmen-step"><h3>מערכת ברקע</h3><p>לידים, משימות, דוחות ואוטומציות רצים על AIOS — ואני מפעילה את זה בשבילך.</p></article>' +
      "</div>" +
      "</div></section>"
    );
  }

  function packagesBlock() {
    return (
      '<section class="carmen-block carmen-block--compact" aria-labelledby="carmen-packages-title">' +
      '<div class="carmen-inner">' +
      '<div class="carmen-badge"><span class="carmen-badge-dot" aria-hidden="true"></span>כרמן מדברת</div>' +
      '<h2 class="carmen-title" id="carmen-packages-title" style="font-size:clamp(1.5rem,4vw,2.25rem)">אלה החבילות ש<strong style="color:var(--carmen-mc-accent)">אני</strong> מנהלת עבורך</h2>' +
      '<p class="carmen-lead" style="margin-bottom:0">מתחת תראה את אותן חבילות Marketing Captain — אני מתזמרת את מה שנבחר, עם אנשי מקצוע ומערכת. המחירים נשארים כפי שהם.</p>' +
      "</div></section>"
    );
  }

  function aboutBlock() {
    return (
      '<section class="carmen-block carmen-block--compact" aria-labelledby="carmen-about-title">' +
      '<div class="carmen-inner">' +
      '<div class="carmen-badge"><span class="carmen-badge-dot" aria-hidden="true"></span>לפני הסיפור</div>' +
      '<h2 class="carmen-title" id="carmen-about-title" style="font-size:clamp(1.5rem,4vw,2.25rem)">מי בנה אותי — ומי עומד מאחורי</h2>' +
      '<p class="carmen-lead" style="margin-bottom:0">אני כרמן. בדף הזה תמצא את הסרטונים, הצוות והסיפור המקצועי — כל מה שעמד פעם בראש. אני ממשיכה מכאן כמנהלת השיווק שלך.</p>' +
      "</div></section>"
    );
  }

  function contactBlock() {
    return (
      '<section class="carmen-block carmen-block--compact" aria-labelledby="carmen-contact-title">' +
      '<div class="carmen-inner">' +
      '<h2 class="carmen-title" id="carmen-contact-title" style="font-size:clamp(1.5rem,4vw,2rem)">רוצה שאנהל את השיווק שלך?</h2>' +
      '<p class="carmen-lead">מלא את הטופס למטה — אני (והצוות) נחזור אליך לשיחת התאמה. בפרודקשן נפתח גם הרשמה לבטא של כרמן.</p>' +
      "</div></section>"
    );
  }

  const blocks = {
    home: heroBlock,
    packages: packagesBlock,
    about: aboutBlock,
    contact: contactBlock,
    blog: packagesBlock,
  };

  function mount() {
    if (document.getElementById("carmen-layer")) return;
    const header = document.querySelector("header.elementor-location-header");
    if (!header) return;

    const key = pageKey();
    const build = blocks[key];
    if (!build) return;

    const layer = document.createElement("div");
    layer.id = "carmen-layer";
    layer.innerHTML = build();
    header.insertAdjacentElement("afterend", layer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
