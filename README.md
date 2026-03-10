# Smart Hybrid OCR & Handwriting Transcriber

A powerful, privacy-focused web application for extracting text, tables, and handwritten notes from images. This tool uses a **Smart Hybrid Engine** that combines local, offline OCR with advanced cloud-based AI for complex documents.

## 🚀 Key Features

- **Smart Hybrid OCR**: 
  - **Basic OCR (Local)**: Uses Tesseract.js for fast, private, and offline extraction of printed text.
  - **Advanced AI (Cloud)**: Uses Google Gemini AI for handwriting, complex tables, and multi-language support.
- **Handwriting Mode**: Specialized AI prompts to accurately transcribe handwritten logs, notes, and symbols (including "ditto marks").
- **Table to Excel**: Automatically detects tables and converts them into downloadable `.xlsx` files.
- **Address Parser**: Extracts structured address data from labels and forms.
- **Privacy First**: API keys are stored only in your browser's local storage and are never sent to a server.

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🌐 Deployment Guide (GitHub Pages)

The best way to deploy this app is to push the **source code** to GitHub and use **GitHub Actions** to build and host it.

### Step 1: Push to GitHub
1. Create a new repository on GitHub.
2. In your local project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/your-repo-name.git
   git push -u origin main
   ```

### Step 2: Configure GitHub Pages
1. Go to your repository on GitHub.
2. Click **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. GitHub will suggest a workflow (e.g., "Static HTML" or "Vite"). Choose the **Vite** or **Node.js** template.
5. Commit the workflow file. GitHub will now automatically build and deploy your app every time you push changes!

## 🔐 Security & API Keys

This application requires a **Gemini API Key** for Advanced AI features (Handwriting, Tables, etc.).
1. Get your free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open the **Settings** menu in the app and enter your key.
3. Your key is saved in your browser's `localStorage` and is **never** committed to your GitHub repository.

## 📄 License
MIT License - feel free to use and modify for your own projects!
