'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

const COLS = 20
const ROWS = 20
const CELL = 24
const W = COLS * CELL
const H = ROWS * CELL

type Dir = 'U' | 'D' | 'L' | 'R'
type Pt = { x: number; y: number }

function rand(max: number) {
  return Math.floor(Math.random() * max)
}

function newFood(snake: Pt[]): Pt {
  let f: Pt
  do {
    f = { x: rand(COLS), y: rand(ROWS) }
  } while (snake.some(s => s.x === f.x && s.y === f.y))
  return f
}

const COLORS = {
  bg: '#0d0d1a',
  grid: '#131325',
  food: '#ff4757',
  foodGlow: '#ff6b81',
  head: '#2ed573',
  body: '#1abc9c',
  tail: '#0e8c6a',
  text: '#eaeaea',
  accent: '#e94560',
}

const SPEED_LEVELS = [200, 160, 130, 105, 85, 68, 55, 44, 36, 28]

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snake = useRef<Pt[]>([{ x: 10, y: 10 }])
  const dir = useRef<Dir>('R')
  const nextDir = useRef<Dir>('R')
  const food = useRef<Pt>(newFood(snake.current))
  const score = useRef(0)
  const running = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameRef = useRef<number | null>(null)
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([])

  const [displayScore, setDisplayScore] = useState(0)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'dead'>('idle')
  const [level, setLevel] = useState(1)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 0.5
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke()
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke()
    }

    // Particles
    particles.current = particles.current.filter(p => p.life > 0)
    for (const p of particles.current) {
      ctx.globalAlpha = p.life / 30
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
      p.x += p.vx; p.y += p.vy; p.life--
    }
    ctx.globalAlpha = 1

    // Food glow
    const f = food.current
    const grd = ctx.createRadialGradient(
      f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, 2,
      f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL,
    )
    grd.addColorStop(0, 'rgba(255,71,87,0.4)')
    grd.addColorStop(1, 'rgba(255,71,87,0)')
    ctx.fillStyle = grd
    ctx.fillRect(f.x * CELL - CELL / 2, f.y * CELL - CELL / 2, CELL * 2, CELL * 2)

    // Food
    ctx.fillStyle = COLORS.food
    ctx.beginPath()
    const fx = f.x * CELL + CELL / 2
    const fy = f.y * CELL + CELL / 2
    ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2)
    ctx.fill()

    // Snake
    const s = snake.current
    for (let i = s.length - 1; i >= 0; i--) {
      const t = i / s.length
      if (i === 0) {
        ctx.fillStyle = COLORS.head
      } else {
        const r = Math.round(30 + t * 14)
        const g = Math.round(188 - t * 60)
        const b = Math.round(156 - t * 60)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      }
      const pad = i === 0 ? 2 : 3
      const radius = i === 0 ? 6 : 4
      const sx = s[i].x * CELL + pad
      const sy = s[i].y * CELL + pad
      const sw = CELL - pad * 2
      const sh = CELL - pad * 2
      ctx.beginPath()
      ctx.roundRect(sx, sy, sw, sh, radius)
      ctx.fill()

      // Eyes on head
      if (i === 0) {
        ctx.fillStyle = '#0d0d1a'
        const d = dir.current
        const ex1 = sx + (d === 'R' ? sw - 5 : d === 'L' ? 3 : 5)
        const ey1 = sy + (d === 'D' ? sh - 5 : d === 'U' ? 3 : 5)
        const ex2 = sx + (d === 'R' ? sw - 5 : d === 'L' ? 3 : sw - 5)
        const ey2 = sy + (d === 'D' ? sh - 5 : d === 'U' ? 3 : sh - 5)
        ctx.beginPath(); ctx.arc(ex1, ey1, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(ex2, ey2, 2.5, 0, Math.PI * 2); ctx.fill()
      }
    }
  }, [])

  const spawnParticles = useCallback((x: number, y: number) => {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2
      const speed = 1.5 + Math.random() * 3
      particles.current.push({
        x: x * CELL + CELL / 2,
        y: y * CELL + CELL / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.floor(Math.random() * 15),
        color: ['#ff4757', '#ffa502', '#eccc68', '#ff6b81'][Math.floor(Math.random() * 4)],
      })
    }
  }, [])

  const tick = useCallback(() => {
    if (!running.current) return

    dir.current = nextDir.current
    const head = snake.current[0]
    let nx = head.x, ny = head.y
    if (dir.current === 'R') nx++
    else if (dir.current === 'L') nx--
    else if (dir.current === 'U') ny--
    else ny++

    // Wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      running.current = false
      setPhase('dead')
      return
    }

    // Self collision
    if (snake.current.some(s => s.x === nx && s.y === ny)) {
      running.current = false
      setPhase('dead')
      return
    }

    const ate = food.current.x === nx && food.current.y === ny
    const newSnake = [{ x: nx, y: ny }, ...snake.current]
    if (!ate) newSnake.pop()

    snake.current = newSnake

    if (ate) {
      spawnParticles(nx, ny)
      score.current++
      setDisplayScore(score.current)
      setBest(b => {
        const nb = Math.max(b, score.current)
        localStorage.setItem('snake-best', String(nb))
        return nb
      })
      food.current = newFood(newSnake)
      const lv = Math.min(10, 1 + Math.floor(score.current / 5))
      setLevel(lv)
    }

    draw()

    if (running.current) {
      const lv = Math.min(10, 1 + Math.floor(score.current / 5))
      timerRef.current = setTimeout(tick, SPEED_LEVELS[lv - 1])
    }
  }, [draw, spawnParticles])

  const startGame = useCallback(() => {
    snake.current = [{ x: 10, y: 10 }]
    dir.current = 'R'
    nextDir.current = 'R'
    food.current = newFood(snake.current)
    score.current = 0
    particles.current = []
    setDisplayScore(0)
    setLevel(1)
    setPhase('playing')
    running.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(tick, SPEED_LEVELS[0])
    draw()
  }, [tick, draw])

  // Animation loop for particles
  useEffect(() => {
    let id: number
    const loop = () => {
      if (particles.current.length > 0) draw()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [draw])

  // Load best
  useEffect(() => {
    setBest(parseInt(localStorage.getItem('snake-best') || '0'))
    draw()
  }, [draw])

  // Keyboard
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R',
      w: 'U', s: 'D', a: 'L', d: 'R',
    }
    const opposite: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' }
    const handler = (e: KeyboardEvent) => {
      const d = map[e.key]
      if (!d) return
      e.preventDefault()
      if (phase === 'idle' || phase === 'dead') { startGame(); return }
      if (d !== opposite[dir.current]) nextDir.current = d
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, startGame])

  // Touch
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
    const opposite: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' }
    let d: Dir
    if (Math.abs(dx) > Math.abs(dy)) d = dx > 0 ? 'R' : 'L'
    else d = dy > 0 ? 'D' : 'U'
    if (d !== opposite[dir.current]) nextDir.current = d
    touchStart.current = null
  }

  const dpadMove = (d: Dir) => {
    const opposite: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' }
    if (phase === 'idle' || phase === 'dead') { startGame(); return }
    if (d !== opposite[dir.current]) nextDir.current = d
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#0a0a14', color: '#eaeaea', fontFamily: 'system-ui, sans-serif' }}>

      <h1 style={{
        fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-2px',
        background: 'linear-gradient(135deg, #2ed573, #1abc9c)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 6,
      }}>SNAKE</h1>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[['점수', displayScore], ['최고', best], [`레벨 ${level}`, '']].map(([label, val]) => (
          <div key={label as string} style={{
            background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 10,
            padding: '8px 20px', textAlign: 'center', minWidth: 80,
          }}>
            <div style={{ fontSize: '0.65rem', color: '#666', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ borderRadius: 12, display: 'block', border: '1px solid #2a2a4a',
            boxShadow: '0 20px 60px rgba(46,213,115,0.08)' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {/* Overlay */}
        {(phase === 'idle' || phase === 'dead') && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'rgba(10,10,20,0.85)', borderRadius: 12,
            backdropFilter: 'blur(4px)',
          }}>
            {phase === 'dead' && (
              <>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#e94560' }}>게임 오버</div>
                <div style={{ color: '#888', fontSize: '0.9rem' }}>점수: {displayScore}</div>
              </>
            )}
            {phase === 'idle' && (
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2ed573' }}>🐍 SNAKE</div>
            )}
            <button
              onClick={startGame}
              style={{
                background: 'linear-gradient(135deg, #2ed573, #1abc9c)',
                color: '#0a0a14', border: 'none', borderRadius: 10,
                padding: '12px 32px', fontSize: '1rem', fontWeight: 800,
                cursor: 'pointer', letterSpacing: 0.5,
              }}>
              {phase === 'dead' ? '다시 시작' : '시작하기'}
            </button>
            <div style={{ color: '#444', fontSize: '0.8rem' }}>← → ↑ ↓ 또는 WASD</div>
          </div>
        )}
      </div>

      {/* D-pad (mobile) */}
      <div style={{ display: 'grid', gridTemplateAreas: `". up ." "left . right" ". down ."`,
        gridTemplateColumns: 'repeat(3, 52px)', gridTemplateRows: 'repeat(3, 52px)',
        gap: 6, marginTop: 16 }}>
        {([['up', 'U', '↑'], ['down', 'D', '↓'], ['left', 'L', '←'], ['right', 'R', '→']] as const).map(([area, d, icon]) => (
          <button key={area} onClick={() => dpadMove(d)}
            style={{ gridArea: area, background: '#1a1a2e', border: '1px solid #2a2a4a',
              borderRadius: 10, color: '#ccc', fontSize: '1.3rem', cursor: 'pointer' }}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
