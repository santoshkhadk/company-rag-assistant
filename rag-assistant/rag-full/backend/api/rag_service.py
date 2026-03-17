"""
RAG Pipeline
============

Stage 1 – Ingestion
    upload file → extract_text() → chunk_text() → save DocumentChunk rows

Stage 2 – Retrieval (query time)
    user question → tokenize → TF-IDF cosine similarity vs all chunks → top-K

Stage 3 – Generation
    build system prompt with retrieved context → call Groq API → return answer
"""

import re
import math
import logging
from collections import Counter
from typing import List, Dict, Tuple, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# STAGE 1 – TEXT EXTRACTION
# ─────────────────────────────────────────────────────────────

def extract_text(file_path: str, file_type: str) -> str:
    """
    Extract plain text from a file.
    Supports: pdf, docx, txt, md, csv
    Falls back to raw UTF-8 read for unknown types.
    """
    ext = file_type.lower().lstrip('.')

    if ext in ('txt', 'md', 'csv'):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as fh:
            return fh.read()

    if ext == 'pdf':
        try:
            import PyPDF2
            pages = []
            with open(file_path, 'rb') as fh:
                reader = PyPDF2.PdfReader(fh)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        pages.append(text)
            return '\n\n'.join(pages)
        except ImportError:
            logger.warning('PyPDF2 not installed – falling back to raw read for PDF')
        except Exception as exc:
            logger.warning('PDF extraction error: %s', exc)

    if ext == 'docx':
        try:
            from docx import Document as DocxDoc
            doc   = DocxDoc(file_path)
            paras = [p.text for p in doc.paragraphs if p.text.strip()]
            # also grab table cells
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            paras.append(cell.text.strip())
            return '\n'.join(paras)
        except ImportError:
            logger.warning('python-docx not installed – falling back to raw read for DOCX')
        except Exception as exc:
            logger.warning('DOCX extraction error: %s', exc)

    # Generic fallback
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as fh:
        return fh.read()


# ─────────────────────────────────────────────────────────────
# STAGE 1 – CHUNKING
# ─────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: Optional[int] = None,
    overlap: Optional[int]    = None,
) -> List[str]:
    """
    Split text into overlapping word-based chunks.

    chunk_size  – max words per chunk  (default: settings.CHUNK_SIZE  = 500)
    overlap     – words shared between adjacent chunks
                  (default: settings.CHUNK_OVERLAP = 50)

    Returns a list of non-empty chunk strings.
    """
    chunk_size = chunk_size or getattr(settings, 'CHUNK_SIZE',    500)
    overlap    = overlap    or getattr(settings, 'CHUNK_OVERLAP',  50)

    # Normalise whitespace
    text  = re.sub(r'\s+', ' ', text).strip()
    words = text.split()
    if not words:
        return []

    chunks, start = [], 0
    while start < len(words):
        end   = min(start + chunk_size, len(words))
        chunk = ' '.join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(words):
            break
        start = end - overlap   # slide forward with overlap

    return chunks


# ─────────────────────────────────────────────────────────────
# STAGE 2 – TF-IDF RETRIEVAL
# ─────────────────────────────────────────────────────────────

STOP_WORDS = {
    'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
    'is','are','was','were','be','been','being','have','has','had','do','does',
    'did','will','would','could','should','may','might','not','no','this','that',
    'these','those','it','its','i','me','my','we','our','you','your','he','she',
    'they','them','s','t','can','just','now','so','such','than','too','very',
}


def _tokenize(text: str) -> List[str]:
    """Lowercase, remove punctuation, drop stop words and short tokens."""
    tokens = re.findall(r'\b[a-z]{2,}\b', text.lower())
    return [t for t in tokens if t not in STOP_WORDS]


def _tfidf_scores(
    query_tokens: List[str],
    corpus:       List[List[str]],
) -> List[float]:
    """
    Compute cosine-similarity between the query TF-IDF vector and each
    document in corpus.  Returns a list of float scores (same length as corpus).
    """
    N = len(corpus)
    if N == 0:
        return []

    # Document frequency
    df: Counter = Counter()
    for doc_tokens in corpus:
        df.update(set(doc_tokens))

    # IDF with smoothing
    idf: Dict[str, float] = {
        term: math.log((N + 1) / (cnt + 1)) + 1
        for term, cnt in df.items()
    }

    def vec(tokens: List[str]) -> Dict[str, float]:
        tf    = Counter(tokens)
        total = len(tokens) or 1
        return {t: (c / total) * idf.get(t, 0) for t, c in tf.items()}

    q_vec = vec(query_tokens)
    q_norm = math.sqrt(sum(v ** 2 for v in q_vec.values())) or 1e-9

    scores = []
    for doc_tokens in corpus:
        d_vec  = vec(doc_tokens)
        dot    = sum(q_vec.get(t, 0) * d_vec.get(t, 0) for t in q_vec)
        d_norm = math.sqrt(sum(v ** 2 for v in d_vec.values())) or 1e-9
        scores.append(dot / (q_norm * d_norm))

    return scores


