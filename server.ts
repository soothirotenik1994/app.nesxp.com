import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      res.status(500).json({ error: "Failed to exchange LINE code" });
    }
  });

  // LINE Messaging Endpoint
  app.post("/api/line/send", async (req, res) => {
    try {
      const { to, message, messages } = req.body;
      const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

      if (!accessToken) {
        console.error("LINE Error: LINE_CHANNEL_ACCESS_TOKEN is not configured");
        return res.status(500).json({ error: "LINE_CHANNEL_ACCESS_TOKEN is not configured" });
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

      console.log("LINE Response:", response.data);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("LINE error details:", errorData);
      res.status(500).json({ 
        error: "Failed to send LINE message", 
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
