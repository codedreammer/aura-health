# 🌿 Aura Health – AI Powered Wellness Companion

<p align="center">
  <img src="https://img.shields.io/badge/MERN-Full%20Stack-green" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-blue" />
  <img src="https://img.shields.io/badge/Database-MongoDB-success" />
  <img src="https://img.shields.io/badge/Authentication-JWT-orange" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

Aura Health is an **AI-powered wellness companion** built using the **MERN Stack** with **Google Gemini AI** integration. The application helps users monitor hydration, manage medications, track daily health habits, and receive personalized AI-driven wellness guidance through an intelligent virtual health coach.

---

# ✨ Features

## 👤 User Authentication

- Secure JWT Authentication
- User Registration
- User Login
- Protected Routes
- Persistent Login Session

---

## 💧 Water Tracking

- Log daily water intake
- View today's progress
- Daily hydration statistics
- Hydration summary

---

## 💊 Medicine Management

- Add medicines
- Edit medicines
- Delete medicines
- Active/Inactive medicines
- Reminder schedules

---

## ✅ Medicine Logs

- Mark medicines as taken
- View today's medicine history
- Track adherence

---

## 📊 Health Insights

- Daily wellness summary
- Hydration insights
- Medicine adherence
- Progress dashboard

---

## 🤖 Aura AI Coach

Powered by **Google Gemini AI**

Features:

- Personalized health coaching
- Hydration reminders
- Medicine reminders
- Daily health summary
- Wellness motivation
- Context-aware conversations
- Safe AI responses
- Markdown message support

The AI uses:

- User profile
- Today's water intake
- Active medicines
- Pending medicines
- Medicine logs

to generate personalized responses.

---

# 🛠 Tech Stack

## Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Context API

---

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcryptjs

---

## AI

- Google Gemini API
- @google/genai SDK

---

## Database

- MongoDB Atlas

---

# 📁 Project Structure

```
Aura-Health
│
├── frontend
│   ├── public
│   ├── src
│   │   ├── assets
│   │   ├── components
│   │   ├── constants
│   │   ├── context
│   │   ├── hooks
│   │   ├── layouts
│   │   ├── pages
│   │   ├── services
│   │   ├── utils
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
└── backend
    ├── config
    ├── controllers
    ├── middleware
    ├── models
    ├── routes
    ├── services
    ├── utils
    ├── server.js
    └── package.json
```

---

# 🚀 Installation

## 1. Clone Repository

```bash
git clone https://github.com/codedreammer/aura-health.git

cd aura-health
```

---

## 2. Install Frontend

```bash
cd frontend

npm install
```

---

## 3. Install Backend

```bash
cd ../backend

npm install
```

---

# ⚙ Environment Variables

Create a `.env` file inside the **backend** directory.

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

GEMINI_API_KEY=your_google_gemini_api_key

GEMINI_MODEL=gemini-3.6-flash
```

---

# ▶ Running the Project

## Backend

```bash
cd backend

npm run dev
```

or

```bash
node server.js
```

---

## Frontend

```bash
cd frontend

npm run dev
```

---

Frontend:

```
http://localhost:5173
```

Backend:

```
http://localhost:5000
```

---

# 🔐 API Endpoints

## Authentication

| Method | Endpoint |
|---------|----------|
| POST | /api/auth/register |
| POST | /api/auth/login |

---

## Users

| Method | Endpoint |
|---------|----------|
| GET | /api/users/profile |
| PUT | /api/users/profile |

---

## Medicines

| Method | Endpoint |
|---------|----------|
| GET | /api/medicines |
| POST | /api/medicines |
| PUT | /api/medicines/:id |
| DELETE | /api/medicines/:id |

---

## Medicine Logs

| Method | Endpoint |
|---------|----------|
| GET | /api/medicine-logs |
| POST | /api/medicine-logs |
| DELETE | /api/medicine-logs/:id |

---

## Water

| Method | Endpoint |
|---------|----------|
| GET | /api/water/today |
| POST | /api/water |
| DELETE | /api/water/:id |

---

## AI Coach

| Method | Endpoint |
|---------|----------|
| POST | /api/ai/chat |

---

# 🤖 AI Safety

Aura Health Coach is designed as a **wellness assistant**, **not a medical professional**.

The AI:

- Encourages healthy habits
- Promotes hydration
- Encourages medication adherence
- Motivates users
- Provides wellness suggestions

The AI does **not**:

- Diagnose diseases
- Prescribe medication
- Recommend dosage
- Replace professional healthcare advice

---

# 📸 Screenshots

![Login Page](../login.png)
![Dashboard](../dashboard.png)
![Coach](../coach.png)
![Insights](../insights.png)

# 📈 Future Enhancements

- Push Notifications
- Medicine Reminder Notifications
- Wearable Device Integration
- PDF Health Reports
- Health Score
- AI Weekly Wellness Reports
- Multi-language Support
- Voice-enabled AI Coach

---

# 👨‍💻 Team

Developed as part of the **IIT Jammu Hackathon**.

---

# 📄 License

This project is licensed under the MIT License.

---

# ⭐ Support

If you found this project useful,

⭐ Star the repository

🍴 Fork the project

📢 Share your feedback

---

# ❤️ Acknowledgements

- Google Gemini AI
- MongoDB Atlas
- React
- Node.js
- Express.js
- Tailwind CSS
- Vite

---

## 🌟 Aura Health

> **"Track Better. Live Healthier. Powered by AI."**