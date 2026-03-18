import logging
import os
import json

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import Document, DocumentChunk, ChatSession, Message
from .serializers import (
    DocumentSerializer, DocumentUploadSerializer, DocumentChunkSerializer,
    ChatSessionSerializer, MessageSerializer, ChatQuerySerializer,
)
from .rag_service import extract_text, chunk_text, rag_query, retrieve_chunks, _build_system_prompt, call_groq, is_conversational, _get_available_docs

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# DOCUMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
def document_list(request):
    docs = Document.objects.all()
    return Response(DocumentSerializer(docs, many=True, context={'request': request}).data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def document_upload(request):
    ser = DocumentUploadSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    vd   = ser.validated_data
    file = vd['file']
    name = vd.get('name') or file.name
    ext  = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else 'txt'

    doc = Document.objects.create(
        name=name, file=file,
        file_type=ext, file_size=file.size,
        status='processing',
    )

    try:
        text   = extract_text(doc.file.path, ext)
        if not text.strip():
            raise ValueError("No text could be extracted from the uploaded file.")
        chunks = chunk_text(text, chunk_size=vd.get('chunk_size'), overlap=vd.get('chunk_overlap'))
        if not chunks:
            raise ValueError("Document produced zero chunks after processing.")

        DocumentChunk.objects.bulk_create([
            DocumentChunk(document=doc, content=ch, chunk_index=i, word_count=len(ch.split()))
            for i, ch in enumerate(chunks)
        ])
        doc.chunk_count = len(chunks)
        doc.status      = 'ready'
        doc.save(update_fields=['chunk_count', 'status', 'updated_at'])
    except Exception as exc:
        logger.exception("Document processing failed: %s", doc.id)
        doc.status    = 'error'
        doc.error_msg = str(exc)
        doc.save(update_fields=['status', 'error_msg', 'updated_at'])

    return Response(
        DocumentSerializer(doc, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET', 'DELETE'])
def document_detail(request, doc_id):
    try:
        doc = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        try:
            if doc.file and os.path.exists(doc.file.path):
                os.remove(doc.file.path)
        except Exception:
            pass
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    return Response(DocumentSerializer(doc, context={'request': request}).data)


@api_view(['GET'])
def document_chunks(request, doc_id):
    try:
        doc = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'document': doc.name,
        'total':    doc.chunk_count,
        'chunks':   DocumentChunkSerializer(doc.chunks.all(), many=True).data,
    })


@api_view(['POST'])
def reprocess_document(request, doc_id):
    try:
        doc = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    doc.chunks.all().delete()
    doc.status = 'processing'
    doc.error_msg = ''
    doc.save(update_fields=['status', 'error_msg', 'updated_at'])

    try:
        text   = extract_text(doc.file.path, doc.file_type)
        chunks = chunk_text(text)
        DocumentChunk.objects.bulk_create([
            DocumentChunk(document=doc, content=ch, chunk_index=i, word_count=len(ch.split()))
            for i, ch in enumerate(chunks)
        ])
        doc.chunk_count = len(chunks)
        doc.status      = 'ready'
        doc.save(update_fields=['chunk_count', 'status', 'updated_at'])
    except Exception as exc:
        doc.status    = 'error'
        doc.error_msg = str(exc)
        doc.save(update_fields=['status', 'error_msg', 'updated_at'])

    return Response(DocumentSerializer(doc, context={'request': request}).data)


# ─────────────────────────────────────────────────────────────
# CHAT SESSION ENDPOINTS
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
def session_list(request):
    sessions = ChatSession.objects.all()
    return Response(ChatSessionSerializer(sessions, many=True).data)


@api_view(['POST'])
def session_create(request):
    title   = request.data.get('title', 'New Chat')
    session = ChatSession.objects.create(title=title)
    return Response(ChatSessionSerializer(session).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
def session_detail(request, session_id):
    try:
        session = ChatSession.objects.get(id=session_id)
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    return Response({
        'session':  ChatSessionSerializer(session).data,
        'messages': MessageSerializer(session.messages.all(), many=True).data,
    })


# ─────────────────────────────────────────────────────────────
# RAG CHAT — STANDARD (non-streaming)
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@parser_classes([JSONParser])
def chat_query(request):
    ser = ChatQuerySerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    vd           = ser.validated_data
    question     = vd['question']
    model        = vd['model']
    top_k        = vd['top_k']
    doc_ids      = [str(uid) for uid in vd.get('document_ids', [])] or None
    api_key      = vd.get('api_key') or settings.GROQ_API_KEY
    company_name = vd['company_name']

    if not api_key:
        return Response({'error': 'Groq API key required.'}, status=status.HTTP_400_BAD_REQUEST)

    session_id = vd.get('session_id')
    if session_id:
        session, _ = ChatSession.objects.get_or_create(id=session_id, defaults={'title': question[:60]})
    else:
        session = ChatSession.objects.create(title=question[:60])

    history = [{'role': m.role, 'content': m.content} for m in session.messages.all()]
    Message.objects.create(session=session, role='user', content=question)

    try:
        result = rag_query(
            question=question, document_ids=doc_ids, model=model,
            api_key=api_key, top_k=top_k, history=history, company_name=company_name,
        )
    except Exception as exc:
        logger.exception("RAG query failed")
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    assistant_msg = Message.objects.create(
        session=session, role='assistant',
        content=result['answer'], sources=result['sources'], model_used=result['model'],
    )

    if session.messages.count() <= 2:
        session.title = question[:80]
        session.save(update_fields=['title', 'updated_at'])

    return Response({
        'session_id': str(session.id),
        'message_id': str(assistant_msg.id),
        'answer':     result['answer'],
        'sources':    result['sources'],
        'usage':      result['usage'],
        'model':      result['model'],
    })


# ─────────────────────────────────────────────────────────────
# RAG CHAT — STREAMING  ✨ NEW
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@parser_classes([JSONParser])
def chat_stream(request):
    """
    POST /api/chat/stream/
    Same body as /api/chat/ but returns a Server-Sent Events stream.
    Each event is: data: {"token": "..."}\n\n
    Final event:   data: {"done": true, "message_id": "...", "session_id": "...", "sources": [...]}\n\n
    """
    ser = ChatQuerySerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    vd           = ser.validated_data
    question     = vd['question']
    model        = vd['model']
    top_k        = vd['top_k']
    doc_ids      = [str(uid) for uid in vd.get('document_ids', [])] or None
    api_key      = vd.get('api_key') or settings.GROQ_API_KEY
    company_name = vd['company_name']

    if not api_key:
        def err():
            yield 'data: ' + json.dumps({'error': 'Groq API key required.'}) + '\n\n'
        return StreamingHttpResponse(err(), content_type='text/event-stream')

    # Resolve or create session
    session_id = vd.get('session_id')
    if session_id:
        session, _ = ChatSession.objects.get_or_create(id=session_id, defaults={'title': question[:60]})
    else:
        session = ChatSession.objects.create(title=question[:60])

    history = [{'role': m.role, 'content': m.content} for m in session.messages.all()]
    Message.objects.create(session=session, role='user', content=question)

    # RAG retrieval (same as always)
    chat_mode = is_conversational(question)
    if chat_mode:
        retrieved = []
    else:
        retrieved = retrieve_chunks(question, document_ids=doc_ids, top_k=top_k)

    system_prompt = _build_system_prompt(retrieved, company_name, conversational=chat_mode)
    messages_payload = [{'role': 'system', 'content': system_prompt}]
    for turn in (history or [])[-6:]:
        messages_payload.append({'role': turn['role'], 'content': turn['content']})
    messages_payload.append({'role': 'user', 'content': question})

    sources = [
        {'document_id': c['document_id'], 'document_name': c['document_name'],
         'chunk_index': c['chunk_index'], 'score': c['score']}
        for c in retrieved
    ]

    import requests as req_lib

    def stream_generator():
        full_answer = ''
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
        payload = {
            'model':       model,
            'messages':    messages_payload,
            'temperature': 0.7 if chat_mode else 0.3,
            'max_tokens':  1024,
            'stream':      True,   # ← streaming ON
        }

        try:
            with req_lib.post(
                'https://api.groq.com/openai/v1/chat/completions',
                json=payload, headers=headers,
                stream=True, timeout=60
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line:
                        continue
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str.strip() == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk['choices'][0]['delta']
                            token = delta.get('content', '')
                            if token:
                                full_answer += token
                                yield 'data: ' + json.dumps({'token': token}) + '\n\n'
                        except (json.JSONDecodeError, KeyError):
                            continue

        except Exception as exc:
            yield 'data: ' + json.dumps({'error': str(exc)}) + '\n\n'
            return

        # Save assistant message to DB
        assistant_msg = Message.objects.create(
            session=session, role='assistant',
            content=full_answer, sources=sources, model_used=model,
        )

        if session.messages.count() <= 2:
            session.title = question[:80]
            session.save(update_fields=['title', 'updated_at'])

        # Final event with metadata
        yield 'data: ' + json.dumps({
            'done':       True,
            'message_id': str(assistant_msg.id),
            'session_id': str(session.id),
            'sources':    sources,
            'model':      model,
        }) + '\n\n'

    response = StreamingHttpResponse(
        stream_generator(),
        content_type='text/event-stream',
    )
    response['Cache-Control']               = 'no-cache'
    response['X-Accel-Buffering']           = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    return response


# ─────────────────────────────────────────────────────────────
# FEEDBACK  ✨ NEW
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@parser_classes([JSONParser])
def message_feedback(request, message_id):
    """
    POST /api/messages/<message_id>/feedback/
    Body: { "rating": "up" | "down", "comment": "optional text" }
    """
    try:
        msg = Message.objects.get(id=message_id)
    except Message.DoesNotExist:
        return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

    rating  = request.data.get('rating')
    comment = request.data.get('comment', '')

    if rating not in ('up', 'down'):
        return Response({'error': 'Rating must be "up" or "down".'}, status=status.HTTP_400_BAD_REQUEST)

    # Store in the sources JSON field as a feedback sub-key (no extra migration needed)
    feedback = {'rating': rating, 'comment': comment}
    if isinstance(msg.sources, list):
        msg.sources = {'chunks': msg.sources, 'feedback': feedback}
    elif isinstance(msg.sources, dict):
        msg.sources['feedback'] = feedback
    msg.save(update_fields=['sources'])

    return Response({'status': 'saved', 'rating': rating})


@api_view(['GET'])
def feedback_list(request):
    """GET /api/feedback/ — all messages that have feedback"""
    messages = Message.objects.filter(role='assistant').exclude(sources={})
    results = []
    for msg in messages:
        src = msg.sources
        if isinstance(src, dict) and 'feedback' in src:
            results.append({
                'message_id': str(msg.id),
                'session_id': str(msg.session_id),
                'content':    msg.content[:200],
                'rating':     src['feedback'].get('rating'),
                'comment':    src['feedback'].get('comment', ''),
                'created_at': msg.created_at.isoformat(),
            })
    return Response(results)


# ─────────────────────────────────────────────────────────────
# DASHBOARD STATS  ✨ NEW
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
def dashboard(request):
    """GET /api/dashboard/ — full analytics for the dashboard page"""
    from django.db.models import Count, Q
    from django.utils import timezone
    from datetime import timedelta

    now   = timezone.now()
    today = now.date()
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # ── Document stats ────────────────────────────────────────
    total_docs   = Document.objects.count()
    ready_docs   = Document.objects.filter(status='ready').count()
    error_docs   = Document.objects.filter(status='error').count()
    total_chunks = DocumentChunk.objects.count()

    doc_types = list(
        Document.objects.values('file_type')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    recent_docs = list(
        Document.objects.order_by('-created_at')[:5].values(
            'id', 'name', 'file_type', 'chunk_count', 'status', 'created_at'
        )
    )
    for d in recent_docs:
        d['id'] = str(d['id'])
        d['created_at'] = d['created_at'].isoformat()

    # ── Chat stats ────────────────────────────────────────────
    total_sessions   = ChatSession.objects.count()
    total_messages   = Message.objects.count()
    user_messages    = Message.objects.filter(role='user').count()
    ai_messages      = Message.objects.filter(role='assistant').count()

    sessions_today   = ChatSession.objects.filter(created_at__date=today).count()
    sessions_week    = ChatSession.objects.filter(created_at__gte=week_ago).count()
    sessions_month   = ChatSession.objects.filter(created_at__gte=month_ago).count()

    messages_today   = Message.objects.filter(created_at__date=today).count()
    messages_week    = Message.objects.filter(created_at__gte=week_ago).count()

    # ── Daily message counts (last 7 days) ────────────────────
    daily_counts = []
    for i in range(6, -1, -1):
        day   = (now - timedelta(days=i)).date()
        count = Message.objects.filter(created_at__date=day, role='user').count()
        daily_counts.append({'date': str(day), 'count': count})

    # ── Feedback stats ────────────────────────────────────────
    all_feedback = []
    thumbs_up    = 0
    thumbs_down  = 0
    for msg in Message.objects.filter(role='assistant'):
        src = msg.sources
        if isinstance(src, dict) and 'feedback' in src:
            fb = src['feedback']
            if fb.get('rating') == 'up':
                thumbs_up += 1
            elif fb.get('rating') == 'down':
                thumbs_down += 1
            all_feedback.append({
                'message_id': str(msg.id),
                'rating':     fb.get('rating'),
                'comment':    fb.get('comment', ''),
                'content':    msg.content[:150],
                'created_at': msg.created_at.isoformat(),
            })

    satisfaction = 0
    if thumbs_up + thumbs_down > 0:
        satisfaction = round((thumbs_up / (thumbs_up + thumbs_down)) * 100)

    # ── Most active sessions ──────────────────────────────────
    top_sessions = list(
        ChatSession.objects.annotate(msg_count=Count('messages'))
        .order_by('-msg_count')[:5]
        .values('id', 'title', 'msg_count', 'created_at')
    )
    for s in top_sessions:
        s['id'] = str(s['id'])
        s['created_at'] = s['created_at'].isoformat()

    return Response({
        'documents': {
            'total':        total_docs,
            'ready':        ready_docs,
            'error':        error_docs,
            'total_chunks': total_chunks,
            'by_type':      doc_types,
            'recent':       recent_docs,
        },
        'chats': {
            'total_sessions':  total_sessions,
            'total_messages':  total_messages,
            'user_messages':   user_messages,
            'ai_messages':     ai_messages,
            'sessions_today':  sessions_today,
            'sessions_week':   sessions_week,
            'sessions_month':  sessions_month,
            'messages_today':  messages_today,
            'messages_week':   messages_week,
            'daily_counts':    daily_counts,
            'top_sessions':    top_sessions,
        },
        'feedback': {
            'thumbs_up':    thumbs_up,
            'thumbs_down':  thumbs_down,
            'satisfaction': satisfaction,
            'recent':       all_feedback[-10:],
        },
    })


# ─────────────────────────────────────────────────────────────
# ORIGINAL STATS (kept for compatibility)
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
def stats(request):
    return Response({
        'total_documents': Document.objects.count(),
        'ready_documents': Document.objects.filter(status='ready').count(),
        'total_chunks':    DocumentChunk.objects.count(),
        'total_sessions':  ChatSession.objects.count(),
        'total_messages':  Message.objects.count(),
    })
