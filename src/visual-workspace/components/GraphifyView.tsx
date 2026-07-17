import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Boxes, GitBranch, Search, Network, Lock } from "lucide-react";
import {
  useGraphifyOverview,
  useGraphifyCommunity,
  useGraphifySearch,
  type GraphifyNode,
  type GraphifyCommunity,
} from "../hooks/useGraphify";
import { GraphCanvas, GraphLegend } from "./GraphCanvas";

function useDebounced(value: string, ms = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GraphifyView() {
  const { data: overview, isLoading, error } = useGraphifyOverview();
  const [selectedCommunity, setSelectedCommunity] = useState<GraphifyCommunity | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphifyNode | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const { data: searchHits = [], isFetching: searching } = useGraphifySearch(debouncedSearch);
  const subgraph = useGraphifyCommunity(selectedCommunity?.community ?? null);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" dir="rtl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (error) {
    const message = String((error as Error)?.message || "");
    const isForbidden = message.includes("limited to admins");
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-3" dir="rtl">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-md">
          {isForbidden
            ? "גרף המערכת זמין למנהלים בלבד."
            : `שגיאה בטעינת הגרף: ${message}`}
        </p>
      </div>
    );
  }

  if (!overview?.active) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-3" dir="rtl">
        <Network className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">אין גרסת גרף פעילה. הרץ סנכרון Graphify כדי לטעון אחת.</p>
      </div>
    );
  }

  const communities = overview.communities ?? [];

  // Drill-down into one community
  if (selectedCommunity) {
    return (
      <div className="flex flex-col h-full" dir="rtl">
        <div className="flex items-center gap-3 px-6 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedCommunity(null); setSelectedNode(null); }}>
            <ArrowRight className="h-4 w-4 ml-1" />
            חזרה לכל הקהילות
          </Button>
          <div className="flex-1">
            <span className="font-semibold">{selectedCommunity.name}</span>
            <span className="text-xs text-muted-foreground mr-2">
              {subgraph.data ? `${subgraph.data.nodes.length} צמתים · ${subgraph.data.edges.length} קשרים` : ""}
              {(selectedCommunity.nodes > (subgraph.data?.nodes.length ?? 0)) && subgraph.data
                ? ` (מציג את ${subgraph.data.nodes.length} המרכזיים מתוך ${selectedCommunity.nodes})`
                : ""}
            </span>
          </div>
          <GraphLegend />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0">
            {subgraph.isLoading ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">טוען גרף…</div>
            ) : (
              <GraphCanvas
                nodes={subgraph.data?.nodes ?? []}
                edges={subgraph.data?.edges ?? []}
                selectedId={selectedNode?.id ?? null}
                onSelect={setSelectedNode}
              />
            )}
          </div>
          {selectedNode && (
            <aside className="w-80 border-r p-4 space-y-3 overflow-auto bg-background/60">
              <h3 className="font-semibold break-all">{selectedNode.label}</h3>
              <div className="space-y-1.5 text-xs">
                {selectedNode.file_type && <Badge variant="secondary">{selectedNode.file_type}</Badge>}
                {selectedNode.source_file && (
                  <p className="font-mono text-muted-foreground break-all" dir="ltr">
                    {selectedNode.source_file}{selectedNode.source_location ? `:${selectedNode.source_location}` : ""}
                  </p>
                )}
                <p className="text-muted-foreground">{selectedNode.degree} קשרים בגרף המלא</p>
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // Overview: stats + search + community islands
  return (
    <div className="p-6 space-y-5 overflow-auto h-full" dir="rtl">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary" />
          <span className="text-sm"><b>{overview.node_count?.toLocaleString()}</b> צמתים</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm"><b>{overview.edge_count?.toLocaleString()}</b> קשרים</span>
        </div>
        {overview.commit_sha && (
          <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">
            {overview.commit_sha.slice(0, 10)}
          </Badge>
        )}
        <div className="flex-1" />
        <div className="relative w-72">
          <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש רכיב, טבלה, פונקציה…"
            className="pr-8"
            dir="rtl"
          />
        </div>
      </div>

      {debouncedSearch.trim().length >= 2 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{searching ? "מחפש…" : `${searchHits.length} תוצאות`}</p>
            <div className="max-h-72 overflow-auto divide-y">
              {searchHits.map((hit) => (
                <div key={hit.node_id} className="py-2 flex items-start gap-3">
                  <Badge variant={hit.distance === 0 ? "default" : "secondary"} className="mt-0.5 shrink-0">
                    {hit.distance === 0 ? "התאמה" : `מרחק ${hit.distance}`}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-all">{hit.label}</p>
                    <p className="text-xs text-muted-foreground font-mono break-all" dir="ltr">{hit.source_file}</p>
                    {hit.community_name && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          const c = communities.find(x => x.name === hit.community_name);
                          if (c) setSelectedCommunity(c);
                        }}
                      >
                        {hit.community_name}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3">קהילות בגרף ({communities.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {communities.map((c) => (
            <Card
              key={String(c.community)}
              className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setSelectedCommunity(c)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-sm truncate">{c.name}</h3>
                  <Badge variant="secondary" className="shrink-0">{c.nodes}</Badge>
                </div>
                {c.file_types && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(c.file_types).slice(0, 4).map(([ft, cnt]) => (
                      <span key={ft} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        {ft} · {cnt}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