def retrieve_chunks(
    query:        str,
    document_ids: Optional[List[str]] = None,
    top_k:        Optional[int]       = None,
) -> List[Dict]:
    """
    Find the most relevant DocumentChunk rows for *query*.

    Parameters
    ----------
    query        : user question string
    document_ids : restrict search to these document UUIDs (None = all ready docs)
    top_k        : how many chunks to return

    Returns
    -------
    List of dicts with keys:
        id, document_id, document_name, content, chunk_index, score
    """
    from api.models import DocumentChunk

    top_k = top_k or getattr(settings, 'TOP_K_RESULTS', 3)

    qs = DocumentChunk.objects.select_related('document').filter(
        document__status='ready'
    )
    if document_ids:
        qs = qs.filter(document_id__in=document_ids)

    chunks = list(qs)
    if not chunks:
        return []

    q_tokens      = _tokenize(query)
    corpus_tokens = [_tokenize(c.content) for c in chunks]
    scores        = _tfidf_scores(q_tokens, corpus_tokens)

    ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)

    results = []
    for chunk, score in ranked[:top_k]:
        if score < 0.005:           # skip near-zero relevance
            continue
        results.append({
            'id':            str(chunk.id),
            'document_id':   str(chunk.document_id),
            'document_name': chunk.document.name,
            'content':       chunk.content,
            'chunk_index':   chunk.chunk_index,
            'score':         round(score, 4),
        })

    return results


# ─────────────────────────────────────────────────────────────
# STAGE 3 – GROQ GENERATION
# ─────────────────────────────────────────────────────────────

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'


def _build_system_prompt(retrieved: List[Dict], company_name: str) -> str:
    """Build the system prompt injecting retrieved context."""
    if not retrieved:
        context_block = (
            "No relevant documents were found in the knowledge base for this query."
        )
    else:
        sections = []
        for i, chunk in enumerate(retrieved, 1):
            sections.append(
                f"[Source {i} | {chunk['document_name']} | chunk #{chunk['chunk_index']}]\n"
                f"{chunk['content']}"
            )
        context_block = "\n\n---\n\n".join(sections)

    return f"""You are an expert AI assistant for {company_name}.
Your job is to answer questions accurately using ONLY the context provided below.

RULES:
1. Base every answer strictly on the provided context.
2. If the answer is not in the context, say:
   "I don't have information about that in the current knowledge base."
3. Cite the source document name when stating specific facts.
4. Be concise, professional, and friendly.
5. Use bullet points when listing multiple items.
6. Never invent information.

=== KNOWLEDGE BASE CONTEXT ===
{context_block}
=== END OF CONTEXT ===
"""


def call_groq(
    messages:    List[Dict],
    model:       str   = 'llama-3.3-70b-versatile',
    api_key:     str   = '',
    temperature: float = 0.3,
    max_tokens:  int   = 1024,
) -> Tuple[str, Dict]:
    """
    Call Groq's OpenAI-compatible chat completions endpoint.

    Returns (answer_text, usage_dict).
    Raises RuntimeError on any API failure.
    """
    key = api_key or settings.GROQ_API_KEY
    if not key:
        raise RuntimeError(
            "Groq API key missing. Set GROQ_API_KEY in .env or pass api_key in request."
        )

    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type':  'application/json',
    }
    payload = {
        'model':       model,
        'messages':    messages,
        'temperature': temperature,
        'max_tokens':  max_tokens,
        'stream':      False,
    }

    try:
        resp = requests.post(GROQ_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
    except requests.Timeout:
        raise RuntimeError("Groq API request timed out (60 s).")
    except requests.HTTPError:
        try:
            detail = resp.json().get('error', {}).get('message', resp.text)
        except Exception:
            detail = resp.text
        raise RuntimeError(f"Groq API error {resp.status_code}: {detail}")
    except requests.RequestException as exc:
        raise RuntimeError(f"Network error calling Groq: {exc}")

    data   = resp.json()
    answer = data['choices'][0]['message']['content']
    usage  = data.get('usage', {})
    return answer, usage


# ─────────────────────────────────────────────────────────────
# PUBLIC: full RAG pipeline
# ─────────────────────────────────────────────────────────────

def rag_query(
    question:     str,
    document_ids: Optional[List[str]] = None,
    model:        str                 = 'llama-3.3-70b-versatile',
    api_key:      str                 = '',
    top_k:        Optional[int]       = None,
    history:      Optional[List[Dict]]= None,
    company_name: str                 = 'Our Company',
) -> Dict:
    """
    Full RAG pipeline: retrieve → build prompt → generate.

    Parameters
    ----------
    question     : user's question
    document_ids : UUIDs to restrict retrieval (None = all ready docs)
    model        : Groq model id
    api_key      : Groq API key (falls back to settings.GROQ_API_KEY)
    top_k        : number of chunks to retrieve
    history      : previous conversation turns  [{'role':'user','content':'...'}]
    company_name : inserted into system prompt

    Returns
    -------
    {
      'answer':  str,
      'sources': [{'document_id', 'document_name', 'chunk_index', 'score'}],
      'usage':   {'prompt_tokens', 'completion_tokens', 'total_tokens'},
      'model':   str,
    }
    """
    # ── 1. Retrieve ───────────────────────────────────────────
    retrieved = retrieve_chunks(question, document_ids=document_ids, top_k=top_k)
    logger.info("RAG: retrieved %d chunks for query: %s", len(retrieved), question[:60])

    # ── 2. Build message list ─────────────────────────────────
    system_prompt = _build_system_prompt(retrieved, company_name)
    messages: List[Dict] = [{'role': 'system', 'content': system_prompt}]

    # Inject last 6 turns of conversation history
    if history:
        for turn in history[-6:]:
            messages.append({'role': turn['role'], 'content': turn['content']})

    messages.append({'role': 'user', 'content': question})

    # ── 3. Generate ───────────────────────────────────────────
    answer, usage = call_groq(messages, model=model, api_key=api_key)

    sources = [
        {
            'document_id':   c['document_id'],
            'document_name': c['document_name'],
            'chunk_index':   c['chunk_index'],
            'score':         c['score'],
        }
        for c in retrieved
    ]

    return {
        'answer':  answer,
        'sources': sources,
        'usage':   usage,
        'model':   model,
    }
