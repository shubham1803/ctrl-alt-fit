const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Meal Tracker API is running' });
});

// Analyze meal endpoint
app.post('/api/analyze-meal', async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

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
