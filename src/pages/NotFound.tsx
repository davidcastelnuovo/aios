import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { buildPath, isReady } = useTenantPath();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Try to determine best redirect path
  const getDashboardPath = () => {
    if (isReady) {
      return buildPath("dashboard");
    }
    return "/landing";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-6 max-w-md px-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">העמוד לא נמצא</h2>
        <p className="text-muted-foreground">
          הדף שחיפשת אינו קיים או שהוסר
        </p>
        <div className="pt-4">
          <Button asChild size="lg">
            <a href={getDashboardPath()}>
              <Home className="ml-2 h-4 w-4" />
              חזרה לדשבורד
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          נתיב: {location.pathname}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
