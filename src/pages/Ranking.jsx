import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem } from '../lib/animations'

export default function Ranking({ selectedLeague, setSelectedLeague }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [rankings, setRankings] = useState([])
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [tab, setTab] = useState('ranking')
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [kickTarget, setKickTarget] = useState(null)
  const bottomRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => { fetchLeagues() }, [])

  useEffect(() => {
    if (!selectedLeague) return
    fetchRanking(selectedLeague.id)
    fetchMembers(selectedLeague.id)
    fetchMessages(selectedLeague.id)

    const channel = supabase
      .channel(`chat:${selectedLeague.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `league_id=eq.${selectedLeague.id}` },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single()
          setMessages(prev => [...prev, {
            ...payload.new,
            profiles: { username: profile?.username || 'Desconocido', avatar_url: profile?.avatar_url }
          }])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedLeague])

  useEffect(() => {
    if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, tab])

  const fetchLeagues = async () => {
    const { data } = await supabase
      .from('league_members')
      .select('league_id, leagues(id, name, created_by)')
      .eq('user_id', user.id)
    const userLeagues = data?.map(d => d.leagues) || []
    setLeagues(userLeagues)
    if (!selectedLeague && userLeagues.length > 0) setSelectedLeague(userLeagues[0])
  }

  const fetchRanking = async (leagueId) => {
    setLoading(true)
    const { data } = await supabase
      .from('league_rankings').select('*')
      .eq('league_id', leagueId)
      .order('total_points', { ascending: false })
    setRankings(data || [])
    setLoading(false)
  }

  const fetchMembers = async (leagueId) => {
    const { data } = await supabase
      .from('league_members')
      .select('joined_at, profiles(id, username, avatar_url)')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true })
    setMembers(data?.map(m => ({ ...m.profiles, joined_at: m.joined_at })) || [])
  }

  const fetchMessages = async (leagueId) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(username, avatar_url)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedLeague || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      league_id: selectedLeague.id,
      user_id: user.id,
      content: newMessage.trim(),
    })
    setNewMessage('')
    setSending(false)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedLeague) return
    setUploadingImage(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path)
      await supabase.from('messages').insert({
        league_id: selectedLeague.id,
        user_id: user.id,
        content: '',
        image_url: publicUrl,
      })
    }
    setUploadingImage(false)
    e.target.value = ''
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const leaveLeague = async () => {
    if (!selectedLeague) return
    await supabase.from('league_members').delete()
      .eq('league_id', selectedLeague.id).eq('user_id', user.id)
    setSelectedLeague(null)
    fetchLeagues()
    setTab('ranking')
  }

  const kickMember = async () => {
    if (!kickTarget || !selectedLeague) return
    await supabase
      .from('league_members')
      .delete()
      .eq('league_id', selectedLeague.id)
      .eq('user_id', kickTarget.id)
    setKickTarget(null)
    fetchMembers(selectedLeague.id)
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  const medals = ['🥇', '🥈', '🥉']

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
    return url ? (
      <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
    ) : (
      <div className={`${dim} rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0`}>
        🍺
      </div>
    )
  }

  return (
    <div className={`text-white flex flex-col bg-gray-950 ${tab === 'chat' ? 'h-screen' : 'min-h-screen'}`}>

      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex-shrink-0">
        <h1 className="text-2xl font-bold mb-1">Liga 🏆</h1>
        <p className="text-gray-400 text-sm mb-4">¿Quién va ganando?</p>

        {leagues.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {leagues.map(league => (
              <motion.button
                key={league.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedLeague(league)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedLeague?.id === league.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {league.name}
              </motion.button>
            ))}
          </div>
        )}

        {selectedLeague && (
          <div className="bg-gray-900 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Comparte este ID con tus amigos</p>
              <p className="text-amber-400 font-bold text-lg">#{selectedLeague.id}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigator.clipboard.writeText(String(selectedLeague.id))}
              className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              Copiar
            </motion.button>
          </div>
        )}

        {selectedLeague && (
          <div className="flex bg-gray-800 rounded-xl p-1">
            {[
              { id: 'ranking', label: '🏆 Ranking' },
              { id: 'members', label: '👥 Miembros' },
              { id: 'chat',    label: '💬 Chat' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10 ${
                  tab === t.id ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 bg-amber-500 rounded-lg"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {loading ? (
            <p className="text-gray-500 text-center py-10">Cargando...</p>
          ) : rankings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-16 text-gray-500"
            >
              <motion.div
                className="text-5xl mb-3"
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                🍺
              </motion.div>
              <p>Aún no hay consumiciones</p>
              <p className="text-sm mt-1">¡Sé el primero en anotar!</p>
            </motion.div>
          ) : (
            <div className="space-y-3 pt-4">
              {rankings.map((entry, index) => {
                const isMe = entry.user_id === user.id
                const drinkCounts = (entry.drinks_detail || []).reduce((acc, d) => {
                  if (!acc[d.name]) acc[d.name] = { emoji: d.emoji, count: 0 }
                  acc[d.name].count += 1
                  return acc
                }, {})

                return (
                  <motion.div
                    key={entry.user_id}
                    variants={staggerItem}
                    initial="initial"
                    animate="animate"
                    className={`rounded-2xl p-4 ${isMe ? 'bg-amber-500' : 'bg-gray-900'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl w-8 text-center">{medals[index] || `${index + 1}`}</span>
                      <Avatar url={entry.avatar_url} username={entry.username} size="md" />
                      <div className="flex-1">
                        <p className="font-bold">{entry.username} {isMe && '(tú)'}</p>
                        <p className={`text-xs ${isMe ? 'text-amber-100' : 'text-gray-500'}`}>
                          {entry.total_drinks} consumiciones
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${isMe ? 'text-white' : 'text-amber-400'}`}>
                          {entry.total_points}
                        </p>
                        <p className={`text-xs ${isMe ? 'text-amber-100' : 'text-gray-500'}`}>puntos</p>
                      </div>
                    </div>
                    <div className={`flex flex-wrap gap-2 pt-2 border-t ${isMe ? 'border-amber-400' : 'border-gray-800'}`}>
                      {Object.entries(drinkCounts)
                        .sort(([, a], [, b]) => b.count - a.count)
                        .map(([name, { emoji, count }]) => (
                          <div
                            key={name}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                              isMe ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MIEMBROS ── */}
      {tab === 'members' && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="space-y-3 pt-4">
            {members.map(member => {
              const isMe = member.id === user.id
              const isOwner = selectedLeague?.created_by === member.id
              const iAmOwner = selectedLeague?.created_by === user.id

              return (
                <motion.div
                  key={member.id}
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                  className={`rounded-2xl p-4 flex items-center gap-4 ${
                    isMe ? 'bg-gray-800 border border-amber-500' : 'bg-gray-900'
                  }`}
                >
                  <Avatar url={member.avatar_url} username={member.username} size="md" />
                  <div className="flex-1">
                    <p className="font-bold">{member.username} {isMe && '(tú)'}</p>
                    <p className="text-xs text-gray-500">
                      {isOwner ? '👑 Creador de la liga' : 'Miembro'}
                    </p>
                  </div>
                  {iAmOwner && !isOwner && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setKickTarget(member)}
                      className="bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                    >
                      Expulsar
                    </motion.button>
                  )}
                </motion.div>
              )
            })}

            {selectedLeague?.created_by !== user.id && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={leaveLeague}
                className="w-full mt-2 bg-transparent hover:bg-red-950 text-red-500 hover:text-red-400 font-semibold py-3 rounded-2xl border border-red-900 transition-colors"
              >
                Abandonar liga 🚪
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* ── CHAT ── */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 text-gray-500"
              >
                <div className="text-5xl mb-3">💬</div>
                <p>Aún no hay mensajes</p>
                <p className="text-sm mt-1">¡Sé el primero en escribir!</p>
              </motion.div>
            ) : (
              Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-xs text-gray-500">{formatDate(msgs[0].created_at)}</span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                  {msgs.map((msg, index) => {
                    const isMe = msg.user_id === user.id
                    const isSameUser = msgs[index - 1]?.user_id === msg.user_id
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div className="flex-shrink-0 self-end">
                            {!isSameUser
                              ? <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} size="sm" />
                              : <div className="w-8" />
                            }
                          </div>
                        )}
                        <div className={`max-w-xs flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && !isSameUser && (
                            <span className="text-xs text-amber-400 font-medium mb-1 ml-1">
                              {msg.profiles?.username}
                            </span>
                          )}
                          {msg.image_url && (
                            <img
                              src={msg.image_url}
                              alt="Imagen"
                              onClick={() => setLightboxUrl(msg.image_url)}
                              className={`max-w-52 rounded-2xl cursor-pointer object-cover ${
                                isMe ? 'rounded-br-sm' : 'rounded-bl-sm'
                              }`}
                            />
                          )}
                          {msg.content && (
                            <div className={`px-4 py-2 rounded-2xl text-sm ${
                              isMe
                                ? 'bg-amber-500 text-white rounded-br-sm'
                                : 'bg-gray-800 text-white rounded-bl-sm'
                            }`}>
                              {msg.content}
                            </div>
                          )}
                          <span className="text-xs text-gray-600 mt-0.5 mx-1">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input chat */}
          <div className="px-4 py-3 pb-24 border-t border-gray-800 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white p-3 rounded-2xl transition-colors flex-shrink-0"
              >
                {uploadingImage ? '⏳' : '📷'}
              </motion.button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                rows={1}
                className="flex-1 bg-gray-800 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
                style={{ maxHeight: '120px' }}
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white p-3 rounded-2xl transition-colors flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </motion.button>
            </div>
          </div>
        </>
      )}

      {/* Lightbox imagen */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={lightboxUrl}
              alt="Imagen ampliada"
              className="max-w-full max-h-full rounded-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal expulsar miembro */}
      <AnimatePresence>
        {kickTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setKickTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🚫</div>
                <h2 className="text-xl font-bold text-white">¿Expulsar a {kickTarget.username}?</h2>
                <p className="text-gray-400 text-sm mt-2">
                  Se eliminará de la liga y perderá su historial de consumiciones en ella.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setKickTarget(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={kickMember}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Expulsar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}