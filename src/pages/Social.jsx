import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem, slideUp } from '../lib/animations'

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
  const postImageRef = useRef(null)
  const storyImageRef = useRef(null)

  useEffect(() => { fetchFeed() }, [])

  const fetchFeed = async () => {
    setLoading(true)
    const [{ data: postsData }, { data: storiesData }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles(username, avatar_url), post_likes(user_id), post_comments(id)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('stories')
        .select('*, profiles(username, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
    ])
    setPosts(postsData || [])
    setStories(storiesData || [])
    setLoading(false)
  }

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

    await supabase.from('posts').insert({
      user_id: user.id,
      content: newPostContent.trim(),
      image_url: imageUrl,
    })

    setNewPostContent('')
    setNewPostImage(null)
    setNewPostPreview(null)
    setShowNewPost(false)
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
      await supabase.from('stories').insert({
        user_id: user.id,
        image_url: publicUrl,
      })
      fetchFeed()
    }
    setUploadingStory(false)
    e.target.value = ''
  }

  const toggleLike = async (post) => {
    const alreadyLiked = post.post_likes?.some(l => l.user_id === user.id)
    if (alreadyLiked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', user.id)
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
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  const submitComment = async () => {
    if (!commentText.trim() || !openComments) return
    await supabase.from('post_comments').insert({
      post_id: openComments.id,
      user_id: user.id,
      content: commentText.trim(),
    })
    setCommentText('')
    openCommentsPanel(openComments)
    fetchFeed()
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
      <div className={`${dim} rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-lg`}>
        🍺
      </div>
    )
  }

  // Agrupar historias por usuario
  const storiesByUser = stories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = { profile: s.profiles, stories: [] }
    acc[s.user_id].stories.push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Social 🍻</h1>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNewPost(true)}
            className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + Post
          </motion.button>
        </div>

        {/* Pestañas */}
        <div className="flex bg-gray-800 rounded-xl p-1">
          {[
            { id: 'feed',    label: '📰 Feed' },
            { id: 'stories', label: '⭕ Historias' },
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
                  layoutId="social-tab"
                  className="absolute inset-0 bg-amber-500 rounded-lg"
                  style={{ zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FEED ── */}
      {tab === 'feed' && (
        <div className="max-w-md mx-auto px-4 pt-4">

          {/* Historias en miniatura encima del feed */}
          {Object.keys(storiesByUser).length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3 mb-4 scrollbar-hide">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button
                  key={userStories[0].user_id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedStory(userStories[0])}
                  className="flex flex-col items-center gap-1 flex-shrink-0"
                >
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600">
                    <div className="bg-gray-950 p-0.5 rounded-full">
                      <Avatar url={profile?.avatar_url} username={profile?.username} size="sm" />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 truncate w-14 text-center">
                    {profile?.username}
                  </span>
                </motion.button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-gray-500 text-center py-10">Cargando feed...</p>
          ) : posts.length === 0 ? (
            <motion.div {...fadeIn} className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">📰</div>
              <p>Aún no hay posts</p>
              <p className="text-sm mt-1">¡Sé el primero en publicar!</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => {
                const isMe = post.user_id === user.id
                const liked = post.post_likes?.some(l => l.user_id === user.id)
                const likesCount = post.post_likes?.length || 0
                const commentsCount = post.post_comments?.length || 0

                return (
                  <motion.div
                    key={post.id}
                    variants={staggerItem}
                    initial="initial"
                    animate="animate"
                    className="bg-gray-900 rounded-2xl overflow-hidden"
                  >
                    {/* Cabecera del post */}
                    <div className="flex items-center gap-3 p-4 pb-3">
                      <Avatar url={post.profiles?.avatar_url} username={post.profiles?.username} />
                      <div className="flex-1">
                        <p className="font-bold text-sm">{post.profiles?.username}</p>
                        <p className="text-xs text-gray-500">{formatTime(post.created_at)}</p>
                      </div>
                      {isMe && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deletePost(post.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors text-lg"
                        >
                          🗑️
                        </motion.button>
                      )}
                    </div>

                    {/* Contenido */}
                    {post.content && (
                      <p className="px-4 pb-3 text-sm leading-relaxed">{post.content}</p>
                    )}

                    {/* Imagen */}
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Post"
                        className="w-full object-cover max-h-80"
                      />
                    )}

                    {/* Acciones */}
                    <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-800">
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => toggleLike(post)}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <motion.span
                          animate={liked ? { scale: [1, 1.4, 1] } : {}}
                          transition={{ duration: 0.3 }}
                          className="text-xl"
                        >
                          {liked ? '🍺' : '🤍'}
                        </motion.span>
                        <span className={liked ? 'text-amber-400 font-semibold' : 'text-gray-500'}>
                          {likesCount}
                        </span>
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openCommentsPanel(post)}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
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

          {/* Botón subir historia */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => storyImageRef.current?.click()}
            disabled={uploadingStory}
            className="w-full bg-gray-900 hover:bg-gray-800 border-2 border-dashed border-gray-700 rounded-2xl py-6 flex flex-col items-center gap-2 mb-6 transition-colors"
          >
            <span className="text-3xl">{uploadingStory ? '⏳' : '⭕'}</span>
            <span className="text-gray-400 text-sm">
              {uploadingStory ? 'Subiendo historia...' : 'Añadir historia'}
            </span>
          </motion.button>
          <input ref={storyImageRef} type="file" accept="image/*" onChange={submitStory} className="hidden" />

          {Object.keys(storiesByUser).length === 0 ? (
            <motion.div {...fadeIn} className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">⭕</div>
              <p>No hay historias activas</p>
              <p className="text-sm mt-1">Las historias duran 24 horas</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button
                  key={userStories[0].user_id}
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedStory(userStories[0])}
                  className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-900"
                >
                  <img
                    src={userStories[0].image_url}
                    alt="Historia"
                    className="w-full h-full object-cover"
                  />
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

      {/* Modal nuevo post */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
            onClick={() => setShowNewPost(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-t-3xl p-6 w-full max-w-lg"
            >
              <h2 className="text-lg font-bold mb-4">Nuevo post 📝</h2>

              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder="¿Qué estás bebiendo? 🍺"
                rows={4}
                className="w-full bg-gray-800 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm mb-3"
              />

              {newPostPreview && (
                <div className="relative mb-3">
                  <img src={newPostPreview} alt="Preview" className="w-full rounded-2xl max-h-48 object-cover" />
                  <button
                    onClick={() => { setNewPostImage(null); setNewPostPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => postImageRef.current?.click()}
                  className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-xl transition-colors"
                >
                  📷
                </motion.button>
                <input ref={postImageRef} type="file" accept="image/*" onChange={handlePostImageSelect} className="hidden" />
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={submitPost}
                  disabled={(!newPostContent.trim() && !newPostImage) || uploadingPost}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {uploadingPost ? 'Publicando...' : 'Publicar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visor de historia */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
            onClick={() => setSelectedStory(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedStory.image_url}
              alt="Historia"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-6 left-4 flex items-center gap-2">
              <Avatar url={selectedStory.profiles?.avatar_url} username={selectedStory.profiles?.username} />
              <div>
                <p className="text-white font-bold text-sm">{selectedStory.profiles?.username}</p>
                <p className="text-gray-300 text-xs">{formatTime(selectedStory.created_at)}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedStory(null)}
              className="absolute top-6 right-4 text-white text-2xl"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel de comentarios */}
      <AnimatePresence>
        {openComments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end z-50"
            onClick={() => setOpenComments(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-t-3xl p-5 w-full max-h-[70vh] flex flex-col"
            >
              <h2 className="text-base font-bold mb-4">Comentarios 💬</h2>

              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">Sin comentarios todavía</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar url={comment.profiles?.avatar_url} username={comment.profiles?.username} />
                      <div className="flex-1 bg-gray-800 rounded-2xl px-3 py-2">
                        <p className="text-xs font-bold text-amber-400">{comment.profiles?.username}</p>
                        <p className="text-sm text-gray-200 mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Escribe un comentario..."
                  rows={1}
                  className="flex-1 bg-gray-800 text-white rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white p-3 rounded-2xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}