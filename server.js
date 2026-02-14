const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const ANALYSIS_PROMPT = `Analyze this meal image and provide nutritional estimates in JSON format only. Identify all food items visible and estimate their quantities. Return ONLY a JSON object with this exact structure, no other text:
{
  "name": "brief meal description",
  "items": ["item1", "item2"],
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number
}

All macro values should be in grams except calories. Be as accurate as possible based on portion sizes visible.`;

const callGeminiGenerateContent = async (apiKey, model, base64Data) => {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: ANALYSIS_PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
        ],
      }],
      generationConfig: { temperature: 0 },
    }),
  });
};

const generateWithFallback = async (apiKey, base64Data) => {
  const candidates = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

  let lastError = null;
  for (const model of candidates) {
    const response = await callGeminiGenerateContent(apiKey, model, base64Data);
    if (response.ok) {
      return response;
    }

    const errText = await response.text();
    lastError = `Gemini error (${response.status}) for ${model}: ${errText.substring(0, 240)}`;
    if (response.status !== 404) {
      break;
    }
  }

  throw new Error(lastError || 'Gemini request failed');
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Meal Tracker API is running' });
});

// Analyze meal endpoint
app.post('/api/analyze-meal', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'GEMINI_API_KEY (or GOOGLE_API_KEY) not configured',
      });
    }

    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    const response = await generateWithFallback(apiKey, base64Data);

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content = parts.find((part) => typeof part?.text === 'string')?.text || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const nutritionData = JSON.parse(jsonMatch[0]);
      res.json(nutritionData);
    } else {
      throw new Error('Could not parse nutrition data from AI response');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze meal', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});
