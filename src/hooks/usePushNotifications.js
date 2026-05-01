import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── CLAVE PÚBLICA VAPID ──────────────────────────────────────────────────────
// Añade esta clave también en tu .env como VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = 'BP2heFNgYLvIc9lPyqX-eZfvQtNNxfRgl8uTbyOmRq3AflGKSUAlTyl-q5vbRNKPWQ_ZtXhM72pldpE5sb0tIT0'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState(Notification.permission)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkSubscription()
  }, [user])

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !user) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch { /* silencioso */ }
  }

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Tu navegador no soporta notificaciones push')
      return false
    }
    setLoading(true)
    try {
      // Pedir permiso
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setLoading(false); return false }

      // Registrar service worker push
      const reg = await navigator.serviceWorker.ready

      // Suscribirse
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const subJson = sub.toJSON()

      // Guardar en Supabase
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      }, { onConflict: 'user_id,endpoint' })

      setSubscribed(true)
      setLoading(false)
      return true
    } catch (err) {
      console.error('Error suscribiendo a push:', err)
      setLoading(false)
      return false
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Error desuscribiendo:', err)
    }
    setLoading(false)
  }

  return { permission, subscribed, loading, subscribe, unsubscribe }
}