import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme, ColorPalette } from "@/contexts/ThemeContext";
import { Palette, Check, Sparkles, Zap, Flame, Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const colorPalettes = [
  {
    id: 'default' as ColorPalette,
    name: 'ברירת מחדל',
    description: 'פלטת הצבעים הסטנדרטית של המערכת',
    icon: Palette,
    preview: 'bg-gradient-to-br from-gray-700 to-gray-900',
    colors: ['bg-gray-700', 'bg-gray-800', 'bg-gray-900'],
  },
  {
    id: 'green-gradient' as ColorPalette,
    name: 'גרדיינט ירוק',
    description: 'מראה יוקרתי עם גרדיינט ירוק-טורקיז',
    icon: Sparkles,
    preview: 'bg-gradient-to-br from-[#36d399] to-[#3abff8]',
    colors: ['bg-[#36d399]', 'bg-[#3abff8]', 'bg-[#2dd4bf]'],
    featured: true,
  },
  {
    id: 'blue' as ColorPalette,
    name: 'כחול מודרני',
    description: 'כחול עז ומרענן למראה מקצועי',
    icon: Zap,
    preview: 'bg-gradient-to-br from-blue-500 to-purple-600',
    colors: ['bg-blue-500', 'bg-indigo-600', 'bg-purple-600'],
  },
  {
    id: 'purple' as ColorPalette,
    name: 'סגול יצירתי',
    description: 'סגול עשיר למראה יצירתי וייחודי',
    icon: Sparkles,
    preview: 'bg-gradient-to-br from-purple-500 to-pink-600',
    colors: ['bg-purple-500', 'bg-fuchsia-600', 'bg-pink-600'],
  },
  {
    id: 'orange' as ColorPalette,
    name: 'כתום אנרגטי',
    description: 'כתום חם ואנרגטי למראה דינמי',
    icon: Flame,
    preview: 'bg-gradient-to-br from-orange-500 to-amber-600',
    colors: ['bg-orange-500', 'bg-orange-600', 'bg-amber-600'],
  },
];

export default function Branding() {
  const { palette, setPalette, logoUrl, setLogoUrl } = useTheme();
  const { currentTenantId } = useTenant();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handlePaletteChange = async (newPalette: ColorPalette) => {
    await setPalette(newPalette);
    toast({
      title: "פלטת הצבעים עודכנה",
      description: "השינויים יוחלו על כל המערכת",
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentTenantId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "שגיאה",
        description: "יש להעלות קובץ תמונה בלבד",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "שגיאה",
        description: "גודל הקובץ חייב להיות עד 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('tenant-logos')
            .remove([`${currentTenantId}/${oldPath}`]);
        }
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentTenantId}/logo.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('tenant-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(filePath);

      await setLogoUrl(publicUrl);

      toast({
        title: "הלוגו הועלה בהצלחה",
        description: "הלוגו שלך עודכן במערכת",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "שגיאה בהעלאת לוגו",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentTenantId || !logoUrl) return;

    try {
      const oldPath = logoUrl.split('/').pop();
      if (oldPath) {
        await supabase.storage
          .from('tenant-logos')
          .remove([`${currentTenantId}/${oldPath}`]);
      }

      await setLogoUrl(null);

      toast({
        title: "הלוגו הוסר",
        description: "הלוגו נמחק מהמערכת",
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: "שגיאה במחיקת לוגו",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">התאמת מערכת</h1>
        <p className="text-muted-foreground text-lg">
          התאם את מראה המערכת לסגנון המותג שלך
        </p>
      </div>

      {/* Logo Upload Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">לוגו הארגון</h2>
            <p className="text-muted-foreground">העלה את הלוגו של הארגון שלך</p>
          </div>
        </div>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {logoUrl ? (
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 border-2 rounded-lg overflow-hidden bg-white flex items-center justify-center p-2">
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">הלוגו הנוכחי</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        החלף לוגו
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLogo}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4 mr-2" />
                        הסר לוגו
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">העלה לוגו</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    PNG, JPG, SVG עד 2MB
                  </p>
                  <Button
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? 'מעלה...' : 'בחר קובץ'}
                  </Button>
                </div>
              )}
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color Palettes Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <Palette className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">פלטות צבעים</h2>
            <p className="text-muted-foreground">בחר את פלטת הצבעים המועדפת עליך</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colorPalettes.map((paletteOption) => {
            const isSelected = palette === paletteOption.id;
            const Icon = paletteOption.icon;

            return (
              <Card
                key={paletteOption.id}
                className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  isSelected ? 'border-primary border-2 shadow-lg' : 'border-2'
                }`}
                onClick={() => handlePaletteChange(paletteOption.id)}
              >
                <CardHeader>
                  {/* Preview */}
                  <div className={`relative h-32 rounded-lg ${paletteOption.preview} overflow-hidden mb-4`}>
                    {paletteOption.featured && (
                      <Badge className="absolute top-2 right-2 bg-white/90 text-primary">
                        <Sparkles className="h-3 w-3 mr-1" />
                        מומלץ
                      </Badge>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                          <Check className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    )}
                    {/* Color Swatches */}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      {paletteOption.colors.map((color, idx) => (
                        <div
                          key={idx}
                          className={`w-6 h-6 rounded-full ${color} border-2 border-white shadow-md`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? 'gradient-primary' : 'bg-muted'
                    }`}>
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{paletteOption.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {paletteOption.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePaletteChange(paletteOption.id);
                    }}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        נבחר
                      </>
                    ) : (
                      'בחר פלטה זו'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Preview Section */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>תצוגה מקדימה</CardTitle>
          <CardDescription>
            ראה איך הפלטה שבחרת נראית על אלמנטים שונים
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Buttons */}
          <div className="space-y-3">
            <h3 className="font-semibold">כפתורים</h3>
            <div className="flex flex-wrap gap-3">
              <Button>כפתור ראשי</Button>
              <Button variant="secondary">כפתור משני</Button>
              <Button variant="outline">כפתור מסגרת</Button>
              <Button variant="ghost">כפתור שקוף</Button>
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-3">
            <h3 className="font-semibold">תגיות</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>תגית רגילה</Badge>
              <Badge variant="secondary">תגית משנית</Badge>
              <Badge variant="outline">תגית מסגרת</Badge>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            <h3 className="font-semibold">כרטיסים</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>כרטיס לדוגמה</CardTitle>
                  <CardDescription>תיאור הכרטיס</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    זהו כרטיס לדוגמה עם הפלטה החדשה
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    כרטיס מודגש
                  </CardTitle>
                  <CardDescription>עם גרדיינט ואייקון</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
