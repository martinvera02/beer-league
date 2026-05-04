import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SLIDES = [
  {
    id: 'welcome',
    emoji: '🍺',
    title: '¡Bienvenido a Beer League!',
    subtitle: 'La liga de consumiciones con tus amigos',
    desc: 'Anota lo que bebes, compite con tu grupo, sube de ranking y desbloquea logros. Cuanto más bebas, más puntos acumulas.',
    bg: 'linear-gradient(135deg, #1a0a00, #2d1500, #1a0a00)',
    accent: '#f59e0b',
    particles: ['🍺', '🍻', '🥂', '🍷', '🍹'],
  },
  {
    id: 'ligas',
    emoji: '🏆',
    title: 'Ligas y rankings',
    subtitle: 'Compite con tus amigos',
    desc: 'Crea una liga o únete con un código de invitación. Cada consumición suma puntos. Al final de temporada (10 días) el top 3 recibe monedas.',
    bg: 'linear-gradient(135deg, #0a1a00, #152d00, #0a1500)',
    accent: '#10b981',
    particles: ['🏆', '🥇', '🥈', '🥉', '🎖️'],
  },
  {
    id: 'mercado',
    emoji: '📈',
    title: 'El mercado de cotizaciones',
    subtitle: 'Los precios suben y bajan',
    desc: 'Cada bebida tiene un multiplicador de puntos que cambia según la demanda. Cuando mucha gente bebe lo mismo, el multiplicador baja. ¡Diversifica!',
    bg: 'linear-gradient(135deg, #00101a, #001a2d, #001015)',
    accent: '#6366f1',
    particles: ['📈', '📉', '💹', '🪙', '💰'],
  },
  {
    id: 'monedas',
    emoji: '🪙',
    title: 'Monedas y la tienda',
    subtitle: 'Gana, gasta, sabotea',
    desc: 'Cada punto equivale a 10 monedas. Úsalas para comprar powerups: congela a un rival, dobla tus puntos, hazte invisible o arma un sabotaje.',
    bg: 'linear-gradient(135deg, #1a1500, #2d2500, #1a1a00)',
    accent: '#f59e0b',
    particles: ['🪙', '⚡', '🧊', '💣', '🛡️'],
  },
  {
    id: 'guerra',
    emoji: '⚔️',
    title: 'Guerra de Clanes',
    subtitle: 'Liga contra liga',
    desc: 'Reta a otra liga a una guerra. Batallas colectivas, roles de Espía y Saboteador, y objetivos personalizados. El equipo que complete el reto primero gana.',
    bg: 'linear-gradient(135deg, #1a0000, #2d0000, #1a0500)',
    accent: '#ef4444',
    particles: ['⚔️', '🏴', '🕵️', '💣', '🏆'],
  },
  {
    id: 'juicio',
    emoji: '⚖️',
    title: 'El Juzgado',
    subtitle: 'La justicia del pueblo',
    desc: 'Si alguien anota algo sospechoso, cualquier miembro puede impugnarlo. La liga vota. Si más del 65% dice que es falso, la consumición se anula.',
    bg: 'linear-gradient(135deg, #100010, #200020, #100010)',
    accent: '#a855f7',
    particles: ['⚖️', '🔨', '👨‍⚖️', '✅', '❌'],
  },
  {
    id: 'social',
    emoji: '💬',
    title: 'Chat, social y más',
    subtitle: 'No solo se bebe',
    desc: 'Cada liga tiene su chat en tiempo real. Sube historias, postea en el feed, sigue a tus amigos, crea encuestas y apuesta contra otros miembros.',
    bg: 'linear-gradient(135deg, #001020, #001530, #001020)',
    accent: '#818cf8',
    particles: ['💬', '📸', '❤️', '🎰', '📊'],
  },
  {
    id: 'ready',
    emoji: '🚀',
    title: '¡Todo listo!',
    subtitle: 'A por la primera ronda',
    desc: 'Crea o únete a una liga para empezar. El ranking se resetea cada 10 días, así que siempre hay una nueva oportunidad de llegar al top.',
    bg: 'linear-gradient(135deg, #0a0a1a, #0f0f2d, #0a0a1a)',
    accent: '#f59e0b',
    particles: ['🚀', '🍺', '🏆', '⚔️', '🪙'],
  },
]

