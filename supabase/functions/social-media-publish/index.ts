import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublishRequest {
  post_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { post_id }: PublishRequest = await req.json();

    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the post
    const { data: post, error: postError } = await supabase
      .from("social_media_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update post status to publishing
    await supabase
      .from("social_media_posts")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", post_id);

    // Fetch post channels with channel details
    const { data: postChannels } = await supabase
      .from("social_media_post_channels")
      .select("*, social_media_channels(*)")
      .eq("post_id", post_id);

    const results: { channel_id: string; success: boolean; error?: string; platform_post_id?: string }[] = [];

    // Publish to each social media channel
    if (postChannels && postChannels.length > 0) {
      for (const pc of postChannels) {
        const channel = (pc as any).social_media_channels;
        if (!channel) continue;

        try {
          await supabase
            .from("social_media_post_channels")
            .update({ status: "publishing" })
            .eq("id", pc.id);

          let platformPostId: string | null = null;

          switch (channel.platform) {
            case "facebook":
              platformPostId = await publishToFacebook(channel, post);
              break;
            case "instagram":
              platformPostId = await publishToInstagram(channel, post);
              break;
            case "linkedin":
              platformPostId = await publishToLinkedIn(channel, post);
              break;
            case "youtube":
              platformPostId = await publishToYouTube(channel, post);
              break;
          }

          await supabase
            .from("social_media_post_channels")
            .update({
              status: "published",
              platform_post_id: platformPostId,
              published_at: new Date().toISOString(),
            })
            .eq("id", pc.id);

          results.push({ channel_id: channel.id, success: true, platform_post_id: platformPostId || undefined });
        } catch (err: any) {
          console.error(`Error publishing to ${channel.platform}:`, err);
          await supabase
            .from("social_media_post_channels")
            .update({ status: "failed", error_message: err.message })
            .eq("id", pc.id);

          results.push({ channel_id: channel.id, success: false, error: err.message });
        }
      }
    }

    // Publish to WordPress if enabled
    let wpResult = null;
    if (post.publish_to_wordpress && post.wordpress_site_url) {
      try {
        wpResult = await publishToWordPress(supabase, post);
      } catch (err: any) {
        console.error("Error publishing to WordPress:", err);
        wpResult = { success: false, error: err.message };
      }
    }

    // Determine overall status
    const allSucceeded = results.every((r) => r.success) && (!wpResult || (wpResult as any).success !== false);
    const allFailed = results.every((r) => !r.success) && (!wpResult || (wpResult as any).success === false);

    const finalStatus = results.length === 0 && !wpResult
      ? "failed"
      : allFailed
      ? "failed"
      : "published";

    const errorMessages = results
      .filter((r) => !r.success)
      .map((r) => r.error)
      .join("; ");

    await supabase
      .from("social_media_posts")
      .update({
        status: finalStatus,
        published_at: finalStatus === "published" ? new Date().toISOString() : null,
        error_message: errorMessages || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post_id);

    return new Response(
      JSON.stringify({ success: true, results, wordpress: wpResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Publish error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---- Platform Publishers ----

async function publishToFacebook(channel: any, post: any): Promise<string | null> {
  if (!channel.access_token || !channel.channel_id) {
    throw new Error("Facebook: missing access_token or page_id");
  }

  const url = `https://graph.facebook.com/v19.0/${channel.channel_id}/feed`;
  const body: Record<string, string> = {
    message: post.content,
    access_token: channel.access_token,
  };

  // If there's an image, use /photos endpoint
  if (post.post_type === "image" && post.media_urls?.length > 0) {
    const photoUrl = `https://graph.facebook.com/v19.0/${channel.channel_id}/photos`;
    const photoBody = {
      url: post.media_urls[0],
      caption: post.content,
      access_token: channel.access_token,
    };
    const resp = await fetch(photoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(photoBody),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.id;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

async function publishToInstagram(channel: any, post: any): Promise<string | null> {
  if (!channel.access_token || !channel.channel_id) {
    throw new Error("Instagram: missing access_token or instagram_business_account_id");
  }

  // Instagram requires media - create a media container first
  if (!post.media_urls || post.media_urls.length === 0) {
    throw new Error("Instagram requires at least one image or video");
  }

  // Step 1: Create media container
  const containerUrl = `https://graph.facebook.com/v19.0/${channel.channel_id}/media`;
  const containerBody: Record<string, string> = {
    caption: post.content,
    access_token: channel.access_token,
  };

  if (post.post_type === "video" || post.post_type === "reel") {
    containerBody.media_type = post.post_type === "reel" ? "REELS" : "VIDEO";
    containerBody.video_url = post.media_urls[0];
  } else {
    containerBody.image_url = post.media_urls[0];
  }

  const containerResp = await fetch(containerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerBody),
  });
  const containerData = await containerResp.json();
  if (containerData.error) throw new Error(containerData.error.message);

  // Step 2: Publish the container
  const publishUrl = `https://graph.facebook.com/v19.0/${channel.channel_id}/media_publish`;
  const publishResp = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: channel.access_token,
    }),
  });
  const publishData = await publishResp.json();
  if (publishData.error) throw new Error(publishData.error.message);
  return publishData.id;
}

async function publishToLinkedIn(channel: any, post: any): Promise<string | null> {
  if (!channel.access_token) {
    throw new Error("LinkedIn: missing access_token");
  }

  const authorUrn = channel.channel_id || channel.metadata?.person_urn;
  if (!authorUrn) throw new Error("LinkedIn: missing author URN");

  const body: any = {
    author: authorUrn.startsWith("urn:") ? authorUrn : `urn:li:person:${authorUrn}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: post.content,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  // Add media if present
  if (post.media_urls && post.media_urls.length > 0) {
    body.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "ARTICLE";
    body.specificContent["com.linkedin.ugc.ShareContent"].media = [
      {
        status: "READY",
        originalUrl: post.media_urls[0],
        title: { text: post.title || "" },
      },
    ];
  }

  const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channel.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.message || `LinkedIn API error: ${resp.status}`);
  }

  const postId = resp.headers.get("x-restli-id");
  return postId;
}

async function publishToYouTube(channel: any, post: any): Promise<string | null> {
  if (!channel.access_token) {
    throw new Error("YouTube: missing access_token");
  }

  if (!post.media_urls || post.media_urls.length === 0 || post.post_type !== "video") {
    throw new Error("YouTube requires a video URL");
  }

  // YouTube upload requires fetching the video and uploading via resumable upload
  // For simplicity, we use the metadata-only insert and expect the video to be
  // uploaded via the client or a separate flow
  const metadata = {
    snippet: {
      title: post.title || post.content.slice(0, 100),
      description: post.content,
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "public",
    },
  };

  const resp = await fetch(
    "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channel.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `YouTube API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.id;
}

// ---- WordPress Publisher ----

async function publishToWordPress(supabase: any, post: any) {
  // Fetch WordPress site config
  const { data: wpSite } = await supabase
    .from("social_media_wordpress_sites")
    .select("*")
    .eq("tenant_id", post.tenant_id)
    .eq("site_url", post.wordpress_site_url)
    .eq("is_active", true)
    .single();

  if (!wpSite) {
    throw new Error("WordPress site not found or inactive");
  }

  const wpApiUrl = `${wpSite.site_url}/wp-json/wp/v2/posts`;
  const credentials = btoa(`${wpSite.username}:${wpSite.app_password}`);

  const wpBody: Record<string, any> = {
    title: post.title || "",
    content: post.content,
    status: "publish",
  };

  const resp = await fetch(wpApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(wpBody),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.message || `WordPress API error: ${resp.status}`);
  }

  const wpPost = await resp.json();

  // Update the post with WordPress post ID
  await supabase
    .from("social_media_posts")
    .update({ wordpress_post_id: String(wpPost.id) })
    .eq("id", post.id);

  return { success: true, wordpress_post_id: wpPost.id, link: wpPost.link };
}
