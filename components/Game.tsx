'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

const CW = 360
const CH = 600
const ITEM_R = 32
const SPEED_BASE = 2.2
const SPAWN_INTERVAL = 900 // ms

const GOOD = ['🍎','🍊','🍋','🍇','🍓','🍑','🍒','🫐','🍉','❤️','🧡','💛','💚','💙','💜','🤍']
const BAD  = ['💣','☠️','🐛']

type Item = {
  id: number
  x: number
  y: number
  vy: number
  emoji: string
  bad: boolean
  popping: boolean
  popAlpha: number
  popScale: number
}

let uid = 0

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const items = useRef<Item[]>([])
  const score = useRef(0)
  const lives = useRef(3)
  const speed = useRef(1)
  const running = useRef(false)
  const frameRef = useRef<number | null>(null)
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const screenShake = useRef(0)
  const bgFlash = useRef<{ color: string; alpha: number } | null>(null)

  const [displayScore, setDisplayScore] = useState(0)
  const [displayLives, setDisplayLives] = useState(3)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'dead'>('idle')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    ctx.save()
    if (screenShake.current > 0) {
      const s = screenShake.current * 3
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
      screenShake.current -= 1
    }

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, CH)
    bg.addColorStop(0, '#0f0c29')
    bg.addColorStop(1, '#302b63')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, CW, CH)

    // Flash effect
    if (bgFlash.current && bgFlash.current.alpha > 0) {
      ctx.fillStyle = bgFlash.current.color.replace('1)', `${bgFlash.current.alpha})`)
      ctx.fillRect(0, 0, CW, CH)
      bgFlash.current.alpha -= 0.06
    }

    // Ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(0, CH - 20)
    ctx.lineTo(CW, CH - 20)
    ctx.stroke()
    ctx.setLineDash([])

    // Items
    for (const item of items.current) {
      ctx.save()
      const cx = item.x
      const cy = item.y

      if (item.popping) {
        // Pop animation
        ctx.globalAlpha = item.popAlpha
        ctx.font = `${ITEM_R * 2 * item.popScale}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.emoji, cx, cy)
        item.popAlpha -= 0.05
        item.popScale += 0.08
      } else {
        // Shadow
        ctx.globalAlpha = 0.25
        ctx.filter = 'blur(6px)'
        ctx.font = `${ITEM_R * 2}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.emoji, cx + 4, cy + 6)
        ctx.filter = 'none'
        ctx.globalAlpha = 1

        // Slight bobbing scale
        const wobble = 1 + Math.sin(Date.now() / 200 + item.id) * 0.04
        ctx.font = `${ITEM_R * 2 * wobble}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.emoji, cx, cy)

        // Danger glow for bad items
        if (item.bad) {
          ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 150) * 0.2
          ctx.fillStyle = 'rgba(255,50,50,0.4)'
          ctx.beginPath()
          ctx.arc(cx, cy, ITEM_R + 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
      ctx.restore()
    }

    ctx.restore()
  }, [])

  const spawnItem = useCallback(() => {
    if (!running.current) return
    const bad = Math.random() < 0.18
    const list = bad ? BAD : GOOD
    const emoji = list[Math.floor(Math.random() * list.length)]
    const margin = ITEM_R + 10
    const x = margin + Math.random() * (CW - margin * 2)
    items.current.push({
      id: uid++,
      x,
      y: -ITEM_R,
      vy: SPEED_BASE * speed.current,
      emoji,
      bad,
      popping: false,
      popAlpha: 1,
      popScale: 1,
    })

    const interval = Math.max(350, SPAWN_INTERVAL - score.current * 8)
    spawnTimer.current = setTimeout(spawnItem, interval)
  }, [])

  const gameLoop = useCallback(() => {
    if (!running.current) return

    for (const item of items.current) {
      if (!item.popping) item.y += item.vy * speed.current
    }

    // Check missed / ground hit
    for (const item of items.current) {
      if (!item.popping && item.y > CH - 20 + ITEM_R) {
        if (!item.bad) {
          // Missed good item → lose life
          item.popping = true
          lives.current = Math.max(0, lives.current - 1)
          setDisplayLives(lives.current)
          screenShake.current = 6
          bgFlash.current = { color: 'rgba(255,0,0,1)', alpha: 0.3 }
          if (lives.current <= 0) {
            running.current = false
            if (spawnTimer.current) clearTimeout(spawnTimer.current)
            draw()
            setTimeout(() => setPhase('dead'), 600)
            if (frameRef.current) cancelAnimationFrame(frameRef.current)
            return
          }
        } else {
          item.popping = true
        }
      }
    }

    // Remove finished pops and off-screen
    items.current = items.current.filter(i =>
      !(i.popping && i.popAlpha <= 0) && i.y < CH + 100
    )

    draw()
    frameRef.current = requestAnimationFrame(gameLoop)
  }, [draw])

  const startGame = useCallback(() => {
    items.current = []
    score.current = 0
    lives.current = 3
    speed.current = 1
    screenShake.current = 0
    bgFlash.current = null
    uid = 0
    setDisplayScore(0)
    setDisplayLives(3)
    setPhase('playing')
    running.current = true
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    spawnTimer.current = setTimeout(spawnItem, 300)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, spawnItem])

  const tap = useCallback((clientX: number, clientY: number) => {
    if (!running.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CW / rect.width
    const scaleY = CH / rect.height
    const tx = (clientX - rect.left) * scaleX
    const ty = (clientY - rect.top) * scaleY

    // Find closest tappable item
    let hit: Item | null = null
    let minDist = ITEM_R * 2.2
    for (const item of items.current) {
      if (item.popping) continue
      const d = Math.hypot(item.x - tx, item.y - ty)
      if (d < minDist) { minDist = d; hit = item }
    }

    if (hit) {
      hit.popping = true
      if (hit.bad) {
        // Hit bomb → lose life
        lives.current = Math.max(0, lives.current - 1)
        setDisplayLives(lives.current)
        screenShake.current = 8
        bgFlash.current = { color: 'rgba(255,50,0,1)', alpha: 0.45 }
        if (lives.current <= 0) {
          running.current = false
          if (spawnTimer.current) clearTimeout(spawnTimer.current)
          setTimeout(() => setPhase('dead'), 600)
          if (frameRef.current) cancelAnimationFrame(frameRef.current)
        }
      } else {
        // Caught good item
        score.current++
        speed.current = 1 + Math.floor(score.current / 10) * 0.25
        setDisplayScore(score.current)
        setBest(b => {
          const nb = Math.max(b, score.current)
          localStorage.setItem('catch-best', String(nb))
          return nb
        })
        bgFlash.current = { color: 'rgba(255,255,255,1)', alpha: 0.08 }
      }
    }
  }, [])

  useEffect(() => {
    setBest(parseInt(localStorage.getItem('catch-best') || '0'))
    draw()
  }, [draw])

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
  }, [])

  const heartDisplay = (n: number) =>
    Array.from({ length: 3 }, (_, i) => (
      <span key={i} style={{ fontSize: '1.4rem', opacity: i < n ? 1 : 0.15 }}>❤️</span>
    ))

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0814',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      fontFamily: 'system-ui, sans-serif',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', width: CW, maxWidth: '95vw', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>최고</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#eee' }}>{best}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>{heartDisplay(displayLives)}</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>점수</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#eee' }}>{displayScore}</div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', lineHeight: 0 }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ display: 'block', borderRadius: 20, touchAction: 'none', maxWidth: '95vw' }}
          onPointerDown={e => {
            e.preventDefault()
            if (phase === 'idle' || phase === 'dead') { startGame(); return }
            tap(e.clientX, e.clientY)
          }}
        />

        {(phase === 'idle' || phase === 'dead') && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 20,
            background: 'rgba(5,3,20,0.88)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            backdropFilter: 'blur(10px)',
          }}>
            {phase === 'dead' ? (
              <>
                <div style={{ fontSize: '3rem' }}>😵</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ff4444' }}>게임 오버</div>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{displayScore}</div>
                <div style={{ color: '#555', fontSize: '0.85rem' }}>최고기록 {best}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.5rem' }}>🍎❤️🍊</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>캐치!</div>
                <div style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.9 }}>
                  떨어지는 걸 탭해서 잡으세요<br/>
                  <span style={{ color: '#ff6b6b' }}>💣 폭탄</span>은 피하세요!<br/>
                  놓치면 ❤️ 하나 잃어요
                </div>
              </>
            )}
            <button
              onPointerDown={e => { e.stopPropagation(); startGame() }}
              style={{
                background: 'linear-gradient(135deg,#a855f7,#ec4899)',
                color: '#fff', border: 'none', borderRadius: 50,
                padding: '14px 44px', fontSize: '1.05rem', fontWeight: 800,
                cursor: 'pointer', marginTop: 6,
                boxShadow: '0 4px 20px rgba(168,85,247,0.4)',
              }}>
              {phase === 'dead' ? '다시 시작' : '시작하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
