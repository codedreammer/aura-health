import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDatabase from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import medicineLogRoutes from './routes/medicineLogRoutes.js';
import waterRoutes from './routes/waterRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

dotenv.config();

await connectDatabase();

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

app.use(cors());

connectDatabase();

app.get('/', (req, res) => {
  res.send("Aura Health Backend is running!");
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/medicine-logs', medicineLogRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
