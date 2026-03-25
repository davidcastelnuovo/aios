import { Component, ErrorInfo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  tenantId?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-error`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            source: "frontend",
            error_message: error.message,
            error_stack: error.stack,
            context: {
              componentStack: info.componentStack?.slice(0, 1000),
              url: window.location.href,
            },
            url: window.location.href,
            tenant_id: this.props.tenantId,
          }),
        }
      );
    } catch (reportErr) {
      console.error("Failed to report error:", reportErr);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center" dir="rtl">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold">משהו השתבש</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            השגיאה דווחה אוטומטית. אנחנו על זה.
          </p>
          <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90"
          >
            טען מחדש
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
