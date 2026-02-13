module.exports = (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Meal Tracker API is running on Vercel',
    timestamp: new Date().toISOString()
  });
};
