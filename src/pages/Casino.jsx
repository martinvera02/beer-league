import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { soundSuccess, soundError } from '../lib/sounds'

// ─── UTILIDADES DE PÓKER ───────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 }

const createDeck = () => {
  const deck = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank })
  return deck
}

const shuffleDeck = (deck) => {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

const HAND_RANKS = {
  'Royal Flush': 9, 'Straight Flush': 8, 'Four of a Kind': 7,
  'Full House': 6, 'Flush': 5, 'Straight': 4,
  'Three of a Kind': 3, 'Two Pair': 2, 'One Pair': 1, 'High Card': 0
}

const evaluateHand = (cards) => {
  if (!cards || cards.length < 5) return { name: 'High Card', rank: 0 }
  const allCombos = getCombinations(cards, 5)
  let best = { name: 'High Card', rank: 0, score: 0 }
  for (const combo of allCombos) {
    const result = evaluateFiveCards(combo)
    if (result.score > best.score) best = result
  }
  return best
}

const getCombinations = (arr, k) => {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = getCombinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

const evaluateFiveCards = (cards) => {
  const ranks = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])
  const rankCounts = {}
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1)
  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a)

  let isStraight = uniqueRanks.length === 5 &&
    uniqueRanks[0] - uniqueRanks[4] === 4
  // Straight especial A-2-3-4-5
  if (!isStraight && uniqueRanks.join(',') === '14,5,4,3,2') isStraight = true

  const baseScore = ranks.reduce((acc, r, i) => acc + r * Math.pow(15, 4 - i), 0)

  if (isFlush && isStraight && ranks[0] === 14 && ranks[1] === 13)
    return { name: 'Royal Flush', rank: 9, score: 9e12 + baseScore }
  if (isFlush && isStraight)
    return { name: 'Straight Flush', rank: 8, score: 8e12 + baseScore }
  if (counts[0] === 4)
    return { name: 'Four of a Kind', rank: 7, score: 7e12 + baseScore }
  if (counts[0] === 3 && counts[1] === 2)
    return { name: 'Full House', rank: 6, score: 6e12 + baseScore }
  if (isFlush)
    return { name: 'Flush', rank: 5, score: 5e12 + baseScore }
  if (isStraight)
    return { name: 'Straight', rank: 4, score: 4e12 + baseScore }
  if (counts[0] === 3)
    return { name: 'Three of a Kind', rank: 3, score: 3e12 + baseScore }
  if (counts[0] === 2 && counts[1] === 2)
    return { name: 'Two Pair', rank: 2, score: 2e12 + baseScore }
  if (counts[0] === 2)
    return { name: 'One Pair', rank: 1, score: 1e12 + baseScore }
  return { name: 'High Card', rank: 0, score: baseScore }
}

// ─── COMPONENTES DE CARTA ──────────────────────────────────────────────────

const suitColor = (suit) => suit === '♥' || suit === '♦' ? '#ef4444' : '#e5e7eb'

