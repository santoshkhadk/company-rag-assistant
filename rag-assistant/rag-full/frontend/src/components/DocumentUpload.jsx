import { useState, useRef } from 'react';
import { useDocuments } from '../hooks/useRag';

const EXT_ICON = { pdf: '📄', txt: '📝', docx: '📋', md: '📑', csv: '📊' };

function StatusBadge({ status, error }) {
  const map = {
    pending:   ['#f3f4f6', '#6b7280', 'Pending'],
    uploading: ['#eff6ff', '#3b82f6', 'Uploading…'],
    done:      ['#f0fdf4', '#16a34a', '✓ Done'],
    error:     ['#fef2f2', '#dc2626', '✕ Error'],
  };
  const [bg, color, label] = map[status] || map.pending;
  return (
    <span title={error || ''} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: bg, color, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export default function DocumentUpload({ onClose }) {
  const { upload } = useDocuments();
  const ref = useRef();
  const [dragging,  setDragging]  = useState(false);
  const [queue,     setQueue]     = useState([]);
  const [chunkSize, setCS]        = useState(500);
  const [overlap,   setOL]        = useState(50);
  const [busy,      setBusy]      = useState(false);

  const enqueue = (files) =>
    setQueue(q => [...q, ...[...files].map(f => ({ file: f, status: 'pending', error: null }))]);

  const onDrop = (e) => { e.preventDefault(); setDragging(false); enqueue(e.dataTransfer.files); };

  const runUpload = async () => {
    setBusy(true);
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== 'pending') continue;
      setQueue(q => q.map((x, j) => j === i ? { ...x, status: 'uploading' } : x));
      try {
        await upload(queue[i].file, { chunk_size: chunkSize, chunk_overlap: overlap });
        setQueue(q => q.map((x, j) => j === i ? { ...x, status: 'done' } : x));
      } catch (e) {
        setQueue(q => q.map((x, j) => j === i ? { ...x, status: 'error', error: e.message } : x));
      }
    }
    setBusy(false);
  };

  const pending = queue.filter(x => x.status === 'pending').length;
  const allDone = queue.length > 0 && queue.every(x => x.status !== 'pending' && x.status !== 'uploading');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 500, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Upload Documents</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Dropzone */}
        <div
          onClick={() => ref.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? '#6366f1' : '#d1d5db'}`, borderRadius: 10,
            padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? '#eef2ff' : '#fafafa', transition: 'all .15s',
          }}
        >
          <input ref={ref} type="file" multiple accept=".pdf,.txt,.docx,.md,.csv" hidden onChange={e => enqueue(e.target.files)} />
          <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
          <p style={{ fontWeight: 500, marginBottom: 4 }}>Drop files here or click to browse</p>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>PDF · TXT · DOCX · MD · CSV — max 10 MB</p>
        </div>

        {/* Chunk settings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Chunk size (words)', chunkSize, setCS, 50, 2000], ['Overlap (words)', overlap, setOL, 0, 500]].map(([lbl, val, fn, min, max]) => (
            <label key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
              {lbl}
              <input type="number" value={val} min={min} max={max} onChange={e => fn(+e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
            </label>
          ))}
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
            {queue.map((item, i) => {
              const ext = item.file.name.split('.').pop().toLowerCase();
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 16 }}>{EXT_ICON[ext] || '📄'}</span>
                  <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</span>
                  <StatusBadge status={item.status} error={item.error} />
                  {item.status === 'pending' && (
                    <button onClick={() => setQueue(q => q.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {allDone ? (
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Done ✓
            </button>
          ) : (
            <>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid #d1d5db', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={runUpload} disabled={pending === 0 || busy}
                style={{ padding: '8px 20px', borderRadius: 8, background: pending === 0 ? '#c7d2fe' : '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: pending === 0 ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Uploading…' : `Upload ${pending} file${pending !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