const STORAGE_KEY = 'beer_league_onboarding_done'

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  const goNext = () => {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, 'true')
      onComplete()
      return
    }
    setDirection(1)
    setCurrent(c => c + 1)
  }

  const goPrev = () => {
    if (current === 0) return
    setDirection(-1)
    setCurrent(c => c - 1)
  }

  const goTo = (idx) => {
    setDirection(idx > current ? 1 : -1)
    setCurrent(idx)
  }

  const skip = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: slide.bg, transition: 'background 0.5s ease' }}>

      {/* Partículas flotantes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {slide.particles.map((p, i) => (
          <motion.div key={`${slide.id}-${i}`}
            className="absolute text-3xl select-none"
            style={{ left: `${10 + i * 18}%`, opacity: 0.08 }}
            initial={{ y: '110%', rotate: 0 }}
            animate={{ y: '-10%', rotate: i % 2 === 0 ? 15 : -15 }}
            transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'linear', delay: i * 1.2 }}>
            {p}
          </motion.div>
        ))}
      </div>

      {/* Header — skip */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-12 pb-4 z-10">
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <motion.button key={i} onClick={() => goTo(i)}
              className="rounded-full transition-all"
              animate={{
                width: i === current ? 24 : 6,
                backgroundColor: i === current ? slide.accent : 'rgba(255,255,255,0.2)',
              }}
              style={{ height: 6 }} />
          ))}
        </div>
        {!isLast && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={skip}
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            Saltar
          </motion.button>
        )}
      </div>

      {/* Contenido del slide */}
      <div className="h-full flex flex-col items-center justify-center px-8 pb-32 pt-24">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex flex-col items-center text-center max-w-sm w-full">

            {/* Emoji principal */}
            <motion.div
              className="text-8xl mb-8 select-none"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}>
              <motion.span
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ display: 'inline-block' }}>
                {slide.emoji}
              </motion.span>
            </motion.div>

            {/* Título */}
            <motion.h1
              className="text-3xl font-black mb-2 leading-tight"
              style={{ color: '#fff' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}>
              {slide.title}
            </motion.h1>

            {/* Subtítulo */}
            <motion.p
              className="text-sm font-bold mb-4 px-2"
              style={{ color: slide.accent }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}>
              {slide.subtitle}
            </motion.p>

            {/* Descripción */}
            <motion.p
              className="text-sm leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}>
              {slide.desc}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Botones inferiores */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4"
        style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.4) 0%, transparent 100%)' }}>
        <div className="flex gap-3 max-w-sm mx-auto">
          {current > 0 && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={goPrev}
              className="w-12 h-14 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              ←
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={goNext}
            className="flex-1 h-14 rounded-2xl font-black text-base relative overflow-hidden"
            style={{ backgroundColor: slide.accent, color: current === SLIDES.length - 1 ? '#000' : '#fff' }}>
            <motion.div className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }} />
            <span className="relative">
              {isLast ? '🚀 ¡Empezar!' : current === 0 ? '¡Vamos!' : 'Siguiente →'}
            </span>
          </motion.button>
        </div>

        {/* Número de slide */}
        <p className="text-center mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {current + 1} / {SLIDES.length}
        </p>
      </div>
    </div>
  )
}

// ─── Hook para controlar si mostrar el onboarding ─────────────────────────────
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setShowOnboarding(true)
  }, [])

  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY)
    setShowOnboarding(true)
  }

  const completeOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowOnboarding(false)
  }

  return { showOnboarding, resetOnboarding, completeOnboarding }
}