const axios = require("axios");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: "You are a Shopify store analyst for Sales Scales. Analyze the store and return JSON only, no markdown, no explanation. Return this exact structure: {\"brandName\":\"string\",\"niche\":\"string\",\"estimatedAOV\":\"$XX\",\"score\":35,\"hasEmailPopup\":true,\"hasCartRecovery\":\"likely\",\"hasSMS\":false,\"hasWhatsApp\":false,\"hasAIVoice\":false,\"estimatedMonthlyRevenue\":\"$XXK\",\"biggestGap\":\"one sentence\",\"pitchMessage\":\"personalised outreach message to the founder\"}",
        messages: [{ role: "user", content: "Audit this Shopify store and identify all revenue gaps: " + url }]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        }
      }
    );

    const text = response.data.content[0].text.trim().replace(/```json|```/g, "");
    const audit = JSON.parse(text);
    res.json(audit);
  } catch (e) {
    console.error("Audit error:", e.message);
    res.status(500).json({ error: "Audit failed", details: e.message });
  }
};
