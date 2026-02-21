import { useState } from 'react'
import { Send, Bot, User, ArrowUpRight } from 'lucide-react'

interface Message {
  id: string
  from: 'patient' | 'ai' | 'doctor'
  text: string
  time: string
}

const initialMessages: Message[] = [
  { id: '1', from: 'ai', text: "Hi! I'm your Vitality health assistant. How can I help you today?", time: '10:00 AM' },
]

const aiResponses: Record<string, string> = {
  headache: "I see you're experiencing a headache. How long has it been going on, and would you rate the pain from 1-10? If it's been more than 3 days or above a 7, I'd recommend escalating to Dr. Mitchell.",
  tired: "Fatigue can have many causes. Looking at your recent vitals, your sleep has averaged 5.2 hours this week — below the recommended 7-8 hours. I'd suggest improving your sleep routine first. Want me to update your wellness plan?",
  medication: "I can see your current medications in your profile. If you're experiencing side effects or want to discuss changes, I'd recommend messaging Dr. Mitchell directly. Want me to escalate this?",
}

const defaultResponse = "Thanks for sharing that. Based on what you've described, I'd recommend discussing this with Dr. Mitchell for a more thorough evaluation. Would you like me to escalate this conversation to your doctor?"

export default function MessagesView() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [escalated, setEscalated] = useState(false)

  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg: Message = {
      id: Date.now().toString(),
      from: 'patient',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    const lower = input.toLowerCase()
    const matched = Object.keys(aiResponses).find((k) => lower.includes(k))
    const reply: Message = {
      id: (Date.now() + 1).toString(),
      from: escalated ? 'doctor' : 'ai',
      text: escalated
        ? "Thanks for reaching out. I've reviewed your message. Let's schedule a quick call to discuss. — Dr. Mitchell"
        : (matched ? aiResponses[matched] : defaultResponse),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages([...messages, userMsg, reply])
    setInput('')
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
