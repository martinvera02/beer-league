import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Chat({ selectedLeague, setSelectedLeague }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchLeagues()
  }, [])

  useEffect(() => {
    if (!selectedLeague) return

    fetchMessages(selectedLeague.id)

    const channel = supabase
      .channel(`chat:${selectedLeague.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `league_id=eq.${selectedLeague.id}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', payload.new.user_id)
            .single()

          // obtener mensaje respondido si existe
          let replyData = null
          if (payload.new.reply_to) {
            const { data } = await supabase
              .from('messages')
              .select(`id, content, user_id, profiles(username)`)
              .eq('id', payload.new.reply_to)
              .single()

            replyData = data
          }

          const fullMessage = {
            ...payload.new,
            profiles: { username: profile?.username || 'Desconocido' },
            reply: replyData
          }

          setMessages(prev => [...prev, fullMessage])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedLeague])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchLeagues = async () => {
    const { data } = await supabase
      .from('league_members')
      .select('league_id, leagues(id, name)')
      .eq('user_id', user.id)

    const userLeagues = data?.map(d => d.leagues) || []
    setLeagues(userLeagues)
    if (!selectedLeague && userLeagues.length > 0) setSelectedLeague(userLeagues[0])
  }

  const fetchMessages = async (leagueId) => {
    setLoading(true)

    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        profiles(username),
        reply:reply_to (
          id,
          content,
          user_id,
          profiles(username)
        )
      `)
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages(data || [])
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedLeague || sending) return
    setSending(true)

    await supabase.from('messages').insert({
      league_id: selectedLeague.id,
      user_id: user.id,
      content: newMessage.trim(),
      reply_to: replyTo?.id || null
    })

    setNewMessage('')
    setReplyTo(null)
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
    })
  }

  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(message)
    return groups
  }, {})

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-gray-800 flex-shrink-0">
        <h1 className="text-2xl font-bold mb-3">Chat 💬</h1>

        {leagues.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {leagues.map(league => (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedLeague?.id === league.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {league.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-2">
        {loading ? (
          <p className="text-gray-500 text-center py-10">Cargando mensajes...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-3">💬</div>
            <p>Aún no hay mensajes</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-800"/>
                <span className="text-xs text-gray-500">
                  {formatDate(msgs[0].created_at)}
                </span>
                <div className="flex-1 h-px bg-gray-800"/>
              </div>

              {msgs.map((msg, index) => {
                const isMe = msg.user_id === user.id
                const prevMsg = msgs[index - 1]
                const isSameUser = prevMsg?.user_id === msg.user_id
                const showUsername = !isMe && !isSameUser

                return (
                  <div
                    key={msg.id}
                    className={`flex mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      
                      {showUsername && (
                        <span className="text-xs text-amber-400 font-medium mb-1 ml-1">
                          {msg.profiles?.username}
                        </span>
                      )}

                      <div
                        onClick={() => setReplyTo(msg)}
                        className={`px-4 py-2 rounded-2xl text-sm cursor-pointer ${
                          isMe
                            ? 'bg-amber-500 text-white rounded-br-sm'
                            : 'bg-gray-800 text-white rounded-bl-sm'
                        }`}
                      >

                        {/* Mensaje citado */}
                        {msg.reply && (
                          <div className="mb-1 px-2 py-1 rounded bg-black/30 border-l-2 border-amber-400 text-xs">
                            <span className="text-amber-400 font-medium">
                              {msg.reply.profiles?.username || 'Usuario'}
                            </span>
                            <p className="truncate opacity-80">
                              {msg.reply.content}
                            </p>
                          </div>
                        )}

                        {msg.content}
                      </div>

                      <span className="text-xs text-gray-600 mt-0.5 mx-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 pb-24 border-t border-gray-800 flex-shrink-0">
        {!selectedLeague ? (
          <p className="text-gray-500 text-center text-sm">
            Selecciona una liga para chatear
          </p>
        ) : (
          <>
            {/* Preview reply */}
            {replyTo && (
              <div className="mb-2 px-3 py-2 bg-gray-800 rounded-xl border-l-4 border-amber-500 flex justify-between items-center">
                <div className="text-xs">
                  <span className="text-amber-400 font-medium">
                    {replyTo.profiles?.username}
                  </span>
                  <p className="truncate">{replyTo.content}</p>
                </div>

                <button
                  onClick={() => setReplyTo(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                rows={1}
                className="flex-1 bg-gray-800 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
                style={{ maxHeight: '120px' }}
              />

              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white p-3 rounded-2xl"
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}