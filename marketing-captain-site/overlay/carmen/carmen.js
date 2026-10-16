(function () {
  const pieces = [
    "/wp-content/uploads/MarketingCaptain_GraphicElement_4.png",
    "/wp-content/uploads/MarketingCaptain_GraphicElement_2.png",
    "/wp-content/uploads/MarketingCaptain_GraphicElement_4-1.svg",
    "/wp-content/uploads/MarketingCaptain_GraphicElement_2-1.svg",
    "/wp-content/uploads/MarketingCaptain_GraphicElement_1.png",
  ];

  const baseAngles = [0.2, 1.45, 2.7, 3.95, 5.2];
  const radii = [1, 0.9, 0.82, 0.94, 0.76];
  const united = [
    { x: -0.1, y: -0.04, r: -16 },
    { x: 0.08, y: -0.05, r: 12 },
    { x: 0.01, y: 0.08, r: 8 },
    { x: 0.09, y: 0.04, r: -11 },
    { x: -0.07, y: 0.05, r: 15 },
  ];

  function pageKey() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/index.html") return "home";
    const seg = path.split("/").filter(Boolean)[0];
    return seg || "home";
  }

  function wordmark(className) {
    const el = document.createElement(className === "carmen-site-wordmark" ? "span" : "p");
    el.className = className;
    el.innerHTML = 'carmen marketing <span>os</span>';
    return el;
  }

  function applyHeaderLogo() {
    const header = document.querySelector("header.elementor-location-header");
    if (!header || header.dataset.carmenLogo === "1") return;
    const iconLink = header.querySelector(".elementor-element-b95edfe a.elementor-icon");
    if (!iconLink) return;
    const svg = iconLink.querySelector("svg");
    if (svg) svg.setAttribute("aria-hidden", "true");
    if (!iconLink.querySelector(".carmen-site-wordmark")) {
      iconLink.setAttribute("aria-label", "carmen marketing os");
      iconLink.appendChild(wordmark("carmen-site-wordmark"));
    }
    if (!iconLink.getAttribute("href")) iconLink.setAttribute("href", "/");
    header.dataset.carmenLogo = "1";
  }

  function renameBrand() {
    if (document.title) {
      document.title = document.title.replace(/marketing captain/gi, "carmen marketing os");
    }
    document.querySelectorAll(".elementor-heading-title").forEach(function (el) {
      if (el.textContent && el.textContent.indexOf("Marketing Captain") !== -1) {
        el.textContent = el.textContent.replace("Marketing Captain", "carmen marketing os");
      }
    });
  }

  function hero() {
    const section = document.createElement("section");
    section.className = "carmen-hero";
    section.setAttribute("aria-labelledby", "carmen-hero-title");

    const copy = document.createElement("div");
    copy.className = "carmen-hero-copy";
    const logo = wordmark("carmen-wordmark");
    const title = document.createElement("h1");
    title.className = "carmen-title";
    title.id = "carmen-hero-title";
    title.textContent = "היי, אני כרמן. מנהלת השיווק והמכירות שלך.";
    const sub = document.createElement("p");
    sub.className = "carmen-sub";
    sub.textContent = "העסק שלך לא צריך עוד קמפיין. הוא צריך מישהי שתחבר את הקמפיינים, הלידים, הלקוחות והמספרים לתמונה אחת.";
    const actions = document.createElement("div");
    actions.className = "carmen-actions";
    actions.innerHTML =
      '<a class="carmen-btn" href="/contact/">בואו נכיר</a>' +
      '<a class="carmen-btn carmen-btn--ghost" href="#carmen-command">גלו מה אני עושה</a>';
    copy.appendChild(logo);
    copy.appendChild(title);
    copy.appendChild(sub);
    copy.appendChild(actions);

    const pin = document.createElement("div");
    pin.className = "carmen-pin";
    const stage = document.createElement("div");
    stage.className = "carmen-stage";

    const field = document.createElement("div");
    field.className = "carmen-field";
    field.setAttribute("aria-hidden", "true");

    const figure = document.createElement("img");
    figure.className = "carmen-figure";
    figure.src = "/carmen/carmen-character.webp";
    figure.onerror = function () { if (!figure.dataset.fallback) { figure.dataset.fallback = "1"; figure.src = "/carmen/carmen-solid.webp"; } };
    figure.alt = "";
    figure.width = 1024;
    figure.height = 1536;
    figure.decoding = "async";

    const nodes = pieces.map(function (src) {
      const img = document.createElement("img");
      img.className = "carmen-orbit";
      img.src = src;
      img.alt = "";
      img.decoding = "async";
      return img;
    });

    stage.appendChild(field);
    stage.appendChild(figure);
    nodes.forEach(function (node) {
      stage.appendChild(node);
    });
    pin.appendChild(stage);
    section.appendChild(copy);
    section.appendChild(pin);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start = performance.now();

    function frame(now) {
      const start = section.offsetTop;
      const range = Math.max(section.offsetHeight - window.innerHeight, 1);
      const p = reduce ? 0 : Math.min(1, Math.max(0, (window.scrollY - start) / range));
      const t = reduce ? 0 : (now - start) / 1000;
      const box = stage.getBoundingClientRect();
      const reach = Math.min(box.width, box.height) * 0.36;
      field.style.opacity = String(p);
      nodes.forEach(function (node, i) {
        const ang = baseAngles[i] + t * 0.55 * (1 - p);
        const spread = 1 - p;
        const x = Math.cos(ang) * reach * radii[i] * spread + united[i].x * box.width * p;
        const y = Math.sin(ang) * reach * 0.62 * radii[i] * spread + united[i].y * box.height * p;
        const rot = united[i].r * p;
        const scale = 1 - p * 0.28;
        node.style.transform =
          "translate(-50%, -50%) translate(" +
          x.toFixed(1) +
          "px, " +
          y.toFixed(1) +
          "px) rotate(" +
          rot.toFixed(1) +
          "deg) scale(" +
          scale.toFixed(3) +
          ")";
        node.style.zIndex = Math.sin(ang) > 0 ? "3" : "1";
      });
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    return section;
  }

  function svg(body) {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      body +
      "</svg>"
    );
  }

  const glyphs = {
    target: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    zap: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    dollar: svg('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    message: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    clock: svg('<circle cx="12" cy="12" r="8"/><polyline points="12 7 12 12 15 14"/>'),
    pie: svg('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'),
    spark: svg('<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>'),
    refresh: svg('<polyline points="23 4 23 10 17 10"/><path d="M20.5 15A9 9 0 1 1 19 6.3L23 10"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    building: svg('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>'),
    shield: svg('<path d="M12 3l8 3v6c0 5-3.4 7.6-8 9-4.6-1.4-8-4-8-9V6z"/>'),
    chart: svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  };

  const modules = [
    { main: "ניהול לידים", sub: "פייפליין מכירות, סטטוסים דינמיים", icon: "target", color: "#08F467" },
    { main: "ניהול משימות", sub: "קנבן, טבלה, לוח שנה", icon: "check", color: "#22c55e" },
    { main: "אוטומציות", sub: "טריגרים אוטומטיים, פולואפים", icon: "zap", color: "#eab308" },
    { main: "ניהול לקוחות", sub: "כרטיס לקוח מפורט, היסטוריה", icon: "users", color: "#3b82f6" },
    { main: "ניהול כספים", sub: "מעקב תשלומים, דוחות", icon: "dollar", color: "#10b981" },
    { main: "אינטגרציית WhatsApp", sub: "Green API, ManyChat, צ'אט מובנה", icon: "message", color: "#4ade80" },
    { main: "זימון פגישות", sub: "Google Calendar, שליחת זימונים", icon: "clock", color: "#0ea5e9", isNew: true },
    { main: "דוחות אוטומטיים", sub: "דוחות ביצועים בזמן אמת", icon: "pie", color: "#ec4899", isNew: true },
    { main: "בינה מלאכותית", sub: "עוזר AI חכם לתמיכה וניהול", icon: "spark", color: "#a855f7", isNew: true },
    { main: "פולואפים אוטומטיים", sub: "מעקב אוטומטי, תזכורות", icon: "refresh", color: "#f97316" },
    { main: "אינטגרציית יומן", sub: "Google Calendar, קביעת פגישות", icon: "calendar", color: "#ef4444" },
  ];

  function optionButton(item, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "carmen-option";
    button.dataset.index = String(index);
    button.style.background = "linear-gradient(145deg, " + item.color + "55, " + item.color + "18)";
    button.innerHTML =
      '<span class="carmen-option-mark">' +
      glyphs[item.icon] +
      "</span>" +
      (item.isNew ? '<span class="carmen-option-badge">חדש</span>' : "") +
      '<span class="carmen-option-foot"><span class="carmen-option-icon">' +
      glyphs[item.icon] +
      '</span><span class="carmen-option-copy"><strong>' +
      item.main +
      "</strong><span>" +
      item.sub +
      "</span></span></span>";
    return button;
  }

  function systemSection() {
    const root = document.createElement("div");
    root.className = "carmen-aios";

    const intro = document.createElement("section");
    intro.className = "carmen-aios-hero";
    intro.innerHTML =
      '<div class="carmen-wrap">' +
      '<div class="carmen-badge"><strong>carmen marketing os</strong><span>מערכת הפעלה מבוססת בינה מלאכותית</span></div>' +
      "<h2>השותפים שלך <span>לצמיחה</span></h2>" +
      '<p class="carmen-lead">ניהול לידים לעסק שלך וללקוחות שלך<span>בנוי במיוחד עבור סוכנויות שיווק.</span></p>' +
      '<div class="carmen-story"><strong>carmen marketing os</strong> היא לא סתם תוכנת CRM — היא מערכת הפעלה חכמה לעסק שלך. במקום לנהל כלים נפרדים, היא מרכזת הכל במקום אחד: לידים, לקוחות, משימות, אוטומציות, ואינטגרציות — ומניעה אותם עם בינה מלאכותית שעובדת בשבילך ברקע, 24/7.</div>' +
      '<div class="carmen-cta-row"><a class="carmen-btn" href="/contact/">הרשמה לרשימת המתנה</a><a class="carmen-btn carmen-btn--ghost" href="https://aios.co.il/auth">יש לי חשבון</a></div>' +
      '<div class="carmen-stats"><div><strong>50+</strong><span>ארגונים פעילים</span></div><div><strong>10K+</strong><span>לידים מנוהלים</span></div><div><strong>99%</strong><span>שביעות רצון</span></div></div>' +
      "</div>";

    const split = document.createElement("section");
    split.className = "carmen-wrap";
    split.innerHTML =
      '<div class="carmen-split">' +
      "<div>" +
      '<div class="carmen-kicker"><b>חדש!</b><span>Multi-Tenant</span></div>' +
      "<h2>פתח חשבונות<br><span>ללקוחות שלך</span></h2>" +
      "<p>אפשר ללקוחות שלך לנהל את העסק שלהם דרך המערכת שלך. כל לקוח מקבל גישה מותאמת אישית לנתונים שלו בלבד.</p>" +
      '<ul class="carmen-benefits">' +
      "<li><i>" + glyphs.building + "</i><span>כל לקוח מקבל חשבון נפרד ומאובטח</span></li>" +
      "<li><i>" + glyphs.shield + "</i><span>בידוד מלא בין ארגונים</span></li>" +
      "<li><i>" + glyphs.chart + "</i><span>צפייה בכל הארגונים ממקום אחד</span></li>" +
      "<li><i>" + glyphs.users + "</i><span>ניהול הרשאות מתקדם</span></li>" +
      "</ul></div>" +
      '<div class="carmen-orgs">' +
      '<div class="carmen-org is-main" style="transform:translateX(0)"><i>' + glyphs.building + '</i><div><b>סוכנות שיווק ראשית</b><span>מנהל</span></div></div>' +
      '<div class="carmen-org" style="transform:translateX(-10px)"><i>' + glyphs.building + '</i><div><b>לקוח - חברת טכנולוגיה</b><span>לקוח</span></div></div>' +
      '<div class="carmen-org" style="transform:translateX(-20px)"><i>' + glyphs.building + '</i><div><b>לקוח - מסעדה</b><span>לקוח</span></div></div>' +
      "</div></div>";

    const picker = document.createElement("section");
    picker.className = "carmen-wrap";
    const rowA = document.createElement("div");
    rowA.className = "carmen-options";
    const rowB = document.createElement("div");
    rowB.className = "carmen-options";
    const mobile = document.createElement("div");
    mobile.className = "carmen-mobile-options";
    const buttons = modules.map(optionButton);
    buttons.forEach(function (button, index) {
      (index < 6 ? rowA : rowB).appendChild(button);
    });
    const mobileCard = document.createElement("div");
    mobileCard.className = "carmen-mobile-card";
    const picks = document.createElement("div");
    picks.className = "carmen-picks";
    const pickButtons = modules.map(function (item, index) {
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "carmen-pick";
      pick.dataset.index = String(index);
      pick.style.background = item.color;
      pick.innerHTML = glyphs[item.icon];
      pick.setAttribute("aria-label", item.main);
      picks.appendChild(pick);
      return pick;
    });
    mobile.appendChild(mobileCard);
    mobile.appendChild(picks);

    function paint(active) {
      buttons.forEach(function (button, index) {
        button.classList.toggle("is-active", index === active);
      });
      pickButtons.forEach(function (button, index) {
        button.classList.toggle("is-active", index === active);
      });
      const item = modules[active];
      mobileCard.style.background = "linear-gradient(145deg, " + item.color + "55, " + item.color + "18)";
      mobileCard.innerHTML =
        (item.isNew ? '<span class="carmen-option-badge" style="display:inline-block">חדש</span>' : "") +
        '<span class="carmen-option-foot"><span class="carmen-option-icon">' +
        glyphs[item.icon] +
        '</span><span class="carmen-option-copy"><strong>' +
        item.main +
        "</strong><span>" +
        item.sub +
        "</span></span></span>";
    }

    function choose(index) {
      paint(index);
    }

    buttons.forEach(function (button, index) {
      button.addEventListener("click", function () {
        choose(index);
      });
    });
    pickButtons.forEach(function (button, index) {
      button.addEventListener("click", function () {
        choose(index);
      });
    });
    paint(0);
    picker.appendChild(rowA);
    picker.appendChild(rowB);
    picker.appendChild(mobile);

    const join = document.createElement("section");
    join.className = "carmen-wrap";
    join.innerHTML =
      '<div class="carmen-join"><h2>רוצים להצטרף?</h2><p>הירשמו לרשימת המתנה ונעדכן אתכם כשהגישה תיפתח</p><a class="carmen-btn" href="/contact/">הרשמה לרשימת המתנה</a></div>';

    root.appendChild(intro);
    root.appendChild(split);
    root.appendChild(picker);
    root.appendChild(join);
    return root;
  }

  function commandSection() {
    const section = document.createElement("section");
    section.id = "carmen-command";
    section.className = "carmen-command";
    section.innerHTML = `
      <div class="carmen-command-head">
        <span class="carmen-eyebrow">CARMEN / ONE CONNECTED SYSTEM</span>
        <h2>אני לא עוד כלי בארגז.<br><em>אני מחברת את כל הכלים.</em></h2>
        <p>CRM, לידים, WhatsApp, דיוור, משימות, דוחות, כספים וחתימות. כל מה שקורה בעסק — בתמונה אחת.</p>
      </div>
      <div class="carmen-command-grid">
        <div class="carmen-command-scene" aria-label="מפת המודולים של כרמן">
          <div class="carmen-command-halo"></div>
          <div class="carmen-command-core"><div class="carmen-command-cube"><span>C</span><small>MARKETING OS</small></div></div>
          <span class="carmen-command-beam beam-a"></span><span class="carmen-command-beam beam-b"></span><span class="carmen-command-beam beam-c"></span>
          <span class="carmen-command-beam beam-d"></span><span class="carmen-command-beam beam-e"></span><span class="carmen-command-beam beam-f"></span>
          <button class="carmen-command-node node-a is-active" data-command="crm">CRM</button>
          <button class="carmen-command-node node-b" data-command="whatsapp">WhatsApp</button>
          <button class="carmen-command-node node-c" data-command="reports">דוחות</button>
          <button class="carmen-command-node node-d" data-command="tasks">משימות</button>
          <button class="carmen-command-node node-e" data-command="finance">כספים</button>
          <button class="carmen-command-node node-f" data-command="signature">חתימות</button>
        </div>
        <div class="carmen-command-info" aria-live="polite">
          <span class="carmen-eyebrow">INSIDE CARMEN</span>
          <h3 id="carmen-command-title">אני מכירה את הלקוחות שלך.</h3>
          <p id="carmen-command-desc">CRM וניהול לקוחות ולידים — במקום אחד, עם היסטוריה וסטטוסים.</p>
          <div class="carmen-command-tabs" role="group" aria-label="בחירת מודול">
            <button class="is-active" data-command="crm">CRM</button><button data-command="whatsapp">WhatsApp</button><button data-command="reports">דוחות</button><button data-command="tasks">משימות</button><button data-command="finance">כספים</button><button data-command="signature">חתימות</button>
          </div>
          <div class="carmen-command-note" id="carmen-command-note">הלקוחות, הלידים והסטטוסים נשארים במקום אחד.</div>
        </div>
      </div>
      <div class="carmen-command-bottom"><h2>אתה מחליט כמה אני עושה לבד.</h2><p>עבודה ידנית, תהליכים עם אישורים ואוטומציות קיימות. אוטונומיה מלאה מקצה לקצה היא חלק מהחזון.</p><a class="carmen-btn" href="/contact/">בוא נדבר על העסק שלך</a></div>
    `;
    const details = {
      crm: ["אני מכירה את הלקוחות שלך.", "CRM וניהול לקוחות ולידים — במקום אחד, עם היסטוריה וסטטוסים.", "הלקוחות, הלידים והסטטוסים נשארים במקום אחד."],
      whatsapp: ["ליד חדש? אני כבר על זה.", "שליחת WhatsApp אוטומטית לליד נכנס ותהליכי תקשורת מחוברים.", "הודעה יוצאת ברגע שהליד נכנס, והשיחה נשארת מחוברת לתהליך."],
      reports: ["אני הופכת נתונים לתמונה ברורה.", "דוחות, דשבורדים ובקרה על הפעילות השיווקית.", "הדשבורד מתעדכן עם הפעילות, בלי לחכות לדוח חודשי."],
      tasks: ["אני שומרת על התוכנית בתנועה.", "ניהול משימות, אחריות ומעקב אחרי הביצוע.", "כל משימה יודעת למי היא שייכת ומה הצעד הבא."],
      finance: ["אני רואה גם את המספרים.", "ניהול הכנסות והוצאות כחלק מתמונת העסק.", "ההכנסות וההוצאות יושבות ליד שאר תמונת העסק."],
      signature: ["גם האישורים נשארים מחוברים.", "מודול חתימה דיגיטלית למסמכים ותהליכי אישור.", "מסמכים ואישורים נסגרים באותו רצף עבודה."]
    };
    section.querySelectorAll("[data-command]").forEach(function (button) {
      button.addEventListener("click", function () {
        const key = button.dataset.command;
        section.querySelectorAll("[data-command]").forEach(function (el) {
          el.classList.toggle("is-active", el.dataset.command === key);
        });
        section.querySelector("#carmen-command-title").textContent = details[key][0];
        section.querySelector("#carmen-command-desc").textContent = details[key][1];
        section.querySelector("#carmen-command-note").textContent = details[key][2];
      });
    });
    return section;
  }

  function storySection() {
    const section = document.createElement("section");
    section.className = "carmen-story";
    section.innerHTML = `
      <div class="carmen-story-chapter carmen-story-chapter--light">
        <span class="carmen-story-kicker">01 / THE BIG PICTURE</span>
        <h2>הקמפיין הוא לא התוכנית.<br><span>הוא חלק ממנה.</span></h2>
        <p>אני מחברת בין האסטרטגיה, הקמפיינים, הלידים והמכירות — כדי שתראה מה קורה בעסק, ולא רק בכלי אחד.</p>
        <div class="carmen-story-flow" aria-label="תהליך שיווק מחובר">
          <span>אסטרטגיה</span><b>←</b><span>קמפיינים</span><b>←</b><span>לידים</span><b>←</b><span>CRM</span><b>←</b><span>דוחות</span>
        </div>
      </div>
      <div class="carmen-story-chapter carmen-story-chapter--dark">
        <span class="carmen-story-kicker">02 / EVERY LEAD MATTERS</span>
        <h2>ליד נכנס.<br><span>העבודה רק מתחילה.</span></h2>
        <p>אני מחברת בין קליטת הליד, התקשורת ב־WhatsApp וניהול המשימות. פחות מעברים בין מסכים, יותר רצף עבודה.</p>
        <div class="carmen-story-process">
          <div><small>01</small><strong>ליד חדש</strong><span>נקלט במערכת</span></div>
          <div><small>02</small><strong>WhatsApp</strong><span>הודעה אוטומטית</span></div>
          <div><small>03</small><strong>CRM</strong><span>ניהול ומעקב</span></div>
          <div><small>04</small><strong>משימה</strong><span>המשך טיפול</span></div>
        </div>
      </div>
      <div class="carmen-story-chapter carmen-story-chapter--green">
        <span class="carmen-story-kicker">03 / CLARITY IS POWER</span>
        <h2>הנתונים לא צריכים<br>לחכות לסוף החודש.</h2>
        <p>דוחות ודשבורדים שמרכזים את המידע במקום אחד, כדי להבין מה עובד ומה דורש תשומת לב.</p>
        <div class="carmen-story-analytics" aria-label="המחשה גרפית של דשבורד — נתונים להמחשה בלבד">
          <div class="carmen-story-chart-head"><span>MARKETING OVERVIEW</span><span>● LIVE VIEW</span></div>
          <div class="carmen-story-bars"><i style="--h:32%"></i><i style="--h:46%"></i><i style="--h:39%"></i><i style="--h:68%"></i><i style="--h:57%"></i><i style="--h:83%"></i><i style="--h:74%"></i><i style="--h:95%"></i></div>
          <div class="carmen-story-chart-foot"><span>CAMPAIGNS</span><span>LEADS</span><span>REPORTS</span></div>
        </div>
      </div>
      <div class="carmen-story-final">
        <span class="carmen-story-kicker">CARMEN MARKETING OS</span>
        <h2>אני לא עוד מערכת.<br><span>אני מנהלת את התמונה הגדולה.</span></h2>
        <p>מקום אחד לשיווק, מכירות וניהול העבודה. עכשיו אפשר להתחיל לדבר על העסק שלך.</p>
        <a class="carmen-btn" href="/contact/">בוא נדבר על העסק שלך <span aria-hidden="true">↗</span></a>
      </div>
    `;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } });
      }, {threshold: 0.12});
      section.querySelectorAll(".carmen-story-chapter, .carmen-story-final").forEach(function(el) {observer.observe(el);});
    } else {
      section.querySelectorAll(".carmen-story-chapter, .carmen-story-final").forEach(function(el) {el.classList.add("is-visible");});
    }
    return section;
  }

  function siteFooter() {
    const footer = document.createElement("footer");
    footer.className = "carmen-foot";
    footer.innerHTML =
      '<div class="carmen-foot-brand">' +
      '<p class="carmen-foot-mark">carmen marketing <span>os</span></p>' +
      "<p>מערכת הפעלה לשיווק, למכירות ולניהול העבודה.</p>" +
      "</div>" +
      '<nav class="carmen-foot-nav" aria-label="ניווט תחתון">' +
      '<a href="/packages/">חבילות</a>' +
      '<a href="/about/">אודות</a>' +
      '<a href="/blog/">בלוג</a>' +
      '<a href="/contact/">צור קשר</a>' +
      "</nav>" +
      '<div class="carmen-foot-meta">' +
      '<a href="https://api.whatsapp.com/send?phone=972507677610&text=%D7%94%D7%99%D7%99,%20" target="_blank" rel="noopener">WhatsApp</a>' +
      "<span>© carmen marketing os</span>" +
      "</div>";
    return footer;
  }

  function homeLayer() {
    const wrap = document.createElement("div");
    wrap.appendChild(hero());
    wrap.appendChild(commandSection());
    wrap.appendChild(storySection());
    wrap.appendChild(siteFooter());
    return wrap;
  }

  function compact(id, title, lead) {
    return (
      '<section class="carmen-block carmen-block--compact" aria-labelledby="' +
      id +
      '"><div class="carmen-inner">' +
      '<h2 class="carmen-title" id="' +
      id +
      '">' +
      title +
      "</h2>" +
      '<p class="carmen-sub">' +
      lead +
      "</p></div></section>"
    );
  }

  const blocks = {
    home: homeLayer,
    packages: function () {
      const wrap = document.createElement("div");
      wrap.innerHTML = compact(
        "carmen-packages-title",
        "החבילות",
        "מערכת הפעלה לסוכנויות שיווק מבוססת בינה מלאכותית"
      );
      return wrap.firstChild;
    },
    about: function () {
      const wrap = document.createElement("div");
      wrap.innerHTML = compact(
        "carmen-about-title",
        "הסיפור והצוות",
        "מנהלת השיווק של העסק שלך"
      );
      return wrap.firstChild;
    },
    contact: function () {
      const wrap = document.createElement("div");
      wrap.innerHTML = compact(
        "carmen-contact-title",
        "בואו נדבר",
        "מערכת הפעלה לסוכנויות שיווק מבוססת בינה מלאכותית"
      );
      return wrap.firstChild;
    },
    blog: function () {
      return blocks.packages();
    },
  };

  function wireServiceTabs() {
    document.querySelectorAll(".e-n-tabs").forEach(function (tabs) {
      if (tabs.dataset.carmenTabs === "1") return;
      tabs.dataset.carmenTabs = "1";
      tabs.classList.add("e-activated");
      const buttons = Array.prototype.slice.call(tabs.querySelectorAll(":scope > .e-n-tabs-heading > .e-n-tab-title"));
      function activate(button) {
        buttons.forEach(function (other) {
          const on = other === button;
          other.setAttribute("aria-selected", on ? "true" : "false");
          other.tabIndex = on ? 0 : -1;
          const panel = document.getElementById(other.getAttribute("aria-controls"));
          if (!panel) return;
          panel.classList.toggle("e-active", on);
          panel.style.display = on ? "flex" : "none";
          panel.querySelectorAll("img").forEach(function (img) {
            img.loading = "eager";
            img.decoding = "sync";
          });
        });
      }
      buttons.forEach(function (button, index) {
        const label = button.querySelector(".e-n-tab-title-text");
        if (label && label.textContent.replace(/\s+/g, "") === "PCC") label.textContent = "PPC";
        button.addEventListener("click", function (event) {
          event.preventDefault();
          activate(button);
        });
        button.addEventListener("keydown", function (event) {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const step = event.key === "ArrowLeft" ? 1 : -1;
          const next = buttons[(index + step + buttons.length) % buttons.length];
          next.focus();
          activate(next);
        });
      });
      const selected = buttons.filter(function (button) {
        return button.getAttribute("aria-selected") === "true";
      })[0];
      if (selected) activate(selected);
    });
  }

  function mount() {
    applyHeaderLogo();
    renameBrand();
    wireServiceTabs();
    if (document.getElementById("carmen-layer")) return;
    const header = document.querySelector("header.elementor-location-header");
    if (!header) return;
    const key = pageKey();
    const build = blocks[key];
    if (!build) return;
    if (key === "home") {
      document.body.classList.add("carmen-home");
      document.querySelectorAll(".logos-section-img img").forEach(function (img) {
        img.loading = "eager";
        img.decoding = "sync";
      });
    }
    const layer = document.createElement("div");
    layer.id = "carmen-layer";
    layer.appendChild(build());
    header.insertAdjacentElement("afterend", layer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
