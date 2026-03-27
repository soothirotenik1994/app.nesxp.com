import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";
import 'dotenv/config';

async function startServer() {
  const app = express();
  const PORT = 3000;

  const getLineSettingsFromDirectus = async () => {
    try {
      const response = await axios.get(`${process.env.DIRECTUS_URL || 'https://data.nesxp.com'}/items/line_settings/1`, {
        headers: {
          'Authorization': `Bearer JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn`
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch LINE settings from Directus:', error);
      return null;
    }
  };

  app.use(cors());
  app.use(express.json());

  let sessionId: string | null = null;
  let lastLoginTime = 0;
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  const getSessionId = async () => {
    const now = Date.now();
    if (sessionId && (now - lastLoginTime < SESSION_TIMEOUT)) {
      return sessionId;
    }

    try {
      console.log("Logging in to GPS provider...");
      const gpsToken = process.env.GPS_API_TOKEN || "f184dc44-454a-7a69-50c5-0d5087c1e20b";
      const response = await axios.post(`https://th-slt.eupfin.com/Eup_Servlet_API_SOAP/login/session?token=${gpsToken}`);
      if (response.data?.result?.sessionId) {
        sessionId = response.data.result.sessionId;
        lastLoginTime = now;
        console.log("Login successful, session ID obtained.");
        return sessionId;
      }
      throw new Error("Session ID not found in login response");
    } catch (error: any) {
      console.error("Login error:", error.message);
      return null;
    }
  };

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

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  // LINE Config Check
  app.get("/api/line/config", async (req, res) => {
    const settings = await getLineSettingsFromDirectus();
    
    // Use redirect_uri from Directus, or LINE_REDIRECT_URI from env, or APP_URL from env, or fallback
    let redirectUri = settings?.redirect_uri || process.env.LINE_REDIRECT_URI;
    
    if (!redirectUri) {
      if (process.env.APP_URL) {
        redirectUri = `${process.env.APP_URL}/line/callback`;
      } else {
        // Default to the user's requested production URL
        redirectUri = "https://app.nesxp.com/line/callback";
      }
    }

    const accessToken = settings?.channel_access_token;
    res.json({
      configured: !!accessToken,
      redirectUri,
      channelId: settings?.channel_id || "2009240188"
    });
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

  // LINE Messaging Endpoint
  app.post("/api/line/send", async (req, res) => {
    try {
      const { to, message, messages } = req.body;
      const settings = await getLineSettingsFromDirectus();
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

      console.log(`Sending LINE message to: ${to}`);

      // Support both single message string and full message objects
      const lineMessages = messages || [
        typeof message === 'object' ? message : {
          type: "text",
          text: message
        }
      ];

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

      console.log("LINE Response success:", response.data);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      
      // Provide more helpful error messages for common LINE errors
      let helpfulMessage = "Failed to send LINE message";
      if (error.response?.status === 401) {
        helpfulMessage = "Invalid LINE Channel Access Token. Please check your token in AI Studio Secrets.";
      } else if (error.response?.status === 400) {
        helpfulMessage = `LINE API Error: ${errorData.message || 'Bad Request'}`;
      } else if (errorData?.message?.includes('monthly limit')) {
        helpfulMessage = "LINE Messaging API monthly limit reached. Notifications are temporarily disabled.";
        console.warn("LINE monthly limit reached:", errorData);
        return res.status(429).json({ 
          error: helpfulMessage, 
          details: errorData,
          limitReached: true
        });
      }

      console.error("LINE error details:", errorData);
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
      
      // Provide more helpful error messages for common LINE errors
      let helpfulMessage = "Failed to broadcast LINE message";
      if (error.response?.status === 401) {
        helpfulMessage = "Invalid LINE Channel Access Token.";
      } else if (error.response?.status === 400) {
        helpfulMessage = `LINE API Error: ${JSON.stringify(errorData)}`;
      } else if (errorData?.message?.includes('monthly limit')) {
        helpfulMessage = "LINE Messaging API monthly limit reached. Notifications are temporarily disabled.";
        console.warn("LINE monthly limit reached (broadcast):", errorData);
        return res.status(429).json({ 
          error: helpfulMessage, 
          details: errorData,
          limitReached: true
        });
      }

      console.error("LINE broadcast error details:", errorData);
      res.status(500).json({ 
        error: helpfulMessage, 
        details: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
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
