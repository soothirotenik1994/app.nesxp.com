import express from "express";
import path from "path";
import fs from "fs";
import axios from "axios";
import cors from "cors";
import puppeteer from "puppeteer";
import * as ntp from "ntp-client";
import 'dotenv/config';

async function startServer() {
  console.log('Backend: startServer() called');
  
  // Set global timezone to Bangkok
  process.env.TZ = 'Asia/Bangkok';
  console.log('Backend: Timezone set to:', process.env.TZ);
  
  // NTP Time Synchronization (Using NIMT Thailand: time1.nimt.or.th)
  let timeOffset = 0; // ms
  const syncTimeWithNTP = () => {
    return new Promise<void>((resolve) => {
      const ntpServer = "time1.nimt.or.th";
      console.log(`Backend: Syncing time with NTP (${ntpServer})...`);
      ntp.getNetworkTime(ntpServer, 123, (err, date) => {
        if (err) {
          console.error(`Backend: NTP Sync failed with ${ntpServer}:`, err.message);
          // Try pool.ntp.org as a secondary NTP fallback
          ntp.getNetworkTime("pool.ntp.org", 123, (err2, date2) => {
            if (err2) {
              // Final fallback to HTTP time
              axios.get('https://worldtimeapi.org/api/timezone/Asia/Bangkok', { timeout: 5000 })
                .then(res => {
                  const netTime = new Date(res.data.datetime);
                  timeOffset = netTime.getTime() - Date.now();
                  console.log(`Backend: Time synced via HTTP (Bangkok). Offset: ${timeOffset}ms`);
                  resolve();
                })
                .catch(() => {
                  console.warn('Backend: Using system time as final fallback.');
                  resolve();
                });
            } else {
              timeOffset = date2.getTime() - Date.now();
              console.log(`Backend: NTP Sync success via fallback. Offset: ${timeOffset}ms`);
              resolve();
            }
          });
          return;
        }
        
        timeOffset = date.getTime() - Date.now();
        console.log(`Backend: NTP Sync success (NIMT). Offset: ${timeOffset}ms. Network Time: ${date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
        resolve();
      });
    });
  };

  // Helper to get adjusted date
  const getSyncedDate = () => {
    return new Date(Date.now() + timeOffset);
  };

  // Initial sync
  await syncTimeWithNTP();
  // Resync every hour
  setInterval(syncTimeWithNTP, 60 * 60 * 1000);

  const app = express();
  const PORT = 3000;

  // Verify environment variables
  console.log('Backend: Starting server...');
  
  const getStaticToken = () => {
    const badTokens = [
      '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0',
      'JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn',
      'KC7bsoqj_bmFeKWJCDGadyxXZsleRUi4',
      'null',
      'undefined'
    ];
    
    const fallbackToken = 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';
    
    // Prefer DIRECTUS_STATIC_TOKEN, then VITE_DIRECTUS_STATIC_TOKEN
    let token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.VITE_DIRECTUS_STATIC_TOKEN || '').trim();
    
    // If environment token is bad or missing, use the hardcoded fallback
    if (!token || badTokens.includes(token) || token.length < 20 || token === 'null' || token === 'undefined') {
      token = fallbackToken;
    }
    
    return token;
  };

  const finalToken = getStaticToken();
  
  console.log('Backend: Directus URL:', process.env.VITE_DIRECTUS_URL || process.env.DIRECTUS_URL || 'https://data.nesxp.com');
  console.log('Backend: Static Token Prefix:', finalToken.substring(0, 5) + '...');

  const getDirectusUrl = () => {
    return (process.env.VITE_DIRECTUS_URL || process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, '');
  };

  const getLineSettingsFromDirectus = async () => {
    const staticToken = getStaticToken();
    const fallbackToken = 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';
    const directusUrl = getDirectusUrl();
    const url = `${directusUrl}/items/line_settings`;
    
    try {
      console.log(`Backend: Fetching LINE settings from: ${url} using token: ${staticToken.substring(0, 5)}...`);
      
      let response;
      try {
        response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${staticToken}`
          },
          timeout: 5000
        });
      } catch (error: any) {
        if (error.response?.status === 401 && staticToken !== fallbackToken) {
          console.warn('Backend: LINE settings primary token failed (401). Retrying with fallback...');
          response = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${fallbackToken}`
            },
            timeout: 5000
          });
        } else {
          throw error;
        }
      }
      
      // Return the first setting found
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error: any) {
      console.error('Backend: Failed to fetch LINE settings from Directus:', error.message);
      if (error.response) {
        console.error('Backend: Directus error response:', error.response.status, error.response.data);
      }
      return null;
    }
  };

  const getSystemSettingsFromDirectus = async () => {
    try {
      const staticToken = getStaticToken();
      const directusUrl = getDirectusUrl();
      const url = `${directusUrl}/items/system_settings`;
      
      console.log(`Backend: Fetching system settings from: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${staticToken}`
        },
        timeout: 5000
      });
      
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error: any) {
      console.error('Backend: Failed to fetch system settings from Directus:', error.message);
      return null;
    }
  };

  const checkScheduledNotifications = async () => {
    try {
      const staticToken = getStaticToken();
      const directusUrl = (process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, '');
      const settings = await getLineSettingsFromDirectus();
      const accessToken = settings?.channel_access_token;

      if (!accessToken) return;

      // Fetch pending and accepted reports
      console.log(`Backend: Checking scheduled notifications from: ${directusUrl}/items/work_reports`);
      const response = await axios.get(`${directusUrl}/items/work_reports`, {
        params: {
          filter: {
            status: { _in: ['pending', 'accepted'] }
          },
          fields: '*,member_id.*'
        },
        headers: { 'Authorization': `Bearer ${staticToken}` }
      });

      const reports = response.data.data;
      if (!reports || !Array.isArray(reports)) {
        console.log('Backend: No pending reports found for scheduled notifications');
        return;
      }

      console.log(`Backend: Found ${reports.length} pending reports to check`);

      const now = getSyncedDate();

      for (const report of reports) {
        if (!report.work_date || !report.member_id) continue;

        const workDate = new Date(report.work_date);
        const diffMs = workDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        let notificationType = null;
        let updateData: any = {};

        const statusLogs = report.status_logs || [];
        const has24h = statusLogs.some((log: any) => log.status === 'notification_24h_sent');
        const has12h = statusLogs.some((log: any) => log.status === 'notification_12h_sent');

        // Send 24h notification only if enabled for this report
        if (diffHours <= 24 && diffHours > 12 && !has24h && report.notify_driver_24h_before) {
          notificationType = '24h';
          updateData.status_logs = [...statusLogs, { status: 'notification_24h_sent', timestamp: getSyncedDate().toISOString() }];
        } else if (diffHours <= 12 && diffHours > 0 && !has12h) {
          notificationType = '12h';
          updateData.status_logs = [...statusLogs, { status: 'notification_12h_sent', timestamp: getSyncedDate().toISOString() }];
        }

        if (notificationType) {
          // Resolve LINE User ID (could be string or object)
          let lineUserId = null;
          const member = report.member_id;
          if (member) {
            if (typeof member.line_user_id === 'string') {
              lineUserId = member.line_user_id;
            } else if (typeof member.line_user_id === 'object' && member.line_user_id !== null) {
              lineUserId = member.line_user_id.line_user_id || member.line_user_id.id;
            }
          }

          if (lineUserId) {
            console.log(`Backend: Sending ${notificationType} notification to LINE User: ${lineUserId}`);
            const message = notificationType === '24h' 
              ? `🔔 แจ้งเตือน: งานใหม่ของคุณจะเริ่มในอีก 24 ชั่วโมง\nเคส: ${report.case_number}\nลูกค้า: ${report.customer_name}\nต้นทาง: ${report.origin}\nปลายทาง: ${report.destination}`
              : `🔔 แจ้งเตือน: งานใหม่ของคุณจะเริ่มในอีก 12 ชั่วโมง\nเคส: ${report.case_number}\nลูกค้า: ${report.customer_name}\nต้นทาง: ${report.origin}\nปลายทาง: ${report.destination}`;

            try {
              await axios.post("https://api.line.me/v2/bot/message/push", {
                to: lineUserId,
                messages: [{ type: 'text', text: message }]
              }, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
              });

              // Update report in Directus
              await axios.patch(`${directusUrl}/items/work_reports/${report.id}`, updateData, {
                headers: { 'Authorization': `Bearer ${staticToken}` }
              });
              console.log(`Scheduled ${notificationType} notification sent for report ${report.id}`);
            } catch (err: any) {
              console.error(`Failed to send scheduled notification for report ${report.id}:`, err.message);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error checking scheduled notifications:', error.message);
      if (error.response) {
        console.error('Directus error response:', error.response.status, error.response.data);
      }
    }
  };

  // Run every 5 minutes
  setInterval(checkScheduledNotifications, 5 * 60 * 1000);

  app.use(cors());
  app.use(express.json());

  // LINE Config Check - Move higher up
  app.get("/api/line/config", async (req, res) => {
    console.log('Backend: /api/line/config requested');
    try {
      const settings = await getLineSettingsFromDirectus();
      
      // Use redirect_uri from Directus, or LINE_REDIRECT_URI from env, or APP_URL from env, or fallback
      let redirectUri = settings?.redirect_uri || process.env.LINE_REDIRECT_URI || process.env.VITE_LINE_REDIRECT_URI;
      
      console.log('Backend: Initial redirectUri:', redirectUri);
      console.log('Backend: APP_URL:', process.env.APP_URL);

      if (!redirectUri) {
        if (process.env.APP_URL) {
          redirectUri = `${process.env.APP_URL.replace(/\/$/, '')}/line/callback`;
        } else {
          // Fallback to current host if possible
          const host = req.get('host');
          const protocol = req.protocol;
          if (host) {
            redirectUri = `${protocol}://${host}/line/callback`;
          } else {
            redirectUri = "https://app.nesxp.com/line/callback";
          }
        }
      }
      
      console.log('Backend: Final redirectUri:', redirectUri);

      const channelId = settings?.channel_id || process.env.VITE_LINE_CHANNEL_ID || "2009240188";
      const accessToken = settings?.channel_access_token;
      
      res.json({
        configured: !!accessToken,
        redirectUri,
        channelId
      });
    } catch (err: any) {
      console.error('Backend: Error in /api/line/config:', err.message);
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  // Google Config
  app.get("/api/google/config", async (req, res) => {
    try {
      const staticToken = getStaticToken();
      const directusUrl = (process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, '');
      const response = await axios.get(`${directusUrl}/items/system_settings`, {
        headers: { 'Authorization': `Bearer ${staticToken}` }
      });
      
      const settings = response.data.data?.[0];
      const clientId = settings?.google_client_id || process.env.VITE_GOOGLE_CLIENT_ID || "559675370597-bs7c8aabdco373h9vc81gb09kbp62dte.apps.googleusercontent.com";
      
      let redirectUri = `${(process.env.APP_URL || 'https://nesxp.com').replace(/\/$/, '')}/google/callback`;
      if (!process.env.APP_URL && !req.get('host')?.includes('nesxp.com')) {
        const host = req.get('host');
        const protocol = req.protocol;
        redirectUri = `${protocol}://${host}/google/callback`;
      }

      res.json({
        clientId,
        redirectUri
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Google Token Exchange
  app.post("/api/auth/google/token", async (req, res) => {
    try {
      const { code, redirect_uri } = req.body;
      
      const staticToken = getStaticToken();
      const directusUrl = (process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, '');
      const settingsResponse = await axios.get(`${directusUrl}/items/system_settings`, {
        headers: { 'Authorization': `Bearer ${staticToken}` }
      });
      
      const settings = settingsResponse.data.data?.[0];
      const clientId = settings?.google_client_id || process.env.VITE_GOOGLE_CLIENT_ID || "559675370597-bs7c8aabdco373h9vc81gb09kbp62dte.apps.googleusercontent.com";
      const clientSecret = settings?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET || "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";

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Google Client ID or Secret not configured' });
      }

      const response = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: 'authorization_code',
      });

      res.json(response.data);
    } catch (err: any) {
      console.error('Google Token Exchange Error:', err.response?.data || err.message);
      res.status(500).json({ error: err.response?.data || err.message });
    }
  });

  // Secure Staff Login Endpoint
  app.post("/api/auth/staff-login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Identifier and password are required' });
      }

      const staticToken = getStaticToken();
      const directusUrl = getDirectusUrl();
      
      console.log(`Backend: Secure staff login attempt for: ${identifier}`);

      const searchParams = {
        filter: {
          _or: [
            { email: { _eq: identifier } },
            { phone: { _eq: identifier } },
            { line_user_id: { _eq: identifier } },
            { display_name: { _eq: identifier } }
          ]
        },
        // IMPORTANT: Must explicitly include 'password' as it's often hidden from '*'
        fields: '*,password,car_users.*,car_users.car_id.*'
      };

      const searchResponse = await axios.get(`${directusUrl}/items/line_users`, {
        params: searchParams,
        headers: { 'Authorization': `Bearer ${staticToken}` }
      });

      const members = searchResponse.data.data || [];
      console.log(`Backend: Staff search found ${members.length} users for: ${identifier}`);
      
      if (members.length > 0 && !members[0].password) {
        console.warn(`Backend: Security Alert! 'password' field missing in search results for: ${identifier}. Backend token may not have read permissions for passwords.`);
      }

      const inputPassword = String(password).trim();
      const match = members.find((m: any) => {
        const dbPassword = String(m.password || '').trim();
        return dbPassword && dbPassword.length > 0 && dbPassword === inputPassword;
      });

      if (match) {
        // Remove sensitive password field before returning to client
        const safeUser = { ...match };
        delete safeUser.password;
        
        console.log(`Backend: Staff login success for: ${identifier}`);
        res.json({ data: safeUser });
      } else {
        console.log(`Backend: Staff login failed (invalid credentials) for: ${identifier}`);
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (err: any) {
      console.error('Backend: Staff Login Error:', err.response?.data || err.message);
      res.status(err.response?.status || 500).json({ 
        error: 'Authentication failed', 
        details: err.message,
        directusMsg: err.response?.data?.errors?.[0]?.message 
      });
    }
  });

  // Secure Login Log Creation (Bypasses proxy 401 issues)
  app.post("/api/login-logs", async (req, res) => {
    try {
      const staticToken = getStaticToken();
      const directusUrl = getDirectusUrl();
      
      const response = await axios.post(`${directusUrl}/items/login_logs`, req.body, {
        headers: { 'Authorization': `Bearer ${staticToken}` }
      });
      
      res.json(response.data);
    } catch (err: any) {
      console.error('Backend: Login Log Creation Error:', err.response?.data || err.message);
      // Don't fail the request if logging fails, but return the error for debugging
      res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
    }
  });

  // API health check - Move to top for faster verification
  app.get("/api/health", (req, res) => {
    console.log('Backend: Health check requested');
    res.json({ status: "ok", timestamp: getSyncedDate().toISOString() });
  });

  // Get synchronized network time
  app.get("/api/time", (req, res) => {
    const now = getSyncedDate();
    res.json({
      timestamp: now.toISOString(),
      time: now.getTime(),
      offset: timeOffset
    });
  });

  // Helper to extract coordinates from Google Maps URL
  const extractCoordinates = async (url: string): Promise<{ lat: number, lng: number } | null> => {
    try {
      console.log(`Extracting coordinates from: ${url}`);
      let finalUrl = url;
      let htmlContent = '';

      if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
        try {
          // Use a very specific mobile User-Agent which often bypasses bot detection for short links
          const response = await axios.get(url, {
            maxRedirects: 10,
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
              'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Referer': 'https://www.google.com/',
            },
            validateStatus: (status) => true // Accept any status to check for location headers or meta refreshes
          });
          
          finalUrl = response.request.res.responseUrl || url;
          htmlContent = response.data;
          
          // Check if the body has a meta refresh or a link (Google often uses these for redirects)
          if (typeof htmlContent === 'string') {
            const metaMatch = htmlContent.match(/url=(https:\/\/www\.google\.com\/maps\/[^"']+)/i);
            if (metaMatch) {
              finalUrl = decodeURIComponent(metaMatch[1]);
              console.log(`Found URL in meta refresh: ${finalUrl}`);
            } else {
              const jsMatch = htmlContent.match(/window\.location\.replace\("([^"]+)"\)/);
              if (jsMatch) {
                finalUrl = jsMatch[1];
                console.log(`Found URL in JS redirect: ${finalUrl}`);
              }
            }
          }
          
          console.log(`Resolved URL (Status ${response.status}): ${finalUrl}`);
        } catch (redirectError: any) {
          console.error('Error resolving short URL:', redirectError.message);
        }
      }

      // Helper to validate coordinates
      const isValidCoords = (lat: number, lng: number) => {
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat !== 0 || lng !== 0);
      };

      // 1. Try to match @lat,lng in the URL
      const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lng = parseFloat(atMatch[2]);
        if (isValidCoords(lat, lng)) {
          console.log(`Found coordinates via @ pattern:`, { lat, lng });
          return { lat, lng };
        }
      }

      // 2. Try to match !3dlat!4dlng in the URL
      const dMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (dMatch) {
        const lat = parseFloat(dMatch[1]);
        const lng = parseFloat(dMatch[2]);
        if (isValidCoords(lat, lng)) {
          console.log(`Found coordinates via !3d pattern:`, { lat, lng });
          return { lat, lng };
        }
      }

      // 3. Try to match query params like ?q=lat,lng or &ll=lat,lng
      const qMatch = finalUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        const lat = parseFloat(qMatch[1]);
        const lng = parseFloat(qMatch[2]);
        if (isValidCoords(lat, lng)) {
          console.log(`Found coordinates via query pattern:`, { lat, lng });
          return { lat, lng };
        }
      }

      // 4. Try to match search pattern like /maps/search/lat,lng or /maps/place/lat,lng
      const searchMatch = finalUrl.match(/\/maps\/(?:search|place)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (searchMatch) {
        const lat = parseFloat(searchMatch[1]);
        const lng = parseFloat(searchMatch[2]);
        if (isValidCoords(lat, lng)) {
          console.log(`Found coordinates via search/place pattern:`, { lat, lng });
          return { lat, lng };
        }
      }

      // 5. Fallback: Check the HTML content for coordinates if URL patterns failed
      if (typeof htmlContent === 'string') {
        console.log("Searching for coordinates in HTML content...");
        
        // Pattern A: center=lat,lng or ll=lat,lng (often in meta tags or static map links)
        const htmlCoordsMatch = htmlContent.match(/(?:center|ll|&ll|%26ll|q|%26q)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
        if (htmlCoordsMatch) {
          const lat = parseFloat(htmlCoordsMatch[1]);
          const lng = parseFloat(htmlCoordsMatch[2]);
          if (isValidCoords(lat, lng)) {
            console.log(`Found coordinates in HTML via center/ll pattern:`, { lat, lng });
            return { lat, lng };
          }
        }

        // Pattern A.2: og:image or og:url meta tags (very common for Google Maps)
        const metaCoordsMatch = htmlContent.match(/meta\s+content="[^"]*(?:center|ll|q)=([^"&%]+)(?:%2C|,)([^"&%]+)[^"]*"\s+property="og:(?:image|url)"/i) ||
                               htmlContent.match(/property="og:(?:image|url)"\s+content="[^"]*(?:center|ll|q)=([^"&%]+)(?:%2C|,)([^"&%]+)[^"]*"/i);
        if (metaCoordsMatch) {
          const lat = parseFloat(metaCoordsMatch[1]);
          const lng = parseFloat(metaCoordsMatch[2]);
          if (isValidCoords(lat, lng)) {
            console.log(`Found coordinates in HTML via og:meta pattern:`, { lat, lng });
            return { lat, lng };
          }
        }

        // Pattern B: JSON-like structure [null,null,lat,lng] or similar
        const jsonCoordsMatch = htmlContent.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
        if (jsonCoordsMatch) {
          const lat = parseFloat(jsonCoordsMatch[1]);
          const lng = parseFloat(jsonCoordsMatch[2]);
          if (isValidCoords(lat, lng)) {
            console.log(`Found coordinates in HTML via JSON pattern:`, { lat, lng });
            return { lat, lng };
          }
        }

        // Pattern C: !3d pattern in HTML
        const htmlDMatch = htmlContent.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (htmlDMatch) {
          const lat = parseFloat(htmlDMatch[1]);
          const lng = parseFloat(htmlDMatch[2]);
          if (isValidCoords(lat, lng)) {
            console.log(`Found coordinates in HTML via !3d pattern:`, { lat, lng });
            return { lat, lng };
          }
        }

        // Pattern D: window.APP_INITIALIZATION_STATE or similar large JSON blobs
        const genericMatch = htmlContent.match(/\[(-?\d+\.\d+),\s*(-?\d+\.\d+)\]/g);
        if (genericMatch) {
          for (const match of genericMatch) {
            const parts = match.match(/\[(-?\d+\.\d+),\s*(-?\d+\.\d+)\]/);
            if (parts) {
              const lat = parseFloat(parts[1]);
              const lng = parseFloat(parts[2]);
              // Coordinates in these blobs are often [lng, lat] or [lat, lng]
              // We check both if they are valid, but usually lat is first in these specific patterns
              if (isValidCoords(lat, lng)) {
                // Additional check: coordinates in these blobs are often very precise
                if (parts[1].includes('.') && parts[1].split('.')[1].length > 4) {
                   console.log(`Found potential coordinates in HTML blob:`, { lat, lng });
                   return { lat, lng };
                }
              }
            }
          }
        }
      }

      // 5. If it's a place ID URL and we still don't have coordinates, try to fetch the page if we haven't already
      if (finalUrl.includes('/place/') && !htmlContent) {
        try {
          console.log(`Fetching place URL to extract coordinates from HTML: ${finalUrl}`);
          const response = await axios.get(finalUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
          });
          const pageHtml = response.data;
          const match = pageHtml.match(/(?:center|ll|&ll|%26ll)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/) || 
                        pageHtml.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (isValidCoords(lat, lng)) {
              console.log(`Found coordinates in fetched place page:`, { lat, lng });
              return { lat, lng };
            }
          }
        } catch (e: any) {
          console.error('Error fetching place page:', e.message);
        }
      }

      // 6. Fallback: Use Puppeteer to load the page and wait for the URL to resolve
      console.log(`Using Puppeteer fallback for: ${url}`);
      try {
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Block unnecessary resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
            req.abort();
          } else {
            req.continue();
          }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Wait up to 10 seconds for the URL to contain '@' (coordinates)
        try {
          await page.waitForFunction(() => window.location.href.includes('@'), { timeout: 10000 });
        } catch (waitError) {
          console.log(`Puppeteer wait timeout for @ in URL`);
        }
        
        const resolvedUrl = page.url();
        console.log(`Puppeteer resolved URL: ${resolvedUrl}`);
        
        await browser.close();

        const match = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoords(lat, lng)) {
            console.log(`Found coordinates via Puppeteer:`, { lat, lng });
            return { lat, lng };
          }
        }
      } catch (puppeteerError: any) {
        console.error('Puppeteer fallback failed:', puppeteerError.message);
      }

      console.warn(`Could not extract coordinates from URL or HTML: ${finalUrl}`);
      return null;
    } catch (error: any) {
      console.error('Error extracting coordinates:', error.message);
      return null;
    }
  };

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  };

  // API to search for coordinates by name (Geocoding)
  app.get("/api/search-location", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: "Query is required" });

      console.log(`Searching for location: ${q}`);
      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: q,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'NES-Tracking-App/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        res.json({
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          display_name: result.display_name
        });
      } else {
        res.status(404).json({ error: "Location not found" });
      }
    } catch (error: any) {
      console.error('Error searching location:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/calculate-distance", async (req, res) => {
    try {
      const { originUrl, destinationUrl, waypointUrls = [], optimize = false, apiKey: clientApiKey } = req.body;
      if (!originUrl || !destinationUrl) {
        return res.status(400).json({ error: "originUrl and destinationUrl are required" });
      }

      const allUrls = [originUrl, ...waypointUrls, destinationUrl];
      const allCoords: { lat: number, lng: number }[] = [];

      for (const url of allUrls) {
        try {
          const coords = await extractCoordinates(url);
          if (!coords) {
            return res.status(400).json({ error: `ไม่สามารถดึงพิกัดจากลิงก์ได้: ${url} กรุณาใช้ลิงก์ Google Maps แบบเต็มที่มีพิกัด (เช่น มี @lat,lng ในลิงก์) หรือลองคัดลอกลิงก์ใหม่จากแอป` });
          }
          allCoords.push(coords);
        } catch (e: any) {
          return res.status(400).json({ error: `เกิดข้อผิดพลาดกับลิงก์ ${url}: ${e.message}` });
        }
      }

      const apiKey = clientApiKey || process.env.GOOGLE_MAPS_API_KEY;
      
      // If we have an API key, use Google Maps Directions API for better accuracy and optimization
      if (apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY') {
        try {
          console.log(`Using Google Maps Directions API (Optimize: ${optimize})`);
          const origin = `${allCoords[0].lat},${allCoords[0].lng}`;
          const destination = `${allCoords[allCoords.length - 1].lat},${allCoords[allCoords.length - 1].lng}`;
          
          let waypointsParam = "";
          if (allCoords.length > 2) {
            const waypoints = allCoords.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|');
            waypointsParam = optimize ? `optimize:true|${waypoints}` : waypoints;
          }

          const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
              origin,
              destination,
              waypoints: waypointsParam,
              key: apiKey,
              mode: 'driving',
              language: 'th'
            }
          });

          if (response.data.status === 'OK') {
            const route = response.data.routes[0];
            const distanceInMeters = route.legs.reduce((acc: number, leg: any) => acc + leg.distance.value, 0);
            const distanceInKm = distanceInMeters / 1000;
            const optimizedOrder = route.waypoint_order; // Array of indices relative to the waypoints provided

            return res.json({
              distance: Math.round(distanceInKm * 10) / 10,
              optimizedOrder: optimizedOrder,
              allCoords: allCoords,
              status: 'OK',
              source: 'google_maps'
            });
          } else {
            console.warn(`Google Maps Directions API returned status: ${response.data.status}. Falling back to Haversine.`);
          }
        } catch (googleErr: any) {
          console.error('Google Maps API Error:', googleErr.message);
          // Fallback to Haversine below
        }
      }

      // Fallback: Haversine formula to calculate distance in km
      let totalDistance = 0;
      for (let i = 0; i < allCoords.length - 1; i++) {
        const d = calculateDistance(allCoords[i].lat, allCoords[i].lng, allCoords[i+1].lat, allCoords[i+1].lng);
        totalDistance += d;
      }
      
      // Multiply by a factor (e.g., 1.3) to estimate driving distance from straight-line distance
      const estimatedDrivingDistance = totalDistance * 1.3;

      res.json({ 
        distance: Math.round(estimatedDrivingDistance * 10) / 10,
        originCoords: allCoords[0],
        destCoords: allCoords[allCoords.length - 1],
        allCoords,
        source: 'haversine'
      });
    } catch (error: any) {
      console.error('Error in /api/calculate-distance:', error.message);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  let sessionId: string | null = null;
  let lastLoginTime = 0;
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  const getSessionId = async (forceRefresh? : boolean) => {
    const now = Date.now();
    if (!forceRefresh && sessionId && (now - lastLoginTime < SESSION_TIMEOUT)) {
      return sessionId;
    }

    try {
      console.log("Logging in to GPS provider...");
      const settings = await getSystemSettingsFromDirectus();
      const gpsToken = settings?.gps_api_token || process.env.GPS_API_TOKEN || "f184dc44-454a-7a69-50c5-0d5087c1e20b";
      
      console.log(`Backend: Using GPS API Token: ${gpsToken.substring(0, 5)}...`);
      const response = await axios.post(`https://th-slt.eupfin.com/Eup_Servlet_API_SOAP/login/session?token=${gpsToken}`);
      if (response.data?.result?.sessionId) {
        sessionId = response.data.result.sessionId;
        lastLoginTime = now;
        console.log("Login successful, session ID obtained.");
        return sessionId;
      }
      throw new Error(response.data?.error?.message || response.data?.message || "Session ID not found in login response");
    } catch (error: any) {
      console.error("Login error:", error.message);
      return null;
    }
  };

  // Endpoint to test GPS connection and clear cache
  app.post("/api/gps/test-connection", async (req, res) => {
    const { token } = req.body;
    const testToken = token || process.env.GPS_API_TOKEN || "f184dc44-454a-7a69-50c5-0d5087c1e20b";
    
    try {
      console.log(`Backend: Testing GPS connection with token: ${testToken.substring(0, 5)}...`);
      const response = await axios.post(`https://th-slt.eupfin.com/Eup_Servlet_API_SOAP/login/session?token=${testToken}`);
      
      if (response.data?.result?.sessionId) {
        // Clear existing session cache so the new token is used immediately for other requests
        sessionId = null;
        lastLoginTime = 0;
        
        return res.json({ 
          success: true, 
          message: "เชื่อมต่อสำเร็จ", 
          sessionId: response.data.result.sessionId 
        });
      }
      
      res.status(400).json({ 
        success: false, 
        message: "Token ไม่ถูกต้อง หรือไม่สามารถสร้าง Session ได้",
        details: response.data 
      });
    } catch (error: any) {
      console.error("Test Connection Error:", error.message);
      res.status(500).json({ 
        success: false, 
        message: `ข้อผิดพลาดในการเชื่อมต่อ: ${error.message}` 
      });
    }
  });

  // Proxy for Directus to avoid CORS
  app.all("/api/directus/*", async (req, res) => {
    try {
      // Robust path extraction
      const directusPath = req.path.replace(/^\/api\/directus/, '').replace(/^\//, '');
      const method = req.method;
      const directusBaseUrl = getDirectusUrl();
      const url = `${directusBaseUrl}/${directusPath}`;
      
      console.log(`Proxying Directus ${method} request to: ${url}`);
      
      // Filter out headers that might cause issues with the target server
      const headers: any = { ...req.headers };
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      
      const isJson = headers['content-type']?.includes('application/json');
      const isMultipart = headers['content-type']?.includes('multipart/form-data');
      
      if (isJson) {
        delete headers['content-length']; // Axios will calculate this correctly for objects
      }
      
      if (headers.authorization) {
        const authHeader = String(headers.authorization);
        const tokenPart = authHeader.replace(/^Bearer\s+/i, '').trim();
        console.log(`[PROXY] Incoming Auth Header: ${tokenPart.substring(0, 5)}...`);
        
        const badTokenValues = [
          '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0',
          'JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn',
          'KC7bsoqj_bmFeKWJCDGadyxXZsleRUi4'
        ];
        
        if (badTokenValues.some(bt => bt === tokenPart || authHeader.includes(bt)) || tokenPart === 'null' || tokenPart === 'undefined' || !tokenPart) {
          const systemToken = getStaticToken();
          headers.authorization = `Bearer ${systemToken}`;
          console.log(`[PROXY] REPLACED invalid/missing token with system token: ${systemToken.substring(0, 5)}...`);
        }
      } else {
        const systemToken = getStaticToken();
        headers.authorization = `Bearer ${systemToken}`;
        console.log(`[PROXY] APPENDED missing Auth Header with system token: ${systemToken.substring(0, 5)}...`);
      }
      
      // Cleanup for auth endpoints always
      if (directusPath.startsWith('auth/login')) {
        delete headers.authorization;
        console.log(`[PROXY] Explicitly removed auth header for auth endpoint: ${directusPath}`);
      }

      const response = await axios({
        method,
        url,
        data: isJson ? req.body : req,
        params: req.query,
        headers,
        responseType: 'stream',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true,
      });
      
      res.status(response.status);
      
      // Forward relevant headers from Directus
      const headersToForward = [
        'content-type',
        'content-length',
        'content-disposition',
        'cache-control',
        'etag',
        'last-modified'
      ];
      
      headersToForward.forEach(header => {
        if (response.headers[header]) {
          res.setHeader(header, response.headers[header]);
        }
      });
      
      response.data.pipe(res);
    } catch (error: any) {
      console.error(`Directus Proxy error for ${req.method} ${req.path}:`, error.message);
      if (error.response) {
        // Log more details about the error response from Directus
        console.error('Directus returned error:', error.response.status);
        if (!res.headersSent) {
          res.status(error.response.status).json(error.response.data || { error: error.message });
        }
      } else if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to proxy request to Directus",
          details: error.message
        });
      }
    }
  });

  // Cron endpoint to record GPS history
  app.get("/api/cron/record-gps", async (req, res) => {
    try {
      const staticToken = getStaticToken();
      const directusUrl = (process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, '');
      
      // 1. Fetch all cars
      const carsResponse = await axios.get(`${directusUrl}/items/cars`, {
        headers: { 'Authorization': `Bearer ${staticToken}` }
      });
      const cars = carsResponse.data.data;
      
      if (!cars || cars.length === 0) {
        return res.json({ message: "No cars found" });
      }

      // 2. Get GPS Session
      const currentSessionId = await getSessionId();
      if (!currentSessionId) {
        return res.status(500).json({ error: "Failed to authenticate with GPS provider" });
      }

      const historyRecords = [];

      // 3. Fetch GPS for each car
      for (const car of cars) {
        try {
          const gpsResponse = await axios.get(`https://th-slt.eupfin.com/Eup_Servlet_API_SOAP/car/log_data/car_status?carNumber=${car.car_number}`, {
            headers: { 'Authorization': currentSessionId },
            timeout: 5000
          });
          
          let data = gpsResponse.data?.result || gpsResponse.data;
          if (Array.isArray(data)) data = data[0];

          if (data && data.logGisy && data.logGisx) {
            const lat = data.logGisy / 1000000;
            const lng = data.logGisx / 1000000;
            const speed = data.logSpeed || data.speed || 0;
            
            historyRecords.push({
              car_number: car.car_number,
              lat: lat,
              lng: lng,
              speed: speed,
              // Use current time for timestamp
              timestamp: new Date().toISOString()
            });
          }
        } catch (err: any) {
          console.error(`Failed to fetch GPS for ${car.car_number} in cron:`, err.message);
        }
      }

      // 4. Save to Directus
      if (historyRecords.length > 0) {
        try {
          await axios.post(`${directusUrl}/items/vehicle_location_history`, historyRecords, {
            headers: { 'Authorization': `Bearer ${staticToken}` }
          });
          console.log(`Saved ${historyRecords.length} GPS records to history.`);
        } catch (saveErr: any) {
          console.error('Failed to save to vehicle_location_history. Does the collection exist?', saveErr.message);
          return res.status(500).json({ error: "Failed to save to collection. Please ensure 'vehicle_location_history' exists in Directus." });
        }
      }

      res.json({ success: true, recorded: historyRecords.length });
    } catch (error: any) {
      console.error('Cron record-gps error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for GPS API to avoid CORS
  app.get("/api/proxy/gps/:carNumber", async (req, res) => {
    try {
      const { carNumber } = req.params;
      const currentSessionId = await getSessionId();
      
      if (!currentSessionId) {
        return res.status(500).json({ error: "Failed to authenticate with GPS provider" });
      }

      console.log(`Proxying GPS request for: ${carNumber}`);
      
      const response = await axios.get(`https://th-slt.eupfin.com/Eup_Servlet_API_SOAP/car/log_data/car_status?carNumber=${carNumber}`, {
        headers: {
          'Authorization': currentSessionId
        },
        timeout: 5000
      });
      
      let data = response.data;
      
      // If the response has a 'result' wrapper like in the n8n code
      if (data.result) {
        data = data.result;
      }

      // Handle array response
      if (Array.isArray(data)) {
        data = data[0];
      }

      // Scale coordinates if they are in the logGisx/logGisy format (integers)
      if (data && data.logGisy && data.logGisx) {
        data.lat = data.logGisy / 1000000;
        data.lng = data.logGisx / 1000000;
      }
      
      // Map other fields if necessary to match what gps.ts expects
      if (data) {
        data.speed = data.logSpeed || data.speed;
        data.lastUpdate = data.logDTime || data.lastUpdate;
      }

      res.json(data);
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      res.status(500).json({ error: "Failed to fetch GPS data from provider" });
    }
  });

  // Proxy for LINE Login code exchange
  app.post("/api/auth/line/token", async (req, res) => {
    try {
      const { code, redirect_uri } = req.body;
      console.log('Backend: Exchanging LINE code for token...', { code: !!code, redirect_uri });
      const response = await axios.post("https://api.line.me/oauth2/v2.1/token", new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: "2009240188",
        client_secret: "b551a30a28f9ad6c169df9e66788e747",
      }).toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      console.log('Backend: LINE token exchange success');
      res.json(response.data);
    } catch (error: any) {
      console.error("Backend: LINE token exchange error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to exchange LINE code",
        details: error.response?.data || error.message
      });
    }
  });


  // LINE Config Check (legacy)
  app.get("/api/line/config-check", async (req, res) => {
    const settings = await getLineSettingsFromDirectus();
    const accessToken = settings?.channel_access_token;
    res.json({
      configured: !!accessToken,
      tokenPrefix: accessToken ? `${accessToken.substring(0, 5)}...` : null
    });
  });

  // --- Public Tracking API ---
  app.get('/api/track/:case_number', async (req, res) => {
    const { case_number } = req.params;
    const { phone } = req.query;
    const staticToken = getStaticToken();
    const fallbackToken = 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';

    try {
      console.log(`Backend: Tracking request received for case: ${case_number}, phone: ${phone}`);
      
      if (!case_number || case_number === '{case_number}') {
        return res.status(400).json({ error: 'Valid case number is required' });
      }

      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required for verification' });
      }

      const directusUrl = (process.env.VITE_DIRECTUS_URL || process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, '');
      
      console.log(`Tracking case: ${case_number} using token prefix: ${staticToken.substring(0, 5)}... (Length: ${staticToken.length})`);
      
      console.log(`Backend: Querying Directus at ${directusUrl} for case ${case_number}`);
      
      // Query Directus for the job report with the matching case_number
      let response;
      const getFields = 'case_number,status,origin,destination,work_date,standby_time,departure_time,arrival_time,status_logs,routes,car_id.car_number,driver_id.first_name,driver_id.last_name,driver_id.phone,member_id.phone,customer_id.phone,customer_id.member_id.phone,customer_id.members.line_user_id.phone';
      
      try {
        response = await axios.get(`${directusUrl}/items/work_reports`, {
          params: {
            filter: {
              case_number: {
                _eq: case_number.trim()
              }
            },
            fields: getFields
          },
          headers: {
            'Authorization': `Bearer ${staticToken.trim()}`
          },
          timeout: 10000
        });
      } catch (error: any) {
        // If the custom token failed with 401, try one more time with the hardcoded fallback
        if (error.response?.status === 401 && staticToken !== fallbackToken) {
          console.warn(`Tracking API: Custom token failed (401). Retrying with backup token...`);
          response = await axios.get(`${directusUrl}/items/work_reports`, {
            params: {
              filter: {
                case_number: {
                  _eq: case_number.trim()
                }
              },
              fields: getFields
            },
            headers: {
              'Authorization': `Bearer ${fallbackToken}`
            },
            timeout: 10000
          });
        } else {
          // If fallback also fails or it wasn't a 401, rethrow
          throw error;
        }
      }

      const jobs = response.data.data;
      console.log(`Backend: Directus returned ${jobs?.length || 0} jobs for case: ${case_number}`);

      if (!jobs || jobs.length === 0) {
        return res.status(404).json({ 
          error: 'Tracking number not found',
          message: `No record found for case number: ${case_number}. Please check the number and try again.`
        });
      }

      const job = jobs[0];
      const providedPhone = String(phone).trim().replace(/[^0-9]/g, '');
      
      // Helper to clean phone numbers for comparison
      const cleanPhone = (p: any) => p ? String(p).trim().replace(/[^0-9]/g, '') : null;

      // Check all possible phone fields for a match
      const allowedPhones = [
        cleanPhone(job.driver_id?.phone),
        cleanPhone(job.member_id?.phone),
        cleanPhone(job.customer_id?.phone),
        cleanPhone(job.customer_id?.member_id?.phone),
        cleanPhone(job.customer_id?.members?.line_user_id?.phone)
      ].filter(Boolean);

      console.log('Backend: Verifying phone match. Provided:', providedPhone, 'Allowed:', allowedPhones);

      const isAuthorized = allowedPhones.some(p => p === providedPhone || (p && providedPhone && (p.endsWith(providedPhone) || providedPhone.endsWith(p))));

      if (!isAuthorized) {
        return res.status(403).json({ 
          error: 'Verification failed',
          message: 'The phone number provided does not match the records for this case number.'
        });
      }

      // Remove sensitive phone fields before returning to public
      const publicJob = { ...job };
      delete publicJob.driver_id?.phone;
      delete publicJob.member_id?.phone;
      delete publicJob.customer_id?.phone;

      res.json({
        success: true,
        data: publicJob
      });
    } catch (error: any) {
      const errorStatus = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      console.error(`Tracking API error (${errorStatus}):`, JSON.stringify(errorData));
      
      res.status(errorStatus).json({ 
        error: 'Failed to fetch tracking information',
        message: error.response?.status === 401 ? 'Invalid API credentials' : (error.response?.data?.errors?.[0]?.message || error.message),
        details: errorData,
        debug: {
          case_number,
          directusUrl: (process.env.VITE_DIRECTUS_URL || process.env.DIRECTUS_URL || 'https://data.nesxp.com').replace(/\/$/, ''),
          tokenUsedPrefix: (staticToken === fallbackToken ? 'fallback' : 'custom') + ': ' + staticToken.substring(0, 5)
        }
      });
    }
  });

  // LINE Messaging Endpoint
  app.post("/api/line/send", async (req, res) => {
    try {
      const { to, message, messages } = req.body;
      const settings = await getLineSettingsFromDirectus();
      console.log('Backend: LINE settings retrieved:', settings ? 'success' : 'failed');
      const accessToken = settings?.channel_access_token;

      console.log('Backend: Received request to send LINE message', { to, hasToken: !!accessToken });

      if (!accessToken) {
        console.error("LINE Error: LINE_CHANNEL_ACCESS_TOKEN is not configured in Directus");
        return res.status(500).json({ 
          error: "LINE_CHANNEL_ACCESS_TOKEN is not configured",
          details: "Please add LINE_CHANNEL_ACCESS_TOKEN to LINE Settings in System Settings."
        });
      }

      if (!to) {
        return res.status(400).json({ error: "Recipient 'to' is required" });
      }

      // Support both single message string and full message objects
      let lineMessages = [];
      if (messages && Array.isArray(messages)) {
        lineMessages = messages;
      } else if (messages && typeof messages === 'string') {
        lineMessages = [{ type: 'text', text: messages }];
      } else if (message) {
        lineMessages = [
          typeof message === 'object' ? message : {
            type: "text",
            text: message
          }
        ];
      }

      if (lineMessages.length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }

      console.log(`Backend: Sending LINE message to: ${to}`, { 
        messageCount: lineMessages.length,
        tokenPrefix: accessToken ? `${accessToken.substring(0, 10)}...` : 'none'
      });

      const response = await axios.post("https://api.line.me/v2/bot/message/push", {
        to: to,
        messages: lineMessages
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log("Backend: LINE push success:", response.data);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("LINE error details:", errorData);
      
      // Provide more helpful error messages for common LINE errors
      let helpfulMessage = "Failed to send LINE message";
      if (error.response?.status === 401) {
        helpfulMessage = "Invalid LINE Channel Access Token. Please check your token in AI Studio Secrets.";
      } else if (error.response?.status === 400) {
        helpfulMessage = `LINE API Error: ${errorData.message || 'Bad Request'}`;
      }

      res.status(500).json({ 
        error: helpfulMessage, 
        details: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData
      });
    }
  });

  // LINE Broadcast Endpoint
  app.post("/api/line/broadcast", async (req, res) => {
    try {
      const { to, messages } = req.body;
      const settings = await getLineSettingsFromDirectus();
      const accessToken = settings?.channel_access_token;

      console.log('Backend: Received request to broadcast LINE message', { recipientsCount: Array.isArray(to) ? to.length : 1, hasToken: !!accessToken, body: req.body });

      if (!accessToken) {
        return res.status(500).json({ error: "LINE_CHANNEL_ACCESS_TOKEN is not configured in Directus" });
      }

      if (!to || !messages) {
        return res.status(400).json({ error: "Recipients 'to' and 'messages' are required" });
      }

      const recipients = Array.isArray(to) ? to : [to];
      
      // LINE Multicast API supports up to 500 recipients
      const results = [];
      for (let i = 0; i < recipients.length; i += 500) {
        const batch = recipients.slice(i, i + 500);
        const response = await axios.post("https://api.line.me/v2/bot/message/multicast", {
          to: batch,
          messages: messages
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        results.push(response.data);
      }

      console.log("LINE Broadcast success");
      res.json({ success: true, results });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("LINE broadcast error details:", errorData);
      
      // Provide more helpful error messages for common LINE errors
      let helpfulMessage = "Failed to broadcast LINE message";
      if (error.response?.status === 401) {
        helpfulMessage = "Invalid LINE Channel Access Token.";
      } else if (error.response?.status === 400) {
        helpfulMessage = `LINE API Error: ${JSON.stringify(errorData)}`;
      }

      res.status(500).json({ 
        error: helpfulMessage, 
        details: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData
      });
    }
  });

  // Catch-all for unmatched API routes
  app.all("/api/*", (req, res) => {
    console.log(`Backend: Unmatched API request: ${req.method} ${req.path}`);
    res.status(404).json({ error: "API route not found", path: req.path });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist')) 
      ? path.join(process.cwd(), 'dist')
      : path.join(process.cwd(), 'build');
    
    console.log(`Production mode: Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
