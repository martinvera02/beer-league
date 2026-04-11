import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    const [{ data: profileData }, { data: drinksData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('drinks').select('points, drink_types(name, emoji)').eq('user_id', user.id)
    ])

    setProfile(profileData)

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

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingAvatar(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Error al subir la imagen')
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    await supabase.from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    setProfile(prev => ({ ...prev, avatar_url: publicUrl }))
    setUploadingAvatar(false)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError('')
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      setError('Error al eliminar la cuenta: ' + error.message)
      setDeleting(false)
      setShowConfirm(false)
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

        <h1 className="text-2xl font-bold mb-6">Tu perfil 👤</h1>

        {/* Tarjeta de usuario con avatar */}
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
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 bg-amber-500 hover:bg-amber-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
            >
              {uploadingAvatar ? '⏳' : '📷'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <p className="text-xl font-bold">{profile?.username}</p>
          <p className="text-gray-500 text-sm">{user.email}</p>
          <p className="text-xs text-gray-600 mt-1">
            {uploadingAvatar ? 'Subiendo imagen...' : 'Toca 📷 para cambiar tu foto'}
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-900 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-400">{stats.count}</p>
                <p className="text-gray-400 text-sm mt-1">Consumiciones</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-400">{stats.total}</p>
                <p className="text-gray-400 text-sm mt-1">Puntos totales</p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 mb-6">
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

        {error && (
          <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2 mb-4">{error}</p>
        )}

        <button
          onClick={logout}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-2xl transition-colors mb-3"
        >
          Cerrar sesión 🚪
        </button>

        <button
          onClick={() => setShowConfirm(true)}
          className="w-full bg-transparent hover:bg-red-950 text-red-500 hover:text-red-400 font-semibold py-3 rounded-2xl border border-red-900 transition-colors"
        >
          Eliminar cuenta 🗑️
        </button>
      </div>

      {/* Modal confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-white mb-2">¿Eliminar cuenta?</h2>
            <p className="text-gray-400 text-sm mb-6">
              Se borrarán todos tus datos, consumiciones y puntos de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}