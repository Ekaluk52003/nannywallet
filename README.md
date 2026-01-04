# NanyWallet (Aunty Duang) 👛

**Your AI-Powered Personal Finance Assistant.**

NanyWallet is a modern, serverless personal finance tracker that runs entirely in your browser. It uses **Google Sheets** as a private, secure database and leverages **Google Gemini AI** to allow you to record transactions using natural voice commands (supporting both Thai and English).

![NanyWallet Screenshot](https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=2340&ixlib=rb-4.0.3)
*(Replace with actual screenshot)*

---

## ✨ Key Features

*   **🛡️ Private & Secure**: Your data lives in your own Google Drive (inside Google Sheets). No external database servers.
*   **🗣️ AI Voice Assistant**: Just say *"Lunch 50 baht"* or *"Salary 50000"*, and Gemini AI categorizes and records it automatically.
*   **📂 Multi-Wallet Support**: Create separate wallets for "Personal", "Family", or "Travel" expenses.
*   **📊 Dashboard & Analytics**: Real-time monthly summaries, category breakdowns, and beautiful charts.
*   **🌓 Modern UI**: Sleek, responsive design with full **Dark Mode** support.
*   **🔄 Real-time Sync**: Instant updates to your Google Sheets.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), TypeScript
*   **Styling**: Tailwind CSS (with Glassmorphism design)
*   **Auth & Database**: Google OAuth 2.0, Google Sheets API v4
*   **AI**: Google Gemini Pro (via API)
*   **Icons**: Lucide React

---

## 🚀 Getting Started

### Prerequisites

1.  **Node.js**: Ensure you have Node.js installed (v16 or higher).
2.  **Google Cloud Console Project**: You need a Client ID to access Google APIs.

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/nanywallet.git
cd nanywallet
npm install
```

### 2. Google Cloud Configuration - **Important!** ⚠️

To make the app work, you must set up a Google Cloud Project:

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project.
3.  **Enable APIs**: Search for and enable the following APIs:
    *   **Google Sheets API**
    *   **Google Drive API**
4.  **Configure OAuth Consent Screen**:
    *   Select **External** (unless you have a Google Workspace organization).
    *   Add your email as a test user.
    *   **Scopes**: Add `.../auth/drive.file` and `.../auth/spreadsheets`.
5.  **Create Credentials**:
    *   Go to Credentials > Create Credentials > **OAuth client ID**.
    *   Application type: **Web application**.
    *   **Authorized JavaScript origins**:
        *   `http://localhost:3000` (or your dev port)
        *   `http://localhost`
6.  Copy your **Client ID**.

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Google OAuth Client ID (Required for Login)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

### 4. Run the App

Start the development server:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🎤 How to Use Voice Assistant

1.  Log in with your Google Account.
2.  Go to **Settings** (Click your profile picture -> Settings).
3.  Enter your **Gemini API Key**. (Get one free at [aistudio.google.com](https://aistudio.google.com/)).
4.  On the dashboard, click **"Tap to Speak"**.
5.  Examples:
    *   *"Bought coffee for 120"* -> Adds ฿120 Expense (Category: Food)
    *   *"Taxi to office 300"* -> Adds ฿300 Expense (Category: Transport)
    *   *"Bonus 20000"* -> Adds ฿20,000 Income

---

## 📝 License

MIT License. Feel free to use and modify for your personal budgeting needs!
