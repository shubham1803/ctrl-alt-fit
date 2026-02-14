const GEMINI_ENV_KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'];
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const ANALYSIS_PROMPT = 'Analyze this food image. Respond with ONLY a valid JSON object, nothing else. Use this exact format:\n\n{"name":"description of meal","items":["food1","food2"],"itemDetails":[{"name":"food1","quantity_g":120},{"name":"food2","quantity_g":80}],"calories":400,"protein":30,"carbs":45,"fat":18,"fiber":6}\n\nRules:\n- quantity_g must be estimated portion size in grams for each food item.\n- All numbers must be integers.\n- itemDetails must include every item listed in items.\n- No text before or after the JSON.';

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
  const parsedItemDetails = Array.isArray(nutritionData.itemDetails)
    ? nutritionData.itemDetails
    : Array.isArray(nutritionData.item_details)
      ? nutritionData.item_details
      : [];

  const itemDetails = parsedItemDetails
    .map((item) => ({
      name: String(item?.name || '').trim(),
      quantity_g: Math.max(0, Math.round(Number(item?.quantity_g) || 0)),
    }))
    .filter((item) => item.name);

  const items = Array.isArray(nutritionData.items)
    ? nutritionData.items.map((item) => String(item).trim()).filter(Boolean)
    : itemDetails.map((item) => item.name);

  return {
    name: nutritionData.name || 'Unknown meal',
    items,
    itemDetails,
    calories: Number(nutritionData.calories) || 0,
    protein: Number(nutritionData.protein) || 0,
    carbs: Number(nutritionData.carbs) || 0,
    fat: Number(nutritionData.fat) || 0,
    fiber: Number(nutritionData.fiber) || 0,
  };
};

const getGeminiApiKey = () => {
  for (const keyName of GEMINI_ENV_KEYS) {
    if (process.env[keyName]) {
      return { keyName, keyValue: process.env[keyName] };
    }
  }
  return null;
};

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
      generationConfig: {
        temperature: 0,
      },
    }),
  });
};

const extractGeminiText = (data) => {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.find((part) => typeof part?.text === 'string')?.text || '';
};

const listGeminiModels = async (apiKey) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''));
};

const chooseGeminiFallbackModel = (availableModels) => {
  const preferred = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-09-2025',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-latest',
  ];

  for (const candidate of preferred) {
    if (availableModels.includes(candidate)) {
      return candidate;
    }
  }

  return availableModels.find((m) => m.includes('flash')) || availableModels[0] || null;
};

const analyzeWithGemini = async (apiKey, model, base64Data) => {
  let response = await callGeminiGenerateContent(apiKey, model, base64Data);

  if (!response.ok) {
    // Handle model deprecations or unavailable model IDs by trying a supported fallback.
    if (response.status === 404) {
      const availableModels = await listGeminiModels(apiKey);
      const fallbackModel = chooseGeminiFallbackModel(availableModels);

      if (fallbackModel && fallbackModel !== model) {
        response = await callGeminiGenerateContent(apiKey, fallbackModel, base64Data);
      }
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini error (${response.status}): ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  return extractGeminiText(data);
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
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const apiKeyInfo = getGeminiApiKey();
    if (!apiKeyInfo) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'GEMINI_API_KEY (or GOOGLE_API_KEY) not configured',
      });
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const responseText = await analyzeWithGemini(apiKeyInfo.keyValue, DEFAULT_GEMINI_MODEL, base64Data);

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
