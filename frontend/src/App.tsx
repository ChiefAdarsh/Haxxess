import { useEffect, useRef, useState } from 'react'
import './App.css'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TranscriptLine {
  id: number
  text: string
  timestamp: Date
}

type CallStatus = 'idle' | 'active' | 'ended' | 'processing' | 'error'

interface TriageData {
  level: 'emergency' | 'urgent' | 'routine' | 'self_care'
  label: string
  color: string
  bg: string
  reason: string
  action: string
}

interface EntitiesData {
  summary?: string
  symptoms?: string[]
  body_regions?: string[]
  severity?: number | null
  onset?: string | null
  duration?: string | null
  bleeding?: boolean | null
  bleeding_amount?: string | null
  pregnancy_status?: string
  fever?: boolean | null
  triggers?: string[]
  other_notes?: string | null
  error?: string
}

interface CaseData {
  call_sid: string
  transcript: string
  triage: TriageData
  entities: EntitiesData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlightPII(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <span key={i} className="pii-badge">{part}</span>
      : <span key={i}>{part}</span>
  )
}

function BoolBadge({ val }: { val: boolean | null | undefined }) {
  if (val === null || val === undefined) return <span className="badge badge-unknown">Unknown</span>
  return val ? <span className="badge badge-yes">Yes</span> : <span className="badge badge-no">No</span>
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callSid, setCallSid] = useState<string | null>(null)
  const [finalLines, setFinalLines] = useState<TranscriptLine[]>([])
  const [interimText, setInterimText] = useState<string>('')
  const [connected, setConnected] = useState(false)
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lineId = useRef(0)

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
          setCaseData(null)
          break

        case 'call_ended':
          setCallStatus('ended')
          setInterimText('')
          break

        case 'processing':
          setCallStatus('processing')
          break

        case 'case_ready':
          setCaseData(data as CaseData)
          setCallStatus('ended')
          break

        case 'call_status':
          if (['completed', 'failed', 'busy', 'no-answer'].includes(data.status)) {
            setCallStatus(prev => prev === 'processing' ? 'processing' : 'ended')
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

    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [finalLines, interimText])

  const statusMap: Record<CallStatus, { label: string; color: string; pulse: boolean }> = {
    idle: { label: 'Waiting for call', color: 'var(--muted)', pulse: false },
    active: { label: 'Live', color: 'var(--green)', pulse: true },
    ended: { label: 'Call ended', color: 'var(--muted)', pulse: false },
    processing: { label: 'Analyzing…', color: 'var(--accent)', pulse: true },
    error: { label: 'Error', color: 'var(--red)', pulse: false },
  }

  const status = statusMap[callStatus]
  const hasCase = !!caseData || callStatus === 'processing'

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <div className="logo"><MicIcon /></div>
          <div>
            <h1 className="app-title">Symptom Intake</h1>
            <p className="app-subtitle">AI-Powered Triage · PII Redacted in Real-Time</p>
          </div>
        </div>
        <div className="header-right">
          <div
            className={`conn-dot ${connected ? 'conn-ok' : 'conn-off'}`}
            title={connected ? 'Server connected' : 'Server disconnected'}
          />
          <div className="status-badge" style={{ '--sc': status.color } as React.CSSProperties}>
            {status.pulse && <span className="pulse-ring" />}
            <span className="status-dot" />
            <span className="status-label">{status.label}</span>
          </div>
        </div>
      </header>

      {/* ── Call ID bar ── */}
      {callSid && (
        <div className="callid-bar">
          <span className="callid-label">CALL SID</span>
          <code className="callid-value">{callSid}</code>
        </div>
      )}

      {/* ── Main grid ── */}
      <main className={`main-grid ${hasCase ? 'has-case' : ''}`}>

        {/* Transcript panel */}
        <section className="panel transcript-panel">
          <div className="panel-header">
            <span className="panel-icon">📝</span>
            <span>Live Transcript</span>
            {callStatus === 'active' && <span className="live-dot" />}
          </div>

          {finalLines.length === 0 && !interimText ? (
            <div className="empty-state">
              <div className="empty-icon"><MicIcon /></div>
              <p className="empty-title">
                {callStatus === 'processing'
                  ? 'Analyzing your symptoms…'
                  : 'Transcript will appear here'}
              </p>
              <p className="empty-sub">
                Call your Twilio number to start reporting symptoms.<br />
                Personal info is automatically <span className="pii-badge">[redacted]</span>.
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
        </section>

        {/* Case / Triage panel */}
        {caseData
          ? <CasePanel data={caseData} />
          : callStatus === 'processing' && <ProcessingPanel />
        }
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <span className="pii-badge">[redacted]</span>
        <span className="footer-label">= PII removed by Deepgram · </span>
        <span className="footer-disclaimer">⚠️ Not for emergencies — call 911. Triage is informational only.</span>
      </footer>

    </div>
  )
}

