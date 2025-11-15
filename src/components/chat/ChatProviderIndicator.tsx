import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone } from "lucide-react";

interface ChatProviderIndicatorProps {
  provider: "manychat" | "green_api" | "internal" | null;
  size?: "sm" | "md";
}

export function ChatProviderIndicator({ provider, size = "sm" }: ChatProviderIndicatorProps) {
  if (!provider || provider === "internal") return null;

  const isSmall = size === "sm";

  if (provider === "manychat") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-green-500/10 text-green-700 dark:text-green-400 ${isSmall ? "text-xs px-1.5 py-0.5" : ""}`}
      >
        <MessageSquare className={isSmall ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {!isSmall && <span className="mr-1">ManyChat</span>}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`bg-blue-500/10 text-blue-700 dark:text-blue-400 ${isSmall ? "text-xs px-1.5 py-0.5" : ""}`}
    >
      <Phone className={isSmall ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {!isSmall && <span className="mr-1">Green API</span>}
    </Badge>
  );
}
