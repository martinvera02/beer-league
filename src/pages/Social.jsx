import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'
import { soundLike, soundMessage, soundSuccess, soundError } from '../lib/sounds'

// ─── RULETA ──────────────────────────────────────────────────────────────────

const SEGMENTS = [
  { label: '+2 pts',       emoji: '🍺', color: '#f59e0b', textColor: '#fff' },
  { label: '+50 🪙',       emoji: '🪙', color: '#6366f1', textColor: '#fff' },
  { label: 'Escudo',       emoji: '🛡️', color: '#10b981', textColor: '#fff' },
  { label: '+5 pts',       emoji: '🍺', color: '#ef4444', textColor: '#fff' },
  { label: '+150 🪙',      emoji: '🪙', color: '#8b5cf6', textColor: '#fff' },
  { label: 'Freeze',       emoji: '🧊', color: '#3b82f6', textColor: '#fff' },
  { label: '+2 pts',       emoji: '🍺', color: '#f59e0b', textColor: '#fff' },
  { label: '+300 🪙',      emoji: '🪙', color: '#ec4899', textColor: '#fff' },
  { label: 'Racha Doble',  emoji: '🔥', color: '#f97316', textColor: '#fff' },
  { label: '+5 pts',       emoji: '🍺', color: '#ef4444', textColor: '#fff' },
  { label: 'Turbo',        emoji: '⚡', color: '#eab308', textColor: '#fff' },
  { label: '💀 Nada',      emoji: '💀', color: '#374151', textColor: '#9ca3af' },
]

const TOTAL = SEGMENTS.length
const SEGMENT_ANGLE = 360 / TOTAL

function RouletteWheel({ spinning, targetIndex, onSpinEnd }) {
  const [rotation, setRotation] = useState(0)
  const [displayRotation, setDisplayRotation] = useState(0)
  const animRef = useRef(null)
  const startRef = useRef(null)
  const startRotRef = useRef(0)

  useEffect(() => {
    if (!spinning) return

    // El puntero está arriba (270°). Calculamos cuánto hay que girar para que
    // el segmento targetIndex quede arriba.
    const segmentCenter = targetIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
    const targetAngle = 270 - segmentCenter
    // Normalizar entre 0-360
    const normalized = ((targetAngle % 360) + 360) % 360
    // Añadir vueltas completas para efecto de giro (5-8 vueltas)
    const spins = 5 + Math.floor(Math.random() * 3)
    const finalRotation = rotation + spins * 360 + normalized - (rotation % 360)

    const duration = 4000 + Math.random() * 1000
    startRef.current = null
    startRotRef.current = rotation

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startRotRef.current + (finalRotation - startRotRef.current) * eased
      setDisplayRotation(current)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setRotation(finalRotation)
        setDisplayRotation(finalRotation)
        onSpinEnd()
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning])

  const size = 280
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8

  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const describeArc = (startAngle, endAngle) => {
    const start = polarToCartesian(startAngle, r)
    const end = polarToCartesian(endAngle, r)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      {/* Puntero */}
      <div style={{
        position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
      }}>▼</div>

      {/* Aro exterior */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        padding: 6, boxShadow: '0 0 40px rgba(245,158,11,0.4), 0 0 0 3px rgba(245,158,11,0.2)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
          <svg
            width={size - 12} height={size - 12}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: `rotate(${displayRotation}deg)`, transformOrigin: 'center', transition: spinning ? 'none' : undefined }}
          >
            {SEGMENTS.map((seg, i) => {
              const startAngle = i * SEGMENT_ANGLE
              const endAngle = (i + 1) * SEGMENT_ANGLE
              const midAngle = startAngle + SEGMENT_ANGLE / 2
              const textPos = polarToCartesian(midAngle, r * 0.65)
              const emojiPos = polarToCartesian(midAngle, r * 0.85)

              return (
                <g key={i}>
                  <path d={describeArc(startAngle, endAngle)} fill={seg.color}
                    stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
                  {/* Emoji cerca del borde */}
                  <text x={emojiPos.x} y={emojiPos.y}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="14" style={{ userSelect: 'none' }}>
                    {seg.emoji}
                  </text>
                  {/* Label en el medio */}
                  <text x={textPos.x} y={textPos.y}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fontWeight="bold" fill={seg.textColor}
                    transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}
                    style={{ userSelect: 'none' }}>
                    {seg.label}
                  </text>
                </g>
              )
            })}
            {/* Centro */}
            <circle cx={cx} cy={cy} r={22} fill="#1f2937" stroke="#f59e0b" strokeWidth="3" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="18">🍺</text>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── SOCIAL PRINCIPAL ────────────────────────────────────────────────────────