// ── CasePanel ─────────────────────────────────────────────────────────────────

function CasePanel({ data }: { data: CaseData }) {
  const { triage, entities } = data

  return (
    <section className="panel case-panel">
      <div className="panel-header">
        <span className="panel-icon">🏥</span>
        <span>Case Summary</span>
      </div>

      {/* Triage card */}
      <div
        className={`triage-card triage-${triage.level}`}
        style={{ '--tc': triage.color, '--tbg': triage.bg } as React.CSSProperties}
      >
        <div className="triage-label">{triage.label}</div>
        <p className="triage-reason">{triage.reason}</p>
        <div className="triage-action-row">
          <span className="triage-action-icon">→</span>
          <span className="triage-action">{triage.action}</span>
        </div>
      </div>

      {/* Extracted entities */}
      {entities && !entities.error && (
        <div className="entities">

          {entities.summary && (
            <div className="entity-row entity-summary-row">
              <span className="entity-key">Chief Complaint</span>
              <p className="entity-summary">{entities.summary}</p>
            </div>
          )}

          {entities.severity != null && (
            <div className="entity-row">
              <span className="entity-key">Severity</span>
              <div className="severity-wrap">
                <div
                  className="severity-bar"
                  style={{
                    width: `${(entities.severity / 10) * 100}%`,
                    '--sev': entities.severity,
                  } as React.CSSProperties}
                />
                <span className="severity-num">{entities.severity}<span className="severity-denom">/10</span></span>
              </div>
            </div>
          )}

          {entities.symptoms && entities.symptoms.length > 0 && (
            <div className="entity-row">
              <span className="entity-key">Symptoms</span>
              <div className="tag-list">
                {entities.symptoms.map((s, i) => (
                  <span key={i} className="tag tag-symptom">{s}</span>
                ))}
              </div>
            </div>
          )}

          {entities.body_regions && entities.body_regions.length > 0 && (
            <div className="entity-row">
              <span className="entity-key">Regions</span>
              <div className="tag-list">
                {entities.body_regions.map((r, i) => (
                  <span key={i} className="tag tag-region">{r}</span>
                ))}
              </div>
            </div>
          )}

          <div className="entity-grid">
            {entities.onset && (
              <div className="entity-cell">
                <span className="entity-key">Onset</span>
                <span className="entity-val">{entities.onset}</span>
              </div>
            )}
            {entities.duration && (
              <div className="entity-cell">
                <span className="entity-key">Duration</span>
                <span className="entity-val">{entities.duration}</span>
              </div>
            )}
            <div className="entity-cell">
              <span className="entity-key">Bleeding</span>
              <BoolBadge val={entities.bleeding} />
              {entities.bleeding_amount &&
                <span className="entity-sub">{entities.bleeding_amount}</span>}
            </div>
            <div className="entity-cell">
              <span className="entity-key">Fever</span>
              <BoolBadge val={entities.fever} />
            </div>
            {entities.pregnancy_status && entities.pregnancy_status !== 'unknown' && (
              <div className="entity-cell">
                <span className="entity-key">Pregnancy</span>
                <span className={`badge badge-preg-${entities.pregnancy_status}`}>
                  {entities.pregnancy_status}
                </span>
              </div>
            )}
          </div>

          {entities.triggers && entities.triggers.length > 0 && (
            <div className="entity-row">
              <span className="entity-key">Triggers</span>
              <div className="tag-list">
                {entities.triggers.map((t, i) => (
                  <span key={i} className="tag tag-trigger">{t}</span>
                ))}
              </div>
            </div>
          )}

          {entities.other_notes && (
            <div className="entity-row">
              <span className="entity-key">Notes</span>
              <span className="entity-val">{entities.other_notes}</span>
            </div>
          )}
        </div>
      )}

      {entities?.error === 'no_key' && (
        <div className="entity-warn">
          ℹ️ Add <code>OPENROUTER_API_KEY</code> to your <code>.env</code> to enable AI entity extraction.
        </div>
      )}
    </section>
  )
}

// ── ProcessingPanel ───────────────────────────────────────────────────────────

function ProcessingPanel() {
  return (
    <section className="panel case-panel processing-panel">
      <div className="panel-header">
        <span className="panel-icon">🔬</span>
        <span>Analysis</span>
      </div>
      <div className="processing-body">
        <div className="spinner" />
        <p className="processing-label">Extracting symptoms &amp; computing triage…</p>
        <p className="processing-sub">This takes a few seconds.</p>
      </div>
    </section>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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
