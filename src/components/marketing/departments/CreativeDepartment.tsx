import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { generateCreativeImage } from "@/components/marketing/lib/generateCreativeImage";
import { resolveCreativeImageUrl } from "@/components/marketing/lib/resolveCreativeImageUrl";
import {
  brandKitPrompt,
  deriveBrandBook,
  filesFromAttachments,
  getBrandKit,
  isGenerationAborted,
  mergeStyleReferences,
  styleRefsFromClientFiles,
  throwIfGenerationAborted,
} from "@/components/marketing/departments/creative/brandKit";
import { ALL_CLIENTS_FILTER, applyClientFilter, type MarketingClientFilter } from "@/components/marketing/clientFilter";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { CreativeCostDialog, buildNextGenerateEstimate } from "@/components/marketing/departments/creative/CreativeCostDialog";
import { CreativeBriefEditor } from "@/components/marketing/departments/creative/CreativeBriefEditor";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { CreativeLayerEditor } from "@/components/marketing/departments/creative/CreativeLayerEditor";
import { CreativeStoryboardEditor } from "@/components/marketing/departments/creative/CreativeStoryboardEditor";
import { CreativeVariationGrid } from "@/components/marketing/departments/creative/CreativeVariationGrid";
import { copyBlockLabel, splitCopyVariations } from "@/components/marketing/departments/creative/copyVariations";
import type { CreativeAssetRow, CreativeComment, CreativeItem, CreativeProjectDraft, CreativeProjectType, CreativeVariation, StoryboardFrame } from "@/components/marketing/departments/creative/types";
import {
  defaultFormat,
  getBriefText,
  getLinkedCopyText,
  getProjectType,
  getStoryboard,
  getStoryboardStyle,
  getVariations,
  makeStoryboardFrame,
  makeVariation,
  projectTypeLabel,
  pickStoryboardReferences,
} from "@/components/marketing/departments/creative/utils";
import { formatUsd, summarizeStoredImageCosts } from "@/components/marketing/departments/creative/imageCost";
import { VisualStyleSelect } from "@/components/marketing/departments/creative/VisualStyleSelect";
import { buildCopySceneBrief, hydrateVariationLayers, isInternalCopyLine, pickNextVariationStyle } from "@/components/marketing/departments/creative/designedLayers";
import {
  buildVisualStyleLock,
  getVisualStyle,
  getVisualStyleId,
  imageSizeForFormat,
  visualStyleById,
  DEFAULT_VISUAL_STYLE_ID,
  type CreativeVisualStyleId,
} from "@/components/marketing/departments/creative/visualStyles";
import { isCreativeDepartmentItem, isLinkableCopyItem } from "@/components/marketing/departmentFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  Coins,
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
  Square,
  ThumbsDown,
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
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CreativeVariation | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [costOpen, setCostOpen] = useState(false);
  const generateAbortRef = useRef(false);

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
  const variations = useMemo(() => {
    const raw = getVariations(selected?.payload ?? null);
    const logoUrl = getBrandKit(selected?.payload).logoUrl;
    const copyText = getLinkedCopyText(selected);
    const styleId = getVisualStyleId(selected?.payload);
    return raw.map((variation) => hydrateVariationLayers(
      variation,
      variation.copyText || copyText,
      selected?.title ?? undefined,
      variation.visualStyle ?? styleId,
      logoUrl,
    ));
  }, [selected]);
  const copyBlocks = useMemo(() => splitCopyVariations(getLinkedCopyText(selected)), [selected]);
  const storyboard = useMemo(() => getStoryboard(selected?.payload ?? null), [selected?.payload]);
  const selectedVariation = variations.find((variation) => variation.id === selectedVariationId) ?? variations[variations.length - 1] ?? null;
  const itemIds = items.map((item) => item.id);

  const { data: runCosts = [] } = useQuery({
    queryKey: ["creative-project-runs", tenantId, itemIds.join(",")],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_runs")
        .select("item_id, tokens_in, tokens_out, cost_usd, model")
        .eq("tenant_id", tenantId)
        .in("item_id", itemIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const costRows = useMemo(() => {
    const runsByItem = new Map<string, typeof runCosts>();
    for (const run of runCosts) {
      const list = runsByItem.get(run.item_id) ?? [];
      list.push(run);
      runsByItem.set(run.item_id, list);
    }
    return items.map((item) => {
      const isVideo = getProjectType(item.payload) === "video";
      const format = defaultFormat(item.payload);
      const images = isVideo
        ? getStoryboard(item.payload).map((frame) => ({
          generationCost: frame.generationCost,
          imageUrl: frame.imageUrl,
          format,
        }))
        : getVariations(item.payload).map((variation) => ({
          generationCost: variation.generationCost,
          imageUrl: variation.imageUrl,
          source: variation.source,
          format: variation.format,
        }));
      const next = buildNextGenerateEstimate(item);
      return {
        item,
        spent: summarizeStoredImageCosts(images, isVideo ? "medium" : "high", runsByItem.get(item.id) ?? []),
        next: next.cost,
        nextCount: next.count,
      };
    });
  }, [items, runCosts]);

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

  const { data: selectedClient } = useQuery({
    queryKey: ["creative-client", selected?.client_id, tenantId],
    enabled: !!selected?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,website,industry,notes,attachments")
        .eq("id", selected!.client_id!)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        website: string | null;
        industry: string | null;
        notes: string | null;
        attachments: unknown;
      } | null;
    },
  });

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
    if (!selectedVariation) {
      setVariationDraft(null);
      return;
    }
    setVariationDraft(hydrateVariationLayers(
      selectedVariation,
      getLinkedCopyText(selected),
      selected?.title ?? undefined,
      getVisualStyleId(selected?.payload),
      getBrandKit(selected?.payload).logoUrl,
    ));
  }, [selectedVariation, selected]);

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
      queryClient.invalidateQueries({ queryKey: ["creative-project-runs", tenantId] }),
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
        visual_style: draft.visualStyle,
        logo_url: draft.logoUrl || null,
        brand_book: draft.brandBook || null,
        style_references: draft.styleReferences,
        client_website: draft.clientWebsite || null,
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

  const assignCreativeClient = async (nextClientId: string | null, draft: CreativeProjectDraft) => {
    if (!selected) return;
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    let website: string | null = null;
    let attachments: unknown = [];
    let clientName: string | undefined;
    let industry: string | undefined;
    let notes: string | undefined;
    if (nextClientId) {
      const pipeline = await ensurePipelineForClient({ clientId: nextClientId, tenantId, track: "campaigns" });
      if (pipeline) {
        const { data: stages, error } = await supabase
          .from("marketing_pipeline_stages")
          .select("id,stage_type")
          .eq("pipeline_id", pipeline.id);
        if (error) throw error;
        pipelineId = pipeline.id;
        stageId = stages?.find((stage) => stage.stage_type === "creative")?.id ?? null;
      }
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id,name,website,industry,notes,attachments")
        .eq("id", nextClientId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (clientError) throw clientError;
      website = client?.website ?? null;
      attachments = client?.attachments ?? [];
      clientName = client?.name ?? undefined;
      industry = client?.industry ?? undefined;
      notes = client?.notes ?? undefined;
      onClientChange?.(nextClientId);
    }
    const clientFiles = filesFromAttachments(attachments);
    const pulledRefs = styleRefsFromClientFiles(supabase, attachments);
    const styleReferences = mergeStyleReferences(draft.styleReferences, pulledRefs);
    const brandBook = draft.brandBook?.source === "manual" && draft.brandBook.notes
      ? draft.brandBook
      : deriveBrandBook({
        clientName,
        website: website ?? undefined,
        industry,
        brief: [draft.briefText, notes].filter(Boolean).join("\n"),
        copy: draft.copyText,
        colors: draft.brandBook?.colors,
        existing: draft.brandBook,
      });
    const nextPayload = {
      ...(selected.payload ?? {}),
      brief_text: draft.briefText.trim(),
      copy_text: draft.copyText.trim() || undefined,
      instructions: draft.instructions.trim() || undefined,
      format: draft.format,
      project_type: draft.projectType,
      visual_style: draft.visualStyle,
      logo_url: draft.logoUrl || null,
      brand_book: brandBook,
      style_references: styleReferences,
      client_website: website,
      client_files: clientFiles.map((file) => ({ name: file.name, path: file.path ?? null })),
      department: "creative",
    };
    const keepStage = !!nextClientId && nextClientId === selected.client_id && !!selected.current_stage_id;
    const { error } = await supabase.from("marketing_work_items").update({
      title: draft.title.trim() || selected.title,
      client_id: nextClientId,
      pipeline_id: pipelineId,
      current_stage_id: nextClientId ? (keepStage ? selected.current_stage_id : stageId) : null,
      payload: nextPayload,
    }).eq("id", selected.id).eq("tenant_id", tenantId);
    if (error) throw error;
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ["creative-client", nextClientId, tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["creative-department-context", nextClientId, tenantId] }),
    ]);
    toast.success(nextClientId ? "נמשך האתר, הקבצים והסגנון של הלקוח" : "השיוך הוסר");
  };

  const persistStoryboard = async (nextFrames: StoryboardFrame[], message = "ה-storyboard נשמר") => {
    if (!selected) return;
    const existingStyle = getStoryboardStyle(selected.payload);
    const firstImage = [...nextFrames].sort((a, b) => a.order - b.order).find((frame) => frame.imageUrl)?.imageUrl;
    const nextPayload = {
      ...(selected.payload ?? {}),
      storyboard: nextFrames,
      storyboard_style: {
        lock: buildVisualStyleLock(selected.payload, { storyboard: true }),
        referenceImageUrl: existingStyle.referenceImageUrl || firstImage,
      },
      visual_style: getVisualStyleId(selected.payload),
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
    if (shouldLock) {
      generateAbortRef.current = false;
      setGenerating(true);
    }
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
      const visual = getVisualStyle(selected.payload);
      const kit = getBrandKit(selected.payload);
      const storyboardRefs = pickStoryboardReferences(activeFrames, frame.id, style.referenceImageUrl);
      const styleRefs = (
        await Promise.all(kit.styleReferences.map((reference) => resolveCreativeImageUrl(reference.url)))
      ).filter((url): url is string => !!url);
      const referenceImageUrls = [...storyboardRefs, ...styleRefs].filter((url, index, list) => list.indexOf(url) === index);
      const framePrompt = [
        `Use case: ads-marketing. Asset type: storyboard still, ${defaultFormat(selected.payload)}.`,
        referenceImageUrls.length && "Input-image roles: earlier frames = continuity (faces/wardrobe/world). Extra stills = style reference only — match grade/material, do not copy lettering or logo.",
        brandKitPrompt(kit),
        `Next shot in ONE continuous ${visual.label} commercial. Keep the same world, people, wardrobe, lighting and grade.`,
        style.lock,
        selected.title && !isInternalCopyLine(selected.title) && `Campaign: ${selected.title}`,
        `Frame ${frame.order}: ${frame.title}`,
        frame.shot && `Shot type: ${frame.shot}`,
        frame.visualPrompt && `Action/setting change only: ${frame.visualPrompt}`,
        referenceImageUrls.length
          ? "A reference still from this same storyboard is attached — match faces, wardrobe, location family and color language. Do not invent a new art style."
          : `This is the first frame. Establish a single ${visual.label} look that later frames must copy exactly.`,
      ].filter(Boolean).join("\n");
      throwIfGenerationAborted(generateAbortRef.current);
      const { imageUrl, cost } = await generateCreativeImage({
        supabase,
        tenantId,
        itemId: selected.id,
        stageId: readyContext.creativeStage.id,
        prompt: framePrompt,
        referenceImageUrls,
        size: imageSizeForFormat(defaultFormat(selected.payload)),
        quality: "medium",
      });
      if (shouldLock) {
        toast.message(referenceImageUrls.length ? "הפריים נוצר מול ייחוס הסגנון" : "פריים ראשון — נשמר כסגנון לייחוס");
      }
      const next = activeFrames.map((value) => value.id === frame.id ? { ...frame, imageUrl, generationCost: cost } : value);
      setStoryboardDraft(next);
      await persistStoryboard(next, shouldLock ? "הפריים נוצר ונשמר" : "");
      return next;
    } catch (error: unknown) {
      if (isGenerationAborted(error)) {
        if (!shouldLock) throw error;
        toast.message("היצירה נעצרה");
        return fallback;
      }
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
    generateAbortRef.current = false;
    setGenerating(true);
    try {
      let current = [...storyboardDraft].sort((a, b) => a.order - b.order);
      for (const frame of queued) {
        throwIfGenerationAborted(generateAbortRef.current);
        const latest = current.find((value) => value.id === frame.id) ?? frame;
        current = await generateStoryboardFrame(latest, current, { lock: false });
      }
      toast.success("הפריימים נוצרו לפי סדר, עם אותו סגנון");
    } catch (error: unknown) {
      if (isGenerationAborted(error)) {
        toast.message("היצירה נעצרה — הפריימים שכבר נוצרו נשמרו");
      }
      // Per-frame toast already shown; stop the sequence so later frames do not drift.
    } finally {
      setGenerating(false);
      setGenerateProgress(null);
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

  const persistVisualStyle = async (visualStyle: CreativeVisualStyleId) => {
    if (!selected) return;
    const { error } = await supabase
      .from("marketing_work_items")
      .update({
        payload: {
          ...(selected.payload ?? {}),
          visual_style: visualStyle,
          department: "creative",
        },
      })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error(errorMessage(error, "שמירת הסגנון נכשלה"));
      return;
    }
    await refresh();
  };

  const prepareCreativeStage = async () => {
    if (!selected) throw new Error("לא נבחר פרויקט");
    if (!selected.client_id) throw new Error("יש לשייך לקוח לפרויקט לפני יצירת קריאייטיב");
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
    ].filter(Boolean).join("\n");
    await supabase
      .from("marketing_work_items")
      .update({ payload: { ...(selected.payload ?? {}), notes, visual_style: getVisualStyleId(selected.payload), department: "creative" } })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    return readyContext;
  };

  const buildCreative = async ({
    copyText,
    copyKey,
    copyLabel,
    styleId,
    rejectNote: directorNote,
    parentId,
    replaceId,
    name,
  }: {
    copyText: string;
    copyKey?: string;
    copyLabel?: string;
    styleId: CreativeVisualStyleId;
    rejectNote?: string;
    parentId?: string;
    replaceId?: string;
    name?: string;
  }): Promise<CreativeVariation> => {
    if (!selected) throw new Error("לא נבחר פרויקט");
    throwIfGenerationAborted(generateAbortRef.current);
    const readyContext = ensureCreativeStageReady(context);
    const style = visualStyleById(styleId);
    const format = defaultFormat(selected.payload);
    const kit = getBrandKit(selected.payload);
    const sceneBrief = buildCopySceneBrief({
      copyText,
      title: selected.title ?? undefined,
      brief: getBriefText(selected),
      instructions: selected.payload?.instructions ? String(selected.payload.instructions) : undefined,
      copyLabel,
    });
    const referenceImageUrls = (
      await Promise.all(kit.styleReferences.map((reference) => resolveCreativeImageUrl(reference.url)))
    ).filter((url): url is string => !!url);
    const creativePrompt = [
      `Use case: ads-marketing. Asset type: standalone ${format} commercial key visual.`,
      sceneBrief,
      `TREATMENT ONLY: dress that same situation in a ${style.label} art system. Do not swap the subject to match the style's cliché.`,
      buildVisualStyleLock(selected.payload, { styleId: style.id }),
      referenceImageUrls.length
        ? "Input-image roles: attached stills are STYLE REFERENCES only — match light, material and grade. Do not copy layout, lettering, faces, or logo, and do not let them override the copy subject."
        : undefined,
      brandKitPrompt(kit),
      directorNote && `Art director REJECT — do not repeat these mistakes: ${directorNote}`,
      `Format ${format}. Poster composition: keep the TOP 20% and BOTTOM 28% quiet for type. Subject lives in the middle band. No face in the top fifth.`,
      kit.logoUrl && "Reserve a clean top-right pad (~18% width) for the real logo composite. Do not invent or redraw a logo.",
      "RTL/production: Hebrew and the brand logo are composited as layers after generation.",
      "Forbidden: grey or white studio, cyclorama, cutout portrait, thinking-hand pose, caption plates, Canva templates, UI chrome, invented logos, baked lettering.",
    ].filter(Boolean).join("\n");
    throwIfGenerationAborted(generateAbortRef.current);
    const { imageUrl, cost } = await generateCreativeImage({
      supabase,
      tenantId,
      itemId: selected.id,
      stageId: readyContext.creativeStage.id,
      prompt: creativePrompt || selected.title || "Marketing creative",
      referenceImageUrls,
      size: imageSizeForFormat(format),
      quality: "high",
    });
    const created = makeVariation({
      imageUrl,
      format,
      copyText,
      title: selected.title ?? undefined,
      visualStyle: style.id,
      name: name ?? `${copyLabel || "וריאציה"} · ${style.label}`,
      source: "ai",
      copyKey,
      copyLabel,
      rejectNote: directorNote,
      parentId,
      logoUrl: kit.logoUrl,
      generationCost: cost,
    });
    return replaceId ? { ...created, id: replaceId } : created;
  };

  const generate = async (mode: "new" | "replace" = "new", target?: CreativeVariation) => {
    if (!selected) return;
    generateAbortRef.current = false;
    setGenerating(true);
    try {
      await prepareCreativeStage();
      const replaceTarget = mode === "replace"
        ? target ?? variations.find((variation) => variation.id === selectedVariationId) ?? variations[variations.length - 1]
        : undefined;
      const usedStyles = variations
        .map((variation) => variation.visualStyle)
        .filter((value): value is CreativeVisualStyleId => !!value);
      const projectStyle = getVisualStyleId(selected.payload);
      const style = mode === "new"
        ? (variations.length > 0 ? pickNextVariationStyle([projectStyle, ...usedStyles]) : visualStyleById(projectStyle))
        : visualStyleById(replaceTarget?.visualStyle ?? projectStyle);
      const usedCopyKeys = new Set(variations.filter((variation) => !variation.rejected).map((variation) => variation.copyKey).filter(Boolean));
      const copyBlock = replaceTarget
        ? copyBlocks.find((block) => block.key === replaceTarget.copyKey) ?? copyBlocks[0]
        : copyBlocks.find((block) => !usedCopyKeys.has(block.key)) ?? copyBlocks[0];
      const copyText = copyBlock?.text || getLinkedCopyText(selected);
      const nextVariation = await buildCreative({
        copyText,
        copyKey: copyBlock?.key ?? replaceTarget?.copyKey,
        copyLabel: copyBlock ? copyBlockLabel(copyBlock) : replaceTarget?.copyLabel,
        styleId: style.id,
        replaceId: replaceTarget?.id,
        parentId: replaceTarget?.parentId,
        name: replaceTarget
          ? (replaceTarget.name.includes("·") ? replaceTarget.name : `${replaceTarget.name} · ${style.label}`)
          : undefined,
      });
      const nextVariations = replaceTarget
        ? variations.map((variation) => variation.id === replaceTarget.id ? { ...replaceTarget, ...nextVariation, rejected: false } : variation)
        : [...variations, nextVariation];
      await persistVariations(
        nextVariations,
        replaceTarget ? `העיצוב נוצר מחדש בסגנון ${style.label}` : `נוצר קריאייטיב ל${nextVariation.copyLabel || "קופי"} בסגנון ${style.label}`,
      );
      setSelectedVariationId(nextVariation.id);
      if (mode !== "replace") setWorkspacePanel(null);
    } catch (error: unknown) {
      if (isGenerationAborted(error)) toast.message("היצירה נעצרה");
      else toast.error(errorMessage(error, "יצירת הקריאייטיב נכשלה"));
    } finally {
      setGenerating(false);
      setGeneratingId(null);
      setGenerateProgress(null);
    }
  };

  const generateAllFromCopy = async (styleMode: "same" | "mixed") => {
    if (!selected) return;
    const blocks = copyBlocks.length > 0 ? copyBlocks : [{ key: "1", index: 1, label: "וריאציה 1", text: getLinkedCopyText(selected), parts: {}, angle: undefined }];
    if (blocks.every((block) => !block.text.trim()) && !getBriefText(selected)) {
      toast.error("שייך קופי או מלא בריף לפני יצירה לכל הווריאציות");
      return;
    }
    generateAbortRef.current = false;
    setGenerating(true);
    try {
      await prepareCreativeStage();
      const projectStyle = getVisualStyleId(selected.payload);
      let usedStyles: CreativeVisualStyleId[] = variations
        .map((variation) => variation.visualStyle)
        .filter((value): value is CreativeVisualStyleId => !!value);
      let current = [...variations];
      for (const [index, block] of blocks.entries()) {
        throwIfGenerationAborted(generateAbortRef.current);
        setGenerateProgress(`יוצר ${index + 1}/${blocks.length} · ${copyBlockLabel(block)}`);
        const style = styleMode === "same"
          ? visualStyleById(projectStyle)
          : pickNextVariationStyle([projectStyle, ...usedStyles]);
        usedStyles = [...usedStyles, style.id];
        const created = await buildCreative({
          copyText: block.text || getBriefText(selected),
          copyKey: block.key,
          copyLabel: copyBlockLabel(block),
          styleId: style.id,
        });
        current = [...current, created];
        await persistVariations(current, `נוצר ${copyBlockLabel(block)} בסגנון ${style.label}`);
        setSelectedVariationId(created.id);
      }
      setWorkspacePanel(null);
      toast.success(styleMode === "same" ? "נוצר קריאייטיב לכל וריאציית קופי בסגנון הנבחר" : "נוצר קריאייטיב לכל וריאציית קופי בסגנון אחר");
    } catch (error: unknown) {
      if (isGenerationAborted(error)) toast.message("היצירה נעצרה — מה שכבר נוצר נשמר");
      else toast.error(errorMessage(error, "יצירת הגריד נכשלה"));
    } finally {
      setGenerating(false);
      setGenerateProgress(null);
    }
  };

  const stopGeneration = () => {
    if (!generating) return;
    generateAbortRef.current = true;
    setGenerateProgress("עוצר אחרי הווריאציה הנוכחית...");
  };

  const rejectVariation = async () => {
    if (!selected || !rejectTarget || !rejectNote.trim()) return;
    generateAbortRef.current = false;
    setGenerating(true);
    setGeneratingId(rejectTarget.id);
    try {
      await prepareCreativeStage();
      const projectStyle = getVisualStyleId(selected.payload);
      const usedStyles = variations
        .map((variation) => variation.visualStyle)
        .filter((value): value is CreativeVisualStyleId => !!value);
      const style = pickNextVariationStyle([rejectTarget.visualStyle ?? projectStyle, ...usedStyles]);
      const copyBlock = copyBlocks.find((block) => block.key === rejectTarget.copyKey);
      const created = await buildCreative({
        copyText: rejectTarget.copyText || copyBlock?.text || getLinkedCopyText(selected),
        copyKey: rejectTarget.copyKey ?? copyBlock?.key,
        copyLabel: rejectTarget.copyLabel ?? (copyBlock ? copyBlockLabel(copyBlock) : undefined),
        styleId: style.id,
        rejectNote: rejectNote.trim(),
        parentId: rejectTarget.id,
        name: `${rejectTarget.copyLabel || rejectTarget.name} · תיקון`,
      });
      const nextVariations = [
        ...variations.map((variation) => variation.id === rejectTarget.id ? { ...variation, rejected: true, rejectNote: rejectNote.trim() } : variation),
        created,
      ];
      await persistVariations(nextVariations, "נוצרה וריאציה לפי הרג׳קט");
      setSelectedVariationId(created.id);
      setRejectTarget(null);
      setRejectNote("");
      setWorkspacePanel(null);
    } catch (error: unknown) {
      if (isGenerationAborted(error)) toast.message("היצירה נעצרה");
      else toast.error(errorMessage(error, "יצירת וריאציית הרג׳קט נכשלה"));
    } finally {
      setGenerating(false);
      setGeneratingId(null);
    }
  };

  const deleteVariation = async (target: CreativeVariation) => {
    const nextVariations = variations.filter((variation) => variation.id !== target.id);
    await persistVariations(nextVariations, "הוריאציה נמחקה");
    if (selectedVariationId === target.id) {
      setSelectedVariationId(nextVariations[nextVariations.length - 1]?.id ?? null);
      setWorkspacePanel(null);
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
    const nextPayload = {
      ...(selected.payload ?? {}),
      copy_text: copyText,
      brief_text: briefText || selected.payload?.brief_text,
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
                  {!!costRows.find((row) => row.item.id === item.id)?.spent.costUsd && (
                    <span>{formatUsd(costRows.find((row) => row.item.id === item.id)!.spent.costUsd)}</span>
                  )}
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
          {(getBriefText(selected) || getLinkedCopyText(selected)) && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs font-semibold hover:bg-muted/50">
                <span>בריף וקופi משויך</span>
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
                    <Badge variant="outline" className="mb-2 gap-1"><PenLine className="h-3 w-3" />קופi משויך</Badge>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{getLinkedCopyText(selected)}</p>
                    {selected?.payload?.linked_copy_title && (
                      <p className="mt-2 text-[10px] text-muted-foreground">מקור: {String(selected.payload.linked_copy_title)}</p>
                    )}
                  </Card>
                )}
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
          {projectTypeLabel(projectType)} · {getVisualStyle(selected.payload).label} · gpt-image-1
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
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCostOpen(true)}>
        <Coins className="h-3.5 w-3.5" />
        {formatUsd(costRows.find((row) => row.item.id === selected.id)?.spent.costUsd ?? 0)}
      </Button>
      <VisualStyleSelect
        compact
        value={getVisualStyleId(selected.payload)}
        onChange={(style) => void persistVisualStyle(style)}
      />
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkCopyOpen(true)}>
        <Link2 className="h-3.5 w-3.5" />שייך קופi
      </Button>
      {!isVideoWorkspace && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-pink-600 to-violet-600" disabled={generating || loadingContext || !selected.client_id}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                צור לכל הקופי
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void generateAllFromCopy("same")}>
                לכל וריאציות הקופי · בסגנון {getVisualStyle(selected.payload).label}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void generateAllFromCopy("mixed")}>
                לכל וריאציות הקופי · סגנון שונה לכל אחת
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void generate("new")} disabled={generating || loadingContext || !selected.client_id}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
            וריאציה אחת
          </Button>
        </>
      )}
      {generating && (
        <Button variant="destructive" size="sm" className="gap-1.5" onClick={stopGeneration}>
          <Square className="h-3.5 w-3.5 fill-current" />עצור
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
              onStop={stopGeneration}
              generating={generating}
              saving={saving}
              scenePanelOpen={workspacePanel === "scene"}
              onScenePanelOpenChange={(open) => setWorkspacePanel(open ? "scene" : null)}
            />
          ) : workspacePanel === "edit" && variationDraft ? (
            <CreativeLayerEditor
              key={variationDraft.id}
              variation={variationDraft}
              onChange={setVariationDraft}
              onSave={saveVariation}
              saving={saving}
              editing
              onEditingChange={(open) => setWorkspacePanel(open ? "edit" : null)}
              onRegenerate={() => void generate("replace", variationDraft)}
              regenerating={generating}
              onBack={() => setWorkspacePanel(null)}
            />
          ) : variations.length > 0 ? (
            <CreativeVariationGrid
              variations={variations}
              generatingId={generatingId}
              progressLabel={generateProgress ?? undefined}
              disabled={generating}
              onEdit={(variation) => {
                setSelectedVariationId(variation.id);
                setWorkspacePanel("edit");
              }}
              onDelete={(variation) => void deleteVariation(variation)}
              onRegenerate={(variation) => {
                setSelectedVariationId(variation.id);
                setGeneratingId(variation.id);
                void generate("replace", variation);
              }}
              onReject={(variation) => {
                setRejectTarget(variation);
                setRejectNote("");
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ImageIcon className="mb-4 h-14 w-14 opacity-30" />
              <h3 className="text-lg font-bold text-foreground">גריד וריאציות</h3>
              <p className="mt-2 max-w-md text-sm">
                כל וריאציית קופי מקבלת קריאייטיב משלה לפי הבריף. אפשר סגנון אחד לכולן או סגנון שונה לכל אחת, ואז לערוך / למחוק / לג׳נרט / לרג׳קט מכל כרטיס.
              </p>
              {copyBlocks.length > 0 && (
                <p className="mt-2 text-xs">נמצאו {copyBlocks.length} וריאציות קופי משויכות</p>
              )}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => setWorkspacePanel("project")}>עריכת פרויקט</Button>
                <Button className="gap-2 bg-gradient-to-r from-pink-600 to-violet-600" onClick={() => void generateAllFromCopy("same")} disabled={generating || loadingContext || !selected.client_id}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  צור לכל הקופי בסגנון הנבחר
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => void generateAllFromCopy("mixed")} disabled={generating || loadingContext || !selected.client_id}>
                  סגנון שונה לכל קופי
                </Button>
                {generating && (
                  <Button variant="destructive" className="gap-2" onClick={stopGeneration}>
                    <Square className="h-4 w-4 fill-current" />עצור
                  </Button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <Palette className="h-12 w-12 opacity-30" />
            <p className="text-sm">בחר פרויקט או צור אחד חדש</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setWorkspacePanel("projects")}>פתח פרויקטים</Button>
              <Button variant="outline" className="gap-1.5" onClick={() => setCostOpen(true)}>
                <Coins className="h-4 w-4" />עלות טוקנים
              </Button>
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
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setCostOpen(true)} title="עלות טוקנים">
                <Coins className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-8 w-8 shrink-0 bg-pink-600 hover:bg-pink-700" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
            <CreativeBriefEditor
              item={selected}
              tenantId={tenantId}
              client={selectedClient}
              onSave={saveProject}
              onAssignClient={assignCreativeClient}
              saving={saving}
            />
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

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>רג׳קט לוריאציה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            מה לא עבד ב־{rejectTarget?.copyLabel || rejectTarget?.name}? ניצור וריאציה חדשה לפי ההערה ונשאיר את הישנה מסומנת כנדחתה.
          </p>
          <Textarea
            className="min-h-28"
            value={rejectNote}
            onChange={(event) => setRejectNote(event.target.value)}
            placeholder="למשל: הכותרת על הפנים, נראה כמו סטוק, ה־CTA חתוך, לא קשור לבריף..."
          />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={() => void rejectVariation()} disabled={generating || !rejectNote.trim()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              צור וריאציה לפי הרג׳קט
            </Button>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreativeCostDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        rows={costRows}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setSelectedVariationId(null);
          setWorkspacePanel(null);
        }}
      />
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
  const [visualStyle, setVisualStyle] = useState<CreativeVisualStyleId>(DEFAULT_VISUAL_STYLE_ID);
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
      setVisualStyle(DEFAULT_VISUAL_STYLE_ID);
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
        visual_style: visualStyle,
        department: "creative",
        intake_source: mode === "from_copy" ? "copy_link" : "manual",
        handoff_from: mode === "from_copy" ? "copy" : undefined,
        linked_copy_item_id: linkedCopy?.id,
        linked_copy_title: linkedCopy?.title,
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
          <VisualStyleSelect value={visualStyle} onChange={setVisualStyle} />
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
