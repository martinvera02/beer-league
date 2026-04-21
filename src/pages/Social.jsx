import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'
import { soundLike, soundMessage, soundSuccess, soundMessageReceived } from '../lib/sounds'

const ACHIEVEMENTS = [
  { id: 'first_drink',       emoji: '🍺', name: 'Primera ronda' },
  { id: 'drinks_10',         emoji: '🔟', name: 'Bebedor consistente' },
  { id: 'drinks_50',         emoji: '🏅', name: 'Veterano' },
  { id: 'drinks_100',        emoji: '👑', name: 'Leyenda' },
  { id: 'martes_macarra',    emoji: '🔥', name: 'Martes Macarra' },
  { id: 'variety_5',         emoji: '🌈', name: 'Paladar exquisito' },
  { id: 'roulette_win',      emoji: '🎰', name: 'Golpe de suerte' },
  { id: 'roulette_3wins',    emoji: '🎯', name: 'En racha' },
  { id: 'millionaire',       emoji: '💰', name: 'Millonario' },
  { id: 'market_5',          emoji: '📈', name: 'Tiburón del mercado' },
  { id: 'big_bet',           emoji: '🎲', name: 'Todo o nada' },
  { id: 'sabotage',          emoji: '💣', name: 'Saboteador' },
  { id: 'shield',            emoji: '🛡️', name: 'Protegido' },
  { id: 'generous',          emoji: '💸', name: 'Generoso' },
  { id: 'popular',           emoji: '❤️', name: 'Popular' },
  { id: 'drinks_day_3',      emoji: '🚀', name: 'Calentando motores' },
  { id: 'drinks_day_10',     emoji: '🚨', name: 'Esto ya es un problema' },
  { id: 'top1_league',       emoji: '🥇', name: 'El último en pie' },
  { id: 'come_back',         emoji: '🧟', name: 'Abstemio rehabilitado' },
  { id: 'most_active',       emoji: '🏃', name: 'El del bar' },
  { id: 'broke',             emoji: '🪙', name: 'Pelado' },
  { id: 'negative_balance',  emoji: '📉', name: 'En números rojos' },
  { id: 'lender',            emoji: '🏦', name: 'Prestamista' },
  { id: 'big_sender',        emoji: '💸', name: 'El que invita' },
  { id: 'roulette_10bets',   emoji: '🎡', name: 'Tahúr' },
  { id: 'big_win',           emoji: '🤑', name: 'Rompebancos' },
  { id: 'pacifist',          emoji: '☮️', name: 'Pacifista' },
  { id: 'war_mode',          emoji: '⚔️', name: 'Guerra total' },
  { id: 'revenge',           emoji: '🗡️', name: 'Venganza servida fría' },
  { id: 'influencer',        emoji: '🌟', name: 'Influencer' },
  { id: 'chatterbox',        emoji: '💬', name: 'Tertuliano' },
  { id: 'photographer',      emoji: '📸', name: 'Fotógrafo de bodas' },
]

