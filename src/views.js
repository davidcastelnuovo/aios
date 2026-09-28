import { findContent, normalizePath } from "./router.js";

const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function contentWithoutDuplicateHero(entry) {
  if (!entry.featuredImage || !entry.content) return entry.content || "";
  const escaped = entry.featuredImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return entry.content.replace(new RegExp(`<img[^>]*src="${escaped}"[^>]*>`, "i"), "");
}

const CONTACT_PATH = normalizePath("/%d7%a6%d7%95%d7%a8-%d7%a7%d7%a9%d7%a8");

function isContactPath(normalized) {
  return normalized === CONTACT_PATH || normalized === "/צור-קשר";
}

function renderContactForm({ idPrefix = "cf", compact = false } = {}) {
  const extraFields = compact
    ? ""
    : `
      <div class="form-field">
        <label class="form-label" for="${idPrefix}-email">דוא&quot;ל</label>
        <input
          class="form-control"
          id="${idPrefix}-email"
          name="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          placeholder="name@example.com"
        />
      </div>
      <div class="form-field">
        <label class="form-label" for="${idPrefix}-message">הערות</label>
        <textarea
          class="form-control form-control--textarea"
          id="${idPrefix}-message"
          name="message"
          rows="4"
          placeholder="ספרו לנו במה נוכל לעזור…"
        ></textarea>
      </div>`;

  return `
    <form class="contact-form" data-contact-form novalidate>
      <div class="form-field">
        <label class="form-label" for="${idPrefix}-name">
          שם מלא <span class="form-required" aria-hidden="true">*</span>
        </label>
        <input
          class="form-control"
          id="${idPrefix}-name"
          name="name"
          type="text"
          required
          autocomplete="name"
          placeholder="השם שלכם"
        />
      </div>
      <div class="form-field">
        <label class="form-label" for="${idPrefix}-phone">
          טלפון <span class="form-required" aria-hidden="true">*</span>
        </label>
        <input
          class="form-control"
          id="${idPrefix}-phone"
          name="phone"
          type="tel"
          required
          autocomplete="tel"
          inputmode="tel"
          placeholder="050-0000000"
        />
      </div>
      ${extraFields}
      <div class="form-field form-field--checkbox">
        <input type="checkbox" id="${idPrefix}-privacy" name="privacy" required />
        <label class="form-label form-label--checkbox" for="${idPrefix}-privacy">
          קראתי ואני מסכים/ה ל<a href="#/%d7%9e%d7%93%d7%99%d7%a0%d7%99%d7%95%d7%aa-%d7%a4%d7%a8%d7%98%d7%99%d7%95%d7%aa" data-nav="/%d7%9e%d7%93%d7%99%d7%a0%d7%99%d7%95%d7%aa-%d7%a4%d7%a8%d7%98%d7%99%d7%95%d7%aa">מדיניות הפרטיות</a>
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn--block">שליחה</button>
      </div>
      <p class="form-note" hidden data-form-success>תודה! קיבלנו את הפנייה ונחזור אליכם בהקדם.</p>
      <p class="form-disclaimer">טופס הדגמה — ללא שליחה לשרת בשלב זה.</p>
    </form>`;
}

export function renderContactPage({ site }) {
  return `
    <section class="section page page--contact">
      <div class="container">
        <div class="contact-layout">
          <div class="contact-intro">
            <h1>צור קשר</h1>
            <p class="contact-intro__lead">
              לייעוץ, הצעת מחיר או שאלה — מלאו את הטופס או התקשרו אלינו ישירות.
            </p>
            <ul class="contact-details">
              <li>
                <span class="contact-details__label">טלפון</span>
                <a href="tel:${site.phoneTel}">${site.phone}</a>
              </li>
              <li>
                <span class="contact-details__label">דוא&quot;ל</span>
                <a href="mailto:${site.email}">${site.email}</a>
              </li>
              <li>
                <span class="contact-details__label">כתובת</span>
                <span>${site.address}</span>
              </li>
            </ul>
          </div>
          <div class="contact-form-panel">
            <h2 class="contact-form-panel__title">שלחו הודעה</h2>
            ${renderContactForm({ idPrefix: "contact-page" })}
          </div>
        </div>
      </div>
    </section>`;
}

function renderPostCard(post, { heading = "h3" } = {}) {
  const media = post.featuredImage
    ? `<div class="post-card__media"><img src="${post.featuredImage}" alt="" loading="lazy" decoding="async" /></div>`
    : `<div class="post-card__media post-card__media--placeholder" aria-hidden="true"></div>`;

  const TitleTag = heading;
  const date = formatDate(post.date);

  return `
    <article class="post-card">
      <a class="post-card__link" href="#${post.path}" data-nav="${post.path}">
        ${media}
        <div class="post-card__body">
          ${date ? `<time class="post-card__date" datetime="${post.date || ""}">${date}</time>` : ""}
          <${TitleTag} class="post-card__title">${post.title}</${TitleTag}>
          <p class="post-card__excerpt">${stripTags(post.excerpt).slice(0, 140)}…</p>
          <span class="post-card__more">קרא עוד</span>
        </div>
      </a>
    </article>`;
}

