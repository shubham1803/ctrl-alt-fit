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

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Check if API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'ANTHROPIC_API_KEY not configured. Please add it in Vercel environment variables.'
      });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Remove data URL prefix if present
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
              text: `Analyze this meal image and provide nutritional estimates in JSON format only. Identify all food items visible and estimate their quantities. Return ONLY a JSON object with this exact structure, no other text:
{
  "name": "brief meal description",
  "items": ["item1", "item2"],
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number
}

All macro values should be in grams except calories. Be as accurate as possible based on portion sizes visible.`,
            },
          ],
        },
      ],
    });

    const content = message.content.find((item) => item.type === 'text')?.text || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const nutritionData = JSON.parse(jsonMatch[0]);
      res.status(200).json(nutritionData);
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
};
