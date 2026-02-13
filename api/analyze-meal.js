const Anthropic = require('@anthropic-ai/sdk');

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

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'ANTHROPIC_API_KEY not configured'
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: 'Analyze this food image. Respond with ONLY a valid JSON object, nothing else. Use this exact format:\n\n{"name":"description of meal","items":["food1","food2"],"calories":400,"protein":30,"carbs":45,"fat":18,"fiber":6}\n\nAll numbers must be integers. No text before or after the JSON.',
          },
        ],
      }],
    });

    let responseText = message.content.find(item => item.type === 'text')?.text || '';
    
    // Log the raw response for debugging
    console.log('Raw AI response:', responseText);
    
    // Strip everything except the JSON object
    responseText = responseText.trim();
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    // Find the first { and last }
    const firstBrace = responseText.indexOf('{');
    const lastBrace = responseText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      console.error('No JSON braces found in:', responseText);
      return res.status(500).json({ 
        error: 'Invalid AI response',
        message: 'Could not find JSON in response',
        debug: responseText.substring(0, 200)
      });
    }
    
    const jsonStr = responseText.substring(firstBrace, lastBrace + 1);
    console.log('Extracted JSON string:', jsonStr);
    
    let nutritionData;
    try {
      nutritionData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse failed:', parseError.message);
      console.error('Tried to parse:', jsonStr);
      return res.status(500).json({ 
        error: 'JSON parse error',
        message: parseError.message,
        debug: jsonStr.substring(0, 200)
      });
    }

    // Ensure all required fields exist with defaults
    const result = {
      name: nutritionData.name || 'Unknown meal',
      items: Array.isArray(nutritionData.items) ? nutritionData.items : [],
      calories: Number(nutritionData.calories) || 0,
      protein: Number(nutritionData.protein) || 0,
      carbs: Number(nutritionData.carbs) || 0,
      fat: Number(nutritionData.fat) || 0,
      fiber: Number(nutritionData.fiber) || 0
    };

    console.log('Returning nutrition data:', result);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze meal', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