function Card({ card, hidden = false, small = false }) {
  const size = small
    ? { width: 36, height: 52, fontSize: 13, suitSize: 10 }
    : { width: 56, height: 80, fontSize: 18, suitSize: 14 }

  if (hidden) return (
    <motion.div
      initial={{ rotateY: 180 }}
      animate={{ rotateY: 0 }}
      style={{
        width: size.width, height: size.height, borderRadius: 8,
        background: 'linear-gradient(135deg, #1e3a5f, #0f2040)',
        border: '2px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
      <span style={{ fontSize: size.suitSize + 4, opacity: 0.3 }}>🂠</span>
    </motion.div>
  )

  if (!card) return null

  return (
    <motion.div
      initial={{ scale: 0, rotateY: 180 }}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        width: size.width, height: size.height, borderRadius: 8,
        backgroundColor: '#fff', border: '2px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        position: 'relative',
      }}>
      <span style={{ fontSize: size.fontSize, fontWeight: 'bold', color: suitColor(card.suit), lineHeight: 1 }}>
        {card.rank}
      </span>
      <span style={{ fontSize: size.suitSize, color: suitColor(card.suit), lineHeight: 1 }}>
        {card.suit}
      </span>
      {/* Esquinas */}
      <span style={{
        position: 'absolute', top: 2, left: 4,
        fontSize: size.suitSize - 2, color: suitColor(card.suit), fontWeight: 'bold', lineHeight: 1
      }}>{card.rank}</span>
      <span style={{
        position: 'absolute', bottom: 2, right: 4,
        fontSize: size.suitSize - 2, color: suitColor(card.suit), fontWeight: 'bold', lineHeight: 1,
        transform: 'rotate(180deg)'
      }}>{card.rank}</span>
    </motion.div>
  )
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export default function Casino() {
  const { user } = useAuth()
  const [view, setView] = useState('lobby') // lobby | room
  const [rooms, setRooms] = useState([])
  const [myBalance, setMyBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  // Crear / unirse
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [buyIn, setBuyIn] = useState(100)
  const [joinCode, setJoinCode] = useState('')
  const [joinBuyIn, setJoinBuyIn] = useState(100)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Sala activa
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [actions, setActions] = useState([])
  const [myPlayer, setMyPlayer] = useState(null)
  const [raiseAmount, setRaiseAmount] = useState(0)
  const [showRaise, setShowRaise] = useState(false)
  const [winner, setWinner] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const timerRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    fetchLobby()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!room) return
    const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin')
    const currentPlayer = activePlayers[room.current_player_index % Math.max(activePlayers.length, 1)]
    const isMine = currentPlayer?.user_id === user.id && room.status === 'playing'
    setIsMyTurn(isMine)
    setRaiseAmount(room.current_bet * 2 || 10)
  }, [room, players, user.id])

  // Timer por turno
  useEffect(() => {
    clearInterval(timerRef.current)
    if (!isMyTurn || !room?.turn_started_at) return
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - new Date(room.turn_started_at).getTime()) / 1000)
      const left = Math.max(0, 30 - elapsed)
      setTimeLeft(left)
      if (left === 0) handleAction('fold')
    }
    updateTimer()
    timerRef.current = setInterval(updateTimer, 1000)
    return () => clearInterval(timerRef.current)
  }, [isMyTurn, room?.turn_started_at])

  const fetchLobby = async () => {
    setLoading(true)
    const [{ data: roomsData }, { data: walletData }] = await Promise.all([
      supabase.from('poker_rooms').select('*, poker_players(count)')
        .in('status', ['waiting', 'playing']).order('created_at', { ascending: false }).limit(10),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
    ])
    setRooms(roomsData || [])
    setMyBalance(walletData?.balance || 0)
    setLoading(false)
  }

  const subscribeToRoom = useCallback((roomId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase.channel(`poker:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new)
          if (payload.new.status === 'finished') {
            fetchRoomData(roomId)
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_players', filter: `room_id=eq.${roomId}` },
        () => fetchRoomData(roomId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poker_actions', filter: `room_id=eq.${roomId}` },
        (payload) => setActions(prev => [...prev, payload.new]))
      .subscribe()

    channelRef.current = channel
  }, [])

  const fetchRoomData = async (roomId) => {
    const [{ data: roomData }, { data: playersData }, { data: actionsData }] = await Promise.all([
      supabase.from('poker_rooms').select('*').eq('id', roomId).single(),
      supabase.from('poker_players').select('*').eq('room_id', roomId).order('seat'),
      supabase.from('poker_actions').select('*').eq('room_id', roomId)
        .order('created_at', { ascending: false }).limit(20),
    ])
    if (roomData) setRoom(roomData)
    if (playersData) {
      setPlayers(playersData)
      const me = playersData.find(p => p.user_id === user.id)
      setMyPlayer(me || null)
    }
    if (actionsData) setActions(actionsData.reverse())
  }

  const handleCreateRoom = async () => {
    setActionLoading(true)
    setActionError('')
    const { data } = await supabase.rpc('create_poker_room', { p_chips: buyIn })
    if (data?.success) {
      setMyBalance(prev => prev - buyIn)
      setShowCreate(false)
      await fetchRoomData(data.room_id)
      subscribeToRoom(data.room_id)
      setView('room')
    } else {
      setActionError(data?.error || 'Error al crear la sala')
    }
    setActionLoading(false)
  }

  const handleJoinRoom = async () => {
    setActionLoading(true)
    setActionError('')
    const { data } = await supabase.rpc('join_poker_room', {
      p_code: joinCode.trim().toUpperCase(),
      p_chips: joinBuyIn,
    })
    if (data?.success) {
      setMyBalance(prev => prev - joinBuyIn)
      setShowJoin(false)
      await fetchRoomData(data.room_id)
      subscribeToRoom(data.room_id)
      setView('room')
    } else {
      setActionError(data?.error || 'Error al unirse')
    }
    setActionLoading(false)
  }

  const handleStartGame = async () => {
    if (!room || players.length < 2) return
    // Crear y mezclar baraja
    const deck = shuffleDeck(createDeck())
    const updatedPlayers = [...players]

    // Repartir 2 cartas a cada jugador
    let deckIndex = 0
    for (const player of updatedPlayers) {
      const holeCards = [deck[deckIndex++], deck[deckIndex++]]
      await supabase.from('poker_players').update({
        hole_cards: holeCards,
        status: 'active',
        bet: 0,
      }).eq('id', player.id)
    }

    // Blinds: small blind = seat 0, big blind = seat 1
    const smallBlind = 10
    const bigBlind = 20

    await supabase.from('poker_players').update({ bet: smallBlind, chips: updatedPlayers[0].chips - smallBlind })
      .eq('id', updatedPlayers[0].id)
    await supabase.from('poker_players').update({ bet: bigBlind, chips: updatedPlayers[1].chips - bigBlind })
      .eq('id', updatedPlayers[1].id)

    // Guardar baraja restante y actualizar sala
    await supabase.from('poker_rooms').update({
      status: 'playing',
      deck: deck.slice(deckIndex),
      community_cards: [],
      pot: smallBlind + bigBlind,
      current_bet: bigBlind,
      current_player_index: players.length > 2 ? 2 : 0,
      current_round: 'preflop',
      turn_started_at: new Date().toISOString(),
    }).eq('id', room.id)

    // Log blinds
    await supabase.from('poker_actions').insert([
      { room_id: room.id, user_id: updatedPlayers[0].user_id, username: updatedPlayers[0].username, action: 'small_blind', amount: smallBlind, round: 'preflop' },
      { room_id: room.id, user_id: updatedPlayers[1].user_id, username: updatedPlayers[1].username, action: 'big_blind', amount: bigBlind, round: 'preflop' },
    ])

    await fetchRoomData(room.id)
  }

  const handleAction = async (action, amount = 0) => {
    if (!room || !myPlayer) return
    const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin')

    let chipsDelta = 0
    let newStatus = myPlayer.status
    let newBet = myPlayer.bet
    let potDelta = 0

    switch (action) {
      case 'fold':
        newStatus = 'folded'
        break
      case 'check':
        break
      case 'call':
        chipsDelta = -(room.current_bet - myPlayer.bet)
        potDelta = room.current_bet - myPlayer.bet
        newBet = room.current_bet
        break
      case 'raise':
        chipsDelta = -(amount - myPlayer.bet)
        potDelta = amount - myPlayer.bet
        newBet = amount
        break
      case 'allin':
        chipsDelta = -myPlayer.chips
        potDelta = myPlayer.chips
        newBet = myPlayer.bet + myPlayer.chips
        newStatus = 'allin'
        break
    }

    // Actualizar jugador
    await supabase.from('poker_players').update({
      status: newStatus,
      bet: newBet,
      chips: myPlayer.chips + chipsDelta,
      total_bet: myPlayer.total_bet + potDelta,
    }).eq('id', myPlayer.id)

    // Log acción
    await supabase.from('poker_actions').insert({
      room_id: room.id,
      user_id: user.id,
      username: myPlayer.username,
      action,
      amount: action === 'raise' ? amount : Math.abs(chipsDelta),
      round: room.current_round,
    })

    // Calcular siguiente turno
    const nextPlayerIndex = getNextPlayerIndex(activePlayers, room.current_player_index)
    const allActed = checkAllActed(activePlayers, room.current_bet, action, newBet)

    const newPot = room.pot + potDelta
    const newCurrentBet = action === 'raise' ? amount : room.current_bet

    if (action !== 'fold') {
      const remainingActive = activePlayers.filter(p => p.user_id !== user.id && p.status === 'active')
      if (remainingActive.length === 0) {
        await advanceToShowdown(newPot)
        return
      }
    }

    if (allActed || action === 'raise') {
      // Avanzar ronda si todos han actuado (salvo raise)
      if (allActed && action !== 'raise') {
        await advanceRound(newPot, newCurrentBet)
        return
      }
    }

    await supabase.from('poker_rooms').update({
      pot: newPot,
      current_bet: newCurrentBet,
      current_player_index: nextPlayerIndex,
      turn_started_at: new Date().toISOString(),
    }).eq('id', room.id)

    setShowRaise(false)
    await fetchRoomData(room.id)
  }

  const getNextPlayerIndex = (activePlayers, currentIndex) => {
    const active = activePlayers.filter(p => p.status === 'active')
    if (active.length === 0) return currentIndex
    const currentInActive = currentIndex % active.length
    return (currentInActive + 1) % active.length
  }

  const checkAllActed = (activePlayers, currentBet, action, newBet) => {
    if (action === 'raise') return false
    const active = activePlayers.filter(p => p.status === 'active')
    return active.every(p => p.bet >= currentBet || p.user_id === user.id)
  }

  const advanceRound = async (pot, currentBet) => {
    const rounds = ['preflop', 'flop', 'turn', 'river', 'showdown']
    const currentRoundIndex = rounds.indexOf(room.current_round)
    const nextRound = rounds[currentRoundIndex + 1]

    if (nextRound === 'showdown') {
      await advanceToShowdown(pot)
      return
    }

    // Revelar cartas comunitarias
    let newCommunity = [...(room.community_cards || [])]
    let newDeck = [...(room.deck || [])]
    const cardsToReveal = nextRound === 'flop' ? 3 : 1

    for (let i = 0; i < cardsToReveal; i++) {
      newCommunity.push(newDeck.shift())
    }

    // Reset bets de jugadores
    await supabase.from('poker_players').update({ bet: 0 })
      .eq('room_id', room.id).neq('status', 'folded')

    await supabase.from('poker_rooms').update({
      current_round: nextRound,
      community_cards: newCommunity,
      deck: newDeck,
      current_bet: 0,
      current_player_index: 0,
      turn_started_at: new Date().toISOString(),
    }).eq('id', room.id)

    await fetchRoomData(room.id)
  }

  const advanceToShowdown = async (pot) => {
    // Evaluar manos
    const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin')
    const community = room.community_cards || []

    let bestScore = -1
    let winnerId = null
    let winnerUsername = ''
    let winnerHand = ''

    for (const player of activePlayers) {
      const allCards = [...(player.hole_cards || []), ...community]
      const hand = evaluateHand(allCards)
      if (hand.score > bestScore) {
        bestScore = hand.score
        winnerId = player.user_id
        winnerUsername = player.username
        winnerHand = hand.name
      }
    }

    // Dar el bote al ganador
    if (winnerId) {
      await supabase.from('poker_players').update({
        chips: supabase.rpc('increment', { x: pot }),
      }).eq('room_id', room.id).eq('user_id', winnerId)

      // Actualizar monedero real del ganador
      const winnerPlayer = players.find(p => p.user_id === winnerId)
      if (winnerPlayer) {
        const totalChips = winnerPlayer.chips + pot
        await supabase.from('wallets').update({
          balance: supabase.rpc('increment', { x: totalChips }),
        }).eq('user_id', winnerId)
      }
    }

    await supabase.from('poker_rooms').update({
      status: 'finished',
      current_round: 'showdown',
      winner_id: winnerId,
    }).eq('id', room.id)

    setWinner({ id: winnerId, username: winnerUsername, hand: winnerHand, pot })
    await fetchRoomData(room.id)
  }

  const leaveRoom = async () => {
    if (!room || !myPlayer) return
    // Si la partida no ha empezado, devolver fichas
    if (room.status === 'waiting') {
      await supabase.from('wallets').update({
        balance: myBalance + myPlayer.chips,
      }).eq('user_id', user.id)
      await supabase.from('poker_players').delete()
        .eq('room_id', room.id).eq('user_id', user.id)
      await fetchLobby()
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    setRoom(null)
    setPlayers([])
    setMyPlayer(null)
    setWinner(null)
    setView('lobby')
    fetchLobby()
  }

  const collectChips = async () => {
    if (!myPlayer || room?.status !== 'finished') return
    await supabase.from('wallets').update({
      balance: myBalance + myPlayer.chips
    }).eq('user_id', user.id)
    setMyBalance(prev => prev + myPlayer.chips)
    await supabase.from('poker_players').update({ chips: 0 }).eq('id', myPlayer.id)
    leaveRoom()
  }

  const formatAction = (a) => {
    switch (a.action) {
      case 'fold': return `${a.username} se retira`
      case 'check': return `${a.username} pasa`
      case 'call': return `${a.username} iguala ${a.amount}🪙`
      case 'raise': return `${a.username} sube a ${a.amount}🪙`
      case 'allin': return `${a.username} va ALL IN 💥`
      case 'small_blind': return `${a.username} paga small blind ${a.amount}🪙`
      case 'big_blind': return `${a.username} paga big blind ${a.amount}🪙`
      default: return `${a.username}: ${a.action}`
    }
  }

  const roundLabel = { preflop: 'Pre-Flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' }

  // ─── LOBBY ────────────────────────────────────────────────────────────────

  if (view === 'lobby') return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Casino 🃏</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Texas Hold'em · Apuesta tus 🪙
          </p>
        </div>

        {/* Balance */}
        <motion.div className="rounded-2xl p-5 mb-6 text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tu saldo</p>
          <p className="text-4xl font-bold text-amber-400">{myBalance.toLocaleString()}🪙</p>
        </motion.div>

        {/* Botones acción */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowCreate(true); setActionError('') }}
            className="rounded-2xl p-4 font-bold text-white text-center"
            style={{ backgroundColor: '#7c3aed' }}>
            <div className="text-2xl mb-1">🎰</div>
            Crear sala
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowJoin(true); setActionError('') }}
            className="rounded-2xl p-4 font-bold text-center"
            style={{ backgroundColor: 'var(--bg-card)', color: '#7c3aed', border: '2px solid #7c3aed' }}>
            <div className="text-2xl mb-1">🔑</div>
            Unirse
          </motion.button>
        </div>

        {/* Reglas rápidas */}
        <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-sm font-bold mb-3">📋 Cómo jugar</p>
          <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <p>🃏 Cada jugador recibe 2 cartas privadas</p>
            <p>🎴 Se revelan 5 cartas comunitarias por fases</p>
            <p>💰 Apuesta, iguala, sube o retírate en cada turno</p>
            <p>⏱ Tienes 30 segundos por turno o fold automático</p>
            <p>🏆 Gana quien tenga la mejor mano de 5 cartas</p>
            <p>💸 El ganador se lleva todo el bote</p>
          </div>
        </div>

        {/* Salas activas */}
        <p className="text-sm font-bold mb-3">Salas activas</p>
        {loading ? (
          <p className="text-center py-6" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
        ) : rooms.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-2">🃏</div>
            <p className="text-sm">No hay salas activas</p>
            <p className="text-xs mt-1">¡Crea una y espera a tus amigos!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(r => (
              <motion.div key={r.id} className="rounded-2xl p-4 flex items-center justify-between"
                style={{ backgroundColor: 'var(--bg-card)' }}>
                <div>
                  <p className="font-bold text-sm font-mono text-purple-400">{r.code}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                    {r.poker_players?.[0]?.count || 0}/{r.max_players} jugadores
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === 'waiting' ? 'bg-green-900 text-green-400' : 'bg-amber-900 text-amber-400'}`}>
                  {r.status === 'waiting' ? 'Esperando' : 'En juego'}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear sala */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🎰</div>
                <h2 className="text-xl font-bold">Nueva sala</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Elige cuántas fichas llevas a la mesa
                </p>
              </div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Buy-in · tienes {myBalance}🪙
              </p>
              <input type="range" min="50" max={Math.min(myBalance, 2000)} step="50"
                value={buyIn} onChange={e => setBuyIn(Number(e.target.value))}
                className="w-full accent-purple-500 mb-2" />
              <div className="flex gap-2 mb-4">
                {[50, 100, 250, 500].map(v => (
                  <motion.button key={v} whileTap={{ scale: 0.9 }}
                    onClick={() => setBuyIn(Math.min(v, myBalance))}
                    className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                    style={{
                      backgroundColor: buyIn === v ? '#7c3aed' : 'var(--bg-input)',
                      color: buyIn === v ? '#fff' : 'var(--text-muted)',
                    }}>{v}</motion.button>
                ))}
              </div>
              <div className="rounded-xl p-3 mb-4 text-center"
                style={{ backgroundColor: 'var(--bg-base)' }}>
                <p className="text-2xl font-bold text-purple-400">{buyIn}🪙</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>en la mesa</p>
              </div>
              {actionError && <p className="text-red-400 text-xs text-center mb-3">⚠️ {actionError}</p>}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateRoom}
                  disabled={actionLoading || buyIn > myBalance}
                  className="flex-1 py-3 rounded-xl font-bold text-white"
                  style={{ backgroundColor: '#7c3aed' }}>
                  {actionLoading ? '...' : 'Crear'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal unirse */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowJoin(false)}>
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🔑</div>
                <h2 className="text-xl font-bold">Unirse a sala</h2>
              </div>
              <input type="text" value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setActionError('') }}
                placeholder="PKR-XXXX"
                className="w-full rounded-xl px-4 py-3 text-center font-bold tracking-widest text-lg outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                maxLength={8} />
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Buy-in · tienes {myBalance}🪙
              </p>
              <input type="range" min="50" max={Math.min(myBalance, 2000)} step="50"
                value={joinBuyIn} onChange={e => setJoinBuyIn(Number(e.target.value))}
                className="w-full accent-purple-500 mb-2" />
              <div className="flex gap-2 mb-4">
                {[50, 100, 250, 500].map(v => (
                  <motion.button key={v} whileTap={{ scale: 0.9 }}
                    onClick={() => setJoinBuyIn(Math.min(v, myBalance))}
                    className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                    style={{
                      backgroundColor: joinBuyIn === v ? '#7c3aed' : 'var(--bg-input)',
                      color: joinBuyIn === v ? '#fff' : 'var(--text-muted)',
                    }}>{v}</motion.button>
                ))}
              </div>
              {actionError && <p className="text-red-400 text-xs text-center mb-3">⚠️ {actionError}</p>}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowJoin(false)}
                  className="flex-1 py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleJoinRoom}
                  disabled={actionLoading || !joinCode.trim() || joinBuyIn > myBalance}
                  className="flex-1 py-3 rounded-xl font-bold text-white"
                  style={{ backgroundColor: '#7c3aed' }}>
                  {actionLoading ? '...' : 'Entrar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  // ─── MESA DE JUEGO ────────────────────────────────────────────────────────

  const activePlayers = players.filter(p => p.status !== 'out')
  const foldedPlayers = players.filter(p => p.status === 'folded')
  const otherPlayers = players.filter(p => p.user_id !== user.id)
  const canCheck = myPlayer && room && myPlayer.bet >= room.current_bet
  const callAmount = room ? room.current_bet - (myPlayer?.bet || 0) : 0

  return (
    <div className="flex flex-col min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: '#0a1628', color: '#fff' }}>

      {/* Header sala */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div>
          <p className="font-mono text-purple-400 font-bold text-sm">{room?.code}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {room?.status === 'waiting' ? 'Esperando jugadores...' : roundLabel[room?.current_round] || ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {room?.status === 'waiting' && room?.created_by === user.id && players.length >= 2 && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleStartGame}
              className="px-4 py-2 rounded-xl font-bold text-sm text-white"
              style={{ backgroundColor: '#10b981' }}>
              ▶ Iniciar
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={leaveRoom}
            className="px-3 py-2 rounded-xl text-xs font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            Salir
          </motion.button>
        </div>
      </div>

      {/* Código para compartir */}
      {room?.status === 'waiting' && (
        <div className="mx-4 mb-3 rounded-2xl p-3 text-center"
          style={{ backgroundColor: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)' }}>
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Comparte este código</p>
          <p className="text-xl font-bold font-mono text-purple-400">{room?.code}</p>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => navigator.clipboard.writeText(room?.code)}
            className="text-xs mt-1 px-3 py-1 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
            Copiar
          </motion.button>
        </div>
      )}

      {/* Mesa */}
      <div className="flex-1 flex flex-col items-center px-4">

        {/* Jugadores contrarios (arriba) */}
        <div className="flex gap-3 justify-center mb-4 flex-wrap">
          {otherPlayers.map((player, idx) => {
            const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin')
            const currentTurnPlayer = activePlayers[room?.current_player_index % Math.max(activePlayers.length, 1)]
            const isCurrentTurn = currentTurnPlayer?.user_id === player.user_id && room?.status === 'playing'

            return (
              <motion.div key={player.id}
                animate={isCurrentTurn ? { boxShadow: ['0 0 0 2px #7c3aed', '0 0 20px 4px #7c3aed', '0 0 0 2px #7c3aed'] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="rounded-2xl p-3 text-center min-w-24"
                style={{
                  backgroundColor: player.status === 'folded' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                  border: isCurrentTurn ? '2px solid #7c3aed' : '2px solid rgba(255,255,255,0.1)',
                  opacity: player.status === 'folded' ? 0.5 : 1,
                }}>
                <div className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  {player.avatar_url
                    ? <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                    : <span className="text-lg">🍺</span>}
                </div>
                <p className="text-xs font-bold truncate" style={{ maxWidth: 80 }}>{player.username}</p>
                <p className="text-xs mt-0.5 text-amber-400">{player.chips}🪙</p>
                {player.bet > 0 && (
                  <p className="text-xs mt-0.5 text-purple-400">apuesta: {player.bet}🪙</p>
                )}
                {player.status === 'folded' && <p className="text-xs text-red-400 mt-0.5">FOLD</p>}
                {player.status === 'allin' && <p className="text-xs text-yellow-400 mt-0.5">ALL IN</p>}
                {/* Cartas ocultas si la partida está activa */}
                {room?.status === 'playing' && player.status !== 'folded' && (
                  <div className="flex gap-1 justify-center mt-2">
                    {room.current_round === 'showdown'
                      ? (player.hole_cards || []).map((card, i) => <Card key={i} card={card} small />)
                      : [0, 1].map(i => <Card key={i} hidden small />)
                    }
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Mesa verde central */}
        <div className="w-full rounded-3xl p-4 mb-4"
          style={{
            background: 'radial-gradient(ellipse at center, #166534, #14532d)',
            border: '3px solid #15803d',
            boxShadow: '0 0 40px rgba(20,83,45,0.5), inset 0 0 30px rgba(0,0,0,0.3)',
            minHeight: 160,
          }}>

          {/* Bote */}
          <div className="text-center mb-3">
            <motion.p key={room?.pot} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
              className="text-2xl font-bold text-amber-400">
              🪙 {room?.pot || 0}
            </motion.p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Bote</p>
          </div>

          {/* Cartas comunitarias */}
          <div className="flex gap-2 justify-center flex-wrap">
            {room?.status === 'waiting' && (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {players.length < 2
                  ? `Esperando jugadores... (${players.length}/2 mínimo)`
                  : `${players.length} jugadores listos · El creador puede iniciar`}
              </p>
            )}
            {(room?.community_cards || []).map((card, i) => (
              <Card key={i} card={card} />
            ))}
            {room?.status === 'playing' && (room?.community_cards || []).length === 0 && (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Pre-Flop</p>
            )}
          </div>

          {/* Ronda actual */}
          {room?.status === 'playing' && (
            <p className="text-center text-xs mt-3 font-bold text-emerald-400">
              — {roundLabel[room?.current_round]} —
            </p>
          )}
        </div>

        {/* Mi jugador (abajo) */}
        {myPlayer && (
          <div className="w-full">
            {/* Mis cartas */}
            <div className="flex justify-center gap-3 mb-3">
              {room?.status === 'playing' && myPlayer.status !== 'folded' && (
                (myPlayer.hole_cards || []).map((card, i) => <Card key={i} card={card} />)
              )}
              {myPlayer.status === 'folded' && (
                <p className="text-red-400 font-bold py-4">FOLD — Esperando siguiente mano</p>
              )}
            </div>

            {/* Info del jugador */}
            <div className="rounded-2xl p-3 mb-3 flex items-center justify-between"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  {myPlayer.avatar_url
                    ? <img src={myPlayer.avatar_url} alt={myPlayer.username} className="w-full h-full object-cover" />
                    : <span className="text-lg flex items-center justify-center h-full">🍺</span>}
                </div>
                <div>
                  <p className="text-sm font-bold">{myPlayer.username} (tú)</p>
                  {myPlayer.is_dealer && <p className="text-xs text-amber-400">🃏 Dealer</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-amber-400">{myPlayer.chips}🪙</p>
                {myPlayer.bet > 0 && <p className="text-xs text-purple-400">apuesta: {myPlayer.bet}🪙</p>}
              </div>
            </div>

            {/* Timer + Acciones */}
            {isMyTurn && myPlayer.status === 'active' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Timer */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-purple-400 font-bold">Tu turno</p>
                    <p className={`text-xs font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                      {timeLeft}s
                    </p>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <motion.div className="h-2 rounded-full"
                      style={{
                        width: `${(timeLeft / 30) * 100}%`,
                        backgroundColor: timeLeft <= 10 ? '#ef4444' : '#7c3aed',
                        transition: 'width 1s linear, background-color 0.3s',
                      }} />
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2 flex-wrap">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAction('fold')}
                    className="flex-1 py-3 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}>
                    Fold
                  </motion.button>

                  {canCheck ? (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAction('check')}
                      className="flex-1 py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                      Check
                    </motion.button>
                  ) : (
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => handleAction('call')}
                      disabled={callAmount > myPlayer.chips}
                      className="flex-1 py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }}>
                      Call {callAmount}🪙
                    </motion.button>
                  )}

                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setShowRaise(!showRaise)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: 'rgba(124,58,237,0.3)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.5)' }}>
                    Raise
                  </motion.button>

                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAction('allin')}
                    className="flex-1 py-3 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
                    All In 💥
                  </motion.button>
                </div>

                {/* Raise slider */}
                <AnimatePresence>
                  {showRaise && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 rounded-xl p-3"
                      style={{ backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-purple-400">Subir a</p>
                        <p className="text-sm font-bold text-purple-400">{raiseAmount}🪙</p>
                      </div>
                      <input type="range"
                        min={room.current_bet * 2 || 20}
                        max={myPlayer.chips + myPlayer.bet}
                        step={10}
                        value={raiseAmount}
                        onChange={e => setRaiseAmount(Number(e.target.value))}
                        className="w-full accent-purple-500 mb-2" />
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleAction('raise', raiseAmount)}
                        className="w-full py-2 rounded-xl font-bold text-sm text-white"
                        style={{ backgroundColor: '#7c3aed' }}>
                        Subir a {raiseAmount}🪙
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* No es mi turno */}
            {!isMyTurn && room?.status === 'playing' && myPlayer.status === 'active' && (
              <div className="text-center py-2">
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Esperando tu turno...</p>
                </motion.div>
              </div>
            )}

            {/* Fin de partida */}
            {room?.status === 'finished' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl p-5 text-center mt-3"
                style={{ backgroundColor: 'rgba(124,58,237,0.2)', border: '2px solid #7c3aed' }}>
                {winner && (
                  <>
                    <div className="text-5xl mb-2">🏆</div>
                    <p className="text-xl font-bold text-amber-400">{winner.username} gana</p>
                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {winner.hand} · {winner.pot}🪙
                    </p>
                  </>
                )}
                {myPlayer.chips > 0 && (
                  <p className="text-sm mt-2 text-emerald-400">Tus fichas: {myPlayer.chips}🪙</p>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={collectChips}
                  className="mt-4 w-full py-3 rounded-xl font-bold text-white"
                  style={{ backgroundColor: myPlayer.chips > 0 ? '#10b981' : '#7c3aed' }}>
                  {myPlayer.chips > 0 ? `Recoger ${myPlayer.chips}🪙` : 'Salir'}
                </motion.button>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Log de acciones */}
      {actions.length > 0 && (
        <div className="mx-4 mt-3 rounded-2xl p-3 max-h-24 overflow-y-auto"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[...actions].reverse().slice(0, 8).map((a, i) => (
            <p key={a.id || i} className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {formatAction(a)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}