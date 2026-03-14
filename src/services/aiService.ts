import { GoogleGenAI } from "@google/genai";

export const aiService = {
  generateInsights: async (data: any) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return "AI Insights are currently unavailable. Please configure the Gemini API key.";
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        As a fleet management expert, analyze the following vehicle tracking data and provide 3 concise, actionable insights in Thai.
        Data: ${JSON.stringify(data)}
        Format: Return only the 3 insights as a bulleted list.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text || "No insights generated.";
    } catch (error) {
      console.error("AI Insight Error:", error);
      return "Unable to generate AI insights at this time.";
    }
  }
};
