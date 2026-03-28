// Node.js backend (Express)
const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for React frontend
app.use(cors());

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from Node!' });
});

app.listen(8080, () => {
  console.log('Server running on port 8080');
}); 