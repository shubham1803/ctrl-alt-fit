const Anthropic = require('@anthropic-ai/sdk');

const MODEL_CONFIG = {
  'claude-sonnet-4-20250514': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    envKey: 'ANTHROPIC_API_KEY',
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
  },
  'gemini-1.5-flash': {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    envKey: 'GEMINI_API_KEY',
  },
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const ANALYSIS_PROMPT = 'Analyze this food image. Respond with ONLY a valid JSON object, nothing else. Use this exact format:\n\n{"name":"description of meal","items":["food1","food2"],"calories":400,"protein":30,"carbs":45,"fat":18,"fiber":6}\n\nAll numbers must be integers. No text before or after the JSON.';

const parseNutritionResponse = (responseText) => {
  let cleaned = (responseText || '').trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('Could not find JSON in response');
  }

  const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
  const nutritionData = JSON.parse(jsonStr);

  return {
    name: nutritionData.name || 'Unknown meal',
    items: Array.isArray(nutritionData.items) ? nutritionData.items : [],
    calories: Number(nutritionData.calories) || 0,
    protein: Number(nutritionData.protein) || 0,
    carbs: Number(nutritionData.carbs) || 0,
    fat: Number(nutritionData.fat) || 0,
    fiber: Number(nutritionData.fiber) || 0,
  };
};

const analyzeWithAnthropic = async (apiKey, model, base64Data) => {
  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model,
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
        },
        { type: 'text', text: ANALYSIS_PROMPT },
      ],
    }],
  });

  return message.content.find(item => item.type === 'text')?.text || '';
};

const analyzeWithOpenAI = async (apiKey, model, imageData) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: imageData } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
};

const analyzeWithGemini = async (apiKey, model, base64Data) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: ANALYSIS_PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
        ],
      }],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, model } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const selectedModel = MODEL_CONFIG[model] ? model : DEFAULT_MODEL;
    const config = MODEL_CONFIG[selectedModel];
    const apiKey = process.env[config.envKey];

    if (!apiKey) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: `${config.envKey} not configured`,
      });
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    let responseText;
    if (config.provider === 'anthropic') {
      responseText = await analyzeWithAnthropic(apiKey, config.model, base64Data);
    } else if (config.provider === 'openai') {
      responseText = await analyzeWithOpenAI(apiKey, config.model, imageData);
    } else {
      responseText = await analyzeWithGemini(apiKey, config.model, base64Data);
    }

    const result = parseNutritionResponse(responseText);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze meal',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
