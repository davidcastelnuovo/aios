import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import JsonLeadBuilder from "@/components/forms/JsonLeadBuilder";

export default function LeadIntegrations() {
  const { toast } = useToast();
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = `${projectUrl}/functions/v1/webhook-lead-intake`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "הועתק ללוח",
      description: "כתובת ה-Webhook הועתקה בהצלחה",
    });
  };

  const examplePayloadBasic = `{
  "company_name": "שם החברה",
  "contact_name": "שם איש הקשר",
  "email": "email@example.com",
  "phone": "050-1234567",
  "source": "website"
}`;

  const examplePayloadFull = `{
  "company_name": "שם החברה",
  "contact_name": "שם איש הקשר",
  "email": "email@example.com",
  "phone": "050-1234567",
  "source": "website",
  "notes": "הערות נוספות",
  "monthly_budget": 5000,
  "three_month_budget": 15000,
  "products": "קמפיין פייסבוק, גוגל",
  "industry": "טכנולוגיה",
  "agency_id": "uuid-של-סוכנות (אופציונלי)"
}`;

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '${examplePayloadBasic.replace(/\n/g, '')}'`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">אינטגרציות לקליטת לידים</h1>
          <p className="text-muted-foreground mt-2">
            חבר את טפסי הצור קשר שלך, Make או Zapier לקליטת לידים אוטומטית
          </p>
        </div>
      </div>

      <Alert>
        <Webhook className="h-4 w-4" />
        <AlertTitle>Webhook URL שלך</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="relative rounded bg-muted px-3 py-2 font-mono text-sm flex-1 min-w-[300px]">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(webhookUrl)}
            >
              <Copy className="h-4 w-4 ml-2" />
              העתק
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="builder">בונה JSON</TabsTrigger>
          <TabsTrigger value="instructions">הוראות שימוש</TabsTrigger>
          <TabsTrigger value="make">Make</TabsTrigger>
          <TabsTrigger value="zapier">Zapier</TabsTrigger>
          <TabsTrigger value="website">טפסי אתר</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">
          <JsonLeadBuilder />
        </TabsContent>

        <TabsContent value="instructions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>איך זה עובד?</CardTitle>
              <CardDescription>
                Webhook זה מאפשר לך לשלוח לידים מכל מקור חיצוני ישירות למערכת
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">שדות נדרשים:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><code className="bg-muted px-1 py-0.5 rounded">company_name</code> - שם החברה (חובה)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">שדות אופציונליים:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><code className="bg-muted px-1 py-0.5 rounded">contact_name</code> - שם איש קשר</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">email</code> - כתובת אימייל</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">phone</code> - מספר טלפון</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">source</code> - מקור הליד (website/referral/linkedin/facebook/other)</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">notes</code> - הערות</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">monthly_budget</code> - תקציב חודשי</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">three_month_budget</code> - תקציב ל-3 חודשים</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">products</code> - מוצרים מעוניינים</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">industry</code> - תעשייה</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">agency_id</code> - ID של סוכנות ספציפית</li>
                </ul>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">דוגמת JSON בסיסית:</h3>
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded">
                  {examplePayloadBasic}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(examplePayloadBasic)}
                >
                  <Copy className="h-4 w-4 ml-2" />
                  העתק דוגמה
                </Button>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">דוגמת JSON מלאה:</h3>
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded">
                  {examplePayloadFull}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(examplePayloadFull)}
                >
                  <Copy className="h-4 w-4 ml-2" />
                  העתק דוגמה
                </Button>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">בדיקה עם cURL:</h3>
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded whitespace-pre-wrap break-all">
                  {curlExample}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(curlExample)}
                >
                  <Copy className="h-4 w-4 ml-2" />
                  העתק פקודה
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="make" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img src="https://www.make.com/favicon.ico" alt="Make" className="h-5 w-5" />
                אינטגרציה עם Make
              </CardTitle>
              <CardDescription>
                הגדר תסריט Make לשליחת לידים אוטומטית
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">שלבי ההגדרה:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>צור תסריט חדש ב-Make</li>
                  <li>הוסף Trigger לפי המקור שלך (טופס, אימייל, וכו')</li>
                  <li>הוסף מודול HTTP → Make a request</li>
                  <li>
                    הגדר את המודול:
                    <ul className="list-disc list-inside mr-6 mt-1 space-y-1">
                      <li><strong>URL:</strong> {webhookUrl}</li>
                      <li><strong>Method:</strong> POST</li>
                      <li><strong>Headers:</strong> Content-Type: application/json</li>
                      <li><strong>Body type:</strong> Raw</li>
                      <li><strong>Request content:</strong> JSON עם השדות הנדרשים</li>
                    </ul>
                  </li>
                  <li>מפה את השדות מה-Trigger ל-JSON</li>
                  <li>הפעל ובדוק</li>
                </ol>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>טיפ:</strong> אתה יכול להשתמש בשדה Data Structure ב-Make כדי להגדיר את מבנה ה-JSON בקלות
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zapier" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img src="https://zapier.com/favicon.ico" alt="Zapier" className="h-5 w-5" />
                אינטגרציה עם Zapier
              </CardTitle>
              <CardDescription>
                צור Zap לשליחת לידים אוטומטית
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">שלבי ההגדרה:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>צור Zap חדש ב-Zapier</li>
                  <li>בחר Trigger לפי המקור שלך (Typeform, Google Forms, וכו')</li>
                  <li>הוסף Action: Webhooks by Zapier → POST</li>
                  <li>
                    הגדר את ה-Webhook:
                    <ul className="list-disc list-inside mr-6 mt-1 space-y-1">
                      <li><strong>URL:</strong> {webhookUrl}</li>
                      <li><strong>Payload Type:</strong> JSON</li>
                      <li><strong>Data:</strong> מפה את השדות מה-Trigger</li>
                    </ul>
                  </li>
                  <li>לחץ על Test & Continue</li>
                  <li>הפעל את ה-Zap</li>
                </ol>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">דוגמת Data Mapping:</h3>
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded">
{`company_name: {{Company Name}}
contact_name: {{Full Name}}
email: {{Email Address}}
phone: {{Phone Number}}
source: website`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="website" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>אינטגרציה בטפסי אתר</CardTitle>
              <CardDescription>
                שלוף לידים ישירות מטופס הצור קשר באתר שלך
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">דוגמת קוד JavaScript:</h3>
                <pre className="text-xs overflow-x-auto bg-muted p-4 rounded-lg">
{`// בעת שליחה של טופס
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    company_name: document.getElementById('company').value,
    contact_name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    notes: document.getElementById('message').value,
    source: 'website'
  };

  try {
    const response = await fetch('${webhookUrl}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    
    if (result.success) {
      alert('תודה! ניצור איתך קשר בקרוב');
    } else {
      alert('שגיאה בשליחת הטופס');
    }
  } catch (error) {
    console.error('Error:', error);
  }
});`}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`// JavaScript example code...`)}
                >
                  <Copy className="h-4 w-4 ml-2" />
                  העתק קוד
                </Button>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>שים לב:</strong> וודא שה-webhook URL מוגדר בצד שרת או מוסתר מהמשתמש כדי למנוע שימוש לא מורשה
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>תגובת הצלחה</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-x-auto bg-muted p-4 rounded-lg">
{`{
  "success": true,
  "lead_id": "uuid-של-הליד-החדש",
  "message": "Lead created successfully"
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