export function renderLayout({ site, navigation, mainHtml, title }) {
  document.title = title
    ? `${stripTags(title)} | ${site.name}`
    : `${site.name} — ${site.tagline}`;

  return `
    <a class="skip-link" href="#main">דלג לתוכן</a>
    <header class="site-header">
      <div class="header-main">
        <div class="container header-main__inner">
          <a class="brand" href="#/" data-nav="/">
            <img
              class="brand-logo"
              src="${site.headerLogo || site.logo}"
              alt="${site.name}"
              width="607"
              height="80"
            />
          </a>
          <div class="header-main__side">
            <p class="header-tagline">
              התקשרו עכשיו:
              <a href="tel:${site.phoneTel}" class="header-tagline__phone">${site.phone}</a>
            </p>
            <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav">
              <span class="nav-toggle__bars" aria-hidden="true"></span>
              <span class="nav-toggle__label">תפריט</span>
            </button>
          </div>
        </div>
      </div>
      <div class="header-nav">
        <div class="container">
          <nav id="site-nav" class="site-nav" aria-label="ראשי">
            ${navigation
              .map((item) => {
                const hasChildren = item.children?.length;
                if (!hasChildren) {
                  return `<a class="site-nav__link" href="#${item.path}" data-nav="${item.path}">${item.label}</a>`;
                }
                return `
                  <div class="nav-group">
                    <a class="site-nav__link site-nav__link--has-sub" href="#${item.path}" data-nav="${item.path}">${item.label}</a>
                    <div class="nav-dropdown">
                      ${item.children
                        .map(
                          (child) =>
                            `<a class="nav-dropdown__link" href="#${child.path}" data-nav="${child.path}">${child.label}</a>`,
                        )
                        .join("")}
                    </div>
                  </div>`;
              })
              .join("")}
          </nav>
        </div>
      </div>
    </header>
    <main id="main" class="site-main">${mainHtml}</main>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <h2>פרטי קשר</h2>
          <p><strong>${site.name}</strong></p>
          <p><a href="tel:${site.phoneTel}">${site.phone}</a></p>
          <p><a href="mailto:${site.email}">${site.email}</a></p>
          <p>${site.address}</p>
        </div>
        <div>
          <h2>קישורים</h2>
          <ul class="footer-links">
            <li><a href="#/${encodeURIComponent("ציוד-למכבסות")}" data-nav="/%d7%a6%d7%99%d7%95%d7%93-%d7%9c%d7%9e%d7%9b%d7%91%d7%a1%d7%95%d7%aa">ציוד למכבסות</a></li>
            <li><a href="#/${encodeURIComponent("מדיניות-פרטיות")}" data-nav="/%d7%9e%d7%93%d7%99%d7%a0%d7%99%d7%95%d7%aa-%d7%a4%d7%a8%d7%98%d7%99%d7%95%d7%aa">מדיניות פרטיות</a></li>
            <li><a href="#/${encodeURIComponent("צור-קשר")}" data-nav="/%d7%a6%d7%95%d7%a8-%d7%a7%d7%a9%d7%a8">צור קשר</a></li>
          </ul>
        </div>
      </div>
      <p class="footer-copy container">© ${new Date().getFullYear()} ${site.name}</p>
    </footer>
  `;
}

