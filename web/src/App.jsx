import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function App() {
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error del servidor')
      setSessionId(data.sessionId)
      setMessages([...next, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) send(e)
  }

  function reset() {
    setMessages([])
    setSessionId(null)
    setError(null)
  }

  return (
    <div className="flex h-svh flex-col bg-base-200">
      <header className="navbar bg-base-100 shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Agent POC</h1>
          <button
            className="btn btn-ghost btn-sm"
            onClick={reset}
            disabled={loading || messages.length === 0}
          >
            Nueva conversación
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {messages.length === 0 && !loading && (
            <div className="mt-24 text-center text-base-content/60">
              <p className="text-xl font-medium">¿En qué te puedo ayudar?</p>
              <p className="mt-1 text-sm">Escribe un mensaje para empezar.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`chat ${m.role === 'user' ? 'chat-end' : 'chat-start'}`}
            >
              {m.role === 'user' ? (
                <div className="chat-bubble chat-bubble-primary whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <div className="chat-bubble md">
                  <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat chat-start">
              <div className="chat-bubble">
                <span className="loading loading-dots loading-sm" />
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-error mt-4">
              <span>{error}</span>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </main>

      <footer className="bg-base-100 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
        <form
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3"
          onSubmit={send}
        >
          <textarea
            className="textarea textarea-bordered max-h-40 flex-1 resize-none"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe un mensaje (Enter envía, Shift+Enter salto de línea)"
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
          >
            Enviar
          </button>
        </form>
      </footer>
    </div>
  )
}
