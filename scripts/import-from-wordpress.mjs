#!/usr/bin/env node
/**
 * Pulls public pages and posts from woodhill.co.il WordPress REST API
 * into public/data/site-content.json for the static rebuild.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { improveContent, firstImageFromHtml } from "../src/content-format.js";

const API = "https://www.woodhill.co.il/wp-json/wp/v2";
const OUT = new URL("../public/data/site-content.json", import.meta.url);

async function fetchAll(endpoint, { embed = false } = {}) {
  const items = [];
  let page = 1;
  for (;;) {
    const url = `${API}/${endpoint}?per_page=100&page=${page}&_embed=${embed ? 1 : 0}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
    if (page >= totalPages) break;
    page += 1;
  }
  return items;
}

function featuredImageFromEntry(entry) {
  const embedded = entry._embedded?.["wp:featuredmedia"]?.[0];
  if (embedded?.source_url) return embedded.source_url;
  return firstImageFromHtml(entry.content?.rendered || entry.excerpt?.rendered || "");
}

function mapEntry(entry, type) {
  const link = entry.link || "";
  let path = "/";
  try {
    const u = new URL(link);
    path = u.pathname.replace(/\/$/, "") || "/";
  } catch {
    path = `/${entry.slug}`;
  }

  return {
    id: entry.id,
    type,
    slug: entry.slug,
    path,
    title: entry.title?.rendered ?? "",
    excerpt: entry.excerpt?.rendered ?? "",
    content: improveContent(entry.content?.rendered ?? ""),
    featuredImage: featuredImageFromEntry(entry),
    date: entry.date ?? entry.modified,
    modified: entry.modified,
  };
}

const navigation = [
  {
    label: "בית",
    path: "/",
  },
  {
    label: "מכונת כביסה תעשייתית",
    path: "/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d/%d7%9e%d7%9b%d7%95%d7%a0%d7%aa_%d7%9b%d7%91%d7%99%d7%a1%d7%94_%d7%aa%d7%a2%d7%a9%d7%99%d7%99%d7%aa%d7%99%d7%aa",
    children: [
      {
        label: "מכונות כביסה אלקטרולוקס",
        path: "/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d/%d7%9e%d7%9b%d7%95%d7%a0%d7%aa_%d7%9b%d7%91%d7%99%d7%a1%d7%94_%d7%aa%d7%a2%d7%a9%d7%99%d7%99%d7%aa%d7%99%d7%aa/%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%9b%d7%91%d7%99%d7%a1%d7%94-%d7%90%d7%9c%d7%a7%d7%98%d7%a8%d7%95%d7%9c%d7%95%d7%a7%d7%a1",
      },
      {
        label: "מכונת כביסה מייטג",
        path: "/%d7%9e%d7%9b%d7%95%d7%a0%d7%aa-%d7%9b%d7%91%d7%99%d7%a1%d7%94-%d7%9e%d7%99%d7%99%d7%98%d7%92",
      },
    ],
  },
  {
    label: "מכונות ייבוש",
    path: "/%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%99%d7%99%d7%91%d7%95%d7%a9",
    children: [
      {
        label: "מכונות ייבוש אלקטרולוקס",
        path: "/%d7%98%d7%9b%d7%a0%d7%90%d7%99-%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%9b%d7%91%d7%99%d7%a1%d7%94/%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%99%d7%99%d7%91%d7%95%d7%a9-%d7%90%d7%9c%d7%a7%d7%98%d7%a8%d7%95%d7%9c%d7%95%d7%a7%d7%a1",
      },
      {
        label: "מכונות ייבוש מייטג",
        path: "/%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%99%d7%99%d7%91%d7%95%d7%a9-%d7%9e%d7%99%d7%99%d7%98%d7%92",
      },
      {
        label: "איך מכונות ייבוש עובדות?",
        path: "/%d7%90%d7%99%d7%9a-%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%99%d7%99%d7%91%d7%95%d7%a9-%d7%a2%d7%95%d7%91%d7%93%d7%95%d7%aa",
      },
      {
        label: "דגשים לבחירת מכונות ייבוש תעשייתיות",
        path: "/%d7%93%d7%92%d7%a9%d7%99%d7%9d-%d7%9c%d7%91%d7%97%d7%99%d7%a8%d7%aa-%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%99%d7%99%d7%91%d7%95%d7%a9-%d7%aa%d7%a2%d7%a9%d7%99%d7%99%d7%aa%d7%99%d7%95%d7%aa",
      },
    ],
  },
  {
    label: "טכנאי מכונות כביסה",
    path: "/%d7%98%d7%9b%d7%a0%d7%90%d7%99-%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%9b%d7%91%d7%99%d7%a1%d7%94",
  },
  {
    label: "תיקון מכונות כביסה",
    path: "/%d7%aa%d7%99%d7%a7%d7%95%d7%9f-%d7%9e%d7%9b%d7%95%d7%a0%d7%95%d7%aa-%d7%9b%d7%91%d7%99%d7%a1%d7%94",
  },
  {
    label: "ציוד למכבסות",
    path: "/%d7%a6%d7%99%d7%95%d7%93-%d7%9c%d7%9e%d7%9b%d7%91%d7%a1%d7%95%d7%aa",
  },
  {
    label: "מאמרים",
    path: "/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d",
  },
  {
    label: "צור קשר",
    path: "/%d7%a6%d7%95%d7%a8-%d7%a7%d7%a9%d7%a8",
  },
];

const siteMeta = {
  name: "וודהיל ונדינג בע\"מ",
  tagline: "מכונות כביסה תעשייתיות וציוד למכבסות",
  phone: "077-2304985",
  phoneTel: "0772304985",
  email: "woodhillvending@gmail.com",
  address: "ירושלים",
  logo: "https://www.woodhill.co.il/wp-content/uploads/2017/04/logobig.png",
  heroCarousel: [
    {
      image: "https://www.woodhill.co.il/wp-content/uploads/2018/02/1.jpg",
      title: "מכונות כביסה בשירות עצמי",
    },
    {
      image: "https://www.woodhill.co.il/wp-content/uploads/2018/03/payments1.jpg",
      title: "תשלום באמצעות אשראי, מטבעות, טלפון ושטרות",
    },
    {
      image: "https://www.woodhill.co.il/wp-content/uploads/2018/02/2.jpg",
      title: "אספקת ציוד איכותי למכבסות",
    },
    {
      image: "https://www.woodhill.co.il/wp-content/uploads/2018/02/3.jpg",
      title: "ייבוש כביסה בשירות עצמי",
    },
  ],
  youtube: "https://www.youtube.com/embed/JT7sfgLE7nM?rel=0",
};

console.log("Fetching WordPress pages…");
const pages = (await fetchAll("pages")).map((p) => mapEntry(p, "page"));
console.log(`  ${pages.length} pages`);

console.log("Fetching WordPress posts…");
const postsRaw = await fetchAll("posts", { embed: true });
const posts = postsRaw.map((p) => mapEntry(p, "post"));
console.log(
  `  ${posts.length} posts (${posts.filter((p) => p.featuredImage).length} with featured images)`,
);

const payload = {
  importedAt: new Date().toISOString(),
  source: "https://www.woodhill.co.il/",
  site: siteMeta,
  navigation,
  pages,
  posts,
};

await mkdir(dirname(OUT.pathname), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");
console.log(`Wrote ${OUT.pathname}`);
