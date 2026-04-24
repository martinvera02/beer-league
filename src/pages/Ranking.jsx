import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem } from '../lib/animations'
import { soundMessage, soundMessageReceived, soundSuccess, soundError } from '../lib/sounds'
import SeasonCountdown from '../components/SeasonCountdown'

// ─── TARJETA DE ENCUESTA ──────────────────────────────────────────────────────
function PollCard({ poll, userId }) {
  const [votes, setVotes] = useState([])
  const [options, setOptions] = useState([])
  const [myVote, setMyVote] = useState(null)
  const [voting, setVoting] = useState(false)
  const [showVoters, setShowVoters] = useState(null)

  useEffect(() => { fetchPollData() }, [poll.id])

  const fetchPollData = async () => {
    const [{ data: opts }, { data: vs }] = await Promise.all([
      supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('position'),
      supabase.from('poll_votes').select('*, profiles(username, avatar_url)').eq('poll_id', poll.id),
    ])
    setOptions(opts || [])
    setVotes(vs || [])
    setMyVote((vs || []).find(v => v.user_id === userId)?.option_id || null)
  }

  const handleVote = async (optionId) => {
    if (voting || isClosed) return
    setVoting(true)
    if (myVote) await supabase.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', userId)
    if (myVote !== optionId) await supabase.from('poll_votes').insert({ poll_id: poll.id, option_id: optionId, user_id: userId })
    await fetchPollData()
    setVoting(false)
  }

  const isClosed = poll.closes_at && new Date(poll.closes_at) < new Date()
  const totalVotes = votes.length

  const formatCloses = (ts) => {
    if (!ts) return null
    const diff = new Date(ts) - new Date()
    if (diff <= 0) return 'Cerrada'
    const h = Math.floor(diff / 3600000), d = Math.floor(h / 24)
    return d > 0 ? `Cierra en ${d}d` : `Cierra en ${h}h`
  }

  return (
    <div className="rounded-2xl overflow-hidden w-full" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid rgba(99,102,241,0.2)' }}>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>📊 Encuesta</span>
          {poll.closes_at && <span className="text-xs" style={{ color: isClosed ? '#ef4444' : 'var(--text-hint)' }}>{formatCloses(poll.closes_at)}</span>}
        </div>
        <p className="font-bold text-sm">{poll.question}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{totalVotes} voto{totalVotes !== 1 ? 's' : ''}</p>
      </div>
      <div className="px-4 pb-3 space-y-2">
        {options.map(opt => {
          const optVotes = votes.filter(v => v.option_id === opt.id)
          const pct = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0
          const isMyVote = myVote === opt.id
          return (
            <div key={opt.id}>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleVote(opt.id)}
                disabled={voting || isClosed}
                className="w-full rounded-xl overflow-hidden relative text-left"
                style={{ border: isMyVote ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.06)' }}>
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full" style={{ backgroundColor: isMyVote ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)' }} />
                </div>
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {isMyVote && <span className="text-indigo-400 text-xs font-black">✓</span>}
                    <span className="text-sm font-medium">{opt.text}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold" style={{ color: isMyVote ? '#818cf8' : 'var(--text-hint)' }}>{pct}%</span>
                    {optVotes.length > 0 && (
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={e => { e.stopPropagation(); setShowVoters(showVoters === opt.id ? null : opt.id) }}
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-hint)' }}>
                        {optVotes.length}
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.button>
              <AnimatePresence>
                {showVoters === opt.id && optVotes.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-1.5 px-2 pt-1.5 pb-1 overflow-hidden">
                    {optVotes.map(v => (
                      <div key={v.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                        {v.profiles?.avatar_url ? <img src={v.profiles.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" /> : <span>🍺</span>}
                        {v.profiles?.username || 'Usuario'}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MODAL CREAR ENCUESTA ─────────────────────────────────────────────────────
function CreatePollModal({ leagueId, userId, onClose, onCreated }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [closesAt, setClosesAt] = useState('')
  const [creating, setCreating] = useState(false)

  const addOption = () => { if (options.length < 4) setOptions([...options, '']) }
  const removeOption = (i) => { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)) }
  const updateOption = (i, val) => setOptions(options.map((o, idx) => idx === i ? val : o))

  const handleCreate = async () => {
    const validOptions = options.filter(o => o.trim())
    if (!question.trim() || validOptions.length < 2) return
    setCreating(true)
    const { data: poll, error } = await supabase.from('polls').insert({
      created_by: userId, question: question.trim(),
      league_id: leagueId, closes_at: closesAt ? new Date(closesAt).toISOString() : null,
    }).select().single()
    if (!error && poll) {
      await supabase.from('poll_options').insert(validOptions.map((text, i) => ({ poll_id: poll.id, text: text.trim(), position: i })))
      onCreated(poll.id)
      onClose()
    }
    setCreating(false)
  }

  const canCreate = question.trim() && options.filter(o => o.trim()).length >= 2

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        onClick={e => e.stopPropagation()}
        className="rounded-t-3xl w-full max-w-lg overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh', paddingBottom: '32px' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cancelar</motion.button>
          <h2 className="text-base font-bold">📊 Nueva encuesta</h2>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreate} disabled={!canCreate || creating}
            className="px-4 py-2 rounded-full text-sm font-bold"
            style={{ backgroundColor: canCreate ? '#6366f1' : 'var(--bg-input)', color: canCreate ? '#fff' : 'var(--text-hint)' }}>
            {creating ? '...' : 'Crear'}
          </motion.button>
        </div>
        <div className="px-5 pt-4 space-y-4">
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Pregunta</p>
            <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="¿Cuál es la mejor bebida?" autoFocus maxLength={120}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Opciones ({options.length}/4)</p>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={opt} onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Opción ${i + 1}`} maxLength={60}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                  {options.length > 2 && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeOption(i)}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>✕</motion.button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 4 && (
              <motion.button whileTap={{ scale: 0.96 }} onClick={addOption}
                className="mt-2 w-full py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)' }}>
                + Añadir opción
              </motion.button>
            )}
          </div>
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fecha de cierre (opcional)</p>
            <input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Ranking({ selectedLeague, setSelectedLeague }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [rankings, setRankings] = useState([])
  const [members, setMembers] = useState([])
  const [myRole, setMyRole] = useState('member')
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [tab, setTab] = useState('ranking')
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [kickTarget, setKickTarget] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [unreadByLeague, setUnreadByLeague] = useState({})
  const [transfers, setTransfers] = useState([])
  const [myBalance, setMyBalance] = useState(0)
  const [selectedReceiver, setSelectedReceiver] = useState(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [sendingTransfer, setSendingTransfer] = useState(false)
  const [transferResult, setTransferResult] = useState(null)
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [adminStats, setAdminStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [adminMsg, setAdminMsg] = useState(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newLeagueCreateName, setNewLeagueCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [polls, setPolls] = useState([])
  const [showCreatePoll, setShowCreatePoll] = useState(false)

  const bottomRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => { fetchLeagues() }, [])

  useEffect(() => {
    if (!selectedLeague) return
    fetchRanking(selectedLeague.id)
    fetchMembers(selectedLeague.id)
    fetchMessages(selectedLeague.id)
    fetchPolls(selectedLeague.id)
    setNewLeagueName(selectedLeague.name)

    const channel = supabase.channel(`chat:${selectedLeague.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `league_id=eq.${selectedLeague.id}` },
        async (payload) => {
          if (payload.new.user_id === user.id) return
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single()
          soundMessageReceived()
          if (tab !== 'chat') setUnreadByLeague(prev => ({ ...prev, [selectedLeague.id]: (prev[selectedLeague.id] || 0) + 1 }))
          // Si trae poll_id, refrescar encuestas
          if (payload.new.poll_id) fetchPolls(selectedLeague.id)
          setMessages(prev => [...prev, { ...payload.new, profiles: { username: profile?.username || 'Desconocido', avatar_url: profile?.avatar_url } }])
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls', filter: `league_id=eq.${selectedLeague.id}` },
        () => fetchPolls(selectedLeague.id))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedLeague, tab])

  useEffect(() => {
    if (tab === 'chat') { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); if (selectedLeague) markChatRead(selectedLeague.id) }
    if (tab === 'transfers' && selectedLeague) fetchTransfers(selectedLeague.id)
    if (tab === 'admin' && selectedLeague) fetchAdminStats(selectedLeague.id)
  }, [tab])

  useEffect(() => { if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchLeagues = async () => {
    const { data } = await supabase.from('league_members').select('league_id, role, leagues(id, name, created_by, invite_code)').eq('user_id', user.id)
    const userLeagues = data?.map(d => ({ ...d.leagues, myRole: d.role })) || []
    setLeagues(userLeagues)
    if (!selectedLeague && userLeagues.length > 0) { const first = userLeagues[0]; setSelectedLeague(first); setMyRole(first.myRole || 'member'); setNewLeagueName(first.name) }
    if (userLeagues.length > 0) fetchAllUnread(userLeagues.map(l => l.id))
  }

  const fetchAllUnread = async (leagueIds) => {
    const counts = {}
    await Promise.all(leagueIds.map(async (leagueId) => {
      const { data: readData } = await supabase.from('message_reads').select('last_read_at').eq('user_id', user.id).eq('league_id', leagueId).single()
      const lastRead = readData?.last_read_at || '1970-01-01'
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).neq('user_id', user.id).gt('created_at', lastRead)
      counts[leagueId] = count || 0
    }))
    setUnreadByLeague(counts)
  }

  const markChatRead = async (leagueId) => {
    await supabase.from('message_reads').upsert({ user_id: user.id, league_id: leagueId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,league_id' })
    setUnreadByLeague(prev => ({ ...prev, [leagueId]: 0 }))
  }

  const fetchRanking = async (leagueId) => {
    setLoading(true)
    const { data } = await supabase.from('league_rankings').select('*').eq('league_id', leagueId).order('total_points', { ascending: false })
    setRankings(data || []); setLoading(false)
  }

  const fetchMembers = async (leagueId) => {
    const { data } = await supabase.from('league_members').select('joined_at, role, profiles(id, username, avatar_url)').eq('league_id', leagueId).order('joined_at', { ascending: true })
    const mapped = data?.map(m => ({ ...m.profiles, joined_at: m.joined_at, role: m.role })) || []
    setMembers(mapped)
    const me = mapped.find(m => m.id === user.id)
    if (me) setMyRole(me.role || 'member')
  }

  const fetchMessages = async (leagueId) => {
    const { data } = await supabase.from('messages').select('*, profiles(username, avatar_url)').eq('league_id', leagueId).order('created_at', { ascending: true }).limit(300)
    setMessages(data || [])
  }

  const fetchPolls = async (leagueId) => {
    const { data } = await supabase.from('polls').select('*, profiles(username, avatar_url)').eq('league_id', leagueId).order('created_at', { ascending: false })
    setPolls(data || [])
  }

  const fetchTransfers = async (leagueId) => {
    setLoadingTransfers(true)
    const [{ data: transferData }, { data: walletData }] = await Promise.all([
      supabase.from('league_transfers').select('*, sender:profiles!league_transfers_sender_id_fkey(username, avatar_url), receiver:profiles!league_transfers_receiver_id_fkey(username, avatar_url)').eq('league_id', leagueId).order('created_at', { ascending: false }).limit(50),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
    ])
    setTransfers(transferData || []); setMyBalance(walletData?.balance || 0); setLoadingTransfers(false)
  }

  const fetchAdminStats = async (leagueId) => {
    setLoadingStats(true)
    const { data } = await supabase.rpc('get_league_stats', { p_league_id: leagueId })
    setAdminStats(data); setLoadingStats(false)
  }

  const handleResetSeason = async () => {
    if (!selectedLeague) return
    setResetting(true); setShowResetConfirm(false)
    const { data: season } = await supabase.from('seasons').select('id').eq('active', true).single()
    if (!season) { setAdminMsg({ success: false, text: 'No hay temporada activa' }); setResetting(false); return }
    const { error } = await supabase.from('drinks').delete().eq('league_id', selectedLeague.id).eq('season_id', season.id)
    if (error) { soundError(); setAdminMsg({ success: false, text: 'Error al resetear: ' + error.message }) }
    else { soundSuccess(); setAdminMsg({ success: true, text: '✅ Puntos reseteados correctamente' }); fetchRanking(selectedLeague.id); fetchAdminStats(selectedLeague.id) }
    setResetting(false); setTimeout(() => setAdminMsg(null), 4000)
  }

  const handleSelectLeague = (league) => {
    setSelectedLeague(league); setMyRole(league.myRole || 'member'); setNewLeagueName(league.name)
    setTab('ranking'); setEditingName(false); setSelectedReceiver(null)
    setTransferAmount(''); setTransferNote(''); setTransferResult(null); setAdminStats(null); setAdminMsg(null)
  }

  const saveLeagueName = async () => {
    if (!newLeagueName.trim() || newLeagueName === selectedLeague.name) { setEditingName(false); return }
    setSavingName(true)
    const { error } = await supabase.from('leagues').update({ name: newLeagueName.trim() }).eq('id', selectedLeague.id)
    if (!error) { const updated = { ...selectedLeague, name: newLeagueName.trim() }; setSelectedLeague(updated); setLeagues(prev => prev.map(l => l.id === selectedLeague.id ? { ...l, name: newLeagueName.trim() } : l)) }
    setSavingName(false); setEditingName(false)
  }

  const copyCode = () => {
    if (!selectedLeague?.invite_code) return
    navigator.clipboard.writeText(selectedLeague.invite_code)
    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleJoinLeague = async () => {
    if (!joinCode.trim()) return
    setJoining(true); setJoinError(''); setJoinSuccess('')
    const { data, error } = await supabase.rpc('join_league_by_code', { p_code: joinCode.trim().toUpperCase() })
    if (error || !data?.success) { setJoinError(data?.error || 'Código no válido') }
    else { setJoinSuccess(`¡Te has unido a ${data.league_name}! 🎉`); setJoinCode(''); fetchLeagues(); setTimeout(() => { setShowJoinModal(false); setJoinSuccess('') }, 2000) }
    setJoining(false)
  }

  const handleCreateLeague = async () => {
    if (!newLeagueCreateName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('leagues').insert({ name: newLeagueCreateName.trim(), created_by: user.id }).select().single()
    if (!error && data) { await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id, role: 'owner' }); setNewLeagueCreateName(''); setShowCreateModal(false); fetchLeagues() }
    setCreating(false)
  }

  const changeRole = async (memberId, newRole) => {
    await supabase.from('league_members').update({ role: newRole }).eq('league_id', selectedLeague.id).eq('user_id', memberId)
    setRoleTarget(null); fetchMembers(selectedLeague.id)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedLeague || sending) return
    setSending(true); soundMessage()
    const content = newMessage.trim()
    const tempMsg = { id: `temp-${Date.now()}`, league_id: selectedLeague.id, user_id: user.id, content, image_url: null, created_at: new Date().toISOString(), profiles: { username: 'Tú', avatar_url: null } }
    setMessages(prev => [...prev, tempMsg]); setNewMessage('')
    const { error } = await supabase.from('messages').insert({ league_id: selectedLeague.id, user_id: user.id, content })
    if (error) { console.error('Error al enviar mensaje:', error); setMessages(prev => prev.filter(m => m.id !== tempMsg.id)) }
    setSending(false)
  }

  // Inserta un mensaje con poll_id en el chat
  const sendPollMessage = async (pollId) => {
    const { data } = await supabase.from('messages')
      .insert({ league_id: selectedLeague.id, user_id: user.id, content: '', poll_id: pollId })
      .select('*, profiles(username, avatar_url)').single()
    if (data) {
      await fetchPolls(selectedLeague.id)
      setMessages(prev => [...prev, data])
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]; if (!file || !selectedLeague) return
    setUploadingImage(true)
    const ext = file.name.split('.').pop(), path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path)
      soundMessage()
      const { data } = await supabase.from('messages').insert({ league_id: selectedLeague.id, user_id: user.id, content: '', image_url: publicUrl }).select('*, profiles(username, avatar_url)').single()
      if (data) setMessages(prev => [...prev, data])
    }
    setUploadingImage(false); e.target.value = ''
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const leaveLeague = async () => {
    if (!selectedLeague) return
    await supabase.from('league_members').delete().eq('league_id', selectedLeague.id).eq('user_id', user.id)
    setSelectedLeague(null); setMyRole('member'); fetchLeagues(); setTab('ranking')
  }

  const kickMember = async () => {
    if (!kickTarget || !selectedLeague) return
    await supabase.from('league_members').delete().eq('league_id', selectedLeague.id).eq('user_id', kickTarget.id)
    setKickTarget(null); fetchMembers(selectedLeague.id); soundSuccess()
    setAdminMsg({ success: true, text: `✅ ${kickTarget.username} expulsado de la liga` })
    setTimeout(() => setAdminMsg(null), 3000)
  }

  const handleSendTransfer = async () => {
    if (!selectedReceiver || !transferAmount || parseInt(transferAmount) < 1) return
    setSendingTransfer(true); setTransferResult(null)
    const { data } = await supabase.rpc('send_coins_to_member', { p_league_id: selectedLeague.id, p_receiver_id: selectedReceiver.id, p_amount: parseInt(transferAmount), p_note: transferNote.trim() || null })
    if (data?.success) { soundSuccess(); setTransferResult({ success: true, amount: data.amount, receiver: data.receiver }); setMyBalance(prev => prev - data.amount); setTransferAmount(''); setTransferNote(''); setSelectedReceiver(null); fetchTransfers(selectedLeague.id) }
    else { soundError(); setTransferResult({ success: false, error: data?.error || 'Error al enviar' }) }
    setSendingTransfer(false); setTimeout(() => setTransferResult(null), 4000)
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  const formatDateShort = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const formatDateLong = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg); return groups
  }, {})

  const medals = ['🥇', '🥈', '🥉']
  const roleLabel = { owner: '👑 Creador', admin: '⚡ Admin', member: 'Miembro' }
  const roleBadgeStyle = {
    owner: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    admin: { backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    member: { backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' },
  }
  const canManage = myRole === 'owner' || myRole === 'admin'
  const otherMembers = members.filter(m => m.id !== user.id)
  const manageableMembers = members.filter(m => { if (m.id === user.id || m.role === 'owner') return false; if (myRole === 'admin' && m.role === 'admin') return false; return true })

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    return url ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-sm`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  const UnreadBadge = ({ count }) => {
    if (!count || count === 0) return null
    return <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-white font-black" style={{ backgroundColor: '#ef4444', fontSize: 9 }}>{count > 9 ? '9+' : count}</motion.span>
  }

  const currentUnread = selectedLeague ? (unreadByLeague[selectedLeague.id] || 0) : 0
  const visibleTabs = [
    { id: 'ranking', label: '🏆 Ranking' },
    { id: 'members', label: '👥 Miembros' },
    { id: 'transfers', label: '💸 Enviar' },
    { id: 'chat', label: '💬 Chat', unread: currentUnread },
    { id: 'polls', label: '📊 Encuestas' },
    ...(canManage ? [{ id: 'admin', label: '👑 Admin' }] : []),
  ]

  return (
    <div className={`flex flex-col transition-colors duration-300 ${tab === 'chat' ? 'h-screen' : 'min-h-screen'}`}
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex-shrink-0">
        <div className="flex gap-2 flex-wrap mb-4 items-center">
          {leagues.map(league => {
            const unread = unreadByLeague[league.id] || 0, isSelected = selectedLeague?.id === league.id
            return (
              <motion.button key={league.id} whileTap={{ scale: 0.95 }} onClick={() => handleSelectLeague(league)}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isSelected ? 'bg-amber-500 text-white' : ''}`}
                style={!isSelected ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' } : {}}>
                {league.name}
                {unread > 0 && !isSelected && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: '#ef4444', fontSize: 9 }}>{unread > 9 ? '9+' : unread}</span>}
              </motion.button>
            )
          })}
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowJoinModal(true)} className="px-3 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--bg-card)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>+ Unirse</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreateModal(true)} className="px-3 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>+ Crear</motion.button>
        </div>

        {selectedLeague && (
          <div className="mb-4">
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input type="text" value={newLeagueName} onChange={e => setNewLeagueName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveLeagueName(); if (e.key === 'Escape') setEditingName(false) }} className="flex-1 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                <motion.button whileTap={{ scale: 0.95 }} onClick={saveLeagueName} disabled={savingName} className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">{savingName ? '...' : 'Guardar'}</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setEditingName(false); setNewLeagueName(selectedLeague.name) }} className="px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{selectedLeague.name}</h1>
                {myRole === 'owner' && <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingName(true)} className="p-1.5 rounded-lg text-sm" style={{ color: 'var(--text-hint)', backgroundColor: 'var(--bg-input)' }}>✏️</motion.button>}
              </div>
            )}
          </div>
        )}

        {selectedLeague && (
          <div className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Código de invitación · compártelo con tus amigos</p>
              <p className="font-bold text-lg tracking-widest text-amber-400">{selectedLeague.invite_code || '···-····-····'}</p>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={copyCode} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-medium" style={{ backgroundColor: codeCopied ? 'rgba(16,185,129,0.15)' : 'var(--bg-input)', color: codeCopied ? '#10b981' : 'var(--text-muted)' }}>{codeCopied ? '✓ Copiado' : 'Copiar'}</motion.button>
          </div>
        )}

        {selectedLeague && (
          <div className="flex rounded-xl p-1 gap-0.5 overflow-x-auto" style={{ backgroundColor: 'var(--bg-input)' }}>
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="relative flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors z-10 flex items-center justify-center gap-1"
                style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
                {tab === t.id && <motion.div layoutId="tab-indicator" className="absolute inset-0 rounded-lg" style={{ zIndex: -1, backgroundColor: t.id === 'transfers' ? '#10b981' : t.id === 'admin' ? '#7c3aed' : t.id === 'polls' ? '#6366f1' : '#f59e0b' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                <span>{t.label}</span>
                {t.unread > 0 && <UnreadBadge count={t.unread} />}
              </button>
            ))}
          </div>
        )}

        {leagues.length === 0 && <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}><div className="text-5xl mb-3">🏆</div><p className="font-bold">Aún no estás en ninguna liga</p><p className="text-sm mt-1">Crea una nueva o únete con un código</p></div>}
      </div>

      {/* ── RANKING ── */}
      {tab === 'ranking' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="pt-2"><SeasonCountdown /></div>
          {loading ? <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
            : rankings.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <motion.div className="text-5xl mb-3" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>🍺</motion.div>
                <p>Aún no hay consumiciones</p><p className="text-sm mt-1">¡Sé el primero en anotar!</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {rankings.map((entry, index) => {
                  const isMe = entry.user_id === user.id
                  const drinkCounts = (entry.drinks_detail || []).reduce((acc, d) => { if (!acc[d.name]) acc[d.name] = { emoji: d.emoji, count: 0 }; acc[d.name].count += 1; return acc }, {})
                  return (
                    <motion.div key={entry.user_id} variants={staggerItem} initial="initial" animate="animate"
                      className={`rounded-2xl p-4 ${isMe ? 'bg-amber-500' : ''}`} style={!isMe ? { backgroundColor: 'var(--bg-card)' } : {}}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl w-8 text-center">{medals[index] || `${index + 1}`}</span>
                        <Avatar url={entry.avatar_url} username={entry.username} size="md" />
                        <div className="flex-1">
                          <p className="font-bold" style={{ color: isMe ? '#fff' : 'var(--text-primary)' }}>{entry.username} {isMe && '(tú)'}</p>
                          <p className="text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>{entry.total_drinks} consumiciones</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${isMe ? 'text-white' : 'text-amber-400'}`}>{entry.total_points}</p>
                          <p className="text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>puntos</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: isMe ? 'rgba(255,255,255,0.3)' : 'var(--border)' }}>
                        {Object.entries(drinkCounts).sort(([, a], [, b]) => b.count - a.count).map(([name, { emoji, count }]) => (
                          <div key={name} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isMe ? 'bg-amber-600 text-white' : ''}`} style={!isMe ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' } : {}}>
                            <span>{emoji}</span><span>{count}</span>
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
      {tab === 'members' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="space-y-3 pt-4">
            {members.map(member => {
              const isMe = member.id === user.id
              return (
                <motion.div key={member.id} variants={staggerItem} initial="initial" animate="animate" className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: isMe ? '2px solid #f59e0b' : '2px solid transparent' }}>
                  <div className="flex items-center gap-3">
                    <Avatar url={member.avatar_url} username={member.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{member.username} {isMe && '(tú)'}</p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={roleBadgeStyle[member.role]}>{roleLabel[member.role]}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
            {myRole !== 'owner' && <motion.button whileTap={{ scale: 0.97 }} onClick={leaveLeague} className="w-full mt-2 bg-transparent text-red-500 font-semibold py-3 rounded-2xl border border-red-900">Abandonar liga 🚪</motion.button>}
            {canManage && <motion.button whileTap={{ scale: 0.97 }} onClick={() => setTab('admin')} className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>👑 Gestionar miembros en Admin →</motion.button>}
          </div>
        </div>
      )}

      {/* ── TRANSFERENCIAS ── */}
      {tab === 'transfers' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <div className="rounded-2xl p-4 mb-5 flex items-center justify-between" style={{ backgroundColor: myBalance < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${myBalance < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}` }}>
            <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Tu saldo disponible</p><p className="text-2xl font-black" style={{ color: myBalance < 0 ? '#ef4444' : '#10b981' }}>{myBalance.toLocaleString()}🪙</p></div>
            <span className="text-3xl">{myBalance < 0 ? '🔴' : '🪙'}</span>
          </div>
          <AnimatePresence>
            {transferResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl p-4 mb-4 text-center" style={{ backgroundColor: transferResult.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${transferResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                {transferResult.success ? <p className="font-bold text-emerald-400">💸 ¡{transferResult.amount}🪙 enviadas a {transferResult.receiver}!</p> : <p className="font-bold text-red-400">⚠️ {transferResult.error}</p>}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-bold mb-3">Enviar monedas 💸</p>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>¿A quién?</p>
            {otherMembers.length === 0 ? <div className="rounded-xl p-3 text-center mb-3" style={{ backgroundColor: 'var(--bg-input)' }}><p className="text-sm" style={{ color: 'var(--text-hint)' }}>No hay otros miembros en la liga</p></div>
              : (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                  {otherMembers.map(member => (
                    <motion.button key={member.id} whileTap={{ scale: 0.93 }} onClick={() => setSelectedReceiver(selectedReceiver?.id === member.id ? null : member)}
                      className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl min-w-16"
                      style={{ backgroundColor: selectedReceiver?.id === member.id ? 'rgba(16,185,129,0.15)' : 'var(--bg-input)', border: selectedReceiver?.id === member.id ? '2px solid #10b981' : '2px solid transparent' }}>
                      <Avatar url={member.avatar_url} username={member.username} size="sm" />
                      <p className="text-xs font-medium truncate w-14 text-center" style={{ color: selectedReceiver?.id === member.id ? '#10b981' : 'var(--text-muted)' }}>{member.username}</p>
                      {selectedReceiver?.id === member.id && <span className="text-xs text-emerald-400">✓</span>}
                    </motion.button>
                  ))}
                </div>
              )}
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Cantidad</p>
            <div className="relative mb-3">
              <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0" min="1" max={myBalance} className="w-full rounded-xl px-4 py-3 text-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500 pr-10" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🪙</span>
            </div>
            <div className="flex gap-2 mb-3">
              {[50, 100, 250, 500].filter(v => v <= myBalance).map(v => <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setTransferAmount(String(v))} className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ backgroundColor: parseInt(transferAmount) === v ? '#10b981' : 'var(--bg-input)', color: parseInt(transferAmount) === v ? '#fff' : 'var(--text-muted)' }}>{v}</motion.button>)}
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTransferAmount(String(Math.max(0, myBalance)))} className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Max</motion.button>
            </div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Nota (opcional)</p>
            <input type="text" value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="¿Por qué le envías? 🍺" maxLength={60} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 mb-4" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
            {selectedReceiver && transferAmount && parseInt(transferAmount) > 0 && (
              <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-base)' }}>
                <div className="flex items-center gap-2"><Avatar url={selectedReceiver.avatar_url} username={selectedReceiver.username} size="sm" /><span className="text-sm font-medium">{selectedReceiver.username}</span></div>
                <span className="font-black text-emerald-400 text-lg">+{transferAmount}🪙</span>
              </div>
            )}
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSendTransfer} disabled={sendingTransfer || !selectedReceiver || !transferAmount || parseInt(transferAmount) < 1 || parseInt(transferAmount) > myBalance} className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-40" style={{ backgroundColor: '#10b981' }}>
              {sendingTransfer ? 'Enviando...' : !selectedReceiver ? '← Elige un destinatario' : !transferAmount || parseInt(transferAmount) < 1 ? '← Escribe una cantidad' : parseInt(transferAmount) > myBalance ? 'Saldo insuficiente' : `💸 Enviar ${transferAmount}🪙 a ${selectedReceiver.username}`}
            </motion.button>
          </div>
          <p className="text-sm font-bold mb-3">Historial de la liga</p>
          {loadingTransfers ? <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-3xl mb-2">💸</motion.div></div>
            : transfers.length === 0 ? <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}><div className="text-4xl mb-2">💸</div><p className="text-sm">Aún no hay transferencias en esta liga</p></div>
            : (
              <div className="space-y-2">
                {transfers.map(tx => {
                  const isMe = tx.sender_id === user.id, isMeReceiver = tx.receiver_id === user.id
                  return (
                    <motion.div key={tx.id} variants={staggerItem} initial="initial" animate="animate" className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', border: isMe || isMeReceiver ? `1px solid ${isMeReceiver ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.2)'}` : '1px solid transparent' }}>
                      <div className="relative flex-shrink-0"><Avatar url={tx.sender?.avatar_url} username={tx.sender?.username} size="sm" /><div className="absolute -bottom-1 -right-1 text-sm">💸</div></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate"><span style={{ color: isMe ? '#f59e0b' : 'var(--text-primary)' }}>{isMe ? 'Tú' : tx.sender?.username}</span><span style={{ color: 'var(--text-hint)' }}> → </span><span style={{ color: isMeReceiver ? '#10b981' : 'var(--text-primary)' }}>{isMeReceiver ? 'Tú' : tx.receiver?.username}</span></p>
                        {tx.note && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-hint)' }}>"{tx.note}"</p>}
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{formatDateShort(tx.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0"><p className={`font-black text-base ${isMeReceiver ? 'text-emerald-400' : isMe ? 'text-amber-400' : ''}`}>{isMeReceiver ? '+' : isMe ? '-' : ''}{tx.amount}🪙</p></div>
                    </motion.div>
                  )
                })}
              </div>
            )}
        </div>
      )}

      {/* ── ENCUESTAS (pestaña independiente) ── */}
      {tab === 'polls' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCreatePoll(true)}
            className="w-full py-3 rounded-2xl font-bold text-white mb-5 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#6366f1' }}>
            📊 Crear nueva encuesta
          </motion.button>
          {polls.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">📊</div>
              <p className="font-bold">Sin encuestas todavía</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>Crea la primera para la liga</p>
            </div>
          ) : (
            <div className="space-y-4">
              {polls.map(poll => <PollCard key={poll.id} poll={poll} userId={user.id} />)}
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN ── */}
      {tab === 'admin' && selectedLeague && canManage && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <div className="rounded-2xl p-4 mb-5 flex items-center gap-3" style={{ backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <span className="text-3xl">👑</span>
            <div><p className="font-bold text-purple-400">Panel de administración</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{myRole === 'owner' ? 'Acceso completo como creador' : 'Acceso de administrador'}</p></div>
          </div>
          <AnimatePresence>
            {adminMsg && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl p-4 mb-4 text-center" style={{ backgroundColor: adminMsg.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${adminMsg.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}><p className={`font-bold text-sm ${adminMsg.success ? 'text-emerald-400' : 'text-red-400'}`}>{adminMsg.text}</p></motion.div>}
          </AnimatePresence>
          <p className="text-sm font-bold mb-3">📊 Estadísticas del grupo</p>
          {loadingStats ? <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-3xl mb-2">📊</motion.div><p className="text-sm">Cargando...</p></div>
            : adminStats ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[{ label: 'Total consumiciones', value: adminStats.total_drinks, emoji: '🍺' }, { label: 'Miembros', value: adminStats.member_count, emoji: '👥' }, { label: 'Monedas en circulación', value: `${Number(adminStats.total_coins).toLocaleString()}🪙`, emoji: '💰' }, { label: 'Temporada desde', value: adminStats.season_start ? formatDateLong(adminStats.season_start) : '—', emoji: '📅' }].map(stat => (
                    <div key={stat.label} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}><p className="text-2xl mb-1">{stat.emoji}</p><p className="font-bold text-amber-400 text-lg leading-tight">{stat.value}</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{stat.label}</p></div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}><p className="text-2xl mb-1">🏆</p><p className="font-bold text-amber-400 text-sm leading-tight">{adminStats.most_active_member || '—'}</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Miembro más activo</p></div>
                  <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}><p className="text-2xl mb-1">⭐</p><p className="font-bold text-amber-400 text-sm leading-tight">{adminStats.most_popular_drink || '—'}</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Bebida más popular</p></div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => fetchAdminStats(selectedLeague.id)} className="w-full py-2.5 rounded-xl text-sm font-medium mb-5" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>🔄 Actualizar estadísticas</motion.button>
              </>
            ) : null}
          <p className="text-sm font-bold mb-3">👥 Gestión de miembros</p>
          {manageableMembers.length === 0 ? <div className="rounded-2xl p-4 mb-5 text-center" style={{ backgroundColor: 'var(--bg-card)' }}><p className="text-sm" style={{ color: 'var(--text-hint)' }}>No hay miembros que puedas gestionar</p></div>
            : (
              <div className="space-y-2 mb-5">
                {manageableMembers.map(member => (
                  <motion.div key={member.id} variants={staggerItem} initial="initial" animate="animate" className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <Avatar url={member.avatar_url} username={member.username} size="md" />
                    <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{member.username}</p><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={roleBadgeStyle[member.role]}>{roleLabel[member.role]}</span></div>
                    <div className="flex gap-2 flex-shrink-0">
                      {myRole === 'owner' && <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRoleTarget(member)} className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Rol</motion.button>}
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setKickTarget(member)} className="text-xs font-semibold px-3 py-2 rounded-xl bg-red-950 text-red-400">Expulsar</motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          <p className="text-sm font-bold mb-3">⚠️ Gestión de temporada</p>
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-start gap-3 mb-4"><span className="text-2xl flex-shrink-0">🗑️</span><div><p className="font-bold text-sm text-red-400">Resetear puntos de la temporada</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Elimina todas las consumiciones de la temporada actual en esta liga. Los puntos y monedas ganados no se devuelven. Esta acción no se puede deshacer.</p></div></div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowResetConfirm(true)} disabled={resetting} className="w-full py-3 rounded-xl font-bold text-red-400 text-sm border border-red-900 disabled:opacity-40" style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>{resetting ? 'Reseteando...' : '🗑️ Resetear puntos'}</motion.button>
          </div>
        </div>
      )}

      {/* ── CHAT ── */}
      {tab === 'chat' && selectedLeague && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {messages.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-5xl mb-3">💬</div><p>Aún no hay mensajes</p><p className="text-sm mt-1">¡Sé el primero en escribir!</p>
              </motion.div>
            ) : (
              Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatDate(msgs[0].created_at)}</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                  </div>
                  {msgs.map((msg, index) => {
                    const isMe = msg.user_id === user.id
                    const isSameUser = msgs[index - 1]?.user_id === msg.user_id

                    // ── Mensaje con encuesta integrada en el flujo del chat ──
                    if (msg.poll_id) {
                      const poll = polls.find(p => p.id === msg.poll_id)
                      if (!poll) return null
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex gap-2 mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="flex-shrink-0 self-end">
                              {!isSameUser ? <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} size="sm" /> : <div className="w-8" />}
                            </div>
                          )}
                          <div className={`flex flex-col w-64 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && !isSameUser && (
                              <span className="text-xs text-amber-400 font-medium mb-1 ml-1">{msg.profiles?.username}</span>
                            )}
                            <PollCard poll={poll} userId={user.id} />
                            <span className="text-xs mt-0.5 mx-1" style={{ color: 'var(--text-hint)' }}>{formatTime(msg.created_at)}</span>
                          </div>
                        </motion.div>
                      )
                    }

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                        className={`flex gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && <div className="flex-shrink-0 self-end">{!isSameUser ? <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} size="sm" /> : <div className="w-8" />}</div>}
                        <div className={`max-w-xs flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && !isSameUser && <span className="text-xs text-amber-400 font-medium mb-1 ml-1">{msg.profiles?.username}</span>}
                          {msg.image_url && <img src={msg.image_url} alt="Imagen" onClick={() => setLightboxUrl(msg.image_url)} className={`max-w-52 rounded-2xl cursor-pointer object-cover ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`} />}
                          {msg.content && <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`} style={{ backgroundColor: isMe ? '#f59e0b' : 'var(--bg-card)', color: isMe ? '#fff' : 'var(--text-primary)' }}>{msg.content}</div>}
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
          <div className="px-4 py-3 pb-24 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-2 items-end">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="p-3 rounded-2xl flex-shrink-0" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>{uploadingImage ? '⏳' : '📷'}</motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCreatePoll(true)} className="p-3 rounded-2xl flex-shrink-0" style={{ backgroundColor: 'var(--bg-card)', color: '#6366f1' }}>📊</motion.button>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe un mensaje..." rows={1} className="flex-1 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '120px' }} />
              <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage} disabled={!newMessage.trim() || sending} className="bg-amber-500 disabled:opacity-40 text-white p-3 rounded-2xl flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
              </motion.button>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setLightboxUrl(null)}><motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} src={lightboxUrl} alt="Imagen ampliada" className="max-w-full max-h-full rounded-2xl object-contain" /></motion.div>}
      </AnimatePresence>

      {/* Modal crear encuesta — al crearse envía mensaje al chat */}
      <AnimatePresence>
        {showCreatePoll && (
          <CreatePollModal
            leagueId={selectedLeague?.id}
            userId={user.id}
            onClose={() => setShowCreatePoll(false)}
            onCreated={(pollId) => {
              fetchPolls(selectedLeague?.id)
              if (tab === 'chat') sendPollMessage(pollId)
            }}
          />
        )}
      </AnimatePresence>

      {/* Modales */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowResetConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5"><div className="text-4xl mb-2">🗑️</div><h2 className="text-xl font-bold">¿Resetear puntos?</h2><p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se eliminarán todas las consumiciones de la temporada actual en <strong>{selectedLeague?.name}</strong>. Esta acción no se puede deshacer.</p></div>
              <div className="flex gap-3"><motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowResetConfirm(false)} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button><motion.button whileTap={{ scale: 0.96 }} onClick={handleResetSeason} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">Resetear</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {kickTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setKickTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-4"><div className="text-4xl mb-2">🚫</div><h2 className="text-xl font-bold">¿Expulsar a {kickTarget?.username}?</h2><p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se eliminará de la liga y perderá su historial en esta temporada.</p></div>
              <div className="flex gap-3"><motion.button whileTap={{ scale: 0.96 }} onClick={() => setKickTarget(null)} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button><motion.button whileTap={{ scale: 0.96 }} onClick={kickMember} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">Expulsar</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {roleTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setRoleTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5"><div className="text-4xl mb-2">⚡</div><h2 className="text-xl font-bold">Rol de {roleTarget?.username}</h2><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Elige qué permisos tendrá en la liga</p></div>
              <div className="space-y-3">
                {[{ role: 'admin', emoji: '⚡', label: 'Admin', desc: 'Puede expulsar miembros y cambiar el nombre', color: '#818cf8', bg: 'rgba(99,102,241,0.15)' }, { role: 'member', emoji: '🍺', label: 'Miembro', desc: 'Solo puede participar y chatear', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }].map(opt => (
                  <motion.button key={opt.role} whileTap={{ scale: 0.97 }} onClick={() => changeRole(roleTarget.id, opt.role)} className="w-full rounded-2xl p-4 text-left" style={{ backgroundColor: roleTarget.role === opt.role ? opt.bg : 'var(--bg-input)', border: roleTarget.role === opt.role ? `2px solid ${opt.color}` : '2px solid transparent' }}>
                    <div className="flex items-center gap-3"><span className="text-2xl">{opt.emoji}</span><div className="flex-1"><p className="font-bold text-sm" style={{ color: roleTarget.role === opt.role ? opt.color : 'var(--text-primary)' }}>{opt.label}</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{opt.desc}</p></div>{roleTarget.role === opt.role && <span style={{ color: opt.color }}>✓</span>}</div>
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setRoleTarget(null)} className="w-full mt-4 font-semibold py-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Cancelar</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showJoinModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); setJoinSuccess('') }}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5"><div className="text-4xl mb-2">🔑</div><h2 className="text-xl font-bold">Unirse a una liga</h2><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Introduce el código de invitación</p></div>
              <input type="text" value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }} placeholder="BEER-XXXX-XXXX" className="w-full rounded-xl px-4 py-3 text-center font-bold tracking-widest text-lg outline-none focus:ring-2 focus:ring-amber-500 mb-3" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} maxLength={14} />
              <AnimatePresence>
                {joinError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm text-center mb-3">⚠️ {joinError}</motion.p>}
                {joinSuccess && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-emerald-400 text-sm text-center mb-3 font-bold">{joinSuccess}</motion.p>}
              </AnimatePresence>
              <div className="flex gap-3"><motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); setJoinSuccess('') }} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button><motion.button whileTap={{ scale: 0.96 }} onClick={handleJoinLeague} disabled={!joinCode.trim() || joining} className="flex-1 bg-amber-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl">{joining ? 'Uniéndose...' : 'Unirse'}</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => { setShowCreateModal(false); setNewLeagueCreateName('') }}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5"><div className="text-4xl mb-2">🏆</div><h2 className="text-xl font-bold">Nueva liga</h2><p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Se generará un código de invitación automáticamente</p></div>
              <input type="text" value={newLeagueCreateName} onChange={e => setNewLeagueCreateName(e.target.value)} placeholder="Nombre de la liga..." onKeyDown={e => e.key === 'Enter' && handleCreateLeague()} className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 mb-4" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              <div className="flex gap-3"><motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowCreateModal(false); setNewLeagueCreateName('') }} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button><motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateLeague} disabled={!newLeagueCreateName.trim() || creating} className="flex-1 bg-amber-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl">{creating ? 'Creando...' : 'Crear'}</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}