import { Component, type ReactNode } from "react";
import { WorkspaceCanvas } from "@/visual-workspace/components/WorkspaceCanvas";
import { AlertTriangle } from "lucide-react";

class WorkspaceErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error("[VisualWorkspace]", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8" dir="rtl">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
          <h2 className="text-lg font-bold">שגיאה בטעינת המרחב הוויזואלי</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md">
            המודול נטען בנפרד ולא ישפיע על שאר המערכת. נסה לרענן או חזור לדשבורד הרגיל.
          </p>
          <p className="text-xs text-slate-400 mt-3 font-mono">{String(this.state.error?.message || "")}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function VisualWorkspace() {
  return (
    <WorkspaceErrorBoundary>
      <WorkspaceCanvas />
    </WorkspaceErrorBoundary>
  );
}
