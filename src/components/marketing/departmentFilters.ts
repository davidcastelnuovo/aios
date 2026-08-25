type WorkItemLike = {
  payload?: Record<string, unknown> | null;
  current_stage_id?: string | null;
};

const otherDepartments = new Set(["creative", "seo", "campaigns"]);

export function isCopyDepartmentItem(item: WorkItemLike, copyStageId?: string | null) {
  const payload = item.payload ?? {};
  const department = payload.department;
  if (typeof department === "string" && otherDepartments.has(department)) return false;
  if (Array.isArray(payload.storyboard)) return false;
  if (Array.isArray(payload.variations)) return false;
  if (payload.project_type === "static" || payload.project_type === "video") return false;
  if (department === "copy") return true;
  if (copyStageId && item.current_stage_id === copyStageId) return true;
  if (!department && (payload.brief_text || payload.copy_text || payload.copy_chat || payload.copy_concepts)) return true;
  return false;
}

export function isCreativeDepartmentItem(item: WorkItemLike, creativeStageId?: string | null) {
  const payload = item.payload ?? {};
  const department = payload.department;
  if (department === "copy") return false;
  if (department === "creative") return true;
  if (payload.handoff_from === "copy") return true;
  if (payload.intake_source === "copy_link") return true;
  if (creativeStageId && item.current_stage_id === creativeStageId) return true;
  if (Array.isArray(payload.variations)) return true;
  if (payload.project_type === "video" && Array.isArray(payload.storyboard)) return true;
  if (payload.project_type === "static" && !!payload.image_url) return true;
  if (!department && !!payload.image_url) return true;
  return false;
}

export function isLinkableCopyItem(item: WorkItemLike, copyStageId?: string | null) {
  return isCopyDepartmentItem(item, copyStageId);
}
