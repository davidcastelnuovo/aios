import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/javascript",
  "Cache-Control": "public, max-age=3600",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");

  if (!trackingId) {
    return new Response("// Invalid tracking ID", { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Validate tracking ID exists
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: config } = await supabase
    .from("site_tracking_configs")
    .select("id, is_active, settings")
    .eq("tracking_id", trackingId)
    .single();

  if (!config || !config.is_active) {
    return new Response("// Tracking disabled or invalid", { 
      status: 404, 
      headers: corsHeaders 
    });
  }

  const settings = config.settings || {};
  const trackEndpoint = `${supabaseUrl}/functions/v1/analytics-track`;
  const identifyEndpoint = `${supabaseUrl}/functions/v1/analytics-identify`;

  // Generate the tracking script
  const script = `
(function(window, document) {
  'use strict';
  
  var MC = window.MCAnalytics = window.MCAnalytics || {};
  
  // Configuration
  var CONFIG = {
    trackingId: '${trackingId}',
    trackEndpoint: '${trackEndpoint}',
    identifyEndpoint: '${identifyEndpoint}',
    heartbeatInterval: 30000,
    settings: ${JSON.stringify(settings)}
  };
  
  // State
  var state = {
    sessionId: null,
    visitorId: null,
    fingerprint: null,
    currentPage: null,
    pageStartTime: null,
    maxScrollDepth: 0,
    initialized: false
  };
  
  // Generate visitor fingerprint
  function generateFingerprint() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('MC Analytics', 0, 0);
    var canvasData = canvas.toDataURL();
    
    var data = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvasData.substring(0, 100)
    ].join('|');
    
    // Simple hash
    var hash = 0;
    for (var i = 0; i < data.length; i++) {
      var char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    // Combine with stored ID for returning visitors
    var storedId = localStorage.getItem('mc_vid');
    if (!storedId) {
      storedId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('mc_vid', storedId);
    }
    
    return storedId + '_' + Math.abs(hash).toString(36);
  }
  
  // Get UTM parameters
  function getUTMParams() {
    var params = {};
    var search = window.location.search.substring(1);
    var pairs = search.split('&');
    
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      var key = decodeURIComponent(pair[0]);
      if (key.indexOf('utm_') === 0) {
        params[key] = decodeURIComponent(pair[1] || '');
      }
    }
    
    // Store UTM for session
    if (Object.keys(params).length > 0) {
      sessionStorage.setItem('mc_utm', JSON.stringify(params));
    } else {
      var stored = sessionStorage.getItem('mc_utm');
      if (stored) {
        try { params = JSON.parse(stored); } catch(e) {}
      }
    }
    
    return params;
  }
  
  // Get device info
  function getDeviceInfo() {
    var ua = navigator.userAgent;
    var mobile = /Mobile|Android|iPhone|iPad/.test(ua);
    var tablet = /iPad|Android(?!.*Mobile)/.test(ua);
    
    var browser = 'Unknown';
    if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';
    else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) browser = 'IE';
    
    var os = 'Unknown';
    if (ua.indexOf('Windows') > -1) os = 'Windows';
    else if (ua.indexOf('Mac') > -1) os = 'macOS';
    else if (ua.indexOf('Linux') > -1) os = 'Linux';
    else if (ua.indexOf('Android') > -1) os = 'Android';
    else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
    
    return {
      device_type: tablet ? 'tablet' : (mobile ? 'mobile' : 'desktop'),
      browser: browser,
      os: os,
      screen_resolution: screen.width + 'x' + screen.height
    };
  }
  
  // Send tracking data
  function track(eventType, data) {
    var payload = {
      tracking_id: CONFIG.trackingId,
      visitor_fingerprint: state.fingerprint,
      session_id: state.sessionId,
      event_type: eventType,
      data: data || {},
      timestamp: Date.now()
    };
    
    // Use sendBeacon for better reliability
    if (navigator.sendBeacon && eventType === 'session_end') {
      navigator.sendBeacon(CONFIG.trackEndpoint, JSON.stringify(payload));
    } else {
      fetch(CONFIG.trackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function(res) {
        return res.json();
      }).then(function(result) {
        if (result.session_id && !state.sessionId) {
          state.sessionId = result.session_id;
        }
        if (result.visitor_id) {
          state.visitorId = result.visitor_id;
        }
      }).catch(function(err) {
        console.debug('MC Analytics error:', err);
      });
    }
  }
  
  // Track page view
  function trackPageView() {
    var now = Date.now();
    var timeOnPrevPage = state.pageStartTime ? Math.floor((now - state.pageStartTime) / 1000) : 0;
    
    var utm = getUTMParams();
    var device = getDeviceInfo();
    
    var data = Object.assign({}, utm, device, {
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer,
      landing_page: state.currentPage ? undefined : window.location.href,
      time_on_page: timeOnPrevPage,
      scroll_depth: state.maxScrollDepth
    });
    
    // Reset for new page
    state.currentPage = window.location.href;
    state.pageStartTime = now;
    state.maxScrollDepth = 0;
    
    track(state.sessionId ? 'pageview' : 'session_start', data);
  }
  
  // Track scroll depth
  function trackScroll() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    var winHeight = window.innerHeight;
    var scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
    
    if (scrollPercent > state.maxScrollDepth) {
      state.maxScrollDepth = Math.min(scrollPercent, 100);
    }
  }
  
  // Track clicks
  function trackClick(e) {
    var target = e.target;
    var data = {
      event_name: 'click',
      event_category: target.tagName.toLowerCase(),
      event_label: target.innerText ? target.innerText.substring(0, 100) : '',
      event_data: {
        id: target.id,
        className: target.className,
        href: target.href || null
      },
      page_url: window.location.href
    };
    
    // Check for specific elements
    if (target.tagName === 'A' && target.href) {
      var isExternal = target.hostname !== window.location.hostname;
      if (isExternal && CONFIG.settings.track_outbound) {
        data.event_name = 'outbound_click';
        data.event_data.destination = target.href;
      }
    }
    
    if (target.tagName === 'BUTTON' || target.type === 'submit') {
      data.event_name = 'button_click';
    }
    
    track('event', data);
  }
  
  // Track form submissions
  function trackFormSubmit(e) {
    var form = e.target;
    var data = {
      event_name: 'form_submit',
      event_category: 'form',
      event_label: form.id || form.name || 'unnamed_form',
      event_data: {
        id: form.id,
        action: form.action,
        method: form.method
      },
      page_url: window.location.href
    };
    
    track('event', data);
    
    // Try to identify user from form
    var email = null;
    var phone = null;
    var name = null;
    
    var inputs = form.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var type = input.type.toLowerCase();
      var inputName = (input.name || '').toLowerCase();
      
      if (type === 'email' || inputName.indexOf('email') > -1) {
        email = input.value;
      }
      if (type === 'tel' || inputName.indexOf('phone') > -1 || inputName.indexOf('tel') > -1) {
        phone = input.value;
      }
      if (inputName.indexOf('name') > -1 && inputName.indexOf('email') === -1) {
        name = input.value;
      }
    }
    
    if (email || phone) {
      MC.identify({ email: email, phone: phone, name: name });
    }
  }
  
  // Heartbeat
  function startHeartbeat() {
    setInterval(function() {
      track('heartbeat', {
        scroll_depth: state.maxScrollDepth,
        page_url: window.location.href
      });
    }, CONFIG.heartbeatInterval);
  }
  
  // Handle page visibility/unload
  function handleUnload() {
    track('session_end', {
      page_url: window.location.href,
      time_on_page: state.pageStartTime ? Math.floor((Date.now() - state.pageStartTime) / 1000) : 0
    });
  }
  
  // Public API
  MC.track = function(eventName, eventData) {
    track('event', {
      event_name: eventName,
      event_category: 'custom',
      event_data: eventData,
      page_url: window.location.href
    });
  };
  
  MC.identify = function(userData) {
    fetch(CONFIG.identifyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_id: CONFIG.trackingId,
        visitor_fingerprint: state.fingerprint,
        email: userData.email,
        phone: userData.phone,
        name: userData.name
      })
    }).catch(function(err) {
      console.debug('MC identify error:', err);
    });
  };
  
  // Initialize
  function init() {
    if (state.initialized) return;
    state.initialized = true;
    
    state.fingerprint = generateFingerprint();
    
    // Track initial page view
    trackPageView();
    
    // Set up event listeners
    if (CONFIG.settings.track_scroll !== false) {
      var scrollTimeout;
      window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(trackScroll, 100);
      }, { passive: true });
    }
    
    if (CONFIG.settings.track_clicks !== false) {
      document.addEventListener('click', trackClick);
    }
    
    if (CONFIG.settings.track_forms !== false) {
      document.addEventListener('submit', trackFormSubmit);
    }
    
    // SPA support - track route changes
    var originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(trackPageView, 0);
    };
    
    window.addEventListener('popstate', function() {
      setTimeout(trackPageView, 0);
    });
    
    // Heartbeat
    startHeartbeat();
    
    // Handle page unload
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      }
    });
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})(window, document);
`;

  return new Response(script, { headers: corsHeaders });
});
