const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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
      messages: [
        {
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
              text: `Analyze this meal image and provide nutritional estimates. Return ONLY valid JSON with this structure (no markdown, no backticks, no extra text):
{"name":"meal description","items":["item1","item2"],"calories":350,"protein":25,"carbs":40,"fat":15,"fiber":5}

All values must be numbers (no units in the JSON). Protein, carbs, fat, fiber in grams.`,
            },
          ],
        },
      ],
    });

    const content = message.content.find((item) => item.type === 'text')?.text || '';
    
    // Remove any markdown formatting
    let cleanContent = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    // Extract JSON
    const jsonMatch = cleanContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    
    if (!jsonMatch) {
      console.error('No JSON found. Response:', content);
      return res.status(500).json({
        error: 'Failed to parse response',
        message: 'AI response did not contain valid JSON'
      });
    }

    let nutritionData;
    try {
      nutritionData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Attempted to parse:', jsonMatch[0]);
      return res.status(500).json({
        error: 'Failed to parse nutrition data',
        message: parseError.message
      });
    }

    // Validate required fields
    if (!nutritionData.name || typeof nutritionData.calories !== 'number') {
      console.error('Invalid data structure:', nutritionData);
      return res.status(500).json({
        error: 'Invalid nutrition data',
        message: 'Missing required fields'
      });
    }

    res.status(200).json(nutritionData);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze meal',
      message: error.message
    });
  }
};
