require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/audit", async (req, res) => {
  const { url } = req.body;
  console.log("Audit requested for:", url);

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are a senior revenue consultant for Sales Scales, a done-for-you AI revenue systems agency. You analyze ecommerce and business websites and produce detailed revenue gap audits.

Analyze the given URL and return ONLY a JSON object with NO markdown, NO explanation, NO extra text. Return this exact structure:

{
  "brandName": "Brand Name",
  "niche": "Specific niche e.g. Luxury Travel Bags",
  "estimatedAOV": "$XXX",
  "score": 42,
  "estimatedMonthlyRevenue": "$XXK-$XXK",
  "hasEmailPopup": true,
  "hasCartRecovery": false,
  "hasSMS": false,
  "hasWhatsApp": false,
  "hasAIVoice": false,
  "hasPostPurchase": false,
  "hasWinBack": false,
  "hasUpsell": false,
  "estimatedMonthlyLoss": "$X,XXX - $XX,XXX",
  "gaps": [
    {
      "name": "Cart Recovery Sequences",
      "status": "missing",
      "impact": "High",
      "estimatedLoss": "$2,400/mo",
      "description": "No automated cart abandonment recovery detected. Industry average recovery rate is 15-20% of abandoned carts.",
      "recommendation": "Build a 3-touch cart recovery sequence across email and SMS firing at 1hr, 24hr, and 48hr after abandonment."
    },
    {
      "name": "SMS Marketing",
      "status": "missing",
      "impact": "High",
      "estimatedLoss": "$1,800/mo",
      "description": "No SMS automation detected. SMS has 98% open rates vs 21% for email, making it the highest converting channel.",
      "recommendation": "Implement SMS sequences for cart recovery, back-in-stock alerts, and VIP customer communications."
    },
    {
      "name": "Post-Purchase Sequences",
      "status": "missing",
      "impact": "Medium",
      "estimatedLoss": "$1,200/mo",
      "description": "No post-purchase follow-up detected. Customers who receive post-purchase nurture have 60% higher lifetime value.",
      "recommendation": "Build a 5-email post-purchase sequence covering order confirmation, product tips, review request, cross-sell, and loyalty."
    },
    {
      "name": "Win-Back Automation",
      "status": "missing",
      "impact": "Medium",
      "estimatedLoss": "$900/mo",
      "description": "No win-back sequences for lapsed customers detected. Winning back existing customers costs 5x less than acquiring new ones.",
      "recommendation": "Create a 3-touch win-back sequence targeting customers inactive for 60-90 days."
    },
    {
      "name": "WhatsApp Marketing",
      "status": "missing",
      "impact": "Medium",
      "estimatedLoss": "$800/mo",
      "description": "No WhatsApp Business automation detected. WhatsApp messages have 98% open rates and feel more personal than email.",
      "recommendation": "Add WhatsApp sequences for order updates, cart recovery, and VIP customer communications."
    }
  ],
  "biggestGap": "One specific sentence about the single most impactful gap and the exact estimated monthly revenue loss",
  "competitorInsight": "One sentence about what competitors in this niche are doing that this brand is missing",
  "quickWin": "The single fastest action they could take this week to recover revenue immediately",
  "pitchMessage": "A specific personalised 3-4 sentence outreach message to the founder. Reference their specific brand, their specific gaps, and mention a specific number. Sound human not robotic. End with a question."
}`,
        messages: [{ role: "user", content: `Perform a detailed revenue audit on this website: ${url}. Analyze everything visible including their marketing, automation gaps, and revenue opportunities. Be specific with dollar estimates based on their apparent business size.` }]
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
    console.log("Audit complete for:", audit.brandName);
    res.json(audit);
  } catch (e) {
    console.error("Error:", e.message);
    res.status(500).json({ error: "Audit failed" });
  }
});

app.listen(3001, () => console.log("Server running on port 3001"));
