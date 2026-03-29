import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostsList } from "@/components/social-media/PostsList";
import { ChannelManager } from "@/components/social-media/ChannelManager";
import { WordPressSettings } from "@/components/social-media/WordPressSettings";
import { ScheduleCalendar } from "@/components/social-media/ScheduleCalendar";
import { Share2, ListChecks, Calendar, Settings, Globe } from "lucide-react";

export default function SocialMediaScheduler() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Share2 className="h-8 w-8" />
          ניהול סושיאל מדיה
        </h1>
        <p className="text-muted-foreground mt-1">
          פוסטים שנוצרו על ידי סוכני AI - צפה, נהל ופרסם במקום אחד
        </p>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
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
