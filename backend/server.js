import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDatabase from './config/database.js';
import healthRoutes from './routes/healthRoutes.js';

dotenv.config();

await connectDatabase();

const app = express();
app.use(express.json());
app.use(cors());

connectDatabase();

app.get('/', (req, res) => {
  res.send("Aura Health Backend is running!");
});

app.use('/api/health', healthRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
