import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import UserHealth from './models/UserHealth.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Use your working connection string or process.env.MONGO_URI
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB Atlas!"))
  .catch(err => console.error("Database connection error:", err));

app.get('/', (req, res) => {
  res.send("Aura Health Backend is running!");
});

// --- API ROUTES FOR HEALTH DATA ---

// Get today's health state for a user
app.get('/api/health/:userId/:date', async (req, res) => {
  try {
    let data = await UserHealth.findOne({ userId: req.params.userId, date: req.params.date });
    if (!data) {
      // Return default template if none exists for today
      data = { 
        water: 0, 
        meals: 0, 
        streak: 0, 
        meds: [
          { id: 'm1', name: 'Vitamin D', time: '8:00 PM', taken: false }, 
          { id: 'm2', name: 'Metformin', time: '8:00 AM', taken: false }
        ]
      };
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update health state
app.post('/api/health', async (req, res) => {
  try {
    const { userId, date, water, meals, meds, streak } = req.body;
    const updatedData = await UserHealth.findOneAndUpdate(
      { userId, date },
      { water, meals, meds, streak },
      { new: true, upsert: true } // Creates it if it doesn't exist yet
    );
    res.json(updatedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});