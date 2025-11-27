from flask import Flask, render_template, request, jsonify
import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

def get_gpt_move(pgn, model, api_key):
    client = OpenAI(api_key=api_key)
    prompt = f"""You are a chess grandmaster.
PGN: {pgn}
Analyze the position and determine the best move for the side to move.
Provide your response in JSON format with two keys: "reasoning" (string) and "move" (string, UCI format e.g. e2e4).
"""
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a chess engine. Output JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        return {"error": str(e)}

def get_claude_move(pgn, model, api_key):
    client = Anthropic(api_key=api_key)
    prompt = f"""You are a chess grandmaster.
PGN: {pgn}
Analyze the position and determine the best move for the side to move.
Provide your response in JSON format with two keys: "reasoning" (string) and "move" (string, UCI format e.g. e2e4).
"""
    try:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        # Claude doesn't have a strict JSON mode like OpenAI, so we might need to parse.
        # But usually it's good if we ask for JSON.
        # Let's try to find the JSON in the text.
        content = message.content[0].text
        # Simple heuristic to extract JSON if there's extra text
        start = content.find('{')
        end = content.rfind('}') + 1
        if start != -1 and end != -1:
            json_str = content[start:end]
            return json.loads(json_str)
        return {"error": "Could not parse JSON from Claude response"}
    except Exception as e:
        return {"error": str(e)}

def get_gemini_move(pgn, model, api_key):
    genai.configure(api_key=api_key)
    # Mapping model names if necessary, but 'gemini-1.5-pro' should work if available
    # The frontend sends 'gemini-1.5-pro', let's use 'gemini-pro' or similar if needed.
    # For now assume the user selects a valid model name or we map it.
    
    # Note: google-generativeai SDK usage
    try:
        m = genai.GenerativeModel(model)
        prompt = f"""You are a chess grandmaster.
PGN: {pgn}
Analyze the position and determine the best move for the side to move.
Return ONLY a JSON object with keys: "reasoning" and "move" (string, UCI format e.g. e2e4).
"""
        response = m.generate_content(prompt)
        content = response.text
        # Clean up markdown code blocks if present
        content = content.replace('```json', '').replace('```', '')
        start = content.find('{')
        end = content.rfind('}') + 1
        if start != -1 and end != -1:
            json_str = content[start:end]
            return json.loads(json_str)
        return {"error": "Could not parse JSON from Gemini response"}
    except Exception as e:
        return {"error": str(e)}

@app.route('/api/move', methods=['POST'])
def get_move():
    data = request.json
    pgn = data.get('pgn')
    model = data.get('model')
    api_key = data.get('api_key')
    
    if not pgn or not model:
        return jsonify({'error': 'Missing PGN or model'}), 400
    
    if not api_key:
        return jsonify({'error': 'Missing API Key'}), 400
    
    result = {}
    if 'gpt' in model:
        result = get_gpt_move(pgn, model, api_key)
    elif 'claude' in model:
        result = get_claude_move(pgn, model, api_key)
    elif 'gemini' in model:
        result = get_gemini_move(pgn, model, api_key)
    else:
        return jsonify({'error': 'Unsupported model'}), 400
        
    if 'error' in result:
        return jsonify({'error': result['error']}), 500
        
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
