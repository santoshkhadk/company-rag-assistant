from rest_framework import serializers
from .models import Document, DocumentChunk, ChatSession, Message


class DocumentSerializer(serializers.ModelSerializer):
    file_size_display = serializers.ReadOnlyField()
    file_url          = serializers.SerializerMethodField()

    class Meta:
        model  = Document
        fields = [
            'id', 'name', 'file_type', 'file_size', 'file_size_display',
            'status', 'error_msg', 'chunk_count', 'file_url',
            'created_at', 'updated_at',
        ]

    def get_file_url(self, obj):
        req = self.context.get('request')
        if obj.file and req:
            return req.build_absolute_uri(obj.file.url)
        return None


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DocumentChunk
        fields = ['id', 'chunk_index', 'word_count', 'content', 'created_at']


class DocumentUploadSerializer(serializers.Serializer):
    file          = serializers.FileField()
    name          = serializers.CharField(max_length=255, required=False)
    chunk_size    = serializers.IntegerField(min_value=50,  max_value=2000, required=False)
    chunk_overlap = serializers.IntegerField(min_value=0,   max_value=500,  required=False)

    def validate_file(self, value):
        from django.conf import settings
        max_size = getattr(settings, 'MAX_UPLOAD_SIZE',    10 * 1024 * 1024)
        allowed  = getattr(settings, 'ALLOWED_EXTENSIONS', ['pdf','txt','docx','md','csv'])
        ext      = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
        if ext not in allowed:
            raise serializers.ValidationError(
                f"File type '.{ext}' not allowed. Allowed: {', '.join(allowed)}"
            )
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File too large ({value.size/1024/1024:.1f} MB). Max: {max_size/1024/1024:.0f} MB"
            )
        return value


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Message
        fields = ['id', 'role', 'content', 'sources', 'model_used', 'created_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    last_message  = serializers.SerializerMethodField()

    class Meta:
        model  = ChatSession
        fields = ['id', 'title', 'message_count', 'last_message', 'created_at', 'updated_at']

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_message(self, obj):
        msg = obj.messages.last()
        return msg.content[:100] if msg else None


class ChatQuerySerializer(serializers.Serializer):
    question     = serializers.CharField(max_length=4000)
    session_id   = serializers.UUIDField(required=False, allow_null=True)
    document_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    model        = serializers.ChoiceField(
        choices=[
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
        ],
        default='llama-3.3-70b-versatile',
    )
    top_k        = serializers.IntegerField(min_value=1, max_value=10, default=3)
    api_key      = serializers.CharField(max_length=200, required=False, allow_blank=True)
    company_name = serializers.CharField(max_length=100, default='Our Company')
