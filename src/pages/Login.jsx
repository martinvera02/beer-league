import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// ─── FEATURES para el showcase ────────────────────────────────────────────────
const FEATURES = [
  { emoji: '🏆', title: 'Ligas privadas', desc: 'Compite con tus amigos en rankings semanales con puntos reales' },
  { emoji: '📈', title: 'Mercado de cotizaciones', desc: 'Los precios suben y bajan según la demanda. Invierte tus monedas' },
  { emoji: '⚔️', title: 'Guerra de Clanes', desc: 'Reta a otra liga a batallas colectivas con roles estratégicos' },
  { emoji: '⚡', title: 'Powerups', desc: 'Congela rivales, dobla puntos, hazte invisible o sabotea al líder' },
  { emoji: '⚖️', title: 'El Juzgado', desc: 'La liga vota si una consumición es real o no. El 65% decide' },
  { emoji: '🎰', title: 'Casino & Apuestas', desc: 'Apuesta monedas contra otros miembros o prueba suerte en la ruleta' },
]

// ─── Partícula flotante ────────────────────────────────────────────────────────
function Particle({ x, delay, size, emoji }) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${x}%`, top: '110%', fontSize: size }}
      animate={{ top: '-10%', rotate: [0, 15, -15, 10, 0] }}
      transition={{ duration: 12 + Math.random() * 6, repeat: Infinity, delay, ease: 'linear' }}>
      {emoji}
    </motion.div>
  )
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, username })
        if (profileError) {
          setError('Error al crear el perfil: ' + profileError.message)
        } else {
          setMessage('¡Cuenta creada! Ya puedes iniciar sesión.')
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email o contraseña incorrectos')
    }

    setLoading(false)
  }

  const particles = [
    { x: 5,  delay: 0,   size: '1.5rem', emoji: '🍺' },
    { x: 15, delay: 2,   size: '1rem',   emoji: '🪙' },
    { x: 25, delay: 4,   size: '1.25rem',emoji: '🍻' },
    { x: 38, delay: 1,   size: '1rem',   emoji: '⚔️' },
    { x: 50, delay: 3,   size: '1.5rem', emoji: '🏆' },
    { x: 62, delay: 5,   size: '1rem',   emoji: '⚡' },
    { x: 75, delay: 2.5, size: '1.25rem',emoji: '🍺' },
    { x: 85, delay: 0.5, size: '1rem',   emoji: '🪙' },
    { x: 93, delay: 4.5, size: '1.5rem', emoji: '🎰' },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: '#060609', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(245,158,11,0.1), transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        {particles.map((p, i) => <Particle key={i} {...p} />)}
      </div>

      {/* ── HERO ── */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-4 pb-8 pt-16 text-center">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <motion.div className="w-2 h-2 rounded-full bg-amber-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <span className="text-xs font-bold text-amber-400" style={{ letterSpacing: '0.1em' }}>
            LA LIGA DE TUS CONSUMICIONES
          </span>
        </motion.div>

        {/* Título */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
          className="text-8xl mb-4">
          <motion.span
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-block' }}>
            🍺
          </motion.span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontSize: 'clamp(3rem, 12vw, 6rem)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #fff 0%, #f59e0b 50%, #fff 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmer 4s linear infinite',
            marginBottom: '1rem',
          }}>
          Beer League
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', maxWidth: 480, lineHeight: 1.6, marginBottom: '2.5rem' }}>
          Anota lo que bebes, sube en el ranking, sabotea a tus rivales y domina la liga con tus amigos.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3 flex-wrap justify-center mb-16">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => { setIsRegister(true); setShowForm(true) }}
            className="relative overflow-hidden px-8 py-3.5 rounded-2xl font-bold text-base text-black"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 0 30px rgba(245,158,11,0.35)' }}>
            <motion.div className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }} />
            <span className="relative">🚀 Crear cuenta gratis</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => { setIsRegister(false); setShowForm(true) }}
            className="px-8 py-3.5 rounded-2xl font-bold text-base"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
            Iniciar sesión
          </motion.button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-8 flex-wrap justify-center mb-20">
          {[
            { value: '69', label: 'Logros desbloqueables' },
            { value: '8+', label: 'Tipos de powerup' },
            { value: '∞', label: 'Guerras declaradas' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-black text-amber-400">{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── FEATURES ── */}
      <div className="relative px-4 pb-24" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-amber-400 mb-2" style={{ letterSpacing: '0.15em' }}>¿QUÉ INCLUYE?</p>
          <h2 className="text-3xl font-black">Todo lo que necesitas para la liga</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-3xl mb-3">{f.emoji}</div>
              <p className="font-bold text-sm mb-1.5">{f.title}</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA final */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-14">
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Gratis. Sin trampa.</p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => { setIsRegister(true); setShowForm(true) }}
            className="relative overflow-hidden px-10 py-4 rounded-2xl font-black text-lg text-black"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 0 40px rgba(245,158,11,0.3)' }}>
            <motion.div className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }} />
            <span className="relative">🍺 Unirse a Beer League</span>
          </motion.button>
        </motion.div>
      </div>

      {/* ── MODAL DE LOGIN/REGISTRO ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="w-full rounded-t-3xl sm:rounded-3xl overflow-hidden"
              style={{ maxWidth: 440, backgroundColor: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)' }}>

              {/* Header modal */}
              <div className="px-6 pt-6 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🍺</span>
                    <span className="font-black text-lg">Beer League</span>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(false)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>✕</motion.button>
                </div>
                {/* Toggle */}
                <div className="flex rounded-xl p-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  {[
                    { id: false, label: 'Iniciar sesión' },
                    { id: true,  label: 'Registrarse' },
                  ].map(t => (
                    <button key={String(t.id)}
                      onClick={() => { setIsRegister(t.id); setError(''); setMessage('') }}
                      className="relative flex-1 py-2 rounded-lg text-sm font-bold z-10 transition-colors"
                      style={{ color: isRegister === t.id ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                      {isRegister === t.id && (
                        <motion.div layoutId="login-tab" className="absolute inset-0 rounded-lg"
                          style={{ zIndex: -1, backgroundColor: '#f59e0b' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                      )}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <div className="px-6 py-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <AnimatePresence>
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>
                          NOMBRE DE USUARIO
                        </label>
                        <input type="text" value={username}
                          onChange={e => setUsername(e.target.value)}
                          placeholder="ej: pepito123" required
                          className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>
                      EMAIL
                    </label>
                    <input type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com" required
                      className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>
                      CONTRASEÑA
                    </label>
                    <input type="password" value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="mínimo 6 caracteres" required
                      className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-sm rounded-xl px-4 py-3 font-medium"
                        style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        ⚠️ {error}
                      </motion.p>
                    )}
                    {message && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-sm rounded-xl px-4 py-3 font-medium"
                        style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                        ✅ {message}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3.5 rounded-2xl font-black text-base relative overflow-hidden disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#000' }}>
                    <motion.div className="absolute inset-0"
                      style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)' }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }} />
                    <span className="relative">
                      {loading ? 'Cargando...' : isRegister ? '🚀 Crear cuenta' : '🍺 Entrar'}
                    </span>
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { border-color: rgba(245,158,11,0.4) !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
      `}</style>
    </div>
  )
}