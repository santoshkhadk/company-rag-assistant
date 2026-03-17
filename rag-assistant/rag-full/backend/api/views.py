import logging
import os

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import Document, DocumentChunk, ChatSession, Message
from .serializers import (
    DocumentSerializer, DocumentUploadSerializer, DocumentChunkSerializer,
    ChatSessionSerializer, MessageSerializer, ChatQuerySerializer,
)
from .rag_service import extract_text, chunk_text, rag_query

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# DOCUMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
def document_list(request):
    """GET /api/documents/ — list all documents"""
    docs = Document.objects.all()
    return Response(DocumentSerializer(docs, many=True, context={'request': request}).data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def document_upload(request):
    """
    POST /api/documents/upload/
    Multipart body: file (required), name, chunk_size, chunk_overlap
    Extracts text → chunks → saves DocumentChunk rows → returns Document.
    """
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

        chunks = chunk_text(
            text,
            chunk_size=vd.get('chunk_size'),
            overlap=vd.get('chunk_overlap'),
        )
        if not chunks:
            raise ValueError("Document produced zero chunks after processing.")

        DocumentChunk.objects.bulk_create([
            DocumentChunk(
                document=doc, content=ch,
                chunk_index=i, word_count=len(ch.split()),
            )
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
    """GET|DELETE /api/documents/<doc_id>/"""
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
    """GET /api/documents/<doc_id>/chunks/"""
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
    """POST /api/documents/<doc_id>/reprocess/ — re-extract and re-chunk"""
    try:
        doc = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    doc.chunks.all().delete()
    doc.status    = 'processing'
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
    """GET /api/sessions/"""
    sessions = ChatSession.objects.all()
    return Response(ChatSessionSerializer(sessions, many=True).data)


@api_view(['POST'])
def session_create(request):
    """POST /api/sessions/create/  body: {title}"""
    title   = request.data.get('title', 'New Chat')
    session = ChatSession.objects.create(title=title)
    return Response(ChatSessionSerializer(session).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
def session_detail(request, session_id):
    """GET|DELETE /api/sessions/<session_id>/"""
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
# RAG CHAT ENDPOINT
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@parser_classes([JSONParser])
def chat_query(request):
    """
    POST /api/chat/
    JSON body:
        question       str  (required)
        session_id     UUID (optional – created if absent)
        document_ids   list[UUID] (optional – restricts retrieval)
        model          str  (optional)
        top_k          int  (optional, 1-10)
        api_key        str  (optional – falls back to env GROQ_API_KEY)
        company_name   str  (optional)
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
        return Response(
            {'error': 'Groq API key required. Pass api_key in body or set GROQ_API_KEY in .env'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Resolve or create session
    session_id = vd.get('session_id')
    if session_id:
        session, _ = ChatSession.objects.get_or_create(
            id=session_id,
            defaults={'title': question[:60]},
        )
    else:
        session = ChatSession.objects.create(title=question[:60])

    # Build conversation history from DB
    history = [
        {'role': m.role, 'content': m.content}
        for m in session.messages.all()
    ]

    # Persist user message
    Message.objects.create(session=session, role='user', content=question)

    # ── RAG ──────────────────────────────────────────────────
    try:
        result = rag_query(
            question=question,
            document_ids=doc_ids,
            model=model,
            api_key=api_key,
            top_k=top_k,
            history=history,
            company_name=company_name,
        )
    except Exception as exc:
        logger.exception("RAG query failed")
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Persist assistant message
    assistant_msg = Message.objects.create(
        session=session,
        role='assistant',
        content=result['answer'],
        sources=result['sources'],
        model_used=result['model'],
    )

    # Update session title after first exchange
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
# STATS
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
def stats(request):
    """GET /api/stats/"""
    return Response({
        'total_documents': Document.objects.count(),
        'ready_documents': Document.objects.filter(status='ready').count(),
        'total_chunks':    DocumentChunk.objects.count(),
        'total_sessions':  ChatSession.objects.count(),
        'total_messages':  Message.objects.count(),
    })
