import { useState } from 'react'
import { Send, Bot, User, ArrowUpRight, Loader2 } from 'lucide-react'
import { chatWithAssistant } from '../../api/client'
import { getStoredProfile } from '../ProfileSelector'

interface Message {
  id: string
  from: 'patient' | 'ai' | 'doctor'
  text: string
  time: string
}

const initialMessages: Message[] = [
  { id: '1', from: 'ai', text: "Hi! I'm your Vitality health assistant. How can I help you today?", time: '10:00 AM' },
]

export default function MessagesView() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [escalated, setEscalated] = useState(false)
  const [thinking, setThinking] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || thinking) return
    const text = input
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      from: 'patient',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, userMsg])

    if (escalated) {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        from: 'doctor',
        text: "Thanks for reaching out. I've reviewed your message. Let's schedule a quick call to discuss. — Dr. Mitchell",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, reply])
      return
    }

    setThinking(true)
    try {
      const history = messages
        .filter((m) => m.from === 'patient' || m.from === 'ai')
        .map((m) => ({ role: m.from === 'patient' ? 'user' : 'assistant', content: m.text }))
        .slice(-10)
      const res = await chatWithAssistant(text, getStoredProfile(), history)
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        from: 'ai',
        text: res.response || res.message || 'I had trouble processing that. Could you try again?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, reply])
    } catch {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        from: 'ai',
        text: "I'm having trouble connecting to the server right now. Please try again in a moment.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, reply])
    } finally {
      setThinking(false)
    }
  }

  const escalate = () => {
    setEscalated(true)
    const msg: Message = {
      id: Date.now().toString(),
      from: 'ai',
      text: "I've escalated this conversation to Dr. Mitchell. She'll respond shortly. You can continue typing below.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, msg])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {!escalated && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} color="#dc2626" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>AI Health Assistant</span>
          </div>
          <button onClick={escalate} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: '1px solid #dc2626',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: 12,
            fontWeight: 500, color: '#dc2626',
          }}>
            <ArrowUpRight size={14} /> Escalate to Doctor
          </button>
        </div>
      )}

      {escalated && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          padding: '10px 14px', borderRadius: 8, backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
          <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>Connected to Dr. Mitchell</span>
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
        padding: '16px', backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      }}>
        {messages.map((msg) => {
          const isPatient = msg.from === 'patient'
          return (
            <div key={msg.id} style={{
              display: 'flex', justifyContent: isPatient ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '70%', display: 'flex', gap: 8,
                flexDirection: isPatient ? 'row-reverse' : 'row', alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                  backgroundColor: isPatient ? '#dc2626' : msg.from === 'doctor' ? '#10b981' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isPatient
                    ? <User size={14} color="#fff" />
                    : msg.from === 'doctor'
                      ? <User size={14} color="#fff" />
                      : <Bot size={14} color="#6b7280" />
                  }
                </div>
                <div>
                  <div style={{
                    padding: '10px 14px', borderRadius: 12,
                    backgroundColor: isPatient ? '#dc2626' : '#f3f4f6',
                    color: isPatient ? '#fff' : '#374151',
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {msg.text}
                  </div>
                  <p style={{
                    fontSize: 10, color: '#9ca3af', margin: '4px 4px 0',
                    textAlign: isPatient ? 'right' : 'left',
                  }}>{msg.time}</p>
                </div>
              </div>
            </div>
          )
        })}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 15, backgroundColor: '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="#6b7280" />
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 12, backgroundColor: '#f3f4f6',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Loader2 size={14} color="#9ca3af" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>thinking...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', gap: 10, marginTop: 12,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 10,
            border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={sendMessage} style={{
          width: 44, height: 44, borderRadius: 10, border: 'none',
          backgroundColor: '#dc2626', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
