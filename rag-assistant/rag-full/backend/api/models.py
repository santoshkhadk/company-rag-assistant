import os
import uuid
from django.db import models


def document_upload_path(instance, filename):
    ext      = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin'
    new_name = f"{uuid.uuid4()}.{ext}"
    return os.path.join('documents', new_name)


class Document(models.Model):
    STATUS = [
        ('pending',    'Pending'),
        ('processing', 'Processing'),
        ('ready',      'Ready'),
        ('error',      'Error'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=255)
    file        = models.FileField(upload_to=document_upload_path)
    file_type   = models.CharField(max_length=20)
    file_size   = models.PositiveIntegerField(default=0)
    status      = models.CharField(max_length=20, choices=STATUS, default='pending')
    error_msg   = models.TextField(blank=True)
    chunk_count = models.PositiveIntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def file_size_display(self):
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"


class DocumentChunk(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document    = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')
    content     = models.TextField()
    chunk_index = models.PositiveIntegerField()
    word_count  = models.PositiveIntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering       = ['document', 'chunk_index']
        unique_together = [['document', 'chunk_index']]

    def __str__(self):
        return f"{self.document.name} – chunk {self.chunk_index}"


class ChatSession(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title      = models.CharField(max_length=255, default='New Chat')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class Message(models.Model):
    ROLES = [('user', 'User'), ('assistant', 'Assistant')]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session    = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role       = models.CharField(max_length=20, choices=ROLES)
    content    = models.TextField()
    sources    = models.JSONField(default=list)   # list of {doc_id, doc_name, chunk_index, score}
    model_used = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
