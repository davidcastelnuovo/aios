import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostComposer } from "@/components/social-media/PostComposer";
import { PostsList } from "@/components/social-media/PostsList";
import { ChannelManager } from "@/components/social-media/ChannelManager";
import { WordPressSettings } from "@/components/social-media/WordPressSettings";
import { ScheduleCalendar } from "@/components/social-media/ScheduleCalendar";
import { Share2, PenSquare, ListChecks, Calendar, Settings, Globe } from "lucide-react";

export default function SocialMediaScheduler() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Share2 className="h-8 w-8" />
          מתזמן מדיה חברתית
        </h1>
        <p className="text-muted-foreground mt-1">
          צור, תזמן ופרסם פוסטים בפייסבוק, אינסטגרם, לינקדאין, יוטיוב ווורדפרס במקום אחד
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <PenSquare className="h-4 w-4" />
            <span className="hidden sm:inline">יצירה</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">פוסטים</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">לוח שנה</span>
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">ערוצים</span>
          </TabsTrigger>
          <TabsTrigger value="wordpress" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">וורדפרס</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <PostComposer />
        </TabsContent>

        <TabsContent value="posts">
          <PostsList />
        </TabsContent>

        <TabsContent value="calendar">
          <ScheduleCalendar />
        </TabsContent>

        <TabsContent value="channels">
          <ChannelManager />
        </TabsContent>

        <TabsContent value="wordpress">
          <WordPressSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
