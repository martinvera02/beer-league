import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { fadeIn, staggerItem, scaleIn } from '../lib/animations'

export default function Profile() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [section, setSection] = useState('profile') // 'profile' | 'settings'
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Ajustes
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    const [{ data: profileData }, { data: drinksData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('drinks').select('points, drink_types(name, emoji)').eq('user_id', user.id)
    ])

    setProfile(profileData)
    setNewUsername(profileData?.username || '')

    if (drinksData) {
      const total = drinksData.reduce((sum, d) => sum + d.points, 0)
      const byType = drinksData.reduce((acc, d) => {
        const name = d.drink_types.name
        acc[name] = (acc[name] || 0) + 1
        return acc
      }, {})
      setStats({ total, count: drinksData.length, byType })
    }

    setLoading(false)
  }

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true })

    if (uploadError) { setError('Error al subir la imagen'); setUploadingAvatar(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setProfile(prev => ({ ...prev, avatar_url: publicUrl }))
    setUploadingAvatar(false)
    showSuccess('Foto actualizada')
  }

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || newUsername === profile?.username) return
    setSavingUsername(true)
    setError('')

    const { error } = await supabase
      .from('profiles').update({ username: newUsername.trim() }).eq('id', user.id)

    if (error) {
      setError(error.message.includes('unique') ? 'Ese nombre de usuario ya está en uso' : error.message)
    } else {
      setProfile(prev => ({ ...prev, username: newUsername.trim() }))
      showSuccess('Nombre de usuario actualizado')
    }
    setSavingUsername(false)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSavingPassword(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setError(error.message)
    } else {
      setNewPassword('')
      setConfirmPassword('')
      showSuccess('Contraseña actualizada')
    }
    setSavingPassword(false)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError('')
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      setError('Error al eliminar la cuenta: ' + error.message)
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }
    await logout()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto">

        {/* Cabecera con pestañas */}
        <motion.div {...fadeIn} className="mb-6">
          <h1 className="text-2xl font-bold mb-4">
            {section === 'profile' ? 'Tu perfil 👤' : 'Ajustes ⚙️'}
          </h1>
          <div className="flex bg-gray-800 rounded-xl p-1">
            {[
              { id: 'profile',  label: '👤 Perfil' },
              { id: 'settings', label: '⚙️ Ajustes' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => { setSection(s.id); setError(''); setSuccessMsg('') }}
                className={`relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10 ${
                  section === s.id ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {section === s.id && (
                  <motion.div
                    layoutId="profile-tab"
                    className="absolute inset-0 bg-amber-500 rounded-lg"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {s.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Mensajes globales */}
        <AnimatePresence>
          {error && (
            <motion.p {...scaleIn} className="text-red-400 text-sm bg-red-950 rounded-xl px-4 py-3 mb-4">
              {error}
            </motion.p>
          )}
          {successMsg && (
            <motion.p {...scaleIn} className="text-green-400 text-sm bg-green-950 rounded-xl px-4 py-3 mb-4">
              ✓ {successMsg}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── SECCIÓN PERFIL ── */}
        {section === 'profile' && (
          <motion.div {...fadeIn} key="profile">

            {/* Tarjeta avatar */}
            <div className="bg-gray-900 rounded-2xl p-6 mb-4 text-center">
              <div className="relative inline-block mb-3">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-4 border-amber-500"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-700 border-4 border-gray-600 flex items-center justify-center text-4xl">
                    🍺
                  </div>
                )}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 bg-amber-500 hover:bg-amber-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
                >
                  {uploadingAvatar ? '⏳' : '📷'}
                </motion.button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
              <p className="text-xl font-bold">{profile?.username}</p>
              <p className="text-gray-500 text-sm">{user.email}</p>
              <p className="text-xs text-gray-600 mt-1">
                {uploadingAvatar ? 'Subiendo...' : 'Toca 📷 para cambiar tu foto'}
              </p>
            </div>

            {/* Stats */}
            {stats && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <motion.div variants={staggerItem} initial="initial" animate="animate" className="bg-gray-900 rounded-2xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-400">{stats.count}</p>
                    <p className="text-gray-400 text-sm mt-1">Consumiciones</p>
                  </motion.div>
                  <motion.div variants={staggerItem} initial="initial" animate="animate" className="bg-gray-900 rounded-2xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-400">{stats.total}</p>
                    <p className="text-gray-400 text-sm mt-1">Puntos totales</p>
                  </motion.div>
                </div>

                <div className="bg-gray-900 rounded-2xl p-4">
                  <p className="text-sm text-gray-400 mb-3 font-medium">Desglose por bebida</p>
                  {Object.entries(stats.byType).length === 0 ? (
                    <p className="text-gray-600 text-sm">Aún no has anotado nada</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats.byType)
                        .sort(([, a], [, b]) => b - a)
                        .map(([name, count]) => (
                          <div key={name} className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">{name}</span>
                            <span className="text-amber-400 font-bold">{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── SECCIÓN AJUSTES ── */}
        {section === 'settings' && (
          <motion.div {...fadeIn} key="settings" className="space-y-4">

            {/* Cambiar nombre de usuario */}
            <div className="bg-gray-900 rounded-2xl p-5">
              <h2 className="text-base font-bold mb-4">✏️ Cambiar nombre de usuario</h2>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Nuevo nombre de usuario"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleChangeUsername}
                disabled={savingUsername || !newUsername.trim() || newUsername === profile?.username}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {savingUsername ? 'Guardando...' : 'Guardar nombre'}
              </motion.button>
            </div>

            {/* Cambiar contraseña */}
            <div className="bg-gray-900 rounded-2xl p-5">
              <h2 className="text-base font-bold mb-4">🔒 Cambiar contraseña</h2>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
              </motion.button>
            </div>

            {/* Tema */}
            <div className="bg-gray-900 rounded-2xl p-5">
              <h2 className="text-base font-bold mb-4">🎨 Apariencia</h2>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dark',   label: 'Oscuro',   emoji: '🌙' },
                  { id: 'light',  label: 'Claro',    emoji: '☀️' },
                  { id: 'system', label: 'Sistema',  emoji: '⚙️' },
                ].map(t => (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl text-sm font-medium transition-colors border-2 ${
                      theme === t.id
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <span>{t.label}</span>
                    {theme === t.id && (
                      <motion.div
                        layoutId="theme-check"
                        className="w-2 h-2 rounded-full bg-amber-400"
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Zona peligrosa */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-red-900">
              <h2 className="text-base font-bold text-red-400 mb-1">⚠️ Zona peligrosa</h2>
              <p className="text-gray-500 text-xs mb-4">
                Esta acción es irreversible. Se borrarán todos tus datos, consumiciones y puntos.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-transparent hover:bg-red-950 text-red-500 hover:text-red-400 font-semibold py-3 rounded-xl border border-red-900 transition-colors text-sm"
              >
                Eliminar cuenta 🗑️
              </motion.button>
            </div>

          </motion.div>
        )}
      </div>

      {/* Modal eliminar cuenta */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🗑️</div>
                <h2 className="text-xl font-bold text-white">¿Eliminar cuenta?</h2>
                <p className="text-gray-400 text-sm mt-2">
                  Se borrarán todos tus datos, consumiciones y puntos de forma permanente. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}