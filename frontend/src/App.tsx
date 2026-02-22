import { useEffect, useRef, useState } from 'react'
import './App.css'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TranscriptLine {
  id: number
  text: string
  timestamp: Date
}

type CallStatus = 'idle' | 'active' | 'ended' | 'error'

// ── PII Highlight ─────────────────────────────────────────────────────────────

function highlightPII(text: string) {
  // Deepgram wraps redacted tokens in brackets: [pci], [ssn], [numbers], etc.
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <span key={i} className="pii-badge">{part}</span>
      : <span key={i}>{part}</span>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callSid, setCallSid] = useState<string | null>(null)
  const [finalLines, setFinalLines] = useState<TranscriptLine[]>([])
  const [interimText, setInterimText] = useState<string>('')
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lineId = useRef(0)

  // ── SSE connection ──────────────────────────────────────────────────────────

  useEffect(() => {
    const source = new EventSource('http://localhost:5001/transcript-stream')

    source.onopen = () => setConnected(true)

    source.onmessage = (e) => {
      const data = JSON.parse(e.data)

      switch (data.type) {
        case 'call_started':
          setCallStatus('active')
          setCallSid(data.call_sid)
          setFinalLines([])
          setInterimText('')
          break

        case 'call_ended':
          setCallStatus('ended')
          setInterimText('')
          break

        case 'call_status':
          if (['completed', 'failed', 'busy', 'no-answer'].includes(data.status)) {
            setCallStatus('ended')
            setInterimText('')
          }
          break

        case 'transcript':
          if (data.is_final) {
            setFinalLines(prev => [
              ...prev,
              { id: lineId.current++, text: data.text, timestamp: new Date() },
            ])
            setInterimText('')
          } else {
            setInterimText(data.text)
          }
          break

        case 'error':
          console.error('Server error:', data.message)
          break
      }
    }

    source.onerror = () => {
      setConnected(false)
    }

    return () => source.close()
  }, [])

  // Auto-scroll to newest line
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [finalLines, interimText])

  // ── Status config ───────────────────────────────────────────────────────────

  const statusMap: Record<CallStatus, { label: string; color: string; pulse: boolean }> = {
    idle: { label: 'Waiting for call', color: 'var(--muted)', pulse: false },
    active: { label: 'Live', color: 'var(--green)', pulse: true },
    ended: { label: 'Call ended', color: 'var(--muted)', pulse: false },
    error: { label: 'Error', color: 'var(--red)', pulse: false },
  }

  const status = statusMap[callStatus]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <MicIcon />
          </div>
          <div>
            <h1 className="app-title">Live Transcript</h1>
            <p className="app-subtitle">PII Redacted in Real‑Time</p>
          </div>
        </div>

        <div className="header-right">
          {/* Server connection */}
          <div className={`conn-dot ${connected ? 'conn-ok' : 'conn-off'}`}
            title={connected ? 'Server connected' : 'Server disconnected'} />

          {/* Call status badge */}
          <div className="status-badge" style={{ '--sc': status.color } as React.CSSProperties}>
            {status.pulse && <span className="pulse-ring" />}
            <span className="status-dot" />
            <span className="status-label">{status.label}</span>
          </div>
        </div>
      </header>

      {/* Call ID strip */}
      {callSid && (
        <div className="callid-bar">
          <span className="callid-label">CALL SID</span>
          <code className="callid-value">{callSid}</code>
        </div>
      )}

      {/* Transcript area */}
      <main className="transcript-wrap">
        {finalLines.length === 0 && !interimText ? (
          <div className="empty-state">
            <div className="empty-icon"><MicIcon /></div>
            <p className="empty-title">Transcript will appear here</p>
            <p className="empty-sub">
              Run <code>python main.py</code> to place the call.<br />
              Personal info will be automatically&nbsp;
              <span className="pii-badge">[redacted]</span>.
            </p>
          </div>
        ) : (
          <div className="lines">
            {finalLines.map(line => (
              <div key={line.id} className="line final-line">
                <span className="ts">
                  {line.timestamp.toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </span>
                <p className="line-text">{highlightPII(line.text)}</p>
              </div>
            ))}

            {interimText && (
              <div className="line interim-line">
                <span className="ts">…</span>
                <p className="line-text interim-text">{highlightPII(interimText)}</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Legend */}
      <footer className="footer">
        <span className="pii-badge">[redacted]</span>
        <span className="footer-label">= Personally Identifiable Information removed by Deepgram</span>
      </footer>

    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
