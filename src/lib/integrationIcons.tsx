import { Facebook, ShoppingCart, FileSpreadsheet, Search, Phone, Zap } from "lucide-react";

/**
 * Shared icon renderer for crm_tables.integration_type.
 * Keep visually consistent across ClientTablesTab, SharedTable, SharedDashboard, DashboardView.
 */
export function getIntegrationIcon(type: string | null | undefined, className = "h-4 w-4 shrink-0") {
  switch (type) {
    case "facebook_insights":
    case "facebook":
    case "facebook_lead_ads":
      return <Facebook className={`${className} text-blue-600`} />;
    case "facebook_ecommerce":
      return <ShoppingCart className={`${className} text-green-600`} />;
    case "google_ads":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04"/>
          <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4"/>
          <circle cx="6" cy="18" r="3.5" fill="#34A853"/>
        </svg>
      );
    case "google_ads_via_make":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04"/>
          <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4"/>
          <circle cx="6" cy="18" r="3.5" fill="#34A853"/>
        </svg>
      );
    case "google_analytics":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M20.5 18.5v-13c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#F9AB00"/>
          <path d="M13.5 18.5v-7c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#E37400"/>
          <circle cx="5" cy="18.5" r="2.5" fill="#E37400"/>
        </svg>
      );
    case "google_search_console":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
        </svg>
      );
    case "ahrefs":
      return (
        <div
          className={`${className} rounded-sm flex items-center justify-center text-[10px] font-bold text-white`}
          style={{ backgroundColor: "#0072F4" }}
        >
          A
        </div>
      );
    case "make_api":
      return <Zap className={`${className} text-purple-600`} />;
    case "maskyoo":
      return <Phone className={`${className} text-emerald-600`} />;
    default:
      return <FileSpreadsheet className={className} />;
  }
}
