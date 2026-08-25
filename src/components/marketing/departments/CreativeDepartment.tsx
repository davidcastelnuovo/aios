import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { generateCreativeImage } from "@/components/marketing/lib/generateCreativeImage";
import { ALL_CLIENTS_FILTER, applyClientFilter, type MarketingClientFilter } from "@/components/marketing/clientFilter";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { CreativeBriefEditor } from "@/components/marketing/departments/creative/CreativeBriefEditor";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { CreativeLayerEditor } from "@/components/marketing/departments/creative/CreativeLayerEditor";
import { CreativeStoryboardEditor } from "@/components/marketing/departments/creative/CreativeStoryboardEditor";
import type { CreativeAssetRow, CreativeComment, CreativeItem, CreativeProjectDraft, CreativeProjectType, CreativeVariation, StoryboardFrame } from "@/components/marketing/departments/creative/types";
import {
  defaultFormat,
  getBriefText,
  getLinkedCopyText,
  getProjectType,
  getApprovedCopyConcepts,
  getConceptBrief,
  getStoryboard,
  getStoryboardStyle,
  getVariations,
  makeStoryboardFrame,
  makeVariation,
  projectTypeLabel,
  pickStoryboardReferences,
} from "@/components/marketing/departments/creative/utils";
import { isCreativeDepartmentItem, isLinkableCopyItem } from "@/components/marketing/departmentFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Archive,
  Check,
  ChevronDown,
  Clock3,
  Clapperboard,
  History,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Palette,
  PenLine,
  Plus,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";

