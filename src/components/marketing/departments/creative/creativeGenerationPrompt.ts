import { buildNoGlyphLock } from "@/components/marketing/lib/creativeImagePrompt";
import { brandKitPrompt, type CreativeBrandKit } from "./brandKit";
import { buildAdaptiveTreatment } from "./adaptiveTreatment";
import { buildCompositionLock, type CompositionId } from "./compositions";
import { buildCursorArtDirectorLock } from "./cursorArtDirector";
import { buildCopyOverlayLock, buildCopySceneBrief, strongestLine } from "./designedLayers";
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
}): string {
  const concept = visualPrompt?.trim() || "";
  const copyLock = concept
    ? buildCopyOverlayLock({ copyText, title, copyLabel })
    : buildCopySceneBrief({ copyText, title, brief, instructions, copyLabel });
  const director = buildCursorArtDirectorLock({
    format,
    instructions,
    kit,
    hasTalentRef,
  });

  return [
    concept,
    director,
    concept && "The concept above is the photograph. Later style/copy instructions may change crop, grade, and a quiet type pocket — they may NOT replace the concept's subject, location, props, or hook.",
    concept
      ? `Use case: ads-marketing. Asset type: ${format} cinematic advertising still of the approved concept — not a slogan-on-background graphic.`
      : `Use case: ads-marketing. Asset type: standalone ${format} finished graphic poster — not a photo with a caption.`,
    buildNoGlyphLock({ regenerate }),
    copyLock,
    styleSource
      ? buildStyleContinuityLock({
        sourceLabel: styleSource.copyLabel || styleSource.name,
        sourceIdea: strongestLine(styleSource.copyText || "", title),
        attachStill: !!attachStyleStill,
      })
      : buildCompositionLock(compositionId),
    concept
      ? "Stay inside the approved concept's world. Different copy cards may change crop and energy, never the core scene or a new story invented from the headline."
      : buildStylePlayLock({
        copyText,
        copyLabel,
        copyKey,
        index: variationIndex,
        avoidLabels: priorLabels,
      }),
    attachStyleStill && !hasTalentRef && "The attached still is a technique sample, not a layout to trace. New cast, new props, new crop. Type sits flush — no rectangle plates.",
    attachStyleStill && hasTalentRef && "A second attached still is technique only (material, ink, light). The first still is the spokesman — keep that face. New scene.",
    costume
      ? [
        buildVisualStyleLock(payload, { styleId }),
        concept && "Apply this technique TO the approved concept's scene. Do not swap the concept's subject for a style-board cliché.",
      ].filter(Boolean).join("\n")
      : concept
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
    directorNote && `Art director REJECT (visual mistakes only — if they mention type/text, the fix is a letter-empty PNG, never new painted words): ${directorNote}`,
    styleSource
      ? `Format ${format}. Same TECHNIQUE family (paper, ink, light, color). Completely different picture, people, and props for this copy.`
      : concept
        ? `Format ${format}. Photograph the approved concept. Leave a quiet pocket for type. Do not invent a competing layout from the copy.`
        : `Format ${format}. Invent this variation's graphic architecture. Do not reserve a top strip + bottom pill.`,
    kit.logoUrl && "Leave a quiet designed pocket for the real logo composite wherever this composition needs it. Do not invent or redraw a logo.",
    "QUIET POCKET: one naturally empty atmospheric region (shadow, wall, sky) so Hebrew type can be composited later. Do not paint a layout, panel, footer, or letter-shaped hole.",
    "RTL/production: Hebrew is composited later as isolated RTL layers (dir=rtl, unicode-bidi:isolate). Never paint or reverse letters.",
    "Forbidden: grey or white studio, cyclorama, cutout portrait, thinking-hand pose, caption plates, boring text rectangles, Canva templates, UI chrome, invented logos, baked lettering, style-board recipes, reprinting a previous collage.",
  ].filter(Boolean).join("\n");
}
