import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  findGaIntegrationForDomain,
  type GaPropertyRef,
} from "@/lib/gaPropertyMatch";
import { Loader2 } from "lucide-react";

type GaConnection = {
  id: string;
  label: string;
  own?: boolean;
};

type FoundProperty = {
  integrationId: string;
  propertyId: string;
  propertyName: string;
  accountName: string;
};

export function GaDomainSearch({
  connections,
  preferredIntegrationId,
  onFound,
}: {
  connections: GaConnection[];
  preferredIntegrationId?: string;
  onFound: (found: FoundProperty) => void;
}) {
  const [domain, setDomain] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  const search = async () => {
    const query = domain.trim();
    if (!query || pending || connections.length === 0) return;
    setPending(true);
    setStatus("");
    try {
      const found = await findGaIntegrationForDomain(
        connections,
        query,
        async (integrationId, matchDomain) => {
          const { data, error } = await supabase.functions.invoke(
            "google-analytics-auth?action=get_properties",
            {
              body: {
                integrationId,
                probe: true,
                ...(matchDomain ? { matchDomain } : {}),
              },
            },
          );
          if (error || data?.needs_reconnect) return null;
          return (data?.properties || []) as GaPropertyRef[];
        },
        preferredIntegrationId,
      );
      if (!found) {
        setStatus("לא נמצא נכס לדומיין הזה");
        return;
      }
      const propertyName =
        found.property.name || found.property.displayName || found.propertyId;
      const accountName = found.property.accountName || "";
      const connection = connections.find(
        (item) => item.id === found.integrationId,
      );
      onFound({
        integrationId: found.integrationId,
        propertyId: found.propertyId,
        propertyName,
        accountName,
      });
      setStatus(
        `נמצא: ${propertyName}${accountName ? ` (${accountName})` : ""}${connection ? ` · ${connection.label}` : ""}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "החיפוש נכשל";
      setStatus(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>דומיין</Label>
      <div className="flex gap-2">
        <Input
          dir="ltr"
          value={domain}
          placeholder="example.co.il"
          onChange={(event) => setDomain(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void search()}
          disabled={pending || !domain.trim()}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "מצא חשבון"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {status ||
          "מדביקים דומיין. החיפוש רץ על החשבון שלך ועל חשבונות ששותפו איתך"}
      </p>
    </div>
  );
}
