from flask import Flask, render_template, request, jsonify
import ollama
import sqlite3
import PyPDF2 # <-- New Library for PDF

app = Flask(__name__)
DB_FILE = 'history.db'

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS history
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, question TEXT, answer TEXT)''')
        conn.commit()

init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_text = request.json.get('message')
    try:
        response = ollama.chat(model='llama3', messages=[{'role': 'user', 'content': user_text}])
        reply = response['message']['content']
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"reply": "Error connecting to Ollama. Make sure it is running!"})

# --- FILE UPLOAD API ---
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    text = ""
    try:
        if file.filename.endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + " "
        elif file.filename.endswith('.txt'):
            text = file.read().decode('utf-8')
        else:
            return jsonify({"error": "Unsupported file type. Please upload .txt or .pdf"}), 400
        
        if not text.strip():
            return jsonify({"error": "File is empty or unreadable."}), 400

        return jsonify({"text": text.strip()})
    except Exception as e:
        return jsonify({"error": f"Error reading file: {str(e)}"}), 500

# --- DATABASE API ROUTES ---
@app.route('/api/history', methods=['GET'])
def get_history():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("SELECT id, title, question, answer FROM history ORDER BY id ASC")
        rows = c.fetchall()
        history = [{"id": r[0], "title": r[1], "q": r[2], "a": r[3]} for r in rows]
        return jsonify(history)

@app.route('/api/history', methods=['POST'])
def add_history():
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO history (title, question, answer) VALUES (?, ?, ?)", (data['title'], data['q'], data['a']))
        conn.commit()
        return jsonify({"status": "success", "id": c.lastrowid})

@app.route('/api/history/<int:item_id>', methods=['PUT'])
def update_history(item_id):
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("UPDATE history SET title = ? WHERE id = ?", (data['title'], item_id))
        conn.commit()
        return jsonify({"status": "success"})

@app.route('/api/history/<int:item_id>', methods=['DELETE'])
def delete_history(item_id):
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM history WHERE id = ?", (item_id,))
        conn.commit()
        return jsonify({"status": "success"})

@app.route('/api/history/all', methods=['DELETE'])
def clear_all_history():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM history")
        conn.commit()
        return jsonify({"status": "success"})

if __name__ == "__main__":
    print("Starting server... Go to http://127.0.0.1:5050")
    app.run(debug=True, port=5050)