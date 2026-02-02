import { useState, useEffect } from "react";
import type { FolderLink } from "@/components/forms/FolderLinksField";
import type { Attachment } from "@/components/forms/AttachmentsField";

interface EntityWithFiles {
  folder_links?: any;
  folder_link?: string;
  attachments?: any;
}

/**
 * Hook לניהול folder_links ו-attachments של ליד או לקוח
 * מטפל בפרסור של הנתונים מהדאטהבייס ומחזיר מצב מנוהל
 */
export function useFolderLinksAndAttachments(entity: EntityWithFiles) {
  const [folderLinks, setFolderLinks] = useState<FolderLink[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    // Parse folder_links
    if (entity?.folder_links) {
      try {
        const parsed = typeof entity.folder_links === 'string'
          ? JSON.parse(entity.folder_links)
          : entity.folder_links;
        setFolderLinks(Array.isArray(parsed) ? parsed : []);
      } catch {
        // Fallback to old folder_link field
        if (entity.folder_link) {
          setFolderLinks([{ name: 'קישור', url: entity.folder_link }]);
        } else {
          setFolderLinks([]);
        }
      }
    } else if (entity?.folder_link) {
      setFolderLinks([{ name: 'קישור', url: entity.folder_link }]);
    } else {
      setFolderLinks([]);
    }

    // Parse attachments
    if (entity?.attachments) {
      try {
        const parsed = typeof entity.attachments === 'string'
          ? JSON.parse(entity.attachments)
          : entity.attachments;
        setAttachments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }
  // Use JSON.stringify to detect actual data changes, not just reference changes
  }, [JSON.stringify(entity?.folder_links), JSON.stringify(entity?.attachments), entity?.folder_link]);

  return {
    folderLinks,
    setFolderLinks,
    attachments,
    setAttachments,
    filesCount: folderLinks.length + attachments.length,
  };
}