// ─── CHAT PRIVADO ─────────────────────────────────────────────────────────────
function PrivateChat({ chat, otherUser, onClose }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const bottomRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => {
    fetchMessages()
    markRead()

    const channel = supabase.channel(`private_chat:${chat.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `chat_id=eq.${chat.id}` },
        async (payload) => {
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.sender_id).single()
          if (payload.new.sender_id !== user.id) soundMessageReceived()
          setMessages(prev => [...prev, { ...payload.new, profiles: profile }])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          markRead()
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [chat.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase.from('private_messages')
      .select('*, profiles(username, avatar_url)')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  const markRead = async () => {
    await supabase.from('private_message_reads').upsert({
      user_id: user.id,
      chat_id: chat.id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,chat_id' })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return
    setSending(true); soundMessage()
    await supabase.from('private_messages').insert({ chat_id: chat.id, sender_id: user.id, content: newMessage.trim() })
    setNewMessage(''); setSending(false)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    const ext = file.name.split('.').pop()
    const path = `private/${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path)
      soundMessage()
      await supabase.from('private_messages').insert({
        chat_id: chat.id, sender_id: user.id, content: '', image_url: publicUrl
      })
    }
    setUploadingImage(false)
    e.target.value = ''
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

  const grouped = messages.reduce((g, m) => {
    const d = new Date(m.created_at).toDateString()
    if (!g[d]) g[d] = []
    g[d].push(m); return g
  }, {})

  const Avatar = ({ url, username }) => url
    ? <img src={url} alt={username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>←</motion.button>
        <Avatar url={otherUser?.avatar_url} username={otherUser?.username} />
        <div className="flex-1">
          <p className="font-bold text-sm">{otherUser?.username}</p>
          <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Chat privado</p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <div className="text-5xl mb-3">💬</div>
            <p>Empieza la conversación con {otherUser?.username}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatDate(msgs[0].created_at)}</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
              </div>
              {msgs.map((msg, index) => {
                const isMe = msg.sender_id === user.id
                const isSameUser = msgs[index - 1]?.sender_id === msg.sender_id
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div className="flex-shrink-0 self-end">
                        {!isSameUser ? <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} /> : <div className="w-8" />}
                      </div>
                    )}
                    <div className={`max-w-xs flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {msg.image_url && (
                        <img src={msg.image_url} alt="Imagen"
                          onClick={() => setLightboxUrl(msg.image_url)}
                          className={`max-w-52 rounded-2xl cursor-pointer object-cover ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`} />
                      )}
                      {msg.content && (
                        <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                          style={{ backgroundColor: isMe ? '#f59e0b' : 'var(--bg-card)', color: isMe ? '#fff' : 'var(--text-primary)' }}>
                          {msg.content}
                        </div>
                      )}
                      <span className="text-xs mt-0.5 mx-1" style={{ color: 'var(--text-hint)' }}>{formatTime(msg.created_at)}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 pb-10 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-base)' }}>
        <div className="flex gap-2 items-end">
          {/* Botón foto */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-3 rounded-2xl flex-shrink-0"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            {uploadingImage ? '⏳' : '📷'}
          </motion.button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..." rows={1}
            className="flex-1 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '120px' }} />
          <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage} disabled={!newMessage.trim() || sending}
            className="bg-amber-500 disabled:opacity-40 text-white p-3 rounded-2xl flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
            onClick={() => setLightboxUrl(null)}>
            <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              src={lightboxUrl} alt="Imagen ampliada"
              className="max-w-full max-h-full rounded-2xl object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── PERFIL DE USUARIO ────────────────────────────────────────────────────────
function UserProfile({ profileId, onClose, onOpenChat }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [canChat, setCanChat] = useState(false)

  useEffect(() => { fetchProfile() }, [profileId])

  const fetchProfile = async () => {
    setLoading(true)
    const [
      { data: profileData },
      { data: drinksData },
      { data: achievementsData },
      { data: followData },
      { count: followersCount2 },
      { count: followingCount2 },
      { data: chatFollow },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('drinks').select('drink_group_id, points').eq('user_id', profileId),
      supabase.from('achievements').select('achievement_id').eq('user_id', profileId),
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle(),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileId),
      supabase.from('follows').select('id').eq('follower_id', profileId).eq('following_id', user.id).maybeSingle(),
    ])

    setProfile(profileData)
    setIsFollowing(!!followData)
    setFollowersCount(followersCount2 || 0)
    setFollowingCount(followingCount2 || 0)
    setCanChat(!!followData && !!chatFollow)

    if (drinksData) {
      const seen = new Set()
      const unique = drinksData.filter(d => { if (seen.has(d.drink_group_id)) return false; seen.add(d.drink_group_id); return true })
      setStats({ count: unique.length, total: unique.reduce((s, d) => s + (d.points || 0), 0) })
    }

    setAchievements((achievementsData || []).map(a => a.achievement_id))
    setLoading(false)
  }

  const toggleFollow = async () => {
    setToggling(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId)
      setIsFollowing(false); setFollowersCount(prev => prev - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId })
      setIsFollowing(true); setFollowersCount(prev => prev + 1); soundSuccess()
    }
    const { data: chatFollow } = await supabase.from('follows').select('id').eq('follower_id', profileId).eq('following_id', user.id).maybeSingle()
    setCanChat(!isFollowing && !!chatFollow)
    setToggling(false)
  }

  const handleOpenChat = async () => {
    const userA = user.id < profileId ? user.id : profileId
    const userB = user.id < profileId ? profileId : user.id
    let { data: existing } = await supabase.from('private_chats').select('*').eq('user_a', userA).eq('user_b', userB).maybeSingle()
    if (!existing) {
      const { data: created } = await supabase.from('private_chats').insert({ user_a: userA, user_b: userB }).select().single()
      existing = created
    }
    onOpenChat(existing, profile)
  }

  if (loading) return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </motion.div>
  )

  const unlockedAchievements = ACHIEVEMENTS.filter(a => achievements.includes(a.id))
  const isMe = profileId === user.id

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="fixed inset-0 z-50 overflow-y-auto pb-24"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      <div className="flex items-center gap-3 px-4 py-4 border-b sticky top-0 z-10"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>←</motion.button>
        <p className="font-bold flex-1">{profile?.username}</p>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={profile.username} className="w-20 h-20 rounded-full object-cover border-4 border-amber-500" />
            : <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-4xl" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)' }}>🍺</div>}
          <div className="flex-1">
            <p className="text-xl font-bold">{profile?.username}</p>
            <div className="flex gap-4 mt-2">
              {[{ v: stats?.count || 0, l: 'consumiciones' }, { v: followersCount, l: 'seguidores' }, { v: followingCount, l: 'siguiendo' }].map(s => (
                <div key={s.l} className="text-center">
                  <p className="font-bold text-amber-400">{s.v}</p>
                  <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!isMe && (
          <div className="flex gap-3 mb-6">
            <motion.button whileTap={{ scale: 0.96 }} onClick={toggleFollow} disabled={toggling}
              className="flex-1 py-3 rounded-2xl font-bold text-sm"
              style={{ backgroundColor: isFollowing ? 'var(--bg-card)' : '#f59e0b', color: isFollowing ? 'var(--text-primary)' : '#fff', border: isFollowing ? '1px solid var(--border)' : 'none' }}>
              {toggling ? '...' : isFollowing ? 'Siguiendo ✓' : '+ Seguir'}
            </motion.button>
            {canChat ? (
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleOpenChat}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                💬 Mensaje
              </motion.button>
            ) : isFollowing ? (
              <div className="flex-1 py-3 rounded-2xl text-center text-xs flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-hint)' }}>
                Chat disponible si te sigue
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-2xl font-bold text-amber-400">{stats?.total || 0}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Puntos totales</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-2xl font-bold text-amber-400">{unlockedAchievements.length}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Logros</p>
          </div>
        </div>

        <p className="text-sm font-bold mb-3">🏅 Logros desbloqueados</p>
        {unlockedAchievements.length === 0 ? (
          <div className="rounded-2xl p-6 text-center mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Aún no tiene logros</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {unlockedAchievements.map(a => (
              <motion.div key={a.id} initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl"
                style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span className="text-lg">{a.emoji}</span>
                <span className="text-xs font-medium text-amber-400">{a.name}</span>
              </motion.div>
            ))}
          </div>
        )}

        {ACHIEVEMENTS.filter(a => !achievements.includes(a.id)).length > 0 && (
          <>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-muted)' }}>🔒 Sin desbloquear</p>
            <div className="flex flex-wrap gap-2">
              {ACHIEVEMENTS.filter(a => !achievements.includes(a.id)).map(a => (
                <div key={a.id} className="flex items-center gap-1.5 px-3 py-2 rounded-2xl opacity-40"
                  style={{ backgroundColor: 'var(--bg-card)', filter: 'grayscale(100%)' }}>
                  <span className="text-lg">{a.emoji}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-hint)' }}>{a.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── SOCIAL PRINCIPAL ─────────────────────────────────────────────────────────
export default function Social() {
  const { user } = useAuth()
  const [tab, setTab] = useState('feed')
  const [posts, setPosts] = useState([])
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImage, setNewPostImage] = useState(null)
  const [newPostPreview, setNewPostPreview] = useState(null)
  const [uploadingPost, setUploadingPost] = useState(false)
  const [uploadingStory, setUploadingStory] = useState(false)
  const [selectedStory, setSelectedStory] = useState(null)
  const [openComments, setOpenComments] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [sendingComment, setSendingComment] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [following, setFollowing] = useState([])
  const [chats, setChats] = useState([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [unreadByChat, setUnreadByChat] = useState({}) // { chatId: count }
  const [totalUnread, setTotalUnread] = useState(0)

  const [viewingProfile, setViewingProfile] = useState(null)
  const [activeChat, setActiveChat] = useState(null)

  const postImageRef = useRef(null)
  const storyImageRef = useRef(null)
  const textareaRef = useRef(null)
  const commentsBottomRef = useRef(null)
  const searchTimeout = useRef(null)

  useEffect(() => { fetchFeed(); fetchFollowing(); fetchUnreadCounts() }, [])
  useEffect(() => { if (tab === 'chats') { fetchChats(); fetchUnreadCounts() } }, [tab])

  // Realtime: escuchar nuevos mensajes privados para actualizar badges
  useEffect(() => {
    const channel = supabase.channel('private_messages_unread')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_messages' },
        (payload) => {
          if (payload.new.sender_id !== user.id) {
            setUnreadByChat(prev => {
              const chatId = payload.new.chat_id
              const newCount = (prev[chatId] || 0) + 1
              const updated = { ...prev, [chatId]: newCount }
              setTotalUnread(Object.values(updated).reduce((s, c) => s + c, 0))
              return updated
            })
          }
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user.id])

  useEffect(() => {
    if (showNewPost && textareaRef.current)
      setTimeout(() => textareaRef.current?.focus(), 100)
  }, [showNewPost])

  useEffect(() => {
    if (!openComments) return
    const channel = supabase.channel(`comments:${openComments.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${openComments.id}` },
        async (payload) => {
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single()
          setComments(prev => [...prev, { ...payload.new, profiles: profile }])
          setTimeout(() => commentsBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [openComments])

  const fetchUnreadCounts = async () => {
    const { data: myChats } = await supabase.from('private_chats')
      .select('id').or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    if (!myChats || myChats.length === 0) return

    const counts = {}
    await Promise.all(myChats.map(async (chat) => {
      const { data: readData } = await supabase.from('private_message_reads')
        .select('last_read_at').eq('user_id', user.id).eq('chat_id', chat.id).maybeSingle()
      const lastRead = readData?.last_read_at || '1970-01-01'
      const { count } = await supabase.from('private_messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .neq('sender_id', user.id)
        .gt('created_at', lastRead)
      counts[chat.id] = count || 0
    }))

    setUnreadByChat(counts)
    setTotalUnread(Object.values(counts).reduce((s, c) => s + c, 0))
  }

  const fetchFeed = async () => {
    setLoading(true)
    const [{ data: postsData }, { data: storiesData }] = await Promise.all([
      supabase.from('posts').select('*, profiles(username, avatar_url), post_likes(user_id), post_comments(id)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('stories').select('*, profiles(username, avatar_url)')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    ])
    setPosts(postsData || [])
    setStories(storiesData || [])
    setLoading(false)
  }

  const fetchFollowing = async () => {
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
    setFollowing((data || []).map(f => f.following_id))
  }

  const fetchChats = async () => {
    setLoadingChats(true)
    const { data } = await supabase.from('private_chats')
      .select(`*, user_a_profile:profiles!private_chats_user_a_fkey(id, username, avatar_url), user_b_profile:profiles!private_chats_user_b_fkey(id, username, avatar_url)`)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const chatsWithLastMsg = await Promise.all((data || []).map(async (chat) => {
      const { data: lastMsg } = await supabase.from('private_messages')
        .select('content, image_url, created_at').eq('chat_id', chat.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      const otherUser = chat.user_a === user.id ? chat.user_b_profile : chat.user_a_profile
      return { ...chat, otherUser, lastMsg }
    }))

    setChats(chatsWithLastMsg)
    setLoadingChats(false)
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase.from('profiles').select('id, username, avatar_url')
        .ilike('username', `%${query.trim()}%`).neq('id', user.id).limit(15)
      setSearchResults(data || [])
      setSearching(false)
    }, 400)
  }

  const toggleFollow = async (profileId) => {
    const isFollowingUser = following.includes(profileId)
    if (isFollowingUser) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId)
      setFollowing(prev => prev.filter(id => id !== profileId))
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId })
      setFollowing(prev => [...prev, profileId]); soundSuccess()
    }
  }

  const handlePostImageSelect = (e) => {
    const file = e.target.files[0]; if (!file) return
    setNewPostImage(file); setNewPostPreview(URL.createObjectURL(file))
  }

  const submitPost = async () => {
    if (!newPostContent.trim() && !newPostImage) return
    setUploadingPost(true)
    let imageUrl = null
    if (newPostImage) {
      const ext = newPostImage.name.split('.').pop()
      const path = `${user.id}/posts/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('social').upload(path, newPostImage)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('social').getPublicUrl(path)
        imageUrl = publicUrl
      }
    }
    await supabase.from('posts').insert({ user_id: user.id, content: newPostContent.trim(), image_url: imageUrl })
    closeNewPost(); setUploadingPost(false); fetchFeed()
  }

  const submitStory = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploadingStory(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/stories/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('social').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('social').getPublicUrl(path)
      await supabase.from('stories').insert({ user_id: user.id, image_url: publicUrl })
      fetchFeed()
    }
    setUploadingStory(false); e.target.value = ''
  }

  const toggleLike = async (post) => {
    const alreadyLiked = post.post_likes?.some(l => l.user_id === user.id)
    if (!alreadyLiked) soundLike()
    if (alreadyLiked) await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    else await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    fetchFeed()
  }

  const deletePost = async (postId) => { await supabase.from('posts').delete().eq('id', postId); fetchFeed() }

  const openCommentsPanel = async (post) => {
    setOpenComments(post); setCommentText('')
    const { data } = await supabase.from('post_comments').select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id).order('created_at', { ascending: true })
    setComments(data || [])
  }

  const closeCommentsPanel = () => { setOpenComments(null); setComments([]); setCommentText('') }

  const submitComment = async () => {
    if (!commentText.trim() || !openComments || sendingComment) return
    setSendingComment(true); soundMessage()
    await supabase.from('post_comments').insert({ post_id: openComments.id, user_id: user.id, content: commentText.trim() })
    setCommentText(''); fetchFeed(); setSendingComment(false)
  }

  const handleCommentKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }
  const closeNewPost = () => { setShowNewPost(false); setNewPostContent(''); setNewPostImage(null); setNewPostPreview(null) }

  const handleOpenChat = (chat, otherUser) => {
    // Limpiar badge del chat al abrirlo
    setUnreadByChat(prev => {
      const updated = { ...prev, [chat.id]: 0 }
      setTotalUnread(Object.values(updated).reduce((s, c) => s + c, 0))
      return updated
    })
    setActiveChat({ chat, otherUser })
  }

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`; if (hours > 0) return `hace ${hours}h`; if (mins > 0) return `hace ${mins}m`; return 'ahora'
  }

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'
    return url
      ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-lg`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  const storiesByUser = stories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = { profile: s.profiles, stories: [] }
    acc[s.user_id].stories.push(s); return acc
  }, {})

  const canPublish = (newPostContent.trim().length > 0 || newPostImage !== null) && !uploadingPost

  const TABS = [
    { id: 'feed',    label: '📰 Feed' },
    { id: 'stories', label: '⭕ Historias' },
    { id: 'people',  label: '🔍 Buscar' },
    { id: 'chats',   label: '💬 Chats', unread: totalUnread },
  ]

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold mb-4">Social 🍻</h1>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10 flex items-center justify-center gap-1"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="social-tab" className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: t.id === 'chats' ? '#10b981' : '#f59e0b' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span>{t.label}</span>
              {t.unread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-white font-black"
                  style={{ backgroundColor: '#ef4444', fontSize: 9 }}>
                  {t.unread > 9 ? '9+' : t.unread}
                </motion.span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── FEED ── */}
      {tab === 'feed' && (
        <div className="max-w-md mx-auto px-4 pt-4">
          {Object.keys(storiesByUser).length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3 mb-4">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button key={userStories[0].user_id} whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedStory(userStories[0])}
                  className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600">
                    <div className="p-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-base)' }}>
                      <Avatar url={profile?.avatar_url} username={profile?.username} size="sm" />
                    </div>
                  </div>
                  <span className="text-xs truncate w-14 text-center" style={{ color: 'var(--text-muted)' }}>{profile?.username}</span>
                </motion.button>
              ))}
            </div>
          )}
          <motion.div {...fadeIn} className="rounded-2xl p-3 mb-4 flex items-center gap-3 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={() => setShowNewPost(true)}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
            <div className="flex-1 rounded-xl px-4 py-2.5 text-sm" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>¿Qué estás bebiendo?</div>
          </motion.div>
          {loading ? <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando feed...</p>
            : posts.length === 0 ? (
              <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-5xl mb-3">📰</div><p>Aún no hay posts</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => {
                  const isMe = post.user_id === user.id
                  const liked = post.post_likes?.some(l => l.user_id === user.id)
                  return (
                    <motion.div key={post.id} variants={staggerItem} initial="initial" animate="animate"
                      className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <div className="flex items-center gap-3 p-4 pb-3">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => !isMe && setViewingProfile(post.user_id)}>
                          <Avatar url={post.profiles?.avatar_url} username={post.profiles?.username} />
                        </motion.button>
                        <div className="flex-1">
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => !isMe && setViewingProfile(post.user_id)}>
                            <p className="font-bold text-sm text-left">{post.profiles?.username}</p>
                          </motion.button>
                          <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(post.created_at)}</p>
                        </div>
                        {isMe && <motion.button whileTap={{ scale: 0.9 }} onClick={() => deletePost(post.id)} className="text-lg" style={{ color: 'var(--text-hint)' }}>🗑️</motion.button>}
                      </div>
                      {post.content && <p className="px-4 pb-3 text-sm leading-relaxed">{post.content}</p>}
                      {post.image_url && <img src={post.image_url} alt="Post" className="w-full object-cover max-h-80" />}
                      <div className="flex items-center gap-4 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleLike(post)} className="flex items-center gap-1.5 text-sm">
                          <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }} className="text-xl">{liked ? '🍺' : '🤍'}</motion.span>
                          <span style={{ color: liked ? '#f59e0b' : 'var(--text-muted)' }}>{post.post_likes?.length || 0}</span>
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => openCommentsPanel(post)} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <span className="text-xl">💬</span><span>{post.post_comments?.length || 0}</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
        </div>
      )}

      {/* ── HISTORIAS ── */}
      {tab === 'stories' && (
        <div className="max-w-md mx-auto px-4 pt-4">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => storyImageRef.current?.click()} disabled={uploadingStory}
            className="w-full border-2 border-dashed rounded-2xl py-6 flex flex-col items-center gap-2 mb-6"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span className="text-3xl">{uploadingStory ? '⏳' : '⭕'}</span>
            <span className="text-sm">{uploadingStory ? 'Subiendo...' : 'Añadir historia'}</span>
            <span className="text-xs" style={{ color: 'var(--text-hint)' }}>Desaparece en 24 horas</span>
          </motion.button>
          <input ref={storyImageRef} type="file" accept="image/*" onChange={submitStory} className="hidden" />
          {Object.keys(storiesByUser).length === 0 ? (
            <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">⭕</div><p>No hay historias activas</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button key={userStories[0].user_id} variants={staggerItem} initial="initial" animate="animate"
                  whileTap={{ scale: 0.95 }} onClick={() => setSelectedStory(userStories[0])}
                  className="relative rounded-2xl overflow-hidden aspect-[3/4]" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <img src={userStories[0].image_url} alt="Historia" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Avatar url={profile?.avatar_url} username={profile?.username} size="sm" />
                    <span className="text-xs font-semibold text-white truncate">{profile?.username}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BUSCAR ── */}
      {tab === 'people' && (
        <div className="max-w-md mx-auto px-4 pt-4">
          <div className="relative mb-5">
            <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar usuarios..."
              className="w-full rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 pr-10"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
            {searching
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="absolute right-4 top-1/2 -translate-y-1/2 text-lg">🔍</motion.div>
              : <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'var(--text-hint)' }}>🔍</span>}
          </div>
          {searchQuery ? (
            searchResults.length === 0 && !searching ? (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <div className="text-4xl mb-2">😶</div><p className="text-sm">No se encontró ningún usuario</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map(profile => {
                  const isFollowingUser = following.includes(profile.id)
                  return (
                    <motion.div key={profile.id} variants={staggerItem} initial="initial" animate="animate"
                      className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setViewingProfile(profile.id)}>
                        {profile.avatar_url
                          ? <img src={profile.avatar_url} alt={profile.username} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>}
                      </motion.button>
                      <motion.button className="flex-1 text-left" whileTap={{ scale: 0.98 }} onClick={() => setViewingProfile(profile.id)}>
                        <p className="font-bold text-sm">{profile.username}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Ver perfil →</p>
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleFollow(profile.id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: isFollowingUser ? 'var(--bg-input)' : '#f59e0b', color: isFollowingUser ? 'var(--text-muted)' : '#fff' }}>
                        {isFollowingUser ? 'Siguiendo' : '+ Seguir'}
                      </motion.button>
                    </motion.div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-medium">Busca usuarios por nombre</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>Sigue a otros para poder chatear</p>
            </div>
          )}
        </div>
      )}

      {/* ── CHATS ── */}
      {tab === 'chats' && (
        <div className="max-w-md mx-auto px-4 pt-4">
          {loadingChats ? (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-3xl mb-2">💬</motion.div>
              <p className="text-sm">Cargando chats...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">💬</div>
              <p className="font-medium">No tienes chats activos</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>Sigue a alguien y si te sigue de vuelta podréis chatear</p>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('people')}
                className="mt-4 px-6 py-3 rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: '#f59e0b' }}>
                🔍 Buscar usuarios
              </motion.button>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map(chat => {
                const unread = unreadByChat[chat.id] || 0
                const lastMsgText = chat.lastMsg?.image_url && !chat.lastMsg?.content ? '📷 Imagen' : (chat.lastMsg?.content || 'Inicia la conversación...')
                return (
                  <motion.button key={chat.id} variants={staggerItem} initial="initial" animate="animate"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleOpenChat(chat, chat.otherUser)}
                    className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: unread > 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                    }}>
                    <div className="relative flex-shrink-0">
                      {chat.otherUser?.avatar_url
                        ? <img src={chat.otherUser.avatar_url} alt={chat.otherUser.username} className="w-12 h-12 rounded-full object-cover" />
                        : <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>}
                      {/* Badge de no leídos en el avatar */}
                      {unread > 0 && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-white font-black"
                          style={{ backgroundColor: '#ef4444', fontSize: 10 }}>
                          {unread > 9 ? '9+' : unread}
                        </motion.span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${unread > 0 ? 'font-bold' : 'font-medium'}`}>{chat.otherUser?.username}</p>
                      <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'font-semibold' : ''}`}
                        style={{ color: unread > 0 ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                        {lastMsgText}
                      </p>
                    </div>
                    {chat.lastMsg && (
                      <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-hint)' }}>
                        {formatTime(chat.lastMsg.created_at)}
                      </p>
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      {tab === 'feed' && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setShowNewPost(true)}
          className="fixed bottom-24 right-5 w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-40">
          ✏️
        </motion.button>
      )}

      {/* Modal nuevo post */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={closeNewPost}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="flex flex-col rounded-t-3xl w-full max-w-lg mx-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={closeNewPost} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cancelar</motion.button>
                <h2 className="text-base font-bold">Nuevo post</h2>
                <motion.button whileTap={{ scale: 0.95 }} onClick={submitPost} disabled={!canPublish}
                  className="px-4 py-2 rounded-full text-sm font-bold"
                  style={{ backgroundColor: canPublish ? '#f59e0b' : 'var(--bg-input)', color: canPublish ? '#fff' : 'var(--text-hint)' }}>
                  {uploadingPost ? '...' : 'Publicar'}
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pt-4">
                <div className="flex gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg mt-1" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
                  <textarea ref={textareaRef} value={newPostContent} onChange={e => setNewPostContent(e.target.value)}
                    placeholder="¿Qué estás bebiendo? 🍺" rows={5}
                    className="flex-1 outline-none resize-none text-sm bg-transparent leading-relaxed"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
                {newPostPreview && (
                  <div className="relative mb-4 ml-12">
                    <img src={newPostPreview} alt="Preview" className="w-full rounded-2xl max-h-52 object-cover" />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setNewPostImage(null); setNewPostPreview(null) }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</motion.button>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 border-t px-5 py-3 flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => postImageRef.current?.click()} style={{ color: '#f59e0b' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                </motion.button>
                <input ref={postImageRef} type="file" accept="image/*" onChange={handlePostImageSelect} className="hidden" />
                <p className="text-xs ml-auto" style={{ color: 'var(--text-hint)' }}>{newPostContent.length > 0 && `${newPostContent.length} caracteres`}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visor historia */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={() => setSelectedStory(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={selectedStory.image_url} alt="Historia" className="w-full h-full object-contain" />
            <div className="absolute top-6 left-4 flex items-center gap-2">
              <Avatar url={selectedStory.profiles?.avatar_url} username={selectedStory.profiles?.username} />
              <div>
                <p className="text-white font-bold text-sm">{selectedStory.profiles?.username}</p>
                <p className="text-gray-300 text-xs">{formatTime(selectedStory.created_at)}</p>
              </div>
            </div>
            <button onClick={() => setSelectedStory(null)} className="absolute top-6 right-4 text-white text-2xl">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel comentarios */}
      <AnimatePresence>
        {openComments && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
            onClick={closeCommentsPanel}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', height: '80vh' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <p style={{ fontWeight: 'bold', fontSize: 16 }}>Comentarios {comments.length > 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 'normal', backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 999 }}>{comments.length}</span>}</p>
                <button onClick={closeCommentsPanel} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                    <p style={{ fontSize: 14 }}>Sin comentarios todavía</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {comments.map(comment => {
                      const isMe = comment.user_id === user.id
                      return (
                        <motion.div key={comment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 18 }}>🍺</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ borderRadius: '4px 16px 16px 16px', padding: '10px 14px', backgroundColor: isMe ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)' }}>
                              <p style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: isMe ? '#f59e0b' : 'var(--text-primary)' }}>{comment.profiles?.username} {isMe && '(tú)'}</p>
                              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{comment.content}</p>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4, marginLeft: 4 }}>{formatTime(comment.created_at)}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                    <div ref={commentsBottomRef} />
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 16px 80px 16px', display: 'flex', gap: 10, alignItems: 'flex-end', backgroundColor: 'var(--bg-card)' }}>
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={handleCommentKeyDown}
                  placeholder="Escribe un comentario..." rows={1}
                  style={{ flex: 1, borderRadius: 20, padding: '10px 16px', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: 'none', outline: 'none', resize: 'none', fontSize: 14, maxHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }} />
                <motion.button whileTap={{ scale: 0.9 }} onClick={submitComment} disabled={!commentText.trim() || sendingComment}
                  style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', backgroundColor: commentText.trim() && !sendingComment ? '#f59e0b' : 'var(--bg-input)', color: commentText.trim() && !sendingComment ? '#fff' : 'var(--text-hint)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !commentText.trim() || sendingComment ? 0.5 : 1 }}>
                  {sendingComment
                    ? <motion.div style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perfil de usuario */}
      <AnimatePresence>
        {viewingProfile && (
          <UserProfile profileId={viewingProfile} onClose={() => setViewingProfile(null)}
            onOpenChat={(chat, otherUser) => { setViewingProfile(null); handleOpenChat(chat, otherUser) }} />
        )}
      </AnimatePresence>

      {/* Chat privado */}
      <AnimatePresence>
        {activeChat && (
          <PrivateChat chat={activeChat.chat} otherUser={activeChat.otherUser}
            onClose={() => { setActiveChat(null); fetchChats(); fetchUnreadCounts() }} />
        )}
      </AnimatePresence>
    </div>
  )
}