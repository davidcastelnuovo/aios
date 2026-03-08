import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, Save, ZoomIn, ZoomOut, RotateCcw, MessageSquare, TestTube, History } from "lucide-react";
import { FlowNode, FlowNodeData } from "./FlowNode";
import { FlowConnector } from "./FlowConnector";
import { StepConfigPanel } from "./StepConfigPanel";
import { AddStepMenu } from "./AddStepMenu";
import { ManualTriggerDialog } from "./ManualTriggerDialog";
import { TestFlowWithLeadDialog } from "./TestFlowWithLeadDialog";
import { ExecutionHistoryPanel } from "./ExecutionHistoryPanel";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;
const NODE_GAP = 60;

export default function FlowEditor() {
  const { automationId } = useParams<{ automationId: string }>();
  const navigate = useNavigate();
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nodes, setNodes] = useState<FlowNodeData[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [automationName, setAutomationName] = useState("");
  const [automationActive, setAutomationActive] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showManualTrigger, setShowManualTrigger] = useState(false);
  const [showTestWithLead, setShowTestWithLead] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Wheel handler for pan/zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.min(Math.max(z + delta, 0.3), 2));
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Fetch automation
  const { data: automation } = useQuery({
    queryKey: ["automation", automationId],
    queryFn: async () => {
      if (!automationId) return null;
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("id", automationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!automationId,
  });

  // Fetch steps
  const { data: steps } = useQuery({
    queryKey: ["automation-flow-steps", automationId],
    queryFn: async () => {
      if (!automationId) return [];
      const { data, error } = await supabase
        .from("automation_flow_steps" as any)
        .select("*")
        .eq("automation_id", automationId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!automationId,
  });

  // Initialize nodes from DB
  useEffect(() => {
    if (automation) {
      setAutomationName(automation.name);
      setAutomationActive(automation.active ?? true);
    }
  }, [automation]);

  useEffect(() => {
    if (steps && steps.length > 0) {
      setNodes(
        steps.map((s: any) => ({
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
        }))
      );
    } else if (steps && steps.length === 0 && automation) {
      // New flow - create default trigger node
      const defaultTrigger: FlowNodeData = {
        id: crypto.randomUUID(),
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
      setNodes([defaultTrigger]);
    }
  }, [steps, automation]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!automationId || !tenantId) throw new Error("Missing data");

      // Update automation
      await supabase
        .from("automations")
        .update({
          name: automationName,
          active: automationActive,
          is_flow: true,
        } as any)
        .eq("id", automationId);

      // Delete existing steps
      await supabase
        .from("automation_flow_steps" as any)
        .delete()
        .eq("automation_id", automationId);

      // Insert new steps
      if (nodes.length > 0) {
        const stepsToInsert = nodes.map((n, idx) => ({
          id: n.id,
          automation_id: automationId,
          tenant_id: tenantId,
          step_type: n.step_type,
          action_type: n.action_type || null,
          label: n.label || null,
          configuration: n.configuration,
          position_x: n.position_x,
          position_y: n.position_y,
          sort_order: idx,
          parent_step_id: n.parent_step_id || null,
          condition_branch: n.condition_branch || null,
        }));

        const { error } = await supabase
          .from("automation_flow_steps" as any)
          .insert(stepsToInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flow-steps", automationId] });
      toast({ title: "הפלוו נשמר בהצלחה!" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה בשמירה", description: err.message, variant: "destructive" });
    },
  });

  // Add step
  const addStep = useCallback(
    (stepType: "action" | "condition" | "delay" | "agent") => {
      const lastNode = nodes[nodes.length - 1];
      const newNode: FlowNodeData = {
        id: crypto.randomUUID(),
        step_type: stepType,
        action_type: undefined,
        label: undefined,
        configuration: {},
        position_x: lastNode ? lastNode.position_x : 400,
        position_y: lastNode ? lastNode.position_y + NODE_HEIGHT + NODE_GAP : 80,
        sort_order: nodes.length,
        parent_step_id: lastNode?.id || null,
        condition_branch: null,
      };
      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [nodes]
  );

  // Delete node
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const filtered = prev.filter((n) => n.id !== nodeId);
        // Re-link children
        return filtered.map((n) => ({
          ...n,
          parent_step_id: n.parent_step_id === nodeId ? null : n.parent_step_id,
        }));
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [selectedNodeId]
  );

  // Update node
  const updateNode = useCallback((nodeId: string, updates: Partial<FlowNodeData>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
    );
  }, []);

  // Mouse handlers for panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === "svg") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (dragNodeId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      updateNode(dragNodeId, { position_x: Math.round(x), position_y: Math.round(y) });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDragNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: FlowNodeData) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    setDragNodeId(node.id);
    setDragOffset({ x: mouseX - node.position_x, y: mouseY - node.position_y });
  };

  // Build connections
  const connections = nodes
    .filter((n) => n.parent_step_id)
    .map((n) => {
      const parent = nodes.find((p) => p.id === n.parent_step_id);
      if (!parent) return null;
      return {
        fromX: parent.position_x + NODE_WIDTH / 2,
        fromY: parent.position_y + NODE_HEIGHT,
        toX: n.position_x + NODE_WIDTH / 2,
        toY: n.position_y,
        label: n.condition_branch === "true" ? "כן" : n.condition_branch === "false" ? "לא" : undefined,
      };
    })
    .filter(Boolean);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("automations"))}>
          <ArrowRight className="h-5 w-5" />
        </Button>

        <Input
          value={automationName}
          onChange={(e) => setAutomationName(e.target.value)}
          className="max-w-xs text-right font-semibold"
          placeholder="שם האוטומציה"
        />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">פעיל</span>
          <Switch checked={automationActive} onCheckedChange={setAutomationActive} />
        </div>

        <div className="flex-1" />

        {/* Manual trigger button - show only when trigger is manual_command */}
        {nodes.find(n => n.step_type === "trigger" && n.action_type === "manual_command") && (
          <Button variant="outline" onClick={() => setShowManualTrigger(true)}>
            <MessageSquare className="h-4 w-4 ml-2" />
            הפעל ידנית
          </Button>
        )}

        <Button variant="outline" onClick={() => setShowTestWithLead(true)}>
          <TestTube className="h-4 w-4 ml-2" />
          בדוק עם ליד
        </Button>

        <Button variant="outline" onClick={() => setShowHistory(true)}>
          <History className="h-4 w-4 ml-2" />
          היסטוריה
        </Button>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 ml-2" />
          {saveMutation.isPending ? "שומר..." : "שמור"}
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden bg-muted/30 relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Dot grid pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
          <defs>
            <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="hsl(var(--foreground))" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
          className="absolute inset-0"
        >
          {/* SVG connectors */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
            {connections.map((conn, i) =>
              conn ? (
                <FlowConnector
                  key={i}
                  fromX={conn.fromX}
                  fromY={conn.fromY}
                  toX={conn.toX}
                  toY={conn.toY}
                  label={conn.label}
                />
              ) : null
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute"
              style={{ left: node.position_x, top: node.position_y }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
            >
              <FlowNode
                node={node}
                isSelected={selectedNodeId === node.id}
                onClick={() => setSelectedNodeId(node.id)}
                onDelete={() => deleteNode(node.id)}
                isDragging={dragNodeId === node.id}
              />
            </div>
          ))}

          {/* Add step button after last node */}
          {nodes.length > 0 && (
            <div
              className="absolute flex justify-center"
              style={{
                left: nodes[nodes.length - 1].position_x + NODE_WIDTH / 2 - 16,
                top: nodes[nodes.length - 1].position_y + NODE_HEIGHT + 20,
              }}
            >
              <AddStepMenu onAdd={addStep} />
            </div>
          )}
        </div>
      </div>

      {/* Step config panel */}
      <StepConfigPanel
        node={selectedNode}
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onUpdate={updateNode}
        allNodes={nodes}
      />

      {/* Manual trigger dialog */}
      <ManualTriggerDialog
        open={showManualTrigger}
        onOpenChange={setShowManualTrigger}
        automationId={automationId || ""}
        automationName={automationName}
      />

      {/* Test with lead dialog */}
      <TestFlowWithLeadDialog
        open={showTestWithLead}
        onOpenChange={setShowTestWithLead}
        automationId={automationId || ""}
        automationName={automationName}
      />

      {/* Execution history panel */}
      <ExecutionHistoryPanel
        open={showHistory}
        onClose={() => setShowHistory(false)}
        automationId={automationId || ""}
      />
    </div>
  );
}
