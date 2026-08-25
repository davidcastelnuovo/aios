---
name: create-premium-hebrew-ads
description: Create and redesign premium Hebrew advertising graphics from a brief, source ad, brand assets, or visual references. Use for Hebrew social ads, campaign key visuals, 8-10 concept grids, style explorations, RTL creative variations, or production-ready refinements where exact Hebrew copy, brand/logo fidelity, and distinctly different art directions matter.
---

# Create Premium Hebrew Ads

Produce high-end Hebrew advertising concepts with controlled variation, accurate right-to-left copy, and disciplined brand handling. Use the built-in image-generation workflow; do not replace requested raster creative with a text-only proposal.

## Select the mode

- **Concept grid:** Create 8-10 deliberately different directions in one comparison board. Default to 10 square tiles in a 2-column x 5-row grid unless the user specifies otherwise.
- **Single final:** Produce one standalone, high-resolution ad from a chosen direction.
- **Campaign set:** Produce each requested format or direction as a separate generation. Do not use one collage when the user asks for deliverable-ready individual ads.
- **Targeted revision:** Edit only the requested element and preserve all approved content.

## Build the source-of-truth brief

Extract and keep these fields before generating:

1. Brand and offer.
2. Exact Hebrew copy, separated into headline, secondary line, support line, CTA, and legal copy.
3. Output format and channel.
4. Required subjects or product imagery.
5. Brand colors and visual restrictions.
6. Every input image and its role: **edit target**, **brand/logo source**, **content source**, or **style reference**.

Treat the user-selected edit target as exact. Never silently substitute another image from the conversation. Inspect all input images before generation. Ask one concise question only when a missing offer, exact copy, or required format would materially change the result; otherwise make a tasteful assumption and proceed.

**Iron rule — subject first:** Style is costume, light, material, and crop only. The picture must depict this variation's copy idea as a concrete situation. A stranger should recognize which variation it is without reading type. Do not replace the copy with a prettier style-board default (vacation village, airplane wing, suitcase, jet engine, generic landscape, abstract glass toy) unless the copy is actually about that.

## Design concept grids

Read [references/style-catalog.md](references/style-catalog.md) when creating a multi-direction board.

Select directions that differ in composition, typography, material, image treatment, palette, and mood-not merely color.

Keep the underlying campaign content constant so the user can compare art direction. Give every tile a subtle number. Use equal tile sizes, clean gutters, a straight-on view, and no frames or device mockups unless requested.

For branded work, derive most colors from the brand but allow each concept one controlled stylistic accent. Preserve the campaign's recognizable subject and proposition across the grid.

## Handle Hebrew and logos safely

- Quote every required phrase verbatim in the generation prompt.
- State: "Hebrew, right-to-left, exact spelling, no extra words."
- Keep copy short in concept boards. Never compress a full sales page into a tile.
- Use a clear hierarchy: headline -> benefit/offer -> support -> CTA.
- Avoid reversed letter order, pseudo-Hebrew glyphs, orphan punctuation, or accidental mixed-direction lines.
- Preserve an attached logo from the supplied asset rather than redrawing it. If exact reproduction is uncertain, reserve a clean logo area; never invent or misspell a brand.
- Do not place critical text or logos too close to edges.

For production-critical copy or logo fidelity, prefer generating the visual foundation and compositing exact text/logo with an available deterministic design method. Do not present a misspelled image as final.

## Generate

Use the image-generation skill and built-in image tool. Include all relevant references in the request and label their roles explicitly. For new concept boards, generate one board per call. For final ads, generate one independent asset per direction or format.

Structure prompts in this order:

1. Use case and asset type.
2. Input-image roles.
3. Brand, audience, offer, and campaign goal.
4. Exact Hebrew copy.
5. Selected art direction.
6. Composition, hierarchy, palette, lighting, materials, and imagery.
7. RTL, logo, and production constraints.
8. Avoid list.

Read [references/prompt-blueprints.md](references/prompt-blueprints.md) for reusable concept-grid and final-ad prompt patterns.

## Validate every result

Inspect the generated image at high detail before handing it off.

For a concept grid, verify:

- The requested number of complete tiles is present.
- Directions are visibly distinct at thumbnail size.
- All required copy is present and correctly ordered in Hebrew.
- The brand/logo is recognizable and not corrupted.
- No tile is clipped, repeated, or visibly weaker than the rest.

For a single final, additionally verify safe margins, CTA legibility, subject anatomy/perspective, commercial credibility, and suitability for the requested channel.

If one issue is local, make one targeted edit and preserve everything else. If the grid structure or overall direction is wrong, regenerate with a corrected brief. If exact text remains wrong, stop iterating blindly and switch to deterministic text composition.

## Hand off

Show the visual first. For a concept grid, ask the user to choose tile numbers for standalone production. For final assets, state the format and any unresolved limitation in one concise sentence. Do not bury the result under design theory.
