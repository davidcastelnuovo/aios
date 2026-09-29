(function () {
  const pieces = ["ppc", "seo", "geo", "ai"].map(function (name) {
    return "/carmen/pieces/" + name + ".webp";
  });

  const baseAngles = [0.4, 2.0, 3.5, 5.1];
  const radii = [1, 0.86, 0.94, 0.78];
  const united = [
    { x: -0.05, y: -0.03, r: -18 },
    { x: 0.06, y: -0.01, r: 11 },
    { x: -0.02, y: 0.05, r: 16 },
    { x: 0.04, y: 0.045, r: -9 },
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
    title.textContent = "מנהלת השיווק של העסק שלך";
    const sub = document.createElement("p");
    sub.className = "carmen-sub";
    sub.textContent = "מערכת הפעלה לסוכנויות שיווק מבוססת בינה מלאכותית";
    copy.appendChild(logo);
    copy.appendChild(title);
    copy.appendChild(sub);

    const pin = document.createElement("div");
    pin.className = "carmen-pin";
    const stage = document.createElement("div");
    stage.className = "carmen-stage";

    const field = document.createElement("div");
    field.className = "carmen-field";
    field.setAttribute("aria-hidden", "true");

    const figure = document.createElement("img");
    figure.className = "carmen-figure";
    figure.src = "/carmen/carmen-solid.webp";
    figure.alt = "";
    figure.width = 720;
    figure.height = 1180;
    figure.decoding = "async";

    const nodes = pieces.map(function (src) {
      const img = document.createElement("img");
      img.className = "carmen-orbit";
      img.src = src;
      img.alt = src.split("/").pop().replace(".webp", "");
      img.width = 540;
      img.height = 540;
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

  function osChip(text) {
    const li = document.createElement("li");
    li.textContent = text;
    return li;
  }

  function osArea(index, title, items) {
    const article = document.createElement("article");
    article.className = "carmen-os-area";
    const head = document.createElement("div");
    head.className = "carmen-os-area-head";
    const num = document.createElement("span");
    num.className = "carmen-os-num";
    num.textContent = index;
    const heading = document.createElement("h3");
    heading.textContent = title;
    head.appendChild(num);
    head.appendChild(heading);
    const list = document.createElement("ul");
    items.forEach(function (item) {
      list.appendChild(osChip(item));
    });
    article.appendChild(head);
    article.appendChild(list);
    return article;
  }

  function departmentCell(name, line, latin) {
    const cell = document.createElement("div");
    cell.className = latin ? "carmen-dept is-latin" : "carmen-dept";
    const strong = document.createElement("strong");
    strong.textContent = name;
    const span = document.createElement("span");
    span.textContent = line;
    cell.appendChild(strong);
    cell.appendChild(span);
    return cell;
  }

  function marketingArea() {
    const article = document.createElement("article");
    article.className = "carmen-os-area carmen-os-area--dept";
    const head = document.createElement("div");
    head.className = "carmen-os-area-head";
    const num = document.createElement("span");
    num.className = "carmen-os-num";
    num.textContent = "04";
    const heading = document.createElement("h3");
    heading.textContent = "מחלקת השיווק";
    head.appendChild(num);
    head.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "carmen-dept-grid";
    [
      ["קופי", "פרויקטים, צ'אט ועורך", false],
      ["קריאייטיב", "בריף, וריאציות ואישור", false],
      ["seo / geo", "מחקר, תוכן ונראות", true],
      ["קמפיינים", "קהלים, מודעות ותקציב", false],
      ["אנליטיקה", "דשבורדים ודוחות", false],
    ].forEach(function (row) {
      grid.appendChild(departmentCell(row[0], row[1], row[2]));
    });
    article.appendChild(head);
    article.appendChild(grid);
    return article;
  }

  function systemSection() {
    const section = document.createElement("section");
    section.className = "carmen-system";
    section.setAttribute("aria-labelledby", "carmen-system-title");

    const layout = document.createElement("div");
    layout.className = "carmen-system-layout";

    const figure = document.createElement("img");
    figure.className = "carmen-system-figure";
    figure.src = "/carmen/carmen-solid.webp";
    figure.alt = "";
    figure.width = 720;
    figure.height = 1180;
    figure.decoding = "async";

    const panel = document.createElement("div");
    panel.className = "carmen-system-panel";
    const title = document.createElement("h2");
    title.className = "carmen-title";
    title.id = "carmen-system-title";
    title.textContent = "המערכת";

    const os = document.createElement("div");
    os.className = "carmen-os";
    const bar = document.createElement("div");
    bar.className = "carmen-os-bar";
    bar.innerHTML = "carmen marketing <span>os</span>";
    const body = document.createElement("div");
    body.className = "carmen-os-body";
    body.appendChild(
      osArea("01", "ניהול שיווק ומכירות", [
        "דשבורד מכירות",
        "פייפליין וסטטוסים",
        "קמפיינרים",
        "דוחות ביצועים",
      ])
    );
    body.appendChild(
      osArea("02", "אוטומציות ופולואפים", [
        "טריגרים אוטומטיים",
        "פולואפים אוטומטיים",
        "תזכורות והתראות",
        "זימון פגישות",
      ])
    );
    body.appendChild(
      osArea("03", "ניהול לידים", [
        "פייפליין מכירות",
        "יבוא מפייסבוק",
        "תמלול שיחות",
        "סיכום ועזרה במכירה",
      ])
    );
    body.appendChild(marketingArea());
    body.appendChild(
      osArea("05", "לקוחות, משימות ופרויקטים", [
        "כרטיס לקוח והיסטוריה",
        "צוותי עבודה",
        "קנבן, טבלה ויומן",
        "פרויקטים לכל לקוח",
      ])
    );
    os.appendChild(bar);
    os.appendChild(body);
    panel.appendChild(title);
    panel.appendChild(os);
    layout.appendChild(figure);
    layout.appendChild(panel);
    section.appendChild(layout);
    return section;
  }

  function homeLayer() {
    const wrap = document.createElement("div");
    wrap.appendChild(hero());
    wrap.appendChild(systemSection());
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
          if (panel) panel.classList.toggle("e-active", on);
        });
      }
      buttons.forEach(function (button, index) {
        const label = button.querySelector(".e-n-tab-title-text");
        if (label && label.textContent.replace(/\s+/g, "") === "PCC") label.textContent = "PPC";
        button.addEventListener("click", function () {
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
