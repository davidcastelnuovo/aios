import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, History, TestTube, MessageSquare, ZoomIn, ZoomOut, ArrowRight, Zap } from "lucide-react";
import { FlowNodeRF, FlowNodeData } from "./FlowNode";
import { AddStepMenu } from "./AddStepMenu";
import { InsertableEdge } from "./InsertableEdge";
import { StepConfigPanel } from "./StepConfigPanel";
import { ManualTriggerDialog } from "./ManualTriggerDialog";
import { TestFlowWithLeadDialog } from "./TestFlowWithLeadDialog";
import { ExecutionHistoryPanel } from "./ExecutionHistoryPanel";

// ─── React Flow node type registry ───────────────────────────────────────────
const nodeTypes = {
  flowNode: FlowNodeRF,
};

const edgeTypes = {
  insertable: InsertableEdge,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toRFNode(nd: FlowNodeData, onDelete: (id: string) => void, onSelect: (id: string) => void): Node {
  return {
    id: nd.id,
    type: "flowNode",
    position: { x: nd.position_x, y: nd.position_y },
    data: { nodeData: nd, onDelete, onSelect },
    draggable: true,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FlowEditor() {
  const { automationId } = useParams<{ automationId: string }>();
  const { tenantId, isActiveTenantSynced } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [automationName, setAutomationName] = useState("אוטומציה חדשה");
  const [automationActive, setAutomationActive] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showManualTrigger, setShowManualTrigger] = useState(false);
  const [showTestWithLead, setShowTestWithLead] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [insertBetween, setInsertBetween] = useState<{ sourceId: string; targetId: string } | null>(null);

  // Track whether we've initialized from DB to prevent re-init after save
  const initializedRef = useRef(false);

  // Internal node data store (source of truth for DB)
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, FlowNodeData>>({});

  // React Flow state
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const handleDeleteNode = useCallback((id: string) => {
    let blocked = false;
    setNodeDataMap((prev) => {
      const target = prev[id];
      if (target?.step_type === "trigger") {
        const triggerCount = Object.values(prev).filter((n) => n.step_type === "trigger").length;
        if (triggerCount <= 1) {
          blocked = true;
          toast({ title: "לא ניתן למחוק את הטריגר היחיד", description: "אוטומציה חייבת לפחות טריגר אחד", variant: "destructive" });
          return prev;
        }
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (blocked) return;
    setRfNodes((nds) => nds.filter((n) => n.id !== id));
    setRfEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((cur) => (cur === id ? null : cur));
  }, [setRfNodes, setRfEdges, toast]);


  const handleDisconnectNode = useCallback((id: string) => {
    // Remove the edge coming into this node and clear parent_step_id
    setRfEdges((eds) => eds.filter((e) => e.target !== id));
    setNodeDataMap((prev) => ({
      ...prev,
      [id]: { ...prev[id], parent_step_id: null, condition_branch: null },
    }));
  }, [setRfEdges]);

  const handleInsertBetween = useCallback((sourceId: string, targetId: string) => {
    setInsertBetween({ sourceId, targetId });
  }, []);

  const handleSelectNode = useCallback((id: string) => {
    setSelectedNodeId(id);
  }, []);

  const syncRFNodes = useCallback(
    (dataMap: Record<string, FlowNodeData>) => {
      setRfNodes((prev) =>
        Object.values(dataMap).map((nd) => {
          const existing = prev.find((n) => n.id === nd.id);
          return {
            ...(existing || {}),
            id: nd.id,
            type: "flowNode",
            position: existing?.position ?? { x: nd.position_x, y: nd.position_y },
            data: { nodeData: nd, onDelete: handleDeleteNode, onSelect: handleSelectNode, onDisconnect: handleDisconnectNode },
            draggable: true,
          } as Node;
        })
      );
    },
    [setRfNodes, handleDeleteNode, handleSelectNode, handleDisconnectNode]
  );

  // ── Fetch automation ───────────────────────────────────────────────────────

  const { data: automation } = useQuery({
    queryKey: ["automation", automationId],
    queryFn: async () => {
      if (!automationId || !tenantId) return null;
      // No tenant filter — automations from other tenants may be visible as shared mirrors
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("id", automationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!automationId && !!tenantId && isActiveTenantSynced,
  });

  // Read-only when viewing a shared mirror (automation belongs to a different tenant)
  const isReadOnlyMirror = !!automation && !!tenantId && automation.tenant_id !== tenantId;

  const { data: steps } = useQuery({
    queryKey: ["automation-flow-steps", automationId],
    queryFn: async () => {
      if (!automationId || !tenantId) return [];
      const { data, error } = await supabase
        .from("automation_flow_steps" as any)
        .select("*")
        .eq("automation_id", automationId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!automationId && !!tenantId && isActiveTenantSynced,
  });

  // ── Init from DB (only once, to avoid overwriting user edits on refetch) ───

  const initializedMetaRef = useRef(false);

  useEffect(() => {
    if (automation && !initializedMetaRef.current) {
      setAutomationName(automation.name);
      setAutomationActive(automation.active ?? true);
      initializedMetaRef.current = true;
    }
  }, [automation]);

  useEffect(() => {
    if (!steps || initializedRef.current) return;

    if (steps.length > 0) {
      const dataMap: Record<string, FlowNodeData> = {};
      const edges: Edge[] = [];

      steps.forEach((s: any) => {
        const nd: FlowNodeData = {
          id: s.id,
          step_type: s.step_type,
          action_type: s.action_type,
          label: s.label,
          configuration: s.configuration || {},
          position_x: s.position_x,
          position_y: s.position_y,
          sort_order: s.sort_order,
          parent_step_id: s.parent_step_id,
          condition_branch: s.condition_branch,
          switch_branches: s.configuration?.switch_branches,
        };
        dataMap[s.id] = nd;
      });

      // Build edges from parent_step_id + condition_branch
      steps.forEach((s: any) => {
        if (!s.parent_step_id) return;
        const parent = dataMap[s.parent_step_id];
        if (!parent) return;

        let sourceHandle = "output";
        if (parent.step_type === "condition") {
          sourceHandle = s.condition_branch === "true" ? "true" : "false";
        } else if (parent.step_type === "switch" && s.condition_branch) {
          sourceHandle = `branch_${s.condition_branch}`;
        } else if (parent.step_type === "loop") {
          sourceHandle = s.condition_branch === "done" ? "loop_done" : "loop_body";
        } else if (parent.step_type === "error_branch") {
          sourceHandle = s.condition_branch === "error" ? "error" : "success";
        } else if (parent.step_type === "merge") {
          sourceHandle = "output";
        }

        edges.push({
          id: `e-${s.parent_step_id}-${s.id}`,
          source: s.parent_step_id,
          target: s.id,
          sourceHandle,
          targetHandle: "input",
          type: "insertable",
          data: { onInsert: handleInsertBetween },
          animated: false,
          style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
          markerEnd: { type: "arrowclosed" as any },
        });
      });

      setNodeDataMap(dataMap);
      setRfEdges(edges);
      syncRFNodes(dataMap);
      initializedRef.current = true;
    } else if (automation) {
      // New flow – create default trigger node
      const triggerId = crypto.randomUUID();
      const defaultTrigger: FlowNodeData = {
        id: triggerId,
        step_type: "trigger",
        action_type: automation.trigger_type || undefined,
        label: undefined,
        configuration: {},
        position_x: 400,
        position_y: 80,
        sort_order: 0,
        parent_step_id: null,
        condition_branch: null,
      };
      const dataMap = { [triggerId]: defaultTrigger };
      setNodeDataMap(dataMap);
      setRfEdges([]);
      syncRFNodes(dataMap);
      initializedRef.current = true;
    }
  }, [steps, automation, handleInsertBetween]);

  // ── Insert step between two nodes ─────────────────────────────────────────

  const doInsertBetween = useCallback(
    (stepType: FlowNodeData["step_type"]) => {
      if (!insertBetween) return;
      const { sourceId, targetId } = insertBetween;
      const sourceNode = nodeDataMap[sourceId];
      const targetNode = nodeDataMap[targetId];
      if (!sourceNode || !targetNode) { setInsertBetween(null); return; }

      const newId = crypto.randomUUID();
      const midX = (sourceNode.position_x + targetNode.position_x) / 2;
      const midY = (sourceNode.position_y + targetNode.position_y) / 2;

      // Find the edge to get sourceHandle info
      const oldEdge = rfEdges.find((e) => e.source === sourceId && e.target === targetId);
      const sourceHandle = oldEdge?.sourceHandle || "output";

      const newNode: FlowNodeData = {
        id: newId,
        step_type: stepType,
        action_type: undefined,
        label: undefined,
        configuration: stepType === "switch" ? { switch_branches: ["ברירת מחדל"] } : {},
        position_x: midX,
        position_y: midY,
        sort_order: sourceNode.sort_order + 1,
        parent_step_id: sourceId,
        condition_branch: targetNode.condition_branch,
        switch_branches: stepType === "switch" ? ["ברירת מחדל"] : undefined,
      };

      // Update target to point to new node
      const updatedTarget = { ...targetNode, parent_step_id: newId, condition_branch: null };
      const newDataMap = { ...nodeDataMap, [newId]: newNode, [targetId]: updatedTarget };
      setNodeDataMap(newDataMap);
      syncRFNodes(newDataMap);

      // Replace old edge with two new edges
      setRfEdges((eds) => {
        const filtered = eds.filter((e) => !(e.source === sourceId && e.target === targetId));
        return [
          ...filtered,
          {
            id: `e-${sourceId}-${newId}`,
            source: sourceId,
            target: newId,
            sourceHandle,
            targetHandle: "input",
            type: "insertable",
            data: { onInsert: handleInsertBetween },
            animated: false,
            style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed" as any },
          },
          {
            id: `e-${newId}-${targetId}`,
            source: newId,
            target: targetId,
            sourceHandle: "output",
            targetHandle: "input",
            type: "insertable",
            data: { onInsert: handleInsertBetween },
            animated: false,
            style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed" as any },
          },
        ];
      });

      setSelectedNodeId(newId);
      setInsertBetween(null);
    },
    [insertBetween, nodeDataMap, rfEdges, syncRFNodes, setRfEdges, handleInsertBetween]
  );

  // ── Add step ───────────────────────────────────────────────────────────────
  const addStep = useCallback(
    (stepType: FlowNodeData["step_type"]) => {
      const allNodes = Object.values(nodeDataMap);
      const lastNode = allNodes.sort((a, b) => b.sort_order - a.sort_order)[0];
      const newId = crypto.randomUUID();

      const newNode: FlowNodeData = {
        id: newId,
        step_type: stepType,
        action_type: undefined,
        label: undefined,
        configuration:
          stepType === "switch"
            ? { switch_branches: ["ברירת מחדל"] }
            : stepType === "merge"
            ? { input_count: 2 }
            : {},
        position_x: lastNode ? lastNode.position_x : 400,
        position_y: lastNode ? lastNode.position_y + 160 : 240,
        sort_order: allNodes.length,
        parent_step_id: lastNode?.id || null,
        condition_branch: null,
        switch_branches: stepType === "switch" ? ["ברירת מחדל"] : undefined,
      };

      const newDataMap = { ...nodeDataMap, [newId]: newNode };
      setNodeDataMap(newDataMap);
      syncRFNodes(newDataMap);

      // Auto-connect to last node
      if (lastNode) {
        const sourceHandle =
          lastNode.step_type === "condition"
            ? "true"
            : lastNode.step_type === "loop"
            ? "loop_body"
            : lastNode.step_type === "error_branch"
            ? "success"
            : "output";

        setRfEdges((eds) => [
          ...eds,
          {
            id: `e-${lastNode.id}-${newId}`,
            source: lastNode.id,
            target: newId,
            sourceHandle,
            targetHandle: "input",
            type: "insertable",
            data: { onInsert: handleInsertBetween },
            animated: false,
            style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed" as any },
          },
        ]);
      }

      setSelectedNodeId(newId);
    },
    [nodeDataMap, syncRFNodes, setRfEdges, handleInsertBetween]
  );

  // ── Add extra trigger (OR semantics — multiple entry points to the same flow) ──
  const addTrigger = useCallback(() => {
    const triggers = Object.values(nodeDataMap).filter((n) => n.step_type === "trigger");
    const rightmost = triggers.sort((a, b) => b.position_x - a.position_x)[0];
    const baseX = rightmost ? rightmost.position_x : 400;
    const baseY = rightmost ? rightmost.position_y : 80;
    const newId = crypto.randomUUID();
    const newTrigger: FlowNodeData = {
      id: newId,
      step_type: "trigger",
      action_type: undefined,
      label: undefined,
      configuration: {},
      position_x: baseX + 260,
      position_y: baseY,
      sort_order: Object.values(nodeDataMap).length,
      parent_step_id: null,
      condition_branch: null,
    };
    const next = { ...nodeDataMap, [newId]: newTrigger };
    setNodeDataMap(next);
    syncRFNodes(next);
    setSelectedNodeId(newId);
  }, [nodeDataMap, syncRFNodes]);


  // ── Update node data ───────────────────────────────────────────────────────

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<FlowNodeData>) => {
      setNodeDataMap((prev) => {
        const updated = { ...prev, [nodeId]: { ...prev[nodeId], ...updates } };
        syncRFNodes(updated);
        return updated;
      });
    },
    [syncRFNodes]
  );

  // ── Handle new connections drawn by user ───────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        type: "insertable",
        data: { onInsert: handleInsertBetween },
        animated: false,
        style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
        markerEnd: { type: "arrowclosed" as any },
      };
      setRfEdges((eds) => addEdge(edge, eds));

      // Update parent_step_id in nodeDataMap
      if (connection.target) {
        const branch =
          connection.sourceHandle === "true" || connection.sourceHandle === "false"
            ? connection.sourceHandle
            : connection.sourceHandle?.startsWith("branch_")
            ? connection.sourceHandle.replace("branch_", "")
            : connection.sourceHandle === "loop_done"
            ? "done"
            : connection.sourceHandle === "error"
            ? "error"
            : null;

        setNodeDataMap((prev) => ({
          ...prev,
          [connection.target!]: {
            ...prev[connection.target!],
            parent_step_id: connection.source,
            condition_branch: branch,
          },
        }));
      }
    },
    [setRfEdges]
  );

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!automationId || !tenantId) throw new Error("Missing data");
      if (isReadOnlyMirror) throw new Error("אוטומציה זו משותפת מארגון אחר וניתנת לצפייה בלבד");

      const allNodes = Object.values(nodeDataMap);
      const triggerNode = allNodes.find((n) => n.step_type === "trigger");
      const flowTriggerType = triggerNode?.action_type || undefined;

      // Sync positions from React Flow
      const rfNodePositions: Record<string, { x: number; y: number }> = {};
      rfNodes.forEach((n) => {
        rfNodePositions[n.id] = n.position;
      });

      // First prepare the steps data before deleting
      const stepsToInsert = allNodes.map((n, idx) => ({
        id: n.id,
        automation_id: automationId,
        tenant_id: tenantId,
        step_type: n.step_type,
        action_type: n.action_type || null,
        label: n.label || null,
        configuration: {
          ...n.configuration,
          ...(n.switch_branches ? { switch_branches: n.switch_branches } : {}),
        },
        position_x: Math.round(rfNodePositions[n.id]?.x ?? n.position_x),
        position_y: Math.round(rfNodePositions[n.id]?.y ?? n.position_y),
        sort_order: idx,
        parent_step_id: n.parent_step_id || null,
        condition_branch: n.condition_branch || null,
      }));

      // Update automation metadata
      const { error: updateError } = await supabase
        .from("automations")
        .update({
          name: automationName,
          active: automationActive,
          is_flow: true,
          ...(flowTriggerType ? { trigger_type: flowTriggerType } : {}),
        } as any)
        .eq("id", automationId)
        .eq("tenant_id", tenantId)
        .select("id")
        .single();
      if (updateError) throw updateError;

      // Delete old steps
      const { error: deleteError } = await supabase
        .from("automation_flow_steps" as any)
        .delete()
        .eq("automation_id", automationId)
        .eq("tenant_id", tenantId);
      if (deleteError) throw deleteError;

      // Insert new steps
      if (stepsToInsert.length > 0) {
        const { error } = await supabase
          .from("automation_flow_steps" as any)
          .insert(stepsToInsert);
        if (error) {
          console.error("Save steps error:", error, "Steps data:", JSON.stringify(stepsToInsert));
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flow-steps", automationId] });
      queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "הפלוו נשמר בהצלחה!" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה בשמירה", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (nextActive: boolean) => {
      if (!automationId || !tenantId) throw new Error("Missing automation data");
      const { data, error } = await supabase
        .from("automations")
        .update({ active: nextActive } as any)
        .eq("id", automationId)
        .eq("tenant_id", tenantId)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("הפלוו לא נמצא בארגון הפעיל");
      return nextActive;
    },
    onMutate: async (nextActive: boolean) => {
      // Optimistic UI: flip the switch immediately so the user sees feedback
      const previous = automationActive;
      setAutomationActive(nextActive);
      return { previous };
    },
    onSuccess: (_, nextActive) => {
      queryClient.invalidateQueries({ queryKey: ["automation", automationId] });
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: nextActive ? "אוטומציה הופעלה" : "אוטומציה הושהתה" });
    },
    onError: (err: any, _nextActive, context) => {
      // Roll back the optimistic update
      if (context?.previous !== undefined) {
        setAutomationActive(context.previous);
      }
      toast({
        title: "שגיאה בהפעלה/השהיה",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const selectedNode = selectedNodeId ? nodeDataMap[selectedNodeId] : null;
  const allNodes = Object.values(nodeDataMap);

  return (
    <div className="flex flex-col h-screen" dir="rtl">
      {isReadOnlyMirror && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-700 dark:text-amber-400 text-center">
          אוטומציה זו שותפה אליך מארגון אחר ומוצגת כצפייה בלבד. היא רצה פעם אחת בלבד מהארגון שבעליה.
        </div>
      )}
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(buildPath("/automations"))}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          אוטומציות
        </Button>
        <div className="w-px h-5 bg-border" />
        <Input
          value={automationName}
          onChange={(e) => setAutomationName(e.target.value)}
          className="w-56 h-8 text-sm font-semibold"
          placeholder="שם האוטומציה"
          disabled={isReadOnlyMirror}
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={automationActive}
            disabled={isReadOnlyMirror}
            onCheckedChange={(v) => !isReadOnlyMirror && toggleActiveMutation.mutate(v)}
          />
          <Label className="text-xs">{automationActive ? "פעיל" : "מושהה"}</Label>
        </div>

        <div className="flex-1" />

        {!isReadOnlyMirror && <AddStepMenu onAdd={addStep} />}
        {!isReadOnlyMirror && insertBetween && (
          <AddStepMenu onAdd={(stepType) => doInsertBetween(stepType)} label="הוסף באמצע" />
        )}
        {!isReadOnlyMirror && insertBetween && (
          <Button variant="ghost" size="sm" onClick={() => setInsertBetween(null)} className="text-xs text-muted-foreground">
            ביטול
          </Button>
        )}

        {!isReadOnlyMirror && allNodes.some((n) => n.step_type === "trigger" && n.action_type === "manual_command") && (
          <Button variant="outline" size="sm" onClick={() => setShowManualTrigger(true)}>
            <MessageSquare className="h-4 w-4 ml-1" />
            הפעל ידנית
          </Button>
        )}
        {!isReadOnlyMirror && (
          <Button variant="outline" size="sm" onClick={() => setShowTestWithLead(true)}>
            <TestTube className="h-4 w-4 ml-1" />
            בדוק עם ליד
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
          <History className="h-4 w-4 ml-1" />
          היסטוריה
        </Button>
        {!isReadOnlyMirror && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 ml-1" />
            {saveMutation.isPending ? "שומר..." : "שמור"}
          </Button>
        )}
      </div>


      {/* ── Canvas ── */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Delete"
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const nd = (n.data as any)?.nodeData as FlowNodeData | undefined;
              if (!nd) return "#888";
              const colors: Record<string, string> = {
                trigger: "#f59e0b",
                action: "#3b82f6",
                condition: "#a855f7",
                switch: "#6366f1",
                delay: "#10b981",
                agent: "#f97316",
                merge: "#14b8a6",
                loop: "#06b6d4",
                code: "#64748b",
                error_branch: "#ef4444",
                whatsapp_session: "#16a34a",
              };
              return colors[nd.step_type] || "#888";
            }}
          />
        </ReactFlow>
      </div>

      {/* ── Config panel ── */}
      <StepConfigPanel
        node={selectedNode}
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onUpdate={updateNode}
        allNodes={allNodes}
      />

      {/* ── Dialogs ── */}
      <ManualTriggerDialog
        open={showManualTrigger}
        onOpenChange={setShowManualTrigger}
        automationId={automationId || ""}
        automationName={automationName}
      />
      <TestFlowWithLeadDialog
        open={showTestWithLead}
        onOpenChange={setShowTestWithLead}
        automationId={automationId || ""}
        automationName={automationName}
      />
      <ExecutionHistoryPanel
        open={showHistory}
        onClose={() => setShowHistory(false)}
        automationId={automationId || ""}
      />
    </div>
  );
}