export function renderHome({ site, posts }) {
  const recent = posts.slice(0, 6);
  const slides =
    site.heroCarousel ||
    (site.heroSlides || []).map((image, i) => ({
      image,
      title: site.heroTitles?.[i] || site.name,
    }));

  return `
    <section
      class="hero-carousel"
      data-hero-carousel
      aria-roledescription="carousel"
      aria-label="באנר ראשי"
    >
      <div class="hero-carousel__slides">
        ${slides
          .map(
            (slide, i) => {
              const payments =
                slide.variant === "payments" || /payments/i.test(slide.image || "");
              return `
          <div
            class="hero-carousel__slide${i === 0 ? " is-active" : ""}${payments ? " hero-carousel__slide--payments" : ""}"
            data-hero-slide
            data-title="${slide.title.replace(/"/g, "&quot;")}"
            aria-hidden="${i === 0 ? "false" : "true"}"
          >
            <img src="${slide.image}" alt="${slide.title}" width="1920" height="700" decoding="async" />
            <p class="hero-carousel__caption" aria-hidden="true">${slide.title}</p>
          </div>`;
            },
          )
          .join("")}
      </div>
      <div class="hero-carousel__chrome">
        <p class="sr-only" data-hero-status aria-live="polite">${slides[0]?.title || ""}</p>
        <div class="hero-carousel__controls">
          <button type="button" class="hero-carousel__arrow hero-carousel__arrow--prev" data-hero-prev aria-label="שקף קודם">‹</button>
          <div class="hero-carousel__dots" role="tablist" aria-label="בחירת שקף">
            ${slides
              .map(
                (slide, i) =>
                  `<button type="button" role="tab" class="hero-carousel__dot${i === 0 ? " is-active" : ""}" data-hero-dot aria-label="${slide.title}" aria-selected="${i === 0 ? "true" : "false"}"></button>`,
              )
              .join("")}
          </div>
          <button type="button" class="hero-carousel__arrow hero-carousel__arrow--next" data-hero-next aria-label="שקף הבא">›</button>
        </div>
      </div>
    </section>

    <section class="section intro">
      <div class="container narrow center">
        <img class="intro-logo" src="${site.logo}" alt="" width="150" height="150" />
        <h1>ציוד למכבסות</h1>
        <p>
          עומדים לפתוח מכבסה? מעוניינים בשירות עצמי או לייעל מכבסה קיימת?
          לייעוץ והזמנת ציוד חייגו <a href="tel:${site.phoneTel}">${site.phone}</a>.
        </p>
      </div>
    </section>

    <section class="section services">
      <div class="container">
        <h2>מה אנחנו מציעים</h2>
        <ul class="card-grid">
          <li class="card"><h3>מכונות כביסה תעשייתיות</h3><p>אלקטרולוקס, מייטג ופתרונות לפי נפח עבודה.</p></li>
          <li class="card"><h3>מכונות ייבוש</h3><p>ייעוץ, אספקה ותחזוקה למייבשים תעשייתיים.</p></li>
          <li class="card"><h3>הקמה ותחזוקה</h3><p>מתקני כביסה במוסדות, טכנאים ותיקונים בשטח.</p></li>
          <li class="card"><h3>ציוד למכבסות</h3><p>מגוון אביזרים ופתרונות להשלמת המכבסה.</p></li>
        </ul>
      </div>
    </section>

    <section class="section video-section">
      <div class="container narrow">
        <h2>וודהיל ונדינג בע&quot;מ</h2>
        <div class="video-embed">
          <iframe src="${site.youtube}" title="סרטון וודהיל" loading="lazy" allowfullscreen></iframe>
        </div>
      </div>
    </section>

    <section class="section contact-teaser">
      <div class="container contact-grid">
        <div>
          <h2>צרו איתנו קשר</h2>
          <p>לפרטים נוספים, הצעת מחיר או ייעוץ — השאירו פרטים או חייגו.</p>
        </div>
        <div class="contact-form-panel contact-form-panel--inline">
          ${renderContactForm({ idPrefix: "home", compact: true })}
        </div>
      </div>
    </section>

    <section class="section posts posts--home">
      <div class="container">
        <div class="section-head">
          <h2>מאמרים אחרונים</h2>
          <a class="section-head__link" href="#/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d" data-nav="/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d">כל המאמרים</a>
        </div>
        <div class="post-grid">
          ${recent.map((post) => renderPostCard(post)).join("")}
        </div>
      </div>
    </section>
  `;
}

export function renderArticlesIndex({ posts }) {
  return `
    <section class="section page page--blog">
      <div class="container">
        <header class="page-header">
          <h1>מאמרים</h1>
          <p>מדריכים, טיפים וחדשות מעולם המכבסות והציוד התעשייתי.</p>
        </header>
        <div class="post-grid post-grid--archive">
          ${posts.map((post) => renderPostCard(post, { heading: "h2" })).join("")}
        </div>
      </div>
    </section>
  `;
}

export function renderContentPage(entry) {
  const isPost = entry.type === "post";
  const body = isPost ? contentWithoutDuplicateHero(entry) : entry.content;
  const date = isPost ? formatDate(entry.date) : "";

  return `
    <article class="section page ${isPost ? "page--article" : "page--content"}">
      ${
        entry.featuredImage
          ? `<figure class="article-featured"><img src="${entry.featuredImage}" alt="" loading="eager" decoding="async" /></figure>`
          : ""
      }
      <div class="container ${isPost ? "article-shell" : "narrow"}">
        ${date ? `<time class="article-date" datetime="${entry.date || ""}">${date}</time>` : ""}
        <h1>${entry.title}</h1>
        <div class="prose-body">${body}</div>
        ${
          isPost
            ? `<p class="article-back"><a href="#/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d" data-nav="/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d">← חזרה למאמרים</a></p>`
            : ""
        }
      </div>
    </article>
  `;
}

export function renderNotFound(path) {
  return `
    <section class="section page">
      <div class="container narrow">
        <h1>הדף לא נמצא</h1>
        <p>לא מצאנו תוכן עבור ${path}</p>
        <p><a class="btn btn-primary" href="#/" data-nav="/">חזרה לדף הבית</a></p>
      </div>
    </section>
  `;
}

export function resolveMainHtml(data, path) {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return { html: renderHome({ site: data.site, posts: data.posts }), title: "בית" };
  }
  if (
    normalized === normalizePath("/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d") ||
    normalized === "/מאמרים"
  ) {
    return { html: renderArticlesIndex({ posts: data.posts }), title: "מאמרים" };
  }

  if (isContactPath(normalized)) {
    return { html: renderContactPage({ site: data.site }), title: "צור קשר" };
  }

  const entry = findContent(data, path);
  if (entry) {
    return { html: renderContentPage(entry), title: entry.title };
  }

  return { html: renderNotFound(path), title: "404" };
}
