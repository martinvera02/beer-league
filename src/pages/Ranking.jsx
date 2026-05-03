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
      league_id: leagueId,
      closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
          <div className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <span className="text-sm">⏱</span>
            <p className="text-xs" style={{ color: '#818cf8' }}>La encuesta cierra automáticamente a las 24 horas</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}


// ─── MODAL JUZGADO ────────────────────────────────────────────────────────────
function JuzgadoModal({ dispute, drink, currentUserId, leagueId, members, onClose, onResolved }) {
  const [votes, setVotes] = useState([])
  const [myVote, setMyVote] = useState(null)
  const [voting, setVoting] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [resolutionResult, setResolutionResult] = useState(null)

  useEffect(() => {
    fetchVotes()
    // Realtime: escuchar nuevos votos
    const channel = supabase.channel(`dispute:${dispute.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dispute_votes',
        filter: `dispute_id=eq.${dispute.id}`
      }, () => fetchVotes())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [dispute.id])

  const fetchVotes = async () => {
    const { data } = await supabase
      .from('dispute_votes')
      .select('*, profiles(username, avatar_url)')
      .eq('dispute_id', dispute.id)
    setVotes(data || [])
    const mine = (data || []).find(v => v.user_id === currentUserId)
    setMyVote(mine?.vote || null)

    // Intentar resolver si hay votos suficientes
    const total = (data || []).length
    if (total >= 2) {
      const { data: result } = await supabase.rpc('resolve_dispute_by_votes', { p_dispute_id: dispute.id })
      if (result?.resolved) {
        setResolved(true)
        setResolutionResult(result)
        soundSuccess()
        setTimeout(() => { onResolved(); onClose() }, 3000)
      }
    }
  }

  const handleVote = async (vote) => {
    if (voting || myVote || currentUserId === drink?.user_id) return
    setVoting(true)
    const { error } = await supabase.from('dispute_votes').insert({
      dispute_id: dispute.id,
      user_id: currentUserId,
      vote,
    })
    if (!error) { soundSuccess(); await fetchVotes() }
    else soundError()
    setVoting(false)
  }

  const totalVotes = votes.length
  const fakeVotes = votes.filter(v => v.vote === 'fake').length
  const realVotes = votes.filter(v => v.vote === 'real').length
  const fakePct = totalVotes > 0 ? Math.round((fakeVotes / totalVotes) * 100) : 0
  const realPct = totalVotes > 0 ? Math.round((realVotes / totalVotes) * 100) : 0
  const isAccused = currentUserId === drink?.user_id
  const alreadyVoted = !!myVote
  const formatTimeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date()
    if (diff <= 0) return 'Expirado'
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        onClick={e => e.stopPropagation()}
        className="rounded-t-3xl w-full max-w-lg overflow-hidden"
        style={{ backgroundColor: '#0d0d1a', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header juzgado */}
        <div className="relative overflow-hidden flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a0a0a, #2d0a0a, #1a0a0a)', borderBottom: '1px solid rgba(220,38,38,0.3)' }}>
          {/* Partículas */}
          {[
            { top: '20%', left: '5%', size: 2, delay: 0 },
            { top: '60%', left: '90%', size: 3, delay: 0.5 },
            { top: '80%', left: '15%', size: 2, delay: 1 },
            { top: '30%', left: '80%', size: 2, delay: 0.3 },
          ].map((p, i) => (
            <motion.div key={i} className="absolute rounded-full bg-red-500"
              style={{ top: p.top, left: p.left, width: p.size, height: p.size }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, delay: p.delay }} />
          ))}
          <div className="px-5 pt-5 pb-4 relative">
            <div className="flex items-center justify-between mb-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-xl font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                ✕ Cerrar
              </motion.button>
              <div className="flex items-center gap-2">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-400">EN VIVO · {totalVotes} voto{totalVotes !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="text-center">
              <motion.div className="text-5xl mb-2"
                animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 2, repeat: Infinity }}>
                ⚖️
              </motion.div>
              <h2 className="text-xl font-black text-white mb-0.5">EL JUZGADO</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {dispute.status === 'pending' ? `Expira en ${formatTimeLeft(dispute.expires_at)}` : 'Caso cerrado'}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4" style={{ paddingBottom: 32 }}>

          {/* El acusado */}
          <div className="rounded-2xl p-4 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-xs font-bold text-red-400 mb-2 tracking-widest">⚠️ ACUSADO</p>
            <div className="flex items-center justify-center gap-3">
              {drink?.profiles?.avatar_url
                ? <img src={drink.profiles.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-red-500" alt="" />
                : <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 border-red-500" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}>🍺</div>
              }
              <div className="text-left">
                <p className="font-black text-white">{drink?.profiles?.username}</p>
                <p className="text-xs text-red-400">{drink?.drink_types?.emoji} {drink?.drink_types?.name} · {drink?.points} pts</p>
              </div>
            </div>
            {drink?.proof_image_url && (
              <a href={drink.proof_image_url} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                📷 Ver prueba aportada
              </a>
            )}
          </div>

          {/* Resultado si resuelto */}
          <AnimatePresence>
            {resolved && resolutionResult && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl p-4 text-center"
                style={{
                  background: resolutionResult.result === 'forfeited'
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))'
                    : 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                  border: `2px solid ${resolutionResult.result === 'forfeited' ? '#ef4444' : '#10b981'}`,
                }}>
                <motion.div className="text-5xl mb-2"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.6 }}>
                  {resolutionResult.result === 'forfeited' ? '🔨' : '✅'}
                </motion.div>
                <p className="font-black text-lg" style={{ color: resolutionResult.result === 'forfeited' ? '#ef4444' : '#10b981' }}>
                  {resolutionResult.result === 'forfeited' ? '¡CULPABLE! Consumición anulada' : '¡INOCENTE! Consumición válida'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {resolutionResult.fake_pct}% votó en contra · {resolutionResult.total_votes} votos totales
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Marcador de votos en tiempo real */}
          {!resolved && (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>MARCADOR</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Se resuelve con ≥65% de mayoría</p>
              </div>

              {/* Barra de votos */}
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-black text-emerald-400 w-8">{realPct}%</span>
                  <div className="flex-1 h-6 rounded-full overflow-hidden flex" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full flex items-center justify-end pr-2"
                      style={{ backgroundColor: '#10b981', minWidth: realVotes > 0 ? 8 : 0 }}
                      animate={{ width: `${realPct}%` }} transition={{ duration: 0.6, type: 'spring' }}>
                      {realPct >= 20 && <span className="text-xs font-black text-white">{realVotes}</span>}
                    </motion.div>
                    <motion.div className="h-full flex items-center justify-start pl-2"
                      style={{ backgroundColor: '#ef4444', minWidth: fakeVotes > 0 ? 8 : 0 }}
                      animate={{ width: `${fakePct}%` }} transition={{ duration: 0.6, type: 'spring' }}>
                      {fakePct >= 20 && <span className="text-xs font-black text-white">{fakeVotes}</span>}
                    </motion.div>
                  </div>
                  <span className="text-xs font-black text-red-400 w-8 text-right">{fakePct}%</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span>✅ Real ({realVotes})</span>
                  <span>❌ Falso ({fakeVotes})</span>
                </div>

                {/* Umbral */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: fakePct >= 65 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)', color: fakePct >= 65 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                    {fakePct >= 65 ? '🔨 Umbral alcanzado' : `Falta ${65 - fakePct}% para anular`}
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                </div>
              </div>

              {/* Votos individuales */}
              {votes.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {votes.map(v => (
                      <motion.div key={v.id} initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                        style={{
                          backgroundColor: v.vote === 'fake' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                          border: `1px solid ${v.vote === 'fake' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                        }}>
                        {v.profiles?.avatar_url
                          ? <img src={v.profiles.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />
                          : <span>🍺</span>}
                        <span style={{ color: v.vote === 'fake' ? '#ef4444' : '#10b981' }}>
                          {v.profiles?.username?.split(' ')[0]} {v.vote === 'fake' ? '❌' : '✅'}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de voto */}
          {!resolved && !isAccused && dispute.status === 'pending' && (
            <div>
              {alreadyVoted ? (
                <div className="rounded-2xl p-4 text-center"
                  style={{ backgroundColor: myVote === 'real' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${myVote === 'real' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  <p className="text-sm font-bold" style={{ color: myVote === 'real' ? '#10b981' : '#ef4444' }}>
                    {myVote === 'real' ? '✅ Has votado: Real' : '❌ Has votado: Falso'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Esperando más votos...</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-center mb-3 font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    ¿ES REAL ESTA CONSUMICIÓN?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleVote('real')} disabled={voting}
                      className="py-4 rounded-2xl font-black text-base relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff' }}>
                      <motion.div className="absolute inset-0"
                        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }}
                        animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
                      <span className="relative">✅ REAL</span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleVote('fake')} disabled={voting}
                      className="py-4 rounded-2xl font-black text-base relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #b91c1c, #ef4444)', color: '#fff' }}>
                      <motion.div className="absolute inset-0"
                        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }}
                        animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }} />
                      <span className="relative">❌ FALSO</span>
                    </motion.button>
                  </div>
                  <p className="text-xs text-center mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Si ≥65% vota FALSO, la consumición se anula
                  </p>
                </div>
              )}
            </div>
          )}

          {isAccused && dispute.status === 'pending' && !resolved && (
            <div className="rounded-2xl p-4 text-center"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <motion.div className="text-3xl mb-2" animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                😰
              </motion.div>
              <p className="font-bold text-amber-400">Estás siendo juzgado</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Los miembros de la liga están votando sobre tu consumición
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── PESTAÑA JUICIO ───────────────────────────────────────────────────────────
function JuicioTab({ leagueId, currentUserId, members }) {
  const [recentDrinks, setRecentDrinks] = useState([])
  const [disputes, setDisputes] = useState([])
  const [myDisputes, setMyDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [disputing, setDisputing] = useState(null)
  const [uploadingProof, setUploadingProof] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [activeDispute, setActiveDispute] = useState(null)
  const [activeDrink, setActiveDrink] = useState(null)
  const proofInputRef = useRef(null)
  const [activeProofDrinkId, setActiveProofDrinkId] = useState(null)

  useEffect(() => { fetchAll() }, [leagueId])

  const fetchAll = async () => {
    setLoading(true)
    await supabase.rpc('resolve_expired_disputes')
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: drinksData }, { data: disputesData }] = await Promise.all([
      supabase.from('drinks').select('*, profiles(username, avatar_url), drink_types(name, emoji)')
        .eq('league_id', leagueId).gte('consumed_at', since).eq('is_adjustment', false)
        .order('consumed_at', { ascending: false }).limit(50),
      supabase.from('drink_disputes')
        .select('*, disputed_by_profile:profiles!drink_disputes_disputed_by_fkey(username, avatar_url)')
        .eq('league_id', leagueId).order('created_at', { ascending: false }),
    ])
    setRecentDrinks(drinksData || [])
    setDisputes(disputesData || [])
    setMyDisputes((disputesData || []).filter(d => {
      const drink = (drinksData || []).find(dr => dr.id === d.drink_id)
      return drink?.user_id === currentUserId && d.status === 'pending'
    }))
    setLoading(false)
  }

  const handleDispute = async (drink) => {
    if (disputing) return
    setDisputing(drink.id)
    const { error } = await supabase.from('drink_disputes').insert({ drink_id: drink.id, league_id: leagueId, disputed_by: currentUserId })
    if (!error) { await supabase.from('drinks').update({ dispute_status: 'disputed' }).eq('id', drink.id); soundSuccess() }
    else soundError()
    setDisputing(null); fetchAll()
  }

  const handleUploadProof = async (e, drinkId) => {
    const file = e.target.files[0]; if (!file) return
    setUploadingProof(drinkId); setAiResult(null)
    const ext = file.name.split('.').pop()
    const path = `disputes/${currentUserId}/${drinkId}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false })
    if (uploadError) { soundError(); setUploadingProof(null); e.target.value = ''; return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path)
    await supabase.from('drinks').update({ proof_image_url: publicUrl }).eq('id', drinkId)
    let aiValid = false, aiReason = 'No se pudo analizar la imagen'
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-drink-proof`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: publicUrl }) }
      )
      const parsed = await response.json()
      aiValid = parsed.valid === true; aiReason = parsed.reason || aiReason
    } catch { aiReason = 'Error al analizar — intenta de nuevo' }
    if (aiValid) {
      await supabase.from('drinks').update({ dispute_status: 'proven' }).eq('id', drinkId)
      await supabase.from('drink_disputes').update({ status: 'proven', resolved_at: new Date().toISOString() }).eq('drink_id', drinkId).eq('status', 'pending')
      soundSuccess()
    } else soundError()
    setAiResult({ drinkId, valid: aiValid, reason: aiReason })
    setUploadingProof(null); e.target.value = ''; fetchAll()
  }

  const openJuzgado = (dispute, drink) => {
    setActiveDispute(dispute)
    setActiveDrink(drink)
  }

  const getDisputeForDrink = (drinkId) => disputes.find(d => d.drink_id === drinkId)
  const hasDisputed = (drinkId) => disputes.some(d => d.drink_id === drinkId && d.disputed_by === currentUserId)

  const formatTimeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date()
    if (diff <= 0) return 'Expirado'
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const formatAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60)
    if (h > 0) return `hace ${h}h`; if (m > 0) return `hace ${m}m`; return 'ahora'
  }

  if (loading) return (
    <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-3xl mb-2">⚖️</motion.div>
      <p className="text-sm">Cargando...</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Modal juzgado */}
      <AnimatePresence>
        {activeDispute && activeDrink && (
          <JuzgadoModal
            dispute={activeDispute}
            drink={activeDrink}
            currentUserId={currentUserId}
            leagueId={leagueId}
            members={members}
            onClose={() => { setActiveDispute(null); setActiveDrink(null) }}
            onResolved={() => { fetchAll(); setActiveDispute(null); setActiveDrink(null) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-4"
            style={{ backgroundColor: aiResult.valid ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${aiResult.valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className={`font-bold text-sm ${aiResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>{aiResult.valid ? '✅ Foto verificada por IA' : '❌ Foto rechazada por IA'}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{aiResult.reason}</p>
                {!aiResult.valid && <p className="text-xs mt-1.5 font-medium" style={{ color: '#f59e0b' }}>Los miembros pueden votar en El Juzgado</p>}
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setAiResult(null)} className="text-xs px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>✕</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mis consumiciones impugnadas */}
      {myDisputes.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.3)' }}>
          <div className="px-4 pt-4 pb-2">
            <p className="font-bold text-red-400 flex items-center gap-2">⚠️ Tienes consumiciones impugnadas</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Sube una foto o espera el veredicto del juzgado. Tienes 3 horas.</p>
          </div>
          {myDisputes.map(dispute => {
            const drink = recentDrinks.find(d => d.id === dispute.drink_id)
            return (
              <div key={dispute.id} className="px-4 pb-4 pt-2">
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <span className="text-2xl">{drink?.drink_types?.emoji || '🍺'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{drink?.drink_types?.name || 'Consumición'}</p>
                    <p className="text-xs" style={{ color: '#ef4444' }}>⏱ {formatTimeLeft(dispute.expires_at)} para responder</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Impugnada por {dispute.disputed_by_profile?.username}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => { setActiveProofDrinkId(drink?.id); proofInputRef.current?.click() }}
                      disabled={uploadingProof === drink?.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: '#ef4444' }}>
                      {uploadingProof === drink?.id ? '🤖 Analizando...' : '📷 Foto'}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => openJuzgado(dispute, drink)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold"
                      style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#ef4444', border: '1px solid rgba(220,38,38,0.3)' }}>
                      ⚖️ Juicio
                    </motion.button>
                  </div>
                </div>
              </div>
            )
          })}
          <input ref={proofInputRef} type="file" accept="image/*" onChange={e => activeProofDrinkId && handleUploadProof(e, activeProofDrinkId)} className="hidden" />
        </div>
      )}

      <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Últimas 24h · {recentDrinks.length} consumiciones</p>
      {recentDrinks.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}><div className="text-4xl mb-2">🍺</div><p className="text-sm">Sin consumiciones recientes</p></div>
      ) : (
        <div className="space-y-2">
          {recentDrinks.map(drink => {
            const isMe = drink.user_id === currentUserId
            const dispute = getDisputeForDrink(drink.id)
            const alreadyDisputed = hasDisputed(drink.id)
            const isForfeited = drink.dispute_status === 'forfeited'
            const isProven = drink.dispute_status === 'proven'
            const isDisputed = drink.dispute_status === 'disputed'
            return (
              <motion.div key={drink.id} variants={staggerItem} initial="initial" animate="animate"
                className="rounded-2xl p-3"
                style={{ backgroundColor: 'var(--bg-card)', border: isForfeited ? '1px solid rgba(239,68,68,0.4)' : isProven ? '1px solid rgba(16,185,129,0.3)' : isDisputed ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent', opacity: isForfeited ? 0.7 : 1 }}>
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    {drink.profiles?.avatar_url ? <img src={drink.profiles.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" /> : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>}
                    <span className="absolute -bottom-1 -right-1 text-sm">{drink.drink_types?.emoji || '🍺'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-sm truncate">{isMe ? 'Tú' : drink.profiles?.username}</p>
                      {isForfeited && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>❌ Anulada</span>}
                      {isProven && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✅ Verificada</span>}
                      {isDisputed && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⚠️ En juicio</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{drink.drink_types?.name} · {isForfeited ? <span style={{ color: '#ef4444' }}>0 pts</span> : `${drink.points} pts`} · {formatAgo(drink.consumed_at)}</p>
                    {dispute && <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Impugnada por {dispute.disputed_by_profile?.username}{dispute.status === 'pending' && ` · expira en ${formatTimeLeft(dispute.expires_at)}`}</p>}
                    {drink.proof_image_url && <a href={drink.proof_image_url} target="_blank" rel="noreferrer" className="text-xs font-medium mt-1 inline-flex items-center gap-1" style={{ color: '#10b981' }}>📷 Ver prueba</a>}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {/* Botón impugnar */}
                    {!isMe && !alreadyDisputed && !isDisputed && !isForfeited && !isProven && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDispute(drink)} disabled={disputing === drink.id}
                        className="px-3 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {disputing === drink.id ? '...' : '⚖️ Impugnar'}
                      </motion.button>
                    )}
                    {/* Botón entrar al juicio si está en disputa */}
                    {isDisputed && dispute && (
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => openJuzgado(dispute, drink)}
                        className="px-3 py-2 rounded-xl text-xs font-bold"
                        style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                        🔴 Ver juicio
                      </motion.button>
                    )}
                    {alreadyDisputed && !isMe && !isDisputed && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-hint)' }}>Impugnada ✓</span>}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── MINI BARCHART ────────────────────────────────────────────────────────────
function BarChart({ data, color = '#f59e0b', label = '' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      {label && <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>}
      <div className="flex items-end gap-1 h-20">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <motion.div className="w-full rounded-t-lg" style={{ backgroundColor: color, opacity: 0.85 }}
              initial={{ height: 0 }} animate={{ height: `${Math.max(4, (d.value / max) * 72)}px` }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }} />
            <span className="text-xs" style={{ color: 'var(--text-hint)', fontSize: 9 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PANEL ADMIN ──────────────────────────────────────────────────────────────
function AdminTab({ selectedLeague, members, myRole, onMsg, onRefreshRanking }) {
  const { user } = useAuth()
  const [adminStats, setAdminStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [kickTarget, setKickTarget] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)
  const [actionLog, setActionLog] = useState([])
  const [loadingLog, setLoadingLog] = useState(false)

  // Ajuste manual de puntos
  const [adjTarget, setAdjTarget] = useState(null)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [showAdjModal, setShowAdjModal] = useState(false)

  // Gráficas
  const [chartData, setChartData] = useState(null)
  const [loadingCharts, setLoadingCharts] = useState(false)

  const canManage = myRole === 'owner' || myRole === 'admin'
  const manageableMembers = members.filter(m => {
    if (m.id === user.id || m.role === 'owner') return false
    if (myRole === 'admin' && m.role === 'admin') return false
    return true
  })

  const roleLabel = { owner: '👑 Creador', admin: '⚡ Admin', member: 'Miembro' }
  const roleBadgeStyle = {
    owner: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    admin: { backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    member: { backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' },
  }

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    return url ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-sm`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  useEffect(() => {
    if (selectedLeague) {
      fetchAdminStats()
      fetchCharts()
      fetchActionLog()
    }
  }, [selectedLeague?.id])

  const fetchAdminStats = async () => {
    setLoadingStats(true)
    const { data } = await supabase.rpc('get_league_stats', { p_league_id: selectedLeague.id })
    setAdminStats(data); setLoadingStats(false)
  }

  const fetchCharts = async () => {
    setLoadingCharts(true)
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: drinks } = await supabase.from('drinks')
      .select('consumed_at, points, user_id, profiles(username)')
      .eq('league_id', selectedLeague.id)
      .gte('consumed_at', since7)
      .eq('is_adjustment', false)
      .order('consumed_at', { ascending: true })

    if (drinks) {
      // Consumiciones por día últimos 7 días
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
        return { date: d, label: d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 2), value: 0 }
      })
      drinks.forEach(dr => {
        const drDate = new Date(dr.consumed_at); drDate.setHours(0, 0, 0, 0)
        const found = days.find(d => d.date.getTime() === drDate.getTime())
        if (found) found.value++
      })

      // Puntos por miembro
      const byMember = {}
      drinks.forEach(dr => {
        const name = dr.profiles?.username || 'Usuario'
        if (!byMember[name]) byMember[name] = 0
        byMember[name] += dr.points || 0
      })
      const memberData = Object.entries(byMember).sort(([, a], [, b]) => b - a).slice(0, 6).map(([label, value]) => ({ label: label.slice(0, 4), value: Math.round(value) }))

      // Horas pico
      const hours = Array.from({ length: 24 }, (_, i) => ({ label: i % 4 === 0 ? `${i}h` : '', value: 0 }))
      drinks.forEach(dr => { const h = new Date(dr.consumed_at).getHours(); hours[h].value++ })
      // Agrupar en bloques de 4h para legibilidad
      const hourBlocks = Array.from({ length: 6 }, (_, i) => ({
        label: `${i * 4}h`, value: hours.slice(i * 4, i * 4 + 4).reduce((s, h) => s + h.value, 0)
      }))

      setChartData({ days, memberData, hourBlocks })
    }
    setLoadingCharts(false)
  }

  const fetchActionLog = async () => {
    setLoadingLog(true)
    const { data } = await supabase.from('admin_action_log')
      .select('*, admin:profiles!admin_action_log_admin_id_fkey(username, avatar_url), target:profiles!admin_action_log_target_user_id_fkey(username)')
      .eq('league_id', selectedLeague.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setActionLog(data || [])
    setLoadingLog(false)
  }

  const logAction = async (actionType, targetUserId, details) => {
    await supabase.from('admin_action_log').insert({
      league_id: selectedLeague.id,
      admin_id: user.id,
      action_type: actionType,
      target_user_id: targetUserId || null,
      details,
    })
  }

  const handleResetSeason = async () => {
    setResetting(true); setShowResetConfirm(false)
    const { data: season } = await supabase.from('seasons').select('id').eq('active', true).single()
    if (!season) { onMsg(false, 'No hay temporada activa'); setResetting(false); return }
    const { error } = await supabase.from('drinks').delete().eq('league_id', selectedLeague.id).eq('season_id', season.id)
    if (error) { soundError(); onMsg(false, 'Error al resetear: ' + error.message) }
    else {
      soundSuccess(); onMsg(true, '✅ Puntos reseteados correctamente')
      await logAction('season_reset', null, { season_id: season.id })
      fetchAdminStats(); fetchCharts(); fetchActionLog()
      if (onRefreshRanking) onRefreshRanking()
    }
    setResetting(false)
  }

  const kickMember = async () => {
    if (!kickTarget) return
    await supabase.from('league_members').delete().eq('league_id', selectedLeague.id).eq('user_id', kickTarget.id)
    await logAction('kick', kickTarget.id, { username: kickTarget.username })
    setKickTarget(null); soundSuccess()
    onMsg(true, `✅ ${kickTarget.username} expulsado de la liga`)
    fetchActionLog()
  }

  const changeRole = async (memberId, newRole) => {
    await supabase.from('league_members').update({ role: newRole }).eq('league_id', selectedLeague.id).eq('user_id', memberId)
    await logAction('role_change', memberId, { new_role: newRole, username: roleTarget?.username })
    setRoleTarget(null); fetchActionLog()
  }

  const handleAdjustPoints = async () => {
    if (!adjTarget || !adjAmount || !adjReason.trim()) return
    const amount = parseFloat(adjAmount)
    if (isNaN(amount) || amount === 0) return
    setAdjusting(true)
    const { data: season } = await supabase.from('seasons').select('id').eq('active', true).single()
    const { error } = await supabase.from('drinks').insert({
      user_id: adjTarget.id,
      league_id: selectedLeague.id,
      season_id: season?.id,
      points: amount,
      is_adjustment: true,
      consumed_at: new Date().toISOString(),
      notes: adjReason.trim(),
    })
    if (error) { soundError(); onMsg(false, 'Error al ajustar puntos') }
    else {
      soundSuccess()
      onMsg(true, `✅ ${amount > 0 ? '+' : ''}${amount} pts a ${adjTarget.username}`)
      await logAction('points_adjustment', adjTarget.id, { amount, reason: adjReason.trim(), username: adjTarget.username })
      fetchActionLog(); fetchCharts()
      if (onRefreshRanking) onRefreshRanking()
    }
    setAdjusting(false); setShowAdjModal(false)
    setAdjTarget(null); setAdjAmount(''); setAdjReason('')
  }

  const formatDateLong = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const formatAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
    if (d > 0) return `hace ${d}d`; if (h > 0) return `hace ${h}h`; if (m > 0) return `hace ${m}m`; return 'ahora'
  }

  const actionLabel = {
    points_adjustment: { emoji: '✏️', label: 'Ajuste de puntos' },
    kick: { emoji: '🚫', label: 'Expulsión' },
    role_change: { emoji: '⚡', label: 'Cambio de rol' },
    season_reset: { emoji: '🗑️', label: 'Reset de temporada' },
  }

  return (
    <div className="space-y-6">
      {/* Banner admin */}
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
        <span className="text-3xl">👑</span>
        <div><p className="font-bold text-purple-400">Panel de administración</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{myRole === 'owner' ? 'Acceso completo como creador' : 'Acceso de administrador'}</p></div>
      </div>

      {/* ── GRÁFICAS ── */}
      <div>
        <p className="text-sm font-bold mb-3">📊 Actividad de la liga</p>
        {loadingCharts ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-2xl mb-1">📊</motion.div>
            <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Cargando gráficas...</p>
          </div>
        ) : chartData ? (
          <div className="space-y-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <BarChart data={chartData.days} color="#f59e0b" label="🍺 Consumiciones últimos 7 días" />
            </div>
            {chartData.memberData.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                <BarChart data={chartData.memberData} color="#6366f1" label="🏆 Puntos por miembro (7 días)" />
              </div>
            )}
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <BarChart data={chartData.hourBlocks} color="#10b981" label="🕐 Actividad por franja horaria" />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Sin datos suficientes todavía</p>
          </div>
        )}
      </div>

      {/* ── STATS ── */}
      <div>
        <p className="text-sm font-bold mb-3">📋 Estadísticas generales</p>
        {loadingStats ? (
          <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-2xl mb-1">📋</motion.div>
          </div>
        ) : adminStats ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: 'Total consumiciones', value: adminStats.total_drinks, emoji: '🍺' },
                { label: 'Miembros', value: adminStats.member_count, emoji: '👥' },
                { label: 'Monedas en circulación', value: `${Number(adminStats.total_coins).toLocaleString()}🪙`, emoji: '💰' },
                { label: 'Temporada desde', value: adminStats.season_start ? formatDateLong(adminStats.season_start) : '—', emoji: '📅' },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <p className="text-2xl mb-1">{stat.emoji}</p>
                  <p className="font-bold text-amber-400 text-lg leading-tight">{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}><p className="text-2xl mb-1">🏆</p><p className="font-bold text-amber-400 text-sm leading-tight">{adminStats.most_active_member || '—'}</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Miembro más activo</p></div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}><p className="text-2xl mb-1">⭐</p><p className="font-bold text-amber-400 text-sm leading-tight">{adminStats.most_popular_drink || '—'}</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Bebida más popular</p></div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => { fetchAdminStats(); fetchCharts() }} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>🔄 Actualizar todo</motion.button>
          </>
        ) : null}
      </div>

      {/* ── AJUSTE MANUAL DE PUNTOS ── */}
      <div>
        <p className="text-sm font-bold mb-3">✏️ Ajuste manual de puntos</p>
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-xs mb-3" style={{ color: 'var(--text-hint)' }}>Selecciona un miembro para añadir o quitar puntos. Queda registrado en el log.</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {members.filter(m => m.id !== user.id).map(member => (
              <motion.button key={member.id} whileTap={{ scale: 0.93 }}
                onClick={() => { setAdjTarget(adjTarget?.id === member.id ? null : member); setShowAdjModal(adjTarget?.id !== member.id) }}
                className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl min-w-16"
                style={{ backgroundColor: adjTarget?.id === member.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-input)', border: adjTarget?.id === member.id ? '2px solid #7c3aed' : '2px solid transparent' }}>
                <Avatar url={member.avatar_url} username={member.username} size="sm" />
                <p className="text-xs font-medium truncate w-14 text-center" style={{ color: adjTarget?.id === member.id ? '#a78bfa' : 'var(--text-muted)' }}>{member.username}</p>
                {adjTarget?.id === member.id && <span className="text-xs" style={{ color: '#a78bfa' }}>✓</span>}
              </motion.button>
            ))}
          </div>
          {adjTarget && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Puntos (negativo para quitar)</p>
                <div className="flex gap-2">
                  <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
                    placeholder="ej: 10 o -5" step="0.5"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                  <div className="flex gap-1">
                    {[5, 10, 20, -5, -10].map(v => (
                      <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setAdjAmount(String(v))}
                        className="px-2 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: v < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(124,58,237,0.1)', color: v < 0 ? '#ef4444' : '#a78bfa' }}>
                        {v > 0 ? `+${v}` : v}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Motivo (obligatorio)</p>
                <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)}
                  placeholder="ej: Premio por reto especial" maxLength={100}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdjustPoints}
                disabled={adjusting || !adjAmount || !adjReason.trim()}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ backgroundColor: parseFloat(adjAmount) < 0 ? '#ef4444' : '#7c3aed' }}>
                {adjusting ? 'Aplicando...' : adjAmount ? `${parseFloat(adjAmount) > 0 ? '+' : ''}${adjAmount} pts a ${adjTarget.username}` : 'Introduce una cantidad'}
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── GESTIÓN DE MIEMBROS ── */}
      <div>
        <p className="text-sm font-bold mb-3">👥 Gestión de miembros</p>
        {manageableMembers.length === 0 ? (
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm" style={{ color: 'var(--text-hint)' }}>No hay miembros que puedas gestionar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {manageableMembers.map(member => (
              <motion.div key={member.id} variants={staggerItem} initial="initial" animate="animate"
                className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                <Avatar url={member.avatar_url} username={member.username} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{member.username}</p>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={roleBadgeStyle[member.role]}>{roleLabel[member.role]}</span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {myRole === 'owner' && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRoleTarget(member)}
                      className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Rol</motion.button>
                  )}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setKickTarget(member)}
                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-red-950 text-red-400">Expulsar</motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── GESTIÓN DE TEMPORADA ── */}
      <div>
        <p className="text-sm font-bold mb-3">⚠️ Gestión de temporada</p>
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl flex-shrink-0">🗑️</span>
            <div>
              <p className="font-bold text-sm text-red-400">Resetear puntos de la temporada</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Elimina todas las consumiciones de la temporada actual en esta liga. Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowResetConfirm(true)} disabled={resetting}
            className="w-full py-3 rounded-xl font-bold text-red-400 text-sm border border-red-900 disabled:opacity-40"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
            {resetting ? 'Reseteando...' : '🗑️ Resetear puntos'}
          </motion.button>
        </div>
      </div>

      {/* ── LOG DE ACCIONES ── */}
      <div>
        <p className="text-sm font-bold mb-3">📝 Log de acciones admin</p>
        {loadingLog ? (
          <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-xl">📝</motion.div>
          </div>
        ) : actionLog.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Sin acciones registradas todavía</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actionLog.map(entry => {
              const aInfo = actionLabel[entry.action_type] || { emoji: '⚙️', label: entry.action_type }
              const details = entry.details || {}
              let desc = ''
              if (entry.action_type === 'points_adjustment') desc = `${details.amount > 0 ? '+' : ''}${details.amount} pts a ${details.username} — "${details.reason}"`
              else if (entry.action_type === 'kick') desc = `Expulsó a ${details.username}`
              else if (entry.action_type === 'role_change') desc = `${details.username} → ${details.new_role}`
              else if (entry.action_type === 'season_reset') desc = 'Reset de puntos de temporada'

              return (
                <motion.div key={entry.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-3 flex items-start gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{aInfo.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{aInfo.label}</p>
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>por {entry.admin?.username}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{formatAgo(entry.created_at)}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODALES ── */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowResetConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5"><div className="text-4xl mb-2">🗑️</div><h2 className="text-xl font-bold">¿Resetear puntos?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se eliminarán todas las consumiciones de la temporada en <strong>{selectedLeague?.name}</strong>. No se puede deshacer.</p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowResetConfirm(false)} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleResetSeason} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">Resetear</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {kickTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setKickTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-4"><div className="text-4xl mb-2">🚫</div><h2 className="text-xl font-bold">¿Expulsar a {kickTarget?.username}?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se eliminará de la liga y perderá su historial en esta temporada.</p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setKickTarget(null)} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={kickMember} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">Expulsar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {roleTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setRoleTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5"><div className="text-4xl mb-2">⚡</div><h2 className="text-xl font-bold">Rol de {roleTarget?.username}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Elige qué permisos tendrá en la liga</p>
              </div>
              <div className="space-y-3">
                {[
                  { role: 'admin', emoji: '⚡', label: 'Admin', desc: 'Puede expulsar miembros y cambiar el nombre', color: '#818cf8', bg: 'rgba(99,102,241,0.15)' },
                  { role: 'member', emoji: '🍺', label: 'Miembro', desc: 'Solo puede participar y chatear', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                ].map(opt => (
                  <motion.button key={opt.role} whileTap={{ scale: 0.97 }} onClick={() => changeRole(roleTarget.id, opt.role)}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{ backgroundColor: roleTarget.role === opt.role ? opt.bg : 'var(--bg-input)', border: roleTarget.role === opt.role ? `2px solid ${opt.color}` : '2px solid transparent' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{opt.emoji}</span>
                      <div className="flex-1"><p className="font-bold text-sm" style={{ color: roleTarget.role === opt.role ? opt.color : 'var(--text-primary)' }}>{opt.label}</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{opt.desc}</p></div>
                      {roleTarget.role === opt.role && <span style={{ color: opt.color }}>✓</span>}
                    </div>
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setRoleTarget(null)} className="w-full mt-4 font-semibold py-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Cancelar</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── RANKING PRINCIPAL ────────────────────────────────────────────────────────
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
  const [trophies, setTrophies] = useState([])
  const [loadingTrophies, setLoadingTrophies] = useState(false)
  const [bets, setBets] = useState([])
  const [loadingBets, setLoadingBets] = useState(false)
  const [showCreateBet, setShowCreateBet] = useState(false)
  const [betTarget, setBetTarget] = useState(null)
  const [betAmount, setBetAmount] = useState('')
  const [betDescription, setBetDescription] = useState('')
  const [creatingBet, setCreatingBet] = useState(false)
  const [betBalance, setBetBalance] = useState(0)
  const [resolvingBet, setResolvingBet] = useState(null)

  const bottomRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => { fetchLeagues() }, [])

  useEffect(() => {
    if (!selectedLeague) return
    fetchRanking(selectedLeague.id)
    fetchMembers(selectedLeague.id)
    fetchMessages(selectedLeague.id)
    fetchPolls(selectedLeague.id)
    fetchTrophies(selectedLeague.id)
    fetchBets(selectedLeague.id)
    setNewLeagueName(selectedLeague.name)

    const channel = supabase.channel(`chat:${selectedLeague.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `league_id=eq.${selectedLeague.id}` },
        async (payload) => {
          if (payload.new.user_id === user.id) return
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single()
          soundMessageReceived()
          if (tab !== 'chat') setUnreadByLeague(prev => ({ ...prev, [selectedLeague.id]: (prev[selectedLeague.id] || 0) + 1 }))
          if (document.hidden) {
            await supabase.from('notifications').insert({
              user_id: user.id, type: 'new_message',
              title: `💬 Nuevo mensaje en ${selectedLeague?.name}`,
              body: payload.new.content ? payload.new.content.slice(0, 80) : '📷 Imagen',
              read: false, sent_push: false,
            })
          }
          if (payload.new.poll_id) fetchPolls(selectedLeague.id)
          setMessages(prev => [...prev, { ...payload.new, profiles: { username: profile?.username || 'Desconocido', avatar_url: profile?.avatar_url } }])
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls', filter: `league_id=eq.${selectedLeague.id}` }, () => fetchPolls(selectedLeague.id))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedLeague, tab])

  useEffect(() => {
    if (tab === 'chat') { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); if (selectedLeague) markChatRead(selectedLeague.id) }
    if (tab === 'transfers' && selectedLeague) fetchTransfers(selectedLeague.id)
  }, [tab])

  useEffect(() => { if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const showAdminMsg = (success, text) => { setAdminMsg({ success, text }); setTimeout(() => setAdminMsg(null), 4000) }

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
    const { data } = await supabase.from('polls').select('*, profiles(username, avatar_url), created_by').eq('league_id', leagueId).order('created_at', { ascending: false })
    setPolls(data || [])
  }

  const fetchTrophies = async (leagueId) => {
    setLoadingTrophies(true)
    const { data } = await supabase.from('season_trophies')
      .select('*, profiles(username, avatar_url), seasons(started_at, ends_at)')
      .eq('league_id', leagueId).order('created_at', { ascending: false }).limit(30)
    setTrophies(data || [])
    setLoadingTrophies(false)
  }

  const fetchBets = async (leagueId) => {
    setLoadingBets(true)
    const [{ data: betsData }, { data: walletData }] = await Promise.all([
      supabase.from('member_bets')
        .select('*, creator:profiles!member_bets_creator_id_fkey(id, username, avatar_url), challenger:profiles!member_bets_challenger_id_fkey(id, username, avatar_url), winner:profiles!member_bets_winner_id_fkey(username)')
        .eq('league_id', leagueId).in('status', ['pending', 'active', 'resolved'])
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
    ])
    setBets(betsData || [])
    setBetBalance(walletData?.balance || 0)
    setLoadingBets(false)
  }

  const handleCreateBet = async () => {
    if (!betTarget || !betAmount || !betDescription.trim() || !selectedLeague) return
    const amount = parseInt(betAmount)
    if (isNaN(amount) || amount < 1 || amount > betBalance) return
    setCreatingBet(true)
    const { error } = await supabase.from('member_bets').insert({
      league_id: selectedLeague.id, creator_id: user.id, challenger_id: betTarget.id,
      amount, description: betDescription.trim(), status: 'pending',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (!error) {
      soundSuccess()
      await supabase.from('notifications').insert({
        user_id: betTarget.id, type: 'bet_challenge',
        title: '🎰 Te han retado a una apuesta',
        body: betDescription.trim() + ' · ' + amount + '🪙',
        read: false, sent_push: false,
      })
      setShowCreateBet(false); setBetTarget(null); setBetAmount(''); setBetDescription('')
      fetchBets(selectedLeague.id)
    } else soundError()
    setCreatingBet(false)
  }

  const handleAcceptBet = async (betId) => {
    await supabase.from('member_bets').update({ status: 'active' }).eq('id', betId)
    soundSuccess(); fetchBets(selectedLeague.id)
  }

  const handleDeclineBet = async (betId) => {
    await supabase.from('member_bets').update({ status: 'cancelled' }).eq('id', betId)
    fetchBets(selectedLeague.id)
  }

  const handleResolveBet = async (betId, winnerId) => {
    setResolvingBet(betId)
    const { data } = await supabase.rpc('resolve_bet', { p_bet_id: betId, p_winner_id: winnerId })
    if (data?.success) { soundSuccess(); fetchBets(selectedLeague.id) } else soundError()
    setResolvingBet(null)
  }

  const fetchTransfers = async (leagueId) => {
    setLoadingTransfers(true)
    const [{ data: transferData }, { data: walletData }] = await Promise.all([
      supabase.from('league_transfers').select('*, sender:profiles!league_transfers_sender_id_fkey(username, avatar_url), receiver:profiles!league_transfers_receiver_id_fkey(username, avatar_url)').eq('league_id', leagueId).order('created_at', { ascending: false }).limit(50),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
    ])
    setTransfers(transferData || []); setMyBalance(walletData?.balance || 0); setLoadingTransfers(false)
  }

  const handleSelectLeague = (league) => {
    setSelectedLeague(league); setMyRole(league.myRole || 'member'); setNewLeagueName(league.name)
    setTab('ranking'); setEditingName(false); setSelectedReceiver(null)
    setTransferAmount(''); setTransferNote(''); setTransferResult(null); setAdminMsg(null)
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedLeague || sending) return
    setSending(true); soundMessage()
    const content = newMessage.trim()
    const tempMsg = { id: `temp-${Date.now()}`, league_id: selectedLeague.id, user_id: user.id, content, image_url: null, created_at: new Date().toISOString(), profiles: { username: 'Tú', avatar_url: null } }
    setMessages(prev => [...prev, tempMsg]); setNewMessage('')
    const { error } = await supabase.from('messages').insert({ league_id: selectedLeague.id, user_id: user.id, content })
    if (error) setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
    setSending(false)
  }

  const sendPollMessage = async (pollId) => {
    const { data } = await supabase.from('messages').insert({ league_id: selectedLeague.id, user_id: user.id, content: '', poll_id: pollId }).select('*, profiles(username, avatar_url)').single()
    if (data) { await fetchPolls(selectedLeague.id); setMessages(prev => [...prev, data]) }
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

  const leaveLeague = async () => {
    if (!selectedLeague) return
    await supabase.from('league_members').delete().eq('league_id', selectedLeague.id).eq('user_id', user.id)
    setSelectedLeague(null); setMyRole('member'); fetchLeagues(); setTab('ranking')
  }

  const handleSendTransfer = async () => {
    if (!selectedReceiver || !transferAmount || parseInt(transferAmount) < 1) return
    setSendingTransfer(true); setTransferResult(null)
    const { data } = await supabase.rpc('send_coins_to_member', { p_league_id: selectedLeague.id, p_receiver_id: selectedReceiver.id, p_amount: parseInt(transferAmount), p_note: transferNote.trim() || null })
    if (data?.success) { soundSuccess(); setTransferResult({ success: true, amount: data.amount, receiver: data.receiver }); setMyBalance(prev => prev - data.amount); setTransferAmount(''); setTransferNote(''); setSelectedReceiver(null); fetchTransfers(selectedLeague.id) }
    else { soundError(); setTransferResult({ success: false, error: data?.error || 'Error al enviar' }) }
    setSendingTransfer(false); setTimeout(() => setTransferResult(null), 4000)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  const formatDateShort = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg); return groups
  }, {})

  const medals = ['🥇', '🥈', '🥉']
  const canManage = myRole === 'owner' || myRole === 'admin'
  const otherMembers = members.filter(m => m.id !== user.id)

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
    { id: 'juicio', label: '⚖️ Juicio' },
    { id: 'trophies', label: '🏅 Trofeos' },
    { id: 'bets', label: '🎰 Apuestas' },
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
                {tab === t.id && <motion.div layoutId="tab-indicator" className="absolute inset-0 rounded-lg" style={{ zIndex: -1, backgroundColor: t.id === 'transfers' ? '#10b981' : t.id === 'admin' ? '#7c3aed' : t.id === 'polls' ? '#6366f1' : t.id === 'juicio' ? '#dc2626' : t.id === 'trophies' ? '#f59e0b' : t.id === 'bets' ? '#8b5cf6' : '#f59e0b' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                <span>{t.label}</span>
                {t.unread > 0 && <UnreadBadge count={t.unread} />}
              </button>
            ))}
          </div>
        )}

        {leagues.length === 0 && <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}><div className="text-5xl mb-3">🏆</div><p className="font-bold">Aún no estás en ninguna liga</p><p className="text-sm mt-1">Crea una nueva o únete con un código</p></div>}
      </div>

      {/* Msg admin global */}
      <AnimatePresence>
        {adminMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 rounded-2xl p-4 mb-2 text-center"
            style={{ backgroundColor: adminMsg.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${adminMsg.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <p className={`font-bold text-sm ${adminMsg.success ? 'text-emerald-400' : 'text-red-400'}`}>{adminMsg.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

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
              const roleBadgeStyle = { owner: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }, admin: { backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }, member: { backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' } }
              const roleLabel = { owner: '👑 Creador', admin: '⚡ Admin', member: 'Miembro' }
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

      {/* ── ENCUESTAS ── */}
      {tab === 'polls' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCreatePoll(true)} className="w-full py-3 rounded-2xl font-bold text-white mb-5 flex items-center justify-center gap-2" style={{ backgroundColor: '#6366f1' }}>📊 Crear nueva encuesta</motion.button>
          {polls.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}><div className="text-5xl mb-3">📊</div><p className="font-bold">Sin encuestas todavía</p><p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>Crea la primera para la liga</p></div>
          ) : (
            <div className="space-y-4">
              {polls.map(poll => (
                <div key={poll.id} className="relative">
                  <PollCard poll={poll} userId={user.id} />
                  {poll.created_by === user.id && (
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={async () => { await supabase.from('polls').delete().eq('id', poll.id); fetchPolls(selectedLeague.id) }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs z-10"
                      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🗑️</motion.button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── JUICIO ── */}
      {tab === 'juicio' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
            <span className="text-2xl flex-shrink-0">⚖️</span>
            <div>
              <p className="font-bold text-sm text-red-400">Sistema de verificación con IA</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Cualquier miembro puede impugnar una consumición. El acusado tiene 3 horas para subir una foto. La IA la analiza automáticamente y decide si es válida.</p>
            </div>
          </div>
          <JuicioTab leagueId={selectedLeague.id} currentUserId={user.id} members={members} />
        </div>
      )}

      {/* ── TROFEOS ── */}
      {tab === 'trophies' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          {loadingTrophies ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-4xl mb-2">🏅</motion.div>
              <p className="text-sm">Cargando trofeos...</p>
            </div>
          ) : trophies.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">🏅</div>
              <p className="font-bold">Sin trofeos todavía</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>Al terminar cada temporada se reparten premios al top 3</p>
              <div className="mt-6 space-y-2 max-w-xs mx-auto">
                {[{ pos: '🥇', label: '1er puesto', coins: '500🪙' }, { pos: '🥈', label: '2do puesto', coins: '300🪙' }, { pos: '🥉', label: '3er puesto', coins: '100🪙' }].map(p => (
                  <div key={p.pos} className="rounded-2xl p-3 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-2"><span className="text-2xl">{p.pos}</span><span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{p.label}</span></div>
                    <span className="font-bold text-amber-400">{p.coins}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(trophies.reduce((acc, t) => {
                const key = t.season_id
                if (!acc[key]) acc[key] = { season: t.seasons, entries: [] }
                acc[key].entries.push(t); return acc
              }, {})).map(([seasonId, { season, entries }]) => (
                <div key={seasonId}>
                  <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>
                    📅 Temporada · {season?.started_at ? new Date(season.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : `#${seasonId}`}
                  </p>
                  <div className="space-y-2">
                    {entries.sort((a, b) => a.position - b.position).map(trophy => (
                      <motion.div key={trophy.id} variants={staggerItem} initial="initial" animate="animate"
                        className="rounded-2xl p-4 flex items-center gap-3"
                        style={{ backgroundColor: 'var(--bg-card)', border: trophy.position === 1 ? '2px solid rgba(245,158,11,0.5)' : trophy.position === 2 ? '2px solid rgba(156,163,175,0.4)' : '2px solid rgba(180,83,9,0.35)' }}>
                        <span className="text-3xl flex-shrink-0">{trophy.position === 1 ? '🥇' : trophy.position === 2 ? '🥈' : '🥉'}</span>
                        <Avatar url={trophy.profiles?.avatar_url} username={trophy.profiles?.username} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{trophy.profiles?.username}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{Math.round(trophy.total_points)} pts totales</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-amber-400">+{trophy.coins_awarded}🪙</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>premio</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── APUESTAS ── */}
      {tab === 'bets' && selectedLeague && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <div className="rounded-2xl p-4 mb-4 flex items-center justify-between" style={{ backgroundColor: betBalance < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)', border: `1px solid ${betBalance < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}` }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Tu saldo</p>
              <p className="text-2xl font-black" style={{ color: betBalance < 0 ? '#ef4444' : '#a78bfa' }}>{betBalance.toLocaleString()}🪙</p>
            </div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCreateBet(true)}
              className="px-4 py-2.5 rounded-2xl font-bold text-white text-sm" style={{ backgroundColor: '#8b5cf6' }}>
              + Nueva apuesta
            </motion.button>
          </div>
          {loadingBets ? (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-3xl mb-2">🎰</motion.div>
            </div>
          ) : bets.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">🎰</div>
              <p className="font-bold">Sin apuestas todavía</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>Reta a otro miembro y el ganador se lleva las monedas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bets.map(bet => {
                const isCreator = bet.creator_id === user.id
                const isChallenger = bet.challenger_id === user.id
                const isPending = bet.status === 'pending'
                const isActive = bet.status === 'active'
                const isResolved = bet.status === 'resolved'
                const iWon = bet.winner_id === user.id
                const statusColor = isPending ? '#f59e0b' : isActive ? '#10b981' : isResolved ? (iWon ? '#10b981' : '#ef4444') : '#6b7280'
                const statusLabel = isPending ? '⏳ Pendiente' : isActive ? '⚔️ En juego' : isResolved ? (iWon ? '🏆 Ganada' : '💀 Perdida') : '❌ Cancelada'
                return (
                  <motion.div key={bet.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${statusColor}30` }}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>{statusLabel}</span>
                      <span className="font-black text-lg" style={{ color: '#a78bfa' }}>{bet.amount}🪙</span>
                    </div>
                    <p className="text-sm font-medium mb-3">{bet.description}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar url={bet.creator?.avatar_url} username={bet.creator?.username} size="sm" />
                      <span className="text-xs font-medium">{isCreator ? 'Tú' : bet.creator?.username}</span>
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>vs</span>
                      <Avatar url={bet.challenger?.avatar_url} username={bet.challenger?.username} size="sm" />
                      <span className="text-xs font-medium">{isChallenger ? 'Tú' : bet.challenger?.username}</span>
                    </div>
                    {isPending && isChallenger && (
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleAcceptBet(bet.id)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: '#10b981' }}>✓ Aceptar</motion.button>
                        <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDeclineBet(bet.id)} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>✕ Rechazar</motion.button>
                      </div>
                    )}
                    {isPending && isCreator && (
                      <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: 'rgba(245,158,11,0.08)' }}>
                        <p className="text-xs" style={{ color: '#f59e0b' }}>Esperando que {bet.challenger?.username} acepte...</p>
                      </div>
                    )}
                    {isActive && (isCreator || isChallenger) && (
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>¿Quién ganó?</p>
                        <div className="flex gap-2">
                          {[
                            { id: bet.creator_id, name: isCreator ? 'Yo' : bet.creator?.username, avatar: bet.creator?.avatar_url },
                            { id: bet.challenger_id, name: isChallenger ? 'Yo' : bet.challenger?.username, avatar: bet.challenger?.avatar_url },
                          ].map(player => (
                            <motion.button key={player.id} whileTap={{ scale: 0.97 }} onClick={() => handleResolveBet(bet.id, player.id)} disabled={resolvingBet === bet.id}
                              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                              style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                              <Avatar url={player.avatar} username={player.name} size="sm" />
                              {resolvingBet === bet.id ? '...' : player.name}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                    {isResolved && (
                      <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: iWon ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                        <p className="text-xs font-bold" style={{ color: iWon ? '#10b981' : '#ef4444' }}>
                          {iWon ? `+${bet.amount}🪙 ganadas` : `-${bet.amount}🪙 perdidas`} · Ganó {bet.winner?.username}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Modal crear apuesta */}
          <AnimatePresence>
            {showCreateBet && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
                onClick={() => { setShowCreateBet(false); setBetTarget(null); setBetAmount(''); setBetDescription('') }}>
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                  onClick={e => e.stopPropagation()}
                  className="rounded-t-3xl w-full max-w-lg overflow-y-auto"
                  style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh', paddingBottom: '100px' }}>
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setShowCreateBet(false); setBetTarget(null); setBetAmount(''); setBetDescription('') }} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cancelar</motion.button>
                    <h2 className="text-base font-bold">🎰 Nueva apuesta</h2>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreateBet}
                      disabled={!betTarget || !betAmount || !betDescription.trim() || creatingBet || parseInt(betAmount) > betBalance}
                      className="px-4 py-2 rounded-full text-sm font-bold"
                      style={{ backgroundColor: betTarget && betAmount && betDescription.trim() ? '#8b5cf6' : 'var(--bg-input)', color: betTarget && betAmount && betDescription.trim() ? '#fff' : 'var(--text-hint)' }}>
                      {creatingBet ? '...' : 'Retar'}
                    </motion.button>
                  </div>
                  <div className="px-5 pt-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>¿A quién retas?</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {otherMembers.map(member => (
                          <motion.button key={member.id} whileTap={{ scale: 0.93 }} onClick={() => setBetTarget(betTarget?.id === member.id ? null : member)}
                            className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl min-w-16"
                            style={{ backgroundColor: betTarget?.id === member.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-input)', border: betTarget?.id === member.id ? '2px solid #8b5cf6' : '2px solid transparent' }}>
                            <Avatar url={member.avatar_url} username={member.username} size="sm" />
                            <p className="text-xs font-medium truncate w-14 text-center" style={{ color: betTarget?.id === member.id ? '#a78bfa' : 'var(--text-muted)' }}>{member.username}</p>
                            {betTarget?.id === member.id && <span className="text-xs text-purple-400">✓</span>}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>¿Sobre qué apostáis?</p>
                      <input type="text" value={betDescription} onChange={e => setBetDescription(e.target.value)}
                        placeholder="ej: El que beba más esta noche gana" maxLength={120} autoFocus
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cantidad en juego</p>
                        <p className="text-xs" style={{ color: '#a78bfa' }}>Saldo: {betBalance}🪙</p>
                      </div>
                      <div className="relative mb-2">
                        <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                          placeholder="0" min="1" max={betBalance}
                          className="w-full rounded-xl px-4 py-3 text-lg font-bold outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">🪙</span>
                      </div>
                      <div className="flex gap-2">
                        {[50, 100, 250, 500].filter(v => v <= betBalance).map(v => (
                          <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setBetAmount(String(v))}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                            style={{ backgroundColor: parseInt(betAmount) === v ? '#8b5cf6' : 'var(--bg-input)', color: parseInt(betAmount) === v ? '#fff' : 'var(--text-muted)' }}>{v}</motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <span className="text-sm">⚠️</span>
                      <p className="text-xs" style={{ color: '#a78bfa' }}>Ambos debéis acordar el ganador. El que pierde paga al instante.</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── ADMIN ── */}
      {tab === 'admin' && selectedLeague && canManage && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <AdminTab
            selectedLeague={selectedLeague}
            members={members}
            myRole={myRole}
            onMsg={showAdminMsg}
            onRefreshRanking={() => fetchRanking(selectedLeague.id)}
          />
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
                    if (msg.poll_id) {
                      const poll = polls.find(p => p.id === msg.poll_id)
                      if (!poll) return null
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                          className={`flex gap-2 mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && <div className="flex-shrink-0 self-end">{!isSameUser ? <Avatar url={msg.profiles?.avatar_url} username={msg.profiles?.username} size="sm" /> : <div className="w-8" />}</div>}
                          <div className={`flex flex-col w-64 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && !isSameUser && <span className="text-xs text-amber-400 font-medium mb-1 ml-1">{msg.profiles?.username}</span>}
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

      <AnimatePresence>
        {showCreatePoll && (
          <CreatePollModal leagueId={selectedLeague?.id} userId={user.id} onClose={() => setShowCreatePoll(false)}
            onCreated={(pollId) => { fetchPolls(selectedLeague?.id); if (tab === 'chat') sendPollMessage(pollId) }} />
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
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); setJoinSuccess('') }} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleJoinLeague} disabled={!joinCode.trim() || joining} className="flex-1 bg-amber-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl">{joining ? 'Uniéndose...' : 'Unirse'}</motion.button>
              </div>
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
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowCreateModal(false); setNewLeagueCreateName('') }} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateLeague} disabled={!newLeagueCreateName.trim() || creating} className="flex-1 bg-amber-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl">{creating ? 'Creando...' : 'Crear'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}