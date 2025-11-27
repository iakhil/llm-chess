# LLM Chess

LLM Chess is a lightweight browser-based chess experience where you play against a large-language-model-powered opponent using your own OpenAI API key.

## How it works

- The UI (`index.html`, `static/js/game.js`, `static/css/style.css`) renders a chessboard via Chessboard.js + Chess.js.
- When it's the AI's turn, the frontend posts directly to `https://api.openai.com/v1/chat/completions` with the stored OpenAI key so the AI can reason about the position and return a JSON move.
- Illegal-move detection and a simple overlay enforce a clean experience, while API keys live only in the user's browser `localStorage`.
- A legacy Flask server (`app.py`) still exists but is currently dormant and not used by the UI; you can remove it if you want a pure static deployment.

## Getting started

1. Install dependencies and run a local dev server (optional):
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```
   The Flask app serves the static pages on `http://localhost:5001`, but the UI now calls OpenAI directly.
2. Alternatively, open `index.html` in a static hosting environment (GitHub Pages, Netlify, etc.).
3. Click the settings icon, paste your OpenAI API key, and start a new game. The key is stored only in your browser.

## Notes

- Only models starting with `gpt` are listed; feel free to extend the dropdown if you plan to support other providers again.
- Because the browser makes requests straight to OpenAI, make sure your key stays private (don’t paste it in shared browsers).
- The project keeps the Flask backend around in case you want to reintroduce a proxy, but it’s not required for the current experience.

