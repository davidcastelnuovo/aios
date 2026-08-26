import { isApprovedConceptPrompt } from "@/components/marketing/copyConcepts";
import { buildNoGlyphLock } from "@/components/marketing/lib/creativeImagePrompt";
import { brandKitPrompt, type CreativeBrandKit } from "./brandKit";
import { buildAdaptiveTreatment } from "./adaptiveTreatment";
import { buildCompositionLock, type CompositionId } from "./compositions";
import { buildCursorArtDirectorLock, LOGO_PLACEMENT_LOCK } from "./cursorArtDirector";
import { buildCopyOverlayLock, buildCopySceneBrief, buildPaintedCopyLock, strongestLine } from "./designedLayers";
import { buildStyleContinuityLock, buildStylePlayLock } from "./styleContinuity";
import { buildStaticQualityLock, buildVisualStyleLock, type CreativeVisualStyleId } from "./visualStyles";

export function assembleStaticCreativePrompt({
  visualPrompt,
  copyText,
  copyLabel,
  copyKey,
  title,
  brief,
  instructions,
  format,
  styleId,
  costume,
  kit,
  payload,
  styleSource,
  attachStyleStill,
  compositionId,
  priorLabels,
  variationIndex,
  directorNote,
  regenerate,
  hasTalentRef,
  liveTextLayers,
  revising,
}: {
  visualPrompt?: string;
  copyText: string;
  copyLabel?: string;
  copyKey?: string;
  title?: string;
  brief?: string;
  instructions?: string;
  format: string;
  styleId: CreativeVisualStyleId;
  costume?: boolean;
  kit: CreativeBrandKit;
  payload: Record<string, unknown> | null | undefined;
  styleSource?: { copyLabel?: string; name?: string; copyText?: string };
  attachStyleStill?: boolean;
  compositionId: CompositionId;
  priorLabels?: string[];
  variationIndex: number;
  directorNote?: string;
  regenerate?: boolean;
  hasTalentRef?: boolean;
  liveTextLayers?: boolean;
  revising?: boolean;
}): string {
  const concept = visualPrompt?.trim() || "";
  const hasVisualBrief = Boolean(concept);
  const hasApprovedConcept = isApprovedConceptPrompt(concept);
  const lockCopyToConcept = hasApprovedConcept || hasVisualBrief;
  const copyLock = liveTextLayers
    ? (lockCopyToConcept
      ? buildCopyOverlayLock({ copyText, title, copyLabel })
      : buildCopySceneBrief({ copyText, title, brief, instructions, copyLabel }))
    : [
      !lockCopyToConcept && buildCopySceneBrief({ copyText, title, brief, instructions, copyLabel, paintCopy: true }),
      buildPaintedCopyLock({ copyText, title, copyLabel, conceptLocked: lockCopyToConcept }),
    ].filter(Boolean).join("\n");
  const director = buildCursorArtDirectorLock({
    format,
    instructions,
    kit,
    hasTalentRef,
    liveTextLayers,
    revising,
    hasApprovedConcept,
  });

  return [
    concept,
    director,
    lockCopyToConcept && "The concept above is the photograph. Later style/copy instructions may change crop, grade, and type placement — they may NOT replace the concept's subject, location, props, or hook. Copy is TYPE on that photograph, never a new scene.",
    lockCopyToConcept
      ? `Use case: ads-marketing. Asset type: ${format} cinematic advertising still of the approved concept — not a slogan-on-background graphic and not a literal illustration of the headline.`
      : `Use case: ads-marketing. Asset type: standalone ${format} finished graphic poster — not a photo with a caption.`,
    liveTextLayers ? buildNoGlyphLock({ regenerate }) : undefined,
    copyLock,
    styleSource
      ? buildStyleContinuityLock({
        sourceLabel: styleSource.copyLabel || styleSource.name,
        sourceIdea: strongestLine(styleSource.copyText || "", title),
        attachStill: !!attachStyleStill,
      })
      : buildCompositionLock(compositionId),
    lockCopyToConcept
      ? "Stay inside the approved concept's world. Different copy cards may change crop and energy, never the core scene or a new story invented from the headline."
      : buildStylePlayLock({
        copyText,
        copyLabel,
        copyKey,
        index: variationIndex,
        avoidLabels: priorLabels,
      }),
    attachStyleStill && !hasTalentRef && "The attached still is a technique sample, not a layout to trace. New cast, new props, new crop.",
    attachStyleStill && hasTalentRef && "A second attached still is technique only (material, ink, light). The first still is the spokesman — keep that face. New scene.",
    costume
      ? [
        buildVisualStyleLock(payload, { styleId }),
        lockCopyToConcept && "Apply this technique TO the approved concept's scene. Do not swap the concept's subject for a style-board cliché.",
      ].filter(Boolean).join("\n")
      : lockCopyToConcept
        ? undefined
        : buildAdaptiveTreatment({
          copyText,
          copyLabel,
          title,
          brief,
          brandColors: kit.brandBook?.colors,
        }),
    buildStaticQualityLock({ selectedStyle: !!costume }),
    brandKitPrompt(kit, { talentLock: hasTalentRef }),
    directorNote && (liveTextLayers
      ? `Art director REJECT (visual mistakes only — if they mention type/text, the fix is a letter-empty PNG, never new painted words): ${directorNote}`
      : `Art director REVISION (apply this fix, keep what still works, output a finished RTL Hebrew ad): ${directorNote}`),
    styleSource
      ? `Format ${format}. Same TECHNIQUE family (paper, ink, light, color). Completely different picture, people, and props for this copy.`
      : lockCopyToConcept
        ? `Format ${format}. Photograph the approved concept.${liveTextLayers ? " Leave a quiet pocket for type." : " Paint the quoted Hebrew type into a quiet pocket — type only, do not restage the copy."} Do not invent a competing layout from the copy.`
        : `Format ${format}. Invent this variation's graphic architecture. Do not reserve a top strip + bottom pill.`,
    kit.logoUrl && LOGO_PLACEMENT_LOCK,
    liveTextLayers
      ? "QUIET POCKET: one naturally empty atmospheric region (shadow, wall, sky) so Hebrew type can be composited later. Do not paint a layout, panel, footer, or letter-shaped hole."
      : "Paint Hebrew type into one naturally quiet atmospheric region (shadow, wall, sky). Do not add a fake caption plate or Instagram UI chrome.",
    liveTextLayers
      ? "RTL/production: Hebrew is composited later as isolated RTL layers (dir=rtl, unicode-bidi:isolate). Never paint or reverse letters."
      : "RTL/production: Hebrew is painted on this PNG as isolated RTL type (dir=rtl, unicode-bidi:isolate). Logical order. No mirrored glyphs.",
    liveTextLayers
      ? "Forbidden: grey or white studio, cyclorama, cutout portrait, thinking-hand pose, caption plates, boring text rectangles, Canva templates, UI chrome, invented logos, baked lettering, style-board recipes, reprinting a previous collage."
      : "Forbidden: grey or white studio, cyclorama, cutout portrait, thinking-hand pose, Canva caption templates, UI chrome, invented logos, reversed or garbled Hebrew, style-board recipes, reprinting a previous collage, restaging the headline instead of the concept.",
    hasApprovedConcept && "CLOSER: the photograph is still the approved concept. The headline did not become the subject.",
  ].filter(Boolean).join("\n");
}
