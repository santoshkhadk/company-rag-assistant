from django.urls import path
from . import views

urlpatterns = [
    # Stats
    path('stats/',                                  views.stats,             name='stats'),

    # Documents
    path('documents/',                              views.document_list,     name='doc-list'),
    path('documents/upload/',                       views.document_upload,   name='doc-upload'),
    path('documents/<uuid:doc_id>/',                views.document_detail,   name='doc-detail'),
    path('documents/<uuid:doc_id>/chunks/',         views.document_chunks,   name='doc-chunks'),
    path('documents/<uuid:doc_id>/reprocess/',      views.reprocess_document,name='doc-reprocess'),

    # Sessions
    path('sessions/',                               views.session_list,      name='session-list'),
    path('sessions/create/',                        views.session_create,    name='session-create'),
    path('sessions/<uuid:session_id>/',             views.session_detail,    name='session-detail'),

    # RAG chat
    path('chat/',                                   views.chat_query,        name='chat-query'),
]
