# Visual Workspace → Live Sitemap (synced with menu)

Turn the Visual Workspace into a hierarchical tree where each card is a module and each branch is a category, mirroring the sidebar menu. Editing the tree visually edits `menu_items` — so the sidebar updates instantly.

## What you'll see

- Compact module cards (≈ 1/3 current size) — icon + label only, hover for description.
- One column per top-level category (e.g. ניהול, מכירות, תקשורת, אוטומציה ו-AI, הגדרות, אינטגרציות).
- Connector lines from each category header down to its modules (SVG).
- Sub-modules (e.g. Social Gantt under Social Media) connect to their parent module with a secondary line.
- Two extra auto-generated categories at the end:
  - **"בלי דרך ישירה"** — modules whose route exists in the app but isn't reachable from any visible menu item (e.g. `/agent-tasks`, `/landing-page-submissions`, `/home`).
  - **"לא בשימוש / מוסתר"** — menu items with `is_visible=false`, plus app routes with no `menu_items` row at all.

## Editing actions (all sync to `menu_items`)

1. **Drag a module card** between categories → updates `parent_menu_key` + `sort_order`.
2. **Drag a module under another module** → makes it a sub-module (parent becomes that module's key).
3. **Double-click a category title** → inline rename → updates that category row's `custom_label`. Sidebar reflects the new label immediately (sidebar already reads `custom_label || original_label`).
4. **+ category button** → creates a new `menu_items` row with `route='#'` and no parent (becomes a sidebar group).
5. **Toggle visibility** on a card (eye icon) → flips `is_visible`. Hidden cards move to "לא בשימוש".
6. **Delete category** → only allowed when empty; otherwise prompts to move children first.

All mutations use the existing `menu_items` RLS (already tenant-scoped), invalidate the `['menu-items', tenantId]` query, so `AppSidebar` re-renders without reload.

## Data model

No schema changes needed — `menu_items` already has `parent_menu_key`, `sort_order`, `custom_label`, `is_visible`, `route`. Categories are rows with `route='#'` and `parent_menu_key=null`.

To detect orphans:
- Build the set of routes from `src/App.tsx` (static catalog, exported from a new `src/lib/appRoutes.ts`).
- Compare against `menu_items.route`. Any app route not in `menu_items` → "לא בשימוש". Any `menu_items` row whose route can't be navigated to via a visible parent chain → "בלי דרך ישירה".

## Files to add / change

- `src/lib/appRoutes.ts` *(new)* — single source-of-truth list `{ key, route, label, icon, description }` for every real route in `App.tsx`, grouped by suggested category. Used by both the workspace and the orphan detector.
- `src/visual-workspace/components/WorkspaceCanvas.tsx` *(rewrite)* — replaces the current "departments / customers / agents" canvas with the sitemap tree.
- `src/visual-workspace/components/SitemapTree.tsx` *(new)* — renders columns, cards, SVG connector lines.
- `src/visual-workspace/components/ModuleCard.tsx` *(new)* — compact draggable card.
- `src/visual-workspace/components/CategoryColumn.tsx` *(new)* — droppable column with editable title + add/delete.
- `src/visual-workspace/hooks/useSitemap.ts` *(new)* — joins `menu_items` + `appRoutes.ts`, returns `{ categories, modulesByParent, orphans, hidden }`, plus mutations: `renameCategory`, `moveModule`, `createCategory`, `deleteCategory`, `toggleVisibility`.
- `src/visual-workspace/utils/connectors.ts` *(new)* — computes SVG paths between parent/child DOM rects via `ResizeObserver`.

Out of scope (not touched): existing `BusinessCore`, `DepartmentIsland`, `CustomerSheet`, `TaskSheet`, `AgentSheet` — left in place but no longer rendered by `WorkspaceCanvas`. Can be deleted in a follow-up.

## Technical details

- Drag-and-drop: reuse `@dnd-kit` already in the project. Each `CategoryColumn` is a `useDroppable`; each `ModuleCard` is `useDraggable`. On drop, mutate `menu_items` with the new `parent_menu_key` and recompute `sort_order` for the destination column (gap-based ordering: `prev.sort_order + 1`, then resequence on collision).
- Connector SVG sits in an absolutely-positioned overlay covering the canvas; lines re-draw on layout change via `ResizeObserver`. Lines use `stroke-muted-foreground/40`, 1.5px, with rounded curves.
- Card size target: `w-36 h-12` with truncated label, icon 16px. Mobile: switches to single-column accordion (out of immediate scope but layout uses CSS grid `auto-fit minmax(180px,1fr)` so it degrades).
- Sidebar sync: no change to `AppSidebar.tsx` needed — it already reads from `useMenuItems`. Verify by checking that `parent_menu_key` is honored when rendering groups (it is).
- Permissions: only roles that can already edit menus (`owner`, `agency_owner`, `super_admin`) can mutate; viewers see read-only. Gate via `useUserRole`.

## Open questions

```text
1. Categories: keep the 6 from the sitemap diagram (ניהול / מכירות / תקשורת / אוטומציה ו-AI / הגדרות / אינטגרציות) as the seed,
   or read whatever currently exists in menu_items (today there are only `sales` and `management` — most modules sit at the root)?
2. Should "אינטגרציות" become a real sidebar category too, or stay a virtual workspace-only grouping?
```

I'll default to: **seed the missing categories into `menu_items` on first load** (so the sidebar gains them), and surface them as full categories in both places. Confirm in chat or the plan covers it.