interface Props {
  clientFilter: MarketingClientFilter;
  tenantId: string;
  onClientChange?: (id: string | null) => void;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const ensureCreativeStageReady = (context: {
  pipeline: { id: string };
  creativeStage: { id: string };
} | null | undefined) => {
  if (!context?.creativeStage) {
    throw new Error("שלב הקריאייטיב לא נמצא — בדוק/י שהלקוח משויך לפייפליין קמפיינים");
  }
  return context;
};

const syncCreativePipelineStage = async ({
  itemId,
  tenantId,
  pipelineId,
  stageId,
}: {
  itemId: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
}) => {
  const { error } = await supabase
    .from("marketing_work_items")
    .update({
      pipeline_id: pipelineId,
      current_stage_id: stageId,
      status: "draft",
    })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
};

export function CreativeDepartment({ clientFilter, tenantId, onClientChange }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [variationDraft, setVariationDraft] = useState<CreativeVariation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkCopyOpen, setLinkCopyOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [workspacePanel, setWorkspacePanel] = useState<"projects" | "project" | "scene" | "versions" | "edit" | null>(null);
  const [storyboardDraft, setStoryboardDraft] = useState<StoryboardFrame[]>([]);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["creative-department-items", clientFilter, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("marketing_work_items")
        .select("id,title,status,client_id,payload,current_stage_id,target_channel,created_at,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      query = applyClientFilter(query, clientFilter);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as CreativeItem[]).filter((item) =>
        isCreativeDepartmentItem(item, context?.creativeStage?.id ?? null),
      );
    },
  });

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const projectType = getProjectType(selected?.payload ?? null);
  const variations = useMemo(() => getVariations(selected?.payload ?? null), [selected?.payload]);
  const storyboard = useMemo(() => getStoryboard(selected?.payload ?? null), [selected?.payload]);
  const selectedVariation = variations.find((variation) => variation.id === selectedVariationId) ?? variations[variations.length - 1] ?? null;

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["creative-department-context", selected?.client_id, tenantId],
    queryFn: async () => {
      if (!selected?.client_id) return null;
      const pipeline = await ensurePipelineForClient({ clientId: selected.client_id, tenantId, track: "campaigns" });
      if (!pipeline) throw new Error("לא ניתן לפתוח פייפליין קמפיינים ללקוח");
      const { data: stages, error } = await supabase
        .from("marketing_pipeline_stages")
        .select("id, stage_type, sort_order")
        .eq("pipeline_id", pipeline.id)
        .order("sort_order");
      if (error) throw error;
      const creativeStage = stages?.find((stage) => stage.stage_type === "creative") ?? null;
      if (!creativeStage) throw new Error("שלב הקריאייטיב לא נמצא בפייפליין");
      return {
        pipeline,
        creativeStage,
        copyStage: stages?.find((stage) => stage.stage_type === "copy") ?? null,
        campaignStage: stages?.find((stage) => stage.stage_type === "target_paid") ?? null,
      };
    },
    enabled: !!selected?.client_id,
  });

  const linkCopyClientFilter = selected?.client_id ?? (clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null);

  const { data: copyItems = [] } = useQuery({
    queryKey: ["creative-linkable-copy", linkCopyClientFilter, tenantId],
    enabled: linkCopyOpen && !!linkCopyClientFilter,
    queryFn: async () => {
      let query = supabase
        .from("marketing_work_items")
        .select("id,title,payload,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      query = applyClientFilter(query, linkCopyClientFilter);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as CreativeItem[]).filter((item) => isLinkableCopyItem(item));
    },
  });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  useEffect(() => {
    setWorkspacePanel(null);
  }, [selectedId]);

  useEffect(() => {
    setStoryboardDraft(storyboard);
  }, [storyboard, selectedId]);

  useEffect(() => {
    if (!selectedVariationId && variations[0]?.id) setSelectedVariationId(variations[0].id);
    if (selectedVariationId && !variations.some((variation) => variation.id === selectedVariationId)) {
      setSelectedVariationId(variations[variations.length - 1]?.id ?? null);
    }
  }, [variations, selectedVariationId]);

  useEffect(() => {
    setVariationDraft(selectedVariation ? { ...selectedVariation } : null);
  }, [selectedVariation]);

  const { data: assetVersions = [] } = useQuery({
    queryKey: ["creative-department-assets", selectedId, tenantId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_assets")
        .select("id,type,url,content,meta,created_at,run_id")
        .eq("tenant_id", tenantId)
        .eq("item_id", selectedId!)
        .in("type", ["image", "data"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CreativeAssetRow[];
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["creative-department-items", clientFilter, tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["creative-department-assets", selectedId, tenantId] }),
    ]);
  };

  const saveProject = async (draft: CreativeProjectDraft) => {
    if (!selected) return;
    setSaving(true);
    try {
      const nextPayload = {
        ...(selected.payload ?? {}),
        brief_text: draft.briefText.trim(),
        copy_text: draft.copyText.trim() || undefined,
        instructions: draft.instructions.trim() || undefined,
        format: draft.format,
        project_type: draft.projectType,
        department: "creative",
      };
      const { error } = await supabase
        .from("marketing_work_items")
        .update({ title: draft.title.trim() || selected.title, payload: nextPayload })
        .eq("id", selected.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("הפרויקט נשמר");
      await refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "שמירת הפרויקט נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  const persistStoryboard = async (nextFrames: StoryboardFrame[], message = "ה-storyboard נשמר") => {
    if (!selected) return;
    const existingStyle = getStoryboardStyle(selected.payload);
    const firstImage = [...nextFrames].sort((a, b) => a.order - b.order).find((frame) => frame.imageUrl)?.imageUrl;
    const nextPayload = {
      ...(selected.payload ?? {}),
      storyboard: nextFrames,
      storyboard_style: {
        lock: existingStyle.lock,
        referenceImageUrl: existingStyle.referenceImageUrl || firstImage,
      },
      project_type: "video",
      department: "creative",
    };
    const { error } = await supabase
      .from("marketing_work_items")
      .update({ payload: nextPayload })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    await supabase.from("marketing_assets").insert({
      tenant_id: tenantId,
      item_id: selected.id,
      stage_id: context?.creativeStage?.id ?? selected.current_stage_id,
      type: "data",
      content: JSON.stringify(nextFrames),
      meta: { source: "visual_editor", skin_slug: "social_media", frame_count: nextFrames.length },
    });
    if (message) toast.success(message);
    await refresh();
  };

  const generateStoryboardFrame = async (
    frame: StoryboardFrame,
    framesOverride?: StoryboardFrame[],
    options?: { lock?: boolean },
  ): Promise<StoryboardFrame[]> => {
    const fallback = framesOverride ?? storyboardDraft;
    if (!selected) return fallback;
    if (!selected.client_id) {
      toast.error("יש לשייך לקוח לפרויקט לפני יצירת פריימים");
      return fallback;
    }
    const readyContext = ensureCreativeStageReady(context);
    if (!frame.visualPrompt?.trim() && !frame.voiceover?.trim()) {
      toast.error("מלא/י 'מה רואים בפריים' או קריינות לפני יצירת הפריים");
      return fallback;
    }
    const shouldLock = options?.lock !== false;
    if (shouldLock) setGenerating(true);
    try {
      const activeFrames = framesOverride ?? storyboardDraft;
      const generationNotes = [
        selected.payload?.notes,
        `בקשת פריים ${frame.order}: ${frame.visualPrompt || frame.voiceover || frame.title}`,
        `סוג שוט: ${frame.shot}`,
      ].filter(Boolean).join("\n");
      await syncCreativePipelineStage({
        itemId: selected.id,
        tenantId,
        pipelineId: readyContext.pipeline.id,
        stageId: readyContext.creativeStage.id,
      });
      await supabase.from("marketing_work_items").update({
        payload: {
          ...(selected.payload ?? {}),
          notes: generationNotes,
          storyboard_frame: {
            id: frame.id,
            order: frame.order,
            title: frame.title,
            shot: frame.shot,
            visualPrompt: frame.visualPrompt,
            overlayText: frame.overlayText,
            voiceover: frame.voiceover,
          },
          department: "creative",
          project_type: "video",
        },
      }).eq("id", selected.id).eq("tenant_id", tenantId);
      const style = getStoryboardStyle(selected.payload);
      const referenceImageUrls = pickStoryboardReferences(activeFrames, frame.id, style.referenceImageUrl);
      const framePrompt = [
        "Next shot in ONE continuous photoreal commercial. Keep the same world, people, wardrobe, lighting and grade.",
        style.lock,
        selected.title && `Campaign: ${selected.title}`,
        getConceptBrief(selected) && `Approved copy concepts (keep the visual idea, not the words):\n${getConceptBrief(selected)}`,
        `Frame ${frame.order}: ${frame.title}`,
        frame.shot && `Shot type: ${frame.shot}`,
        frame.visualPrompt && `Action/setting change only: ${frame.visualPrompt}`,
        referenceImageUrls.length
          ? "A reference still from this same storyboard is attached — match faces, wardrobe, location family, lens and color grade. Do not invent a new art style."
          : "This is the first frame. Establish a single photoreal look that later frames must copy exactly.",
      ].filter(Boolean).join("\n");
      const { imageUrl } = await generateCreativeImage({
        supabase,
        tenantId,
        itemId: selected.id,
        stageId: readyContext.creativeStage.id,
        prompt: framePrompt,
        referenceImageUrls,
      });
      if (shouldLock) {
        toast.message(referenceImageUrls.length ? "הפריים נוצר מול ייחוס הסגנון" : "פריים ראשון — נשמר כסגנון לייחוס");
      }
      const next = activeFrames.map((value) => value.id === frame.id ? { ...frame, imageUrl } : value);
      setStoryboardDraft(next);
      await persistStoryboard(next, shouldLock ? "הפריים נוצר ונשמר" : "");
      return next;
    } catch (error: unknown) {
      toast.error(errorMessage(error, "יצירת הפריים נכשלה"));
      if (!shouldLock) throw error;
      return fallback;
    } finally {
      if (shouldLock) setGenerating(false);
    }
  };

  const generateAllStoryboardFrames = async () => {
    if (!selected?.client_id) {
      toast.error("יש לשייך לקוח לפרויקט לפני יצירת פריימים");
      return;
    }
    const queued = [...storyboardDraft]
      .sort((a, b) => a.order - b.order)
      .filter((frame) => frame.visualPrompt?.trim() || frame.voiceover?.trim());
    if (queued.length === 0) {
      toast.error("מלא/י הנחיות לפריימים לפני יצירה לפי סדר");
      return;
    }
    setGenerating(true);
    try {
      let current = [...storyboardDraft].sort((a, b) => a.order - b.order);
      for (const frame of queued) {
        const latest = current.find((value) => value.id === frame.id) ?? frame;
        current = await generateStoryboardFrame(latest, current, { lock: false });
      }
      toast.success("הפריימים נוצרו לפי סדר, עם אותו סגנון");
    } catch {
      // Per-frame toast already shown; stop the sequence so later frames do not drift.
    } finally {
      setGenerating(false);
    }
  };

  const persistVariations = async (nextVariations: CreativeVariation[], message = "הגרסה נשמרה") => {
    if (!selected) return;
    const active = selectedVariationId
      ? nextVariations.find((variation) => variation.id === selectedVariationId) ?? nextVariations[nextVariations.length - 1]
      : nextVariations[nextVariations.length - 1];

    const nextPayload = {
      ...(selected.payload ?? {}),
      variations: nextVariations,
      department: "creative",
      image_url: active?.imageUrl ?? selected.payload?.image_url,
    };

    const { error: itemError } = await supabase
      .from("marketing_work_items")
      .update({ payload: nextPayload })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (itemError) throw itemError;

    if (active) {
      const { error: assetError } = await supabase.from("marketing_assets").insert({
        tenant_id: tenantId,
        item_id: selected.id,
        stage_id: context?.creativeStage?.id ?? selected.current_stage_id,
        type: "image",
        url: active.imageUrl,
        content: JSON.stringify({ layers: active.layers, format: active.format }),
        meta: {
          source: "manual_edit",
          skin_slug: "social_media",
          variation_id: active.id,
          variation_name: active.name,
          comments: active.comments,
          layers: active.layers,
          format: active.format,
        },
      });
      if (assetError) throw assetError;
    }

    toast.success(message);
    await refresh();
  };

  const generate = async () => {
    if (!selected) return;
    if (!selected.client_id) {
      toast.error("יש לשייך לקוח לפרויקט לפני יצירת קריאייטיב");
      return;
    }
    setGenerating(true);
    try {
      const readyContext = ensureCreativeStageReady(context);

      await syncCreativePipelineStage({
        itemId: selected.id,
        tenantId,
        pipelineId: readyContext.pipeline.id,
        stageId: readyContext.creativeStage.id,
      });

      const notes = [
        selected.payload?.notes,
        getBriefText(selected) && `בריף: ${getBriefText(selected)}`,
        getConceptBrief(selected) && `קונספטים מאושרים מהקופי:\n${getConceptBrief(selected)}`,
      ].filter(Boolean).join("\n");

      await supabase
        .from("marketing_work_items")
        .update({ payload: { ...(selected.payload ?? {}), notes, department: "creative" } })
        .eq("id", selected.id)
        .eq("tenant_id", tenantId);

      const approved = getApprovedCopyConcepts(selected);
      const primary = approved[0];
      const creativePrompt = [
        "Create a polished advertising photograph for this campaign. Build the picture around the approved concept — not a generic text-on-background graphic.",
        selected.title && `Campaign: ${selected.title}`,
        primary && `Approved concept: ${primary.name}`,
        primary?.bigIdea && `Big idea: ${primary.bigIdea}`,
        primary?.visualLanguage && `Visual language: ${primary.visualLanguage}`,
        primary?.hook && `First-second hook / scene: ${primary.hook}`,
        getConceptBrief(selected) && `All approved concepts:\n${getConceptBrief(selected)}`,
        getBriefText(selected) && `Visual brief (ignore any copy/headlines, use only mood, audience, setting): ${getBriefText(selected)}`,
        `Format: ${defaultFormat(selected.payload)}`,
      ].filter(Boolean).join("\n");

      const { imageUrl, usedFallback } = await generateCreativeImage({
        supabase,
        tenantId,
        itemId: selected.id,
        stageId: readyContext.creativeStage.id,
        prompt: creativePrompt || selected.title || "Marketing creative",
      });
      if (usedFallback) toast.message("הקריאייטיב נוצר (gpt-image-1)");

      const nextVariation = makeVariation({
        imageUrl,
        format: defaultFormat(selected.payload),
        copyText: getLinkedCopyText(selected),
        name: `גרסה ${variations.length + 1}`,
        source: "ai",
      });

      const nextVariations = [...variations, nextVariation];
      await persistVariations(nextVariations, "כרמן יצרה וריאציה ויזואלית חדשה");
      setSelectedVariationId(nextVariation.id);
      setWorkspacePanel(null);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "יצירת הקריאייטיב נכשלה"));
    } finally {
      setGenerating(false);
    }
  };

  const saveVariation = async () => {
    if (!variationDraft) return;
    setSaving(true);
    try {
      const nextVariations = variations.map((variation) =>
        variation.id === variationDraft.id ? { ...variationDraft, source: "manual_edit" as const } : variation,
      );
      await persistVariations(nextVariations);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "השמירה נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!variationDraft || !commentDraft.trim()) return;
    const comment: CreativeComment = {
      id: crypto.randomUUID(),
      text: commentDraft.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextDraft = {
      ...variationDraft,
      comments: [...variationDraft.comments, comment],
    };
    setVariationDraft(nextDraft);
    setCommentDraft("");
    try {
      const nextVariations = variations.map((variation) =>
        variation.id === nextDraft.id ? nextDraft : variation,
      );
      await persistVariations(nextVariations, "ההערה נשמרה");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "שמירת ההערה נכשלה"));
    }
  };

  const linkCopyFromItem = async (copyItem: CreativeItem) => {
    if (!selected) return;
    const copyText = String(copyItem.payload?.copy_text ?? "");
    const briefText = String(copyItem.payload?.brief_text ?? "");
    const approved = getApprovedCopyConcepts(copyItem);
    const nextPayload = {
      ...(selected.payload ?? {}),
      copy_text: copyText,
      brief_text: briefText || selected.payload?.brief_text,
      copy_concepts: copyItem.payload?.copy_concepts,
      approved_concepts: copyItem.payload?.approved_concepts ?? approved,
      creative_concept: copyItem.payload?.creative_concept,
      concept_brief: getConceptBrief(copyItem) || undefined,
      linked_copy_item_id: copyItem.id,
      linked_copy_title: copyItem.title,
      content_type: copyItem.payload?.content_type ?? selected.payload?.content_type,
      channel: copyItem.payload?.channel ?? selected.payload?.channel,
      department: "creative",
    };
    const { error } = await supabase
      .from("marketing_work_items")
      .update({ payload: nextPayload })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    toast.success("הקופי שויך לפרויקט");
    setLinkCopyOpen(false);
    await refresh();
  };

  const handoff = useMutation({
    mutationFn: async () => {
      if (!selected || !context?.campaignStage) throw new Error("שלב הקמפיינים לא נמצא");
      const { error } = await supabase.from("marketing_work_items").update({
        current_stage_id: context.campaignStage.id,
        status: "draft",
        payload: {
          ...(selected.payload ?? {}),
          variations,
          storyboard: storyboardDraft,
          creative_approved: true,
          department: "campaigns",
        },
      }).eq("id", selected.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("הקריאייטיב אושר והועבר למחלקת הקמפיינים");
      await refresh();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "ההעברה נכשלה")),
  });

  const canHandoff = projectType === "video" ? storyboardDraft.length > 0 : variations.length > 0;
  const isVideoWorkspace = projectType === "video";

  const toggleWorkspacePanel = (panel: "projects" | "project" | "scene" | "versions" | "edit") => {
    setWorkspacePanel((current) => (current === panel ? null : panel));
  };

  const projectsList = (
    <ScrollArea className="flex-1">
      <div className="space-y-2 p-2">
        {loadingItems ? (
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" />
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            <Palette className="mx-auto mb-2 h-8 w-8 opacity-30" />
            אין פרויקטים עדיין
          </div>
        ) : items.map((item) => (
          <button
            key={item.id}
            onClick={() => { setSelectedId(item.id); setSelectedVariationId(null); setWorkspacePanel(null); }}
            className={cn(
              "w-full rounded-xl border p-3 text-right transition-colors",
              selectedId === item.id ? "border-pink-400 bg-pink-50 dark:bg-pink-950/20" : "bg-background hover:bg-muted/50",
            )}
          >
            <div className="flex items-start gap-2">
              <StatusDot status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{item.title || "ללא כותרת"}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {getBriefText(item) || getLinkedCopyText(item) || "מחכה לבריף או לקופi"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="h-4 px-1 text-[9px]">{projectTypeLabel(getProjectType(item.payload))}</Badge>
                  <span>{getProjectType(item.payload) === "video" ? `${getStoryboard(item.payload).length} סצנות` : `${getVariations(item.payload).length} וריאציות`}</span>
                  {item.payload?.handoff_from === "copy" && <Badge variant="secondary" className="h-4 px-1 text-[9px]">מהקופi</Badge>}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );

  const versionsPanel = (
    <>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {(getBriefText(selected) || getLinkedCopyText(selected) || getConceptBrief(selected)) && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold hover:bg-muted/50">
                <span>בריף, קופי וקונספטים</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {getBriefText(selected) && (
                  <Card className="p-3">
                    <Badge variant="secondary" className="mb-2">בריף מקור</Badge>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{getBriefText(selected)}</p>
                  </Card>
                )}
                {getLinkedCopyText(selected) && (
                  <Card className="p-3">
                    <Badge variant="outline" className="mb-2 gap-1"><PenLine className="h-3 w-3" />קופי משויך</Badge>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{getLinkedCopyText(selected)}</p>
                    {selected?.payload?.linked_copy_title && (
                      <p className="mt-2 text-[10px] text-muted-foreground">מקור: {String(selected.payload.linked_copy_title)}</p>
                    )}
                  </Card>
                )}
                {getApprovedCopyConcepts(selected).map((concept) => (
                  <Card key={concept.id} className="p-3">
                    <Badge className="mb-2 bg-emerald-600 hover:bg-emerald-600">קונספט מאושר</Badge>
                    <div className="text-xs font-semibold">{concept.name}</div>
                    {concept.bigIdea && <p className="mt-1 text-xs leading-relaxed">{concept.bigIdea}</p>}
                    {concept.visualLanguage && (
                      <p className="mt-1 text-[11px] text-muted-foreground">ויזואל: {concept.visualLanguage}</p>
                    )}
                    {concept.hook && (
                      <p className="mt-1 text-[11px] text-muted-foreground">הוק: {concept.hook}</p>
                    )}
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {selectedVariation && (
            <Card className="overflow-hidden p-0 ring-2 ring-pink-400">
              {selectedVariation.imageUrl && (
                <CreativeImage src={selectedVariation.imageUrl} alt={selectedVariation.name} className="aspect-video w-full object-cover" />
              )}
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Badge>גרסה נוכחית</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(selectedVariation.createdAt).toLocaleString("he-IL")}
                  </span>
                </div>
                <div className="text-xs font-semibold">{selectedVariation.name}</div>
                {selectedVariation.comments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {selectedVariation.comments.slice(-3).map((comment) => (
                      <div key={comment.id} className="rounded-md bg-muted/60 px-2 py-1 text-[10px] leading-relaxed">
                        {comment.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {(variations.filter((v) => v.id !== selectedVariationId).length > 0 || (assetVersions as CreativeAssetRow[]).length > 0) && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold hover:bg-muted/50">
                <span>
                  גרסאות ישנות
                  ({variations.filter((v) => v.id !== selectedVariationId).length + (assetVersions as CreativeAssetRow[]).length})
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {variations.filter((variation) => variation.id !== selectedVariationId).map((variation, index) => (
                  <Card
                    key={variation.id}
                    className="cursor-pointer overflow-hidden p-0 hover:bg-muted/20"
                    onClick={() => setSelectedVariationId(variation.id)}
                  >
                    {variation.imageUrl && (
                      <CreativeImage src={variation.imageUrl} alt={variation.name} className="aspect-video w-full object-cover" />
                    )}
                    <div className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="outline">גרסה {index + 1}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(variation.createdAt).toLocaleString("he-IL")}
                        </span>
                      </div>
                      <div className="text-xs font-semibold">{variation.name}</div>
                    </div>
                  </Card>
                ))}
                {(assetVersions as CreativeAssetRow[]).map((asset, index) => (
                  <Card key={asset.id} className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">שמירה {(assetVersions as CreativeAssetRow[]).length - index}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(asset.created_at).toLocaleString("he-IL")}</span>
                    </div>
                    {asset.meta?.source === "manual_edit" && <div className="text-[10px] text-muted-foreground">עריכה ידנית</div>}
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {selected && variations.length === 0 && projectType === "static" && (
            <div className="py-8 text-center text-xs text-muted-foreground">הגרסה הראשונה תופיע כאן</div>
          )}
        </div>
      </ScrollArea>

      {variationDraft && (
        <div className="border-t p-3">
          <Label className="flex items-center gap-1 text-xs"><MessageSquare className="h-3.5 w-3.5" />הערה לגרסה הנוכחית</Label>
          <Textarea
            className="mt-2 min-h-16 text-xs"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="פידבק ללקוח, לצוות או לכרמן..."
          />
          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={addComment} disabled={!commentDraft.trim()}>
            שמור הערה
          </Button>
        </div>
      )}
    </>
  );

  const workspaceHeader = selected ? (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card/50 px-4 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-700 text-white">
        {isVideoWorkspace ? <Clapperboard className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-bold">{selected.title}</h2>
        <p className="text-[11px] text-muted-foreground">
          {projectTypeLabel(projectType)} · Skin: social_media · תמונות: gpt-image-1
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        <Button size="sm" variant={workspacePanel === "projects" ? "secondary" : "ghost"} className="h-8" onClick={() => toggleWorkspacePanel("projects")}>
          פרויקטים
        </Button>
        <Button size="sm" variant={workspacePanel === "project" ? "secondary" : "ghost"} className="h-8" onClick={() => toggleWorkspacePanel("project")}>
          עריכת פרויקט
        </Button>
        {isVideoWorkspace ? (
          <Button size="sm" variant={workspacePanel === "scene" ? "secondary" : "ghost"} className="h-8" onClick={() => toggleWorkspacePanel("scene")} disabled={storyboardDraft.length === 0}>
            סצנה
          </Button>
        ) : (
          <Button size="sm" variant={workspacePanel === "edit" ? "secondary" : "ghost"} className="h-8" onClick={() => toggleWorkspacePanel("edit")} disabled={!variationDraft}>
            עריכה
          </Button>
        )}
        <Button size="sm" variant={workspacePanel === "versions" ? "secondary" : "ghost"} className="h-8" onClick={() => toggleWorkspacePanel("versions")}>
          גרסאות
        </Button>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkCopyOpen(true)}>
        <Link2 className="h-3.5 w-3.5" />שייך קופi
      </Button>
      {!isVideoWorkspace && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={generate} disabled={generating || loadingContext || !selected.client_id}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
          {variations.length ? "צור וריאציה" : "צור קריאייטיב"}
        </Button>
      )}
      <Button
        size="sm"
        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        onClick={() => handoff.mutate()}
        disabled={handoff.isPending || !canHandoff}
      >
        <Send className="h-3.5 w-3.5" />אשר לקמפיינים
      </Button>
    </div>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
        {workspaceHeader}
        {selected ? (
          isVideoWorkspace ? (
            <CreativeStoryboardEditor
              frames={storyboardDraft}
              onChange={setStoryboardDraft}
              onSave={() => persistStoryboard(storyboardDraft)}
              onGenerateFrame={async (frame) => {
                const merged = storyboardDraft.map((value) => value.id === frame.id ? frame : value);
                setStoryboardDraft(merged);
                await generateStoryboardFrame(frame, merged);
              }}
              onGenerateAll={generateAllStoryboardFrames}
              generating={generating}
              saving={saving}
              scenePanelOpen={workspacePanel === "scene"}
              onScenePanelOpenChange={(open) => setWorkspacePanel(open ? "scene" : null)}
            />
          ) : variationDraft ? (
            <CreativeLayerEditor
              key={variationDraft.id}
              variation={variationDraft}
              onChange={setVariationDraft}
              onSave={saveVariation}
              saving={saving}
              editing={workspacePanel === "edit"}
              onEditingChange={(open) => setWorkspacePanel(open ? "edit" : null)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ImageIcon className="mb-4 h-14 w-14 opacity-30" />
              <h3 className="text-lg font-bold text-foreground">עדיין אין קריאייטיב</h3>
              <p className="mt-2 max-w-md text-sm">לחץ על &quot;צור קריאייטיב&quot; כדי לייצר תמונה מוכנה. עריכת שכבות תיפתח רק בלחיצה על התמונה.</p>
              <div className="mt-5 flex gap-2">
                <Button variant="outline" onClick={() => setWorkspacePanel("project")}>עריכת פרויקט</Button>
                <Button className="gap-2 bg-gradient-to-r from-pink-600 to-violet-600" onClick={generate} disabled={generating || loadingContext || !selected.client_id}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  צור קריאייטיב
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <Palette className="h-12 w-12 opacity-30" />
            <p className="text-sm">בחר פרויקט או צור אחד חדש</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setWorkspacePanel("projects")}>פתח פרויקטים</Button>
              <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => setCreateOpen(true)}>פרויקט חדש</Button>
            </div>
          </div>
        )}
      </main>

      <Sheet open={workspacePanel === "projects"} onOpenChange={(open) => setWorkspacePanel(open ? "projects" : null)}>
        <SheetContent side="right" className="flex w-[320px] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[320px]" dir="rtl">
          <SheetHeader className="flex-row items-center justify-between border-b px-6 py-4 text-right">
            <div>
              <SheetTitle className="text-sm">פרויקטים לקריאייטיב</SheetTitle>
              <p className="text-[11px] text-muted-foreground">מהקופi, מבריף ידני או AI</p>
            </div>
            <Button size="icon" className="h-8 w-8 shrink-0 bg-pink-600 hover:bg-pink-700" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </SheetHeader>
          {projectsList}
        </SheetContent>
      </Sheet>

      <Sheet open={workspacePanel === "project"} onOpenChange={(open) => setWorkspacePanel(open ? "project" : null)}>
        <SheetContent side="right" className="flex w-[min(560px,92vw)] max-w-none flex-col gap-0 p-0 sm:max-w-[560px]" dir="rtl">
          <SheetHeader className="border-b px-6 py-4 text-right">
            <SheetTitle>עריכת פרויקט</SheetTitle>
          </SheetHeader>
          {selected ? (
            <CreativeBriefEditor item={selected} onSave={saveProject} saving={saving} />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={workspacePanel === "versions"} onOpenChange={(open) => setWorkspacePanel(open ? "versions" : null)}>
        <SheetContent side="left" className="flex w-[320px] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[320px]" dir="rtl">
          <SheetHeader className="border-b px-6 py-4 text-right">
            <SheetTitle className="flex items-center gap-1.5 text-sm">
              <History className="h-4 w-4" />גרסאות והערות
            </SheetTitle>
            <p className="text-[11px] text-muted-foreground">כל יצירה, שמירה והערה נשמרות</p>
          </SheetHeader>
          {versionsPanel}
        </SheetContent>
      </Sheet>

      <ManualCreativeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        clientFilter={clientFilter}
        defaultClientId={clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null}
        onClientChange={onClientChange}
        onCreated={async (id, createdClientId) => {
          if (onClientChange && createdClientId !== undefined) {
            const filterClient = clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null;
            if (createdClientId !== filterClient) onClientChange(createdClientId);
          }
          setSelectedId(id);
          setWorkspacePanel("project");
          setCreateOpen(false);
          await refresh();
        }}
      />

      <Dialog open={linkCopyOpen} onOpenChange={(value) => !value && setLinkCopyOpen(false)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>שיוך קופי ממחלקת הקופי</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-2 py-2">
              {copyItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {linkCopyClientFilter ? "אין פריטי קופי זמינים ללקוח הזה" : "בחר פרויקט עם לקוח משויך כדי לשייך קופi"}
                </p>
              ) : copyItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void linkCopyFromItem(item)}
                  className="w-full rounded-xl border p-3 text-right hover:bg-muted/50"
                >
                  <div className="text-sm font-semibold">{item.title || "ללא כותרת"}</div>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{String(item.payload?.copy_text ?? "")}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManualCreativeDialog({ open, onClose, tenantId, clientFilter, defaultClientId, onClientChange, onCreated }: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  clientFilter: MarketingClientFilter;
  defaultClientId?: string | null;
  onClientChange?: (id: string | null) => void;
  onCreated: (id: string, createdClientId: string | null) => void;
}) {
  const [mode, setMode] = useState<"manual" | "from_copy">("manual");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState("1:1");
  const [projectType, setProjectType] = useState<CreativeProjectType>("static");
  const [copyText, setCopyText] = useState("");
  const [selectedCopyId, setSelectedCopyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignedClientId, setAssignedClientId] = useState<string | null>(defaultClientId ?? null);
  const clientLocked = !!clientFilter && clientFilter !== ALL_CLIENTS_FILTER;

  const { data: copyItems = [] } = useQuery({
    queryKey: ["creative-create-copy-items", assignedClientId, tenantId],
    enabled: open && mode === "from_copy" && !!assignedClientId,
    queryFn: async () => {
      let query = supabase
        .from("marketing_work_items")
        .select("id,title,payload,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      query = applyClientFilter(query, assignedClientId);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as CreativeItem[]).filter((item) => isLinkableCopyItem(item));
    },
  });

  const selectedCopyItem = copyItems.find((item) => item.id === selectedCopyId) ?? null;

  useEffect(() => {
    if (open) {
      setAssignedClientId(defaultClientId ?? null);
      setProjectType("static");
      setFormat("1:1");
      setMode("manual");
      setSelectedCopyId(null);
      setTitle("");
      setBrief("");
      setCopyText("");
    }
  }, [defaultClientId, open]);

  useEffect(() => {
    if (mode !== "from_copy" || !selectedCopyItem) return;
    setTitle(selectedCopyItem.title?.trim() || "קריאייטיב מקופי");
    setBrief(String(selectedCopyItem.payload?.brief_text ?? ""));
    setCopyText(String(selectedCopyItem.payload?.copy_text ?? ""));
  }, [mode, selectedCopyItem]);

  useEffect(() => {
    if (projectType === "video" && format === "1:1") setFormat("9:16");
  }, [projectType, format]);

  const canCreate = mode === "manual"
    ? !!title.trim()
    : !!assignedClientId && !!selectedCopyId && !!title.trim();

  const createHint = !canCreate && !saving
    ? mode === "from_copy" && !assignedClientId
      ? "בחר לקוח (לא תוכן כללי) כדי לשייך פרויקט קופי"
      : mode === "from_copy" && !selectedCopyId
        ? "בחר פרויקט קופי מהרשימה"
        : !title.trim()
          ? "הזן שם לפרויקט"
          : null
    : null;

  const create = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      let pipelineId: string | null = null;
      let stageId: string | null = null;
      if (assignedClientId) {
        const pipeline = await ensurePipelineForClient({ clientId: assignedClientId, tenantId, track: "campaigns" });
        if (!pipeline) throw new Error("לא ניתן לפתוח פייפליין קמפיינים ללקוח");
        const { data: stages, error: stageError } = await supabase
          .from("marketing_pipeline_stages")
          .select("id,stage_type")
          .eq("pipeline_id", pipeline.id);
        if (stageError) throw stageError;
        pipelineId = pipeline.id;
        stageId = stages?.find((stage) => stage.stage_type === "creative")?.id ?? null;
        if (!stageId) throw new Error("שלב הקריאייטיב לא נמצא");
      }
      const linkedCopy = mode === "from_copy" ? selectedCopyItem : null;
      const payload: Record<string, unknown> = {
        brief_text: brief.trim() || String(linkedCopy?.payload?.brief_text ?? "") || undefined,
        copy_text: copyText.trim() || undefined,
        format,
        project_type: projectType,
        department: "creative",
        intake_source: mode === "from_copy" ? "copy_link" : "manual",
        handoff_from: mode === "from_copy" ? "copy" : undefined,
        linked_copy_item_id: linkedCopy?.id,
        linked_copy_title: linkedCopy?.title,
        copy_concepts: linkedCopy?.payload?.copy_concepts,
        approved_concepts: linkedCopy?.payload?.approved_concepts,
        creative_concept: linkedCopy?.payload?.creative_concept,
        concept_brief: linkedCopy ? getConceptBrief(linkedCopy) || undefined : undefined,
        content_type: linkedCopy?.payload?.content_type,
        channel: linkedCopy?.payload?.channel,
        instructions: linkedCopy?.payload?.instructions,
      };
      if (projectType === "video") payload.storyboard = [makeStoryboardFrame(1)];

      const { data, error } = await supabase.from("marketing_work_items").insert({
        tenant_id: tenantId,
        client_id: assignedClientId,
        pipeline_id: pipelineId,
        current_stage_id: stageId,
        title: title.trim(),
        status: "draft",
        target_channel: projectType === "video" ? "video" : "creative",
        payload,
      }).select("id").single();
      if (error) throw error;
      toast.success(mode === "from_copy" ? "פרויקט קריאייטיב נוצר ושויך לקופי הקיים" : "הפרויקט נכנס למחלקת הקריאייטיב");
      onCreated(data.id, assignedClientId);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "יצירת הפרויקט נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[min(90vh,760px)] max-w-2xl flex-col gap-0 overflow-hidden p-0" dir="rtl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>פרויקט קריאייטיב חדש</DialogTitle>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 px-6 py-4">
          <Tabs value={mode} onValueChange={(value) => setMode(value as "manual" | "from_copy")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">בריף ידני</TabsTrigger>
              <TabsTrigger value="from_copy">מפרויקט קיים בקופי</TabsTrigger>
            </TabsList>
          </Tabs>
          <div>
            <Label>שיוך לקוח</Label>
            <div className="mt-1">
              {clientLocked ? (
                <ClientSelector tenantId={tenantId} value={assignedClientId} onChange={() => undefined} disabled />
              ) : (
                <ClientSelector
                  tenantId={tenantId}
                  value={assignedClientId}
                  onChange={(id) => { setAssignedClientId(id); setSelectedCopyId(null); }}
                  allowGeneral={mode === "manual"}
                  generalLabel="תוכן כללי — ללא לקוח"
                />
              )}
            </div>
            {clientLocked && (
              <p className="mt-2 text-xs text-muted-foreground">הפרויקט ייווצר עבור הלקוח שנבחר במסנן ההדר</p>
            )}
            {mode === "from_copy" && !assignedClientId && (
              <p className="mt-2 text-xs text-amber-600">מצב שיוך לקופי דורש בחירת לקוח ספציפי</p>
            )}
          </div>
          {mode === "from_copy" ? (
            <div>
              <Label>פרויקט קופי לשיוך</Label>
              <ScrollArea className="mt-2 max-h-40 rounded-xl border">
                <div className="space-y-2 p-2">
                  {!assignedClientId ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">בחר לקוח קודם</p>
                  ) : copyItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">אין פרויקטי קופי ללקוח הזה</p>
                  ) : copyItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedCopyId(item.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-right transition-colors",
                        selectedCopyId === item.id ? "border-pink-400 bg-pink-50 dark:bg-pink-950/20" : "hover:bg-muted/50",
                      )}
                    >
                      <div className="text-sm font-semibold">{item.title || "ללא כותרת"}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{String(item.payload?.copy_text ?? item.payload?.brief_text ?? "")}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : null}
          <div><Label>שם הפרויקט</Label><Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="לדוגמה: מודעת השקה לפייסבוק" /></div>
          <div>
            <Label>סוג פרויקט</Label>
            <Select value={projectType} onValueChange={(value: CreativeProjectType) => setProjectType(value)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="בחר סוג פרויקט" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="static">מודעה / גרפיקה סטטית</SelectItem>
                <SelectItem value="video">וידאו / storyboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>פורמט</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">סטורי / רילס 9:16</SelectItem>
                <SelectItem value="1:1">פוסט מרובע 1:1</SelectItem>
                <SelectItem value="4:5">פיד 4:5</SelectItem>
                <SelectItem value="16:9">וידאו רחב 16:9</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "manual" ? (
            <>
              <div><Label>בריף / חומר גלם (אופציונלי)</Label><Textarea className="mt-1 min-h-24" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="מטרה, קהל, סגנון, רפרנסים, מגבלות" /></div>
              <div><Label>קופי משויך (אופציונלי)</Label><Textarea className="mt-1 min-h-20" value={copyText} onChange={(event) => setCopyText(event.target.value)} placeholder="אפשר להדביק קופi ידנית או לשייך אחר כך ממחלקת הקופi" /></div>
            </>
          ) : selectedCopyItem ? (
            <div className="max-h-32 overflow-y-auto rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-semibold">קופi שיושב לפרויקט</div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{copyText || "אין טקסט קופi"}</p>
              {brief ? <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{brief}</p> : null}
            </div>
          ) : null}
          </div>
        </ScrollArea>
        <div className="shrink-0 border-t bg-background px-6 py-4">
          {createHint ? <p className="mb-2 text-xs text-amber-600">{createHint}</p> : null}
          <Button onClick={create} disabled={saving || !canCreate} className="w-full gap-1.5 bg-pink-600 hover:bg-pink-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {mode === "from_copy" ? "צור קריאייטיב מקופi קיים" : "הכנס למחלקת קריאייטיב"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusDot({ status }: { status: string }) {
  const config = status === "waiting_approval"
    ? { icon: Clock3, className: "text-amber-500" }
    : status === "approved" || status === "published"
      ? { icon: Check, className: "text-emerald-500" }
      : status === "archived"
        ? { icon: Archive, className: "text-gray-400" }
        : { icon: Sparkles, className: "text-pink-500" };
  const Icon = config.icon;
  return <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", config.className)} />;
}
