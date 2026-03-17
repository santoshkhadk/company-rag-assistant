# RAG Company Assistant — Django + React + Groq

A full-stack Retrieval-Augmented Generation (RAG) app.
Upload company documents → ask questions → get cited answers powered by Groq LLM.

---

## Project Structure

```
rag-full/
├── backend/               ← Django REST API
│   ├── core/
│   │   ├── settings.py    CORS, DB, upload/chunk settings
│   │   ├── urls.py        Root URL routing
│   │   └── wsgi.py
│   ├── api/
│   │   ├── models.py      Document, DocumentChunk, ChatSession, Message
│   │   ├── rag_service.py Full pipeline: extract → chunk → TF-IDF → Groq
│   │   ├── serializers.py DRF serializers + validation
│   │   ├── views.py       All REST endpoints
│   │   └── urls.py        API URL patterns
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/              ← React SPA
    ├── public/index.html
    └── src/
        ├── App.jsx              Root component
        ├── index.js             Entry point
        ├── index.css            Global styles
        ├── store/index.js       Global state (useReducer)
        ├── hooks/useRag.js      useDocuments + useChat hooks
        ├── services/api.js      Fetch wrapper for all endpoints
        ├── components/
        │   ├── Sidebar.jsx      Docs tab + Chats tab
        │   ├── Header.jsx       Top bar with status + settings
        │   ├── ChatMessage.jsx  Bubble + markdown + source chips
        │   ├── ChatInput.jsx    Textarea + send button + suggestions
        │   ├── DocumentUpload.jsx  Drag-drop upload modal
        │   └── SettingsPanel.jsx   API key + model + top-k config
        └── pages/
            └── ChatPage.jsx     Main chat view
```

---

## Quick Start

### 1 — Backend

```bash
cd backend

# Create and activate virtualenv
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set GROQ_API_KEY=gsk_...

# Run migrations and start server
python manage.py migrate
python manage.py runserver
# API available at http://localhost:8000/api/
```

### 2 — Frontend

```bash
cd frontend
npm install
npm start
# App available at http://localhost:3000
```

---

## API Endpoints

| Method | URL                                   | Description                  |
|--------|---------------------------------------|------------------------------|
| GET    | /api/stats/                           | Dashboard stats              |
| GET    | /api/documents/                       | List all documents           |
| POST   | /api/documents/upload/                | Upload + process document    |
| GET    | /api/documents/{id}/                  | Get document detail          |
| DELETE | /api/documents/{id}/                  | Delete document              |
| GET    | /api/documents/{id}/chunks/           | List all chunks              |
| POST   | /api/documents/{id}/reprocess/        | Re-extract and re-chunk      |
| GET    | /api/sessions/                        | List chat sessions           |
| POST   | /api/sessions/create/                 | Create new session           |
| GET    | /api/sessions/{id}/                   | Get session + messages       |
| DELETE | /api/sessions/{id}/                   | Delete session               |
| POST   | /api/chat/                            | RAG query (main endpoint)    |

### POST /api/chat/ body
```json
{
  "question":     "What is the refund policy?",
  "session_id":   "uuid (optional)",
  "document_ids": ["uuid", "uuid"],
  "model":        "llama-3.3-70b-versatile",
  "top_k":        3,
  "api_key":      "gsk_... (optional if set in .env)",
  "company_name": "Acme Corp"
}
```

---

## RAG Pipeline

```
Upload file
    │
    ▼
extract_text()          ← PyPDF2 / python-docx / plain read
    │
    ▼
chunk_text()            ← word-based sliding window with overlap
    │
    ▼
DocumentChunk rows      ← stored in SQLite

Query time:
    │
    ▼
tokenize query          ← lowercase, remove stop words
    │
    ▼
TF-IDF cosine sim       ← scored against all chunks in DB
    │
    ▼
top-K chunks            ← injected into system prompt
    │
    ▼
Groq API call           ← llama-3.3-70b-versatile (default)
    │
    ▼
Answer + sources        ← returned to frontend
```

---

## Supported File Types
- PDF (.pdf)
- Word (.docx)
- Plain text (.txt)
- Markdown (.md)
- CSV (.csv)

## Groq Models
- `llama-3.3-70b-versatile` — Best quality (default)
- `llama-3.1-8b-instant`    — Fastest
- `mixtral-8x7b-32768`      — Long context
- `gemma2-9b-it`            — Compact

Get a free API key at https://console.groq.com