export default function Social() {
  const { user } = useAuth()
  const [tab, setTab] = useState('feed')

  // Feed / Stories state
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
  const postImageRef = useRef(null)
  const storyImageRef = useRef(null)
  const textareaRef = useRef(null)
  const commentsBottomRef = useRef(null)

  // Ruleta state
  const [spinning, setSpinning] = useState(false)
  const [targetIndex, setTargetIndex] = useState(0)
  const [prize, setPrize] = useState(null)
  const [showPrize, setShowPrize] = useState(false)
  const [alreadySpun, setAlreadySpun] = useState(false)
  const [spinHistory, setSpinHistory] = useState([])
  const [loadingRoulette, setLoadingRoulette] = useState(true)

  useEffect(() => { fetchFeed() }, [])
  useEffect(() => { if (tab === 'casino') fetchRouletteData() }, [tab])

  useEffect(() => {
    if (showNewPost && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [showNewPost])

  useEffect(() => {
    if (!openComments) return
    const channel = supabase
      .channel(`comments:${openComments.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${openComments.id}` },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single()
          setComments(prev => [...prev, { ...payload.new, profiles: profile }])
          setTimeout(() => commentsBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [openComments])

  const fetchFeed = async () => {
    setLoading(true)
    const [{ data: postsData }, { data: storiesData }] = await Promise.all([
      supabase.from('posts')
        .select('*, profiles(username, avatar_url), post_likes(user_id), post_comments(id)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('stories')
        .select('*, profiles(username, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
    ])
    setPosts(postsData || [])
    setStories(storiesData || [])
    setLoading(false)
  }

  const fetchRouletteData = async () => {
    setLoadingRoulette(true)
    const { data } = await supabase
      .from('roulette_spins')
      .select('*')
      .eq('user_id', user.id)
      .order('spun_at', { ascending: false })
      .limit(10)

    setSpinHistory(data || [])

    // Comprobar si ya giró hoy
    if (data && data.length > 0) {
      const lastSpin = new Date(data[0].spun_at)
      const now = new Date()
      const lastMadrid = new Date(lastSpin.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      const nowMadrid = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      const sameDay = lastMadrid.toDateString() === nowMadrid.toDateString()
      setAlreadySpun(sameDay)
    } else {
      setAlreadySpun(false)
    }

    setLoadingRoulette(false)
  }

  // Mapear prize_label del servidor al índice de segmento visual
  const findSegmentIndex = (prizeLabel) => {
    // Buscar por label aproximado
    const map = {
      '+2 puntos': 0,
      '+50 monedas': 1,
      'Escudo': 2,
      '+5 puntos': 3,
      '+150 monedas': 4,
      'Freeze': 5,
      '+300 monedas': 7,
      'Racha Doble': 8,
      'Turbo': 10,
      '¡Mala suerte!': 11,
    }
    for (const [key, idx] of Object.entries(map)) {
      if (prizeLabel?.includes(key.split(' ')[0]) || key.includes(prizeLabel?.split(' ')[0] || '')) {
        return idx
      }
    }
    return Math.floor(Math.random() * TOTAL)
  }

  const handleSpin = async () => {
    if (spinning || alreadySpun) return
    setSpinning(true)
    setPrize(null)
    setShowPrize(false)

    const { data } = await supabase.rpc('spin_roulette')

    if (!data?.success) {
      soundError()
      setSpinning(false)
      if (data?.error) alert(data.error)
      return
    }

    // Determinar en qué segmento visual cae
    const labelMap = {
      '+2 puntos': 0,
      '+5 puntos': 3,
      '+50 monedas': 1,
      '+150 monedas': 4,
      '+300 monedas': 7,
      'Escudo': 2,
      'Freeze': 5,
      'Racha Doble': 8,
      'Turbo': 10,
      'Sniper': 10, // fallback
      'Sabotaje': 11, // fallback
      '¡Mala suerte!': 11,
    }
    const idx = labelMap[data.prize_label] ?? Math.floor(Math.random() * TOTAL)
    setTargetIndex(idx)
    setPrize(data)
    // El giro empieza, onSpinEnd lo llamará la animación
  }

  const handleSpinEnd = useCallback(() => {
    setSpinning(false)
    setAlreadySpun(true)
    soundSuccess()
    setTimeout(() => {
      setShowPrize(true)
      fetchRouletteData()
    }, 300)
  }, [])

  // ── Feed helpers ──
  const handlePostImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setNewPostImage(file)
    setNewPostPreview(URL.createObjectURL(file))
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
    closeNewPost()
    setUploadingPost(false)
    fetchFeed()
  }

  const submitStory = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingStory(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/stories/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('social').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('social').getPublicUrl(path)
      await supabase.from('stories').insert({ user_id: user.id, image_url: publicUrl })
      fetchFeed()
    }
    setUploadingStory(false)
    e.target.value = ''
  }

  const toggleLike = async (post) => {
    const alreadyLiked = post.post_likes?.some(l => l.user_id === user.id)
    if (!alreadyLiked) soundLike()
    if (alreadyLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    }
    fetchFeed()
  }

  const deletePost = async (postId) => {
    await supabase.from('posts').delete().eq('id', postId)
    fetchFeed()
  }

  const openCommentsPanel = async (post) => {
    setOpenComments(post)
    setCommentText('')
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  const closeCommentsPanel = () => { setOpenComments(null); setComments([]); setCommentText('') }

  const submitComment = async () => {
    if (!commentText.trim() || !openComments || sendingComment) return
    setSendingComment(true)
    soundMessage()
    const { error } = await supabase.from('post_comments').insert({
      post_id: openComments.id, user_id: user.id, content: commentText.trim(),
    })
    if (!error) { setCommentText(''); fetchFeed() }
    setSendingComment(false)
  }

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() }
  }

  const closeNewPost = () => {
    setShowNewPost(false); setNewPostContent(''); setNewPostImage(null); setNewPostPreview(null)
  }

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`
    if (hours > 0) return `hace ${hours}h`
    if (mins > 0) return `hace ${mins}m`
    return 'ahora'
  }

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'
    return url ? (
      <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
    ) : (
      <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-lg`}
        style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
    )
  }

  const storiesByUser = stories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = { profile: s.profiles, stories: [] }
    acc[s.user_id].stories.push(s)
    return acc
  }, {})

  const canPublish = (newPostContent.trim().length > 0 || newPostImage !== null) && !uploadingPost

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold mb-4">Social 🍻</h1>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[
            { id: 'feed',    label: '📰 Feed' },
            { id: 'stories', label: '⭕ Historias' },
            { id: 'casino',  label: '🎰 Casino' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="social-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: t.id === 'casino' ? '#7c3aed' : '#f59e0b' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
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
                  <span className="text-xs truncate w-14 text-center" style={{ color: 'var(--text-muted)' }}>
                    {profile?.username}
                  </span>
                </motion.button>
              ))}
            </div>
          )}

          <motion.div {...fadeIn}
            className="rounded-2xl p-3 mb-4 flex items-center gap-3 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={() => setShowNewPost(true)}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
              style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
            <div className="flex-1 rounded-xl px-4 py-2.5 text-sm"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>
              ¿Qué estás bebiendo?
            </div>
          </motion.div>

          {loading ? (
            <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando feed...</p>
          ) : posts.length === 0 ? (
            <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">📰</div>
              <p>Aún no hay posts</p>
              <p className="text-sm mt-1">¡Sé el primero en publicar!</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const isMe = post.user_id === user.id
                const liked = post.post_likes?.some(l => l.user_id === user.id)
                const likesCount = post.post_likes?.length || 0
                const commentsCount = post.post_comments?.length || 0
                return (
                  <motion.div key={post.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-3 p-4 pb-3">
                      <Avatar url={post.profiles?.avatar_url} username={post.profiles?.username} />
                      <div className="flex-1">
                        <p className="font-bold text-sm">{post.profiles?.username}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(post.created_at)}</p>
                      </div>
                      {isMe && (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => deletePost(post.id)}
                          className="text-lg" style={{ color: 'var(--text-hint)' }}>🗑️</motion.button>
                      )}
                    </div>
                    {post.content && <p className="px-4 pb-3 text-sm leading-relaxed">{post.content}</p>}
                    {post.image_url && <img src={post.image_url} alt="Post" className="w-full object-cover max-h-80" />}
                    <div className="flex items-center gap-4 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleLike(post)}
                        className="flex items-center gap-1.5 text-sm">
                        <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }} className="text-xl">
                          {liked ? '🍺' : '🤍'}
                        </motion.span>
                        <span style={{ color: liked ? '#f59e0b' : 'var(--text-muted)' }} className={liked ? 'font-semibold' : ''}>
                          {likesCount}
                        </span>
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => openCommentsPanel(post)}
                        className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <span className="text-xl">💬</span>
                        <span>{commentsCount}</span>
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
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => storyImageRef.current?.click()}
            disabled={uploadingStory}
            className="w-full border-2 border-dashed rounded-2xl py-6 flex flex-col items-center gap-2 mb-6"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span className="text-3xl">{uploadingStory ? '⏳' : '⭕'}</span>
            <span className="text-sm">{uploadingStory ? 'Subiendo...' : 'Añadir historia'}</span>
            <span className="text-xs" style={{ color: 'var(--text-hint)' }}>Desaparece en 24 horas</span>
          </motion.button>
          <input ref={storyImageRef} type="file" accept="image/*" onChange={submitStory} className="hidden" />

          {Object.keys(storiesByUser).length === 0 ? (
            <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">⭕</div>
              <p>No hay historias activas</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button key={userStories[0].user_id} variants={staggerItem} initial="initial" animate="animate"
                  whileTap={{ scale: 0.95 }} onClick={() => setSelectedStory(userStories[0])}
                  className="relative rounded-2xl overflow-hidden aspect-[3/4]"
                  style={{ backgroundColor: 'var(--bg-card)' }}>
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

      {/* ── CASINO / RULETA ── */}
      {tab === 'casino' && (
        <div className="max-w-md mx-auto px-4 pt-6 pb-10">

          {/* Header casino */}
          <motion.div {...fadeIn} className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-1">Ruleta de la Suerte 🎰</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Una tirada gratis al día · Gana puntos, monedas o powerups
            </p>
          </motion.div>

          {loadingRoulette ? (
            <div className="text-center py-16">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="text-4xl mb-3">🎰</motion.div>
              <p style={{ color: 'var(--text-muted)' }}>Cargando ruleta...</p>
            </div>
          ) : (
            <>
              {/* Ruleta */}
              <div className="mb-8">
                <RouletteWheel
                  spinning={spinning}
                  targetIndex={targetIndex}
                  onSpinEnd={handleSpinEnd}
                />
              </div>

              {/* Estado y botón */}
              {alreadySpun && !spinning ? (
                <motion.div {...fadeIn} className="text-center mb-6">
                  <div className="rounded-2xl p-4 mb-4"
                    style={{ backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <p className="text-sm font-bold text-purple-400">✅ Ya has girado hoy</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      Vuelve mañana para otra tirada gratis
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  whileTap={!spinning && !alreadySpun ? { scale: 0.95 } : {}}
                  onClick={handleSpin}
                  disabled={spinning || alreadySpun}
                  className="w-full py-5 rounded-2xl font-bold text-white text-lg mb-6 relative overflow-hidden"
                  style={{ backgroundColor: spinning ? '#4c1d95' : '#7c3aed' }}>
                  {spinning ? (
                    <div className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}>
                        🎰
                      </motion.span>
                      Girando...
                    </div>
                  ) : (
                    '🎰 ¡Girar la ruleta!'
                  )}
                  {!spinning && !alreadySpun && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </motion.button>
              )}

              {/* Premio revelado */}
              <AnimatePresence>
                {showPrize && prize && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="rounded-2xl p-6 mb-6 text-center"
                    style={{
                      backgroundColor: prize.prize_type === 'nothing'
                        ? 'rgba(55,65,81,0.5)'
                        : 'rgba(124,58,237,0.15)',
                      border: `2px solid ${prize.prize_type === 'nothing' ? '#374151' : '#7c3aed'}`,
                    }}>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], rotate: prize.prize_type === 'nothing' ? [0, -5, 5, 0] : [0, -10, 10, 0] }}
                      transition={{ duration: 0.6 }}
                      className="text-6xl mb-3">
                      {prize.prize_emoji}
                    </motion.div>
                    <p className="text-xl font-bold mb-1"
                      style={{ color: prize.prize_type === 'nothing' ? '#9ca3af' : '#c084fc' }}>
                      {prize.prize_type === 'nothing' ? '¡Mala suerte!' : '¡Premio!'}
                    </p>
                    <p className="text-lg font-bold text-white mb-2">{prize.prize_label}</p>
                    {prize.prize_type === 'points' && (
                      <p className="text-sm" style={{ color: 'var(--text-hint)' }}>
                        Puntos añadidos en todas tus ligas
                      </p>
                    )}
                    {prize.prize_type === 'coins' && (
                      <p className="text-sm" style={{ color: 'var(--text-hint)' }}>
                        Monedas añadidas a tu monedero
                      </p>
                    )}
                    {prize.prize_type === 'powerup' && (
                      <p className="text-sm" style={{ color: 'var(--text-hint)' }}>
                        Powerup añadido a tu inventario
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tabla de premios */}
              <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-sm font-bold mb-3">Tabla de premios</p>
                <div className="space-y-2">
                  {[
                    { emoji: '🍺', label: '+2 puntos', prob: '20%', color: '#f59e0b' },
                    { emoji: '🍺', label: '+5 puntos', prob: '15%', color: '#f59e0b' },
                    { emoji: '🪙', label: '+50 monedas', prob: '15%', color: '#6366f1' },
                    { emoji: '🪙', label: '+150 monedas', prob: '10%', color: '#8b5cf6' },
                    { emoji: '🪙', label: '+300 monedas', prob: '8%', color: '#ec4899' },
                    { emoji: '🔥', label: 'Racha Doble', prob: '8%', color: '#f97316' },
                    { emoji: '🛡️', label: 'Escudo', prob: '7%', color: '#10b981' },
                    { emoji: '🧊', label: 'Freeze', prob: '7%', color: '#3b82f6' },
                    { emoji: '⚡', label: 'Turbo', prob: '5%', color: '#eab308' },
                    { emoji: '💣', label: 'Sabotaje', prob: '3%', color: '#ef4444' },
                    { emoji: '🎯', label: 'Sniper', prob: '1%', color: '#a855f7' },
                    { emoji: '💀', label: 'Nada', prob: '1%', color: '#6b7280' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.emoji}</span>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                        {item.prob}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historial de tiradas */}
              {spinHistory.length > 0 && (
                <div>
                  <p className="text-sm font-bold mb-3">Últimas tiradas</p>
                  <div className="space-y-2">
                    {spinHistory.map(spin => (
                      <motion.div key={spin.id} variants={staggerItem} initial="initial" animate="animate"
                        className="rounded-2xl p-3 flex items-center gap-3"
                        style={{ backgroundColor: 'var(--bg-card)' }}>
                        <span className="text-2xl">{spin.prize_emoji}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{spin.prize_label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                            {formatTime(spin.spun_at)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: spin.prize_type === 'nothing' ? 'rgba(107,114,128,0.2)' :
                              spin.prize_type === 'coins' ? 'rgba(99,102,241,0.2)' :
                              spin.prize_type === 'points' ? 'rgba(245,158,11,0.2)' : 'rgba(124,58,237,0.2)',
                            color: spin.prize_type === 'nothing' ? '#9ca3af' :
                              spin.prize_type === 'coins' ? '#818cf8' :
                              spin.prize_type === 'points' ? '#f59e0b' : '#c084fc',
                          }}>
                          {spin.prize_type === 'nothing' ? 'Nada' :
                           spin.prize_type === 'coins' ? '🪙' :
                           spin.prize_type === 'points' ? '🍺' : '⚡'}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Botón flotante feed */}
      {tab === 'feed' && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}
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
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
            onClick={closeNewPost}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="flex flex-col rounded-t-3xl w-full max-w-lg mx-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border)' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={closeNewPost}
                  className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cancelar</motion.button>
                <h2 className="text-base font-bold">Nuevo post</h2>
                <motion.button whileTap={{ scale: 0.95 }} onClick={submitPost} disabled={!canPublish}
                  className="px-4 py-2 rounded-full text-sm font-bold"
                  style={{ backgroundColor: canPublish ? '#f59e0b' : 'var(--bg-input)', color: canPublish ? '#fff' : 'var(--text-hint)' }}>
                  {uploadingPost ? '...' : 'Publicar'}
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pt-4">
                <div className="flex gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg mt-1"
                    style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
                  <textarea ref={textareaRef} value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder="¿Qué estás bebiendo? 🍺" rows={5}
                    className="flex-1 outline-none resize-none text-sm bg-transparent leading-relaxed"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
                {newPostPreview && (
                  <div className="relative mb-4 ml-12">
                    <img src={newPostPreview} alt="Preview" className="w-full rounded-2xl max-h-52 object-cover" />
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => { setNewPostImage(null); setNewPostPreview(null) }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</motion.button>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 border-t px-5 py-3 flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => postImageRef.current?.click()}
                  style={{ color: '#f59e0b' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                </motion.button>
                <input ref={postImageRef} type="file" accept="image/*" onChange={handlePostImageSelect} className="hidden" />
                <p className="text-xs ml-auto" style={{ color: 'var(--text-hint)' }}>
                  {newPostContent.length > 0 && `${newPostContent.length} caracteres`}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visor historia */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
            onClick={() => setSelectedStory(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              src={selectedStory.image_url} alt="Historia" className="w-full h-full object-contain" />
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
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
            onClick={closeCommentsPanel}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
                width: '100%', borderRadius: '24px 24px 0 0',
                display: 'flex', flexDirection: 'column', height: '80vh',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <p style={{ fontWeight: 'bold', fontSize: 16 }}>
                  Comentarios {comments.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 'normal', backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 999 }}>{comments.length}</span>
                  )}
                </p>
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
                        <motion.div key={comment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          style={{ display: 'flex', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {comment.profiles?.avatar_url
                              ? <img src={comment.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                              : <span style={{ fontSize: 18 }}>🍺</span>}
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
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={handleCommentKeyDown} placeholder="Escribe un comentario..." rows={1}
                  style={{ flex: 1, borderRadius: 20, padding: '10px 16px', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: 'none', outline: 'none', resize: 'none', fontSize: 14, maxHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }} />
                <motion.button whileTap={{ scale: 0.9 }} onClick={submitComment}
                  disabled={!commentText.trim() || sendingComment}
                  style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', backgroundColor: commentText.trim() && !sendingComment ? '#f59e0b' : 'var(--bg-input)', color: commentText.trim() && !sendingComment ? '#fff' : 'var(--text-hint)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !commentText.trim() || sendingComment ? 0.5 : 1 }}>
                  {sendingComment ? (
                    <motion.div style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}