'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

const COLS = 4
const TILE_H = 160
const SPEED_BASE = 3
const GAP = 4

type Tile = {
  id: number
  col: number
  y: number
  hit: boolean
  missed: boolean
}

let nextId = 0

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tiles = useRef<Tile[]>([])
  const score = useRef(0)
  const speed = useRef(SPEED_BASE)
  const running = useRef(false)
  const frameRef = useRef<number | null>(null)
  const lastTileY = useRef<number[]>([-TILE_H, -TILE_H, -TILE_H, -TILE_H])
  const flashRef = useRef<{ col: number; alpha: number }[]>([])
  const missFlash = useRef(0)

  const [displayScore, setDisplayScore] = useState(0)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'dead'>('idle')

  const W = useRef(320)
  const H = useRef(600)

  const TILE_W = () => (W.current - GAP * (COLS + 1)) / COLS

  const spawnTile = useCallback(() => {
    // pick a random col that isn't the same as the last spawned
    const lastCols = tiles.current.slice(-2).map(t => t.col)
    const available = [0, 1, 2, 3].filter(c => !lastCols.includes(c))
    const col = available[Math.floor(Math.random() * available.length)]
    tiles.current.push({ id: nextId++, col, y: -TILE_H, hit: false, missed: false })
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = W.current, h = H.current
    const tw = TILE_W()

    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, w, h)

    // Column dividers
    for (let c = 0; c <= COLS; c++) {
      const x = GAP + c * (tw + GAP)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x - GAP / 2, 0, GAP, h)
    }

    // Hit zone bar at bottom
    ctx.fillStyle = '#1e1e2e'
    ctx.fillRect(0, h - TILE_H - GAP, w, TILE_H + GAP)
    ctx.fillStyle = '#2a2a4a'
    ctx.fillRect(0, h - TILE_H - GAP, w, 2)

    // Miss flash
    if (missFlash.current > 0) {
      ctx.fillStyle = `rgba(255,50,50,${missFlash.current / 20 * 0.3})`
      ctx.fillRect(0, 0, w, h)
      missFlash.current--
    }

    // Flash effects
    flashRef.current = flashRef.current.filter(f => f.alpha > 0)
    for (const f of flashRef.current) {
      const x = GAP + f.col * (tw + GAP)
      const grad = ctx.createLinearGradient(x, h - TILE_H, x, h)
      grad.addColorStop(0, `rgba(100,200,255,0)`)
      grad.addColorStop(1, `rgba(100,200,255,${f.alpha})`)
      ctx.fillStyle = grad
      ctx.fillRect(x, h - TILE_H, tw, TILE_H)
      f.alpha -= 0.06
    }

    // Tiles
    for (const tile of tiles.current) {
      const x = GAP + tile.col * (tw + GAP)
      const y = tile.y

      if (tile.hit) {
        // Hit animation - bright flash
        ctx.fillStyle = '#64c8ff'
        ctx.beginPath()
        ;(ctx as CanvasRenderingContext2D & { roundRect: Function }).roundRect(x, y, tw, TILE_H - GAP, 10)
        ctx.fill()
      } else if (tile.missed) {
        ctx.fillStyle = '#ff3232'
        ctx.beginPath()
        ;(ctx as CanvasRenderingContext2D & { roundRect: Function }).roundRect(x, y, tw, TILE_H - GAP, 10)
        ctx.fill()
      } else {
        // Normal tile
        const isInZone = y + TILE_H > h - TILE_H - GAP && y < h
        ctx.fillStyle = isInZone ? '#1a1a1a' : '#0d0d0d'
        ctx.beginPath()
        ;(ctx as CanvasRenderingContext2D & { roundRect: Function }).roundRect(x, y, tw, TILE_H - GAP, 10)
        ctx.fill()

        // Glow for tiles in hit zone
        if (isInZone) {
          ctx.strokeStyle = 'rgba(100,200,255,0.15)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    // Score
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `bold ${w * 0.12}px system-ui`
    ctx.textAlign = 'center'
    ctx.fillText(String(score.current), w / 2, 70)

    // Hint arrows in hit zone columns (when idle)
    if (!running.current) return

  }, [])

  const gameLoop = useCallback(() => {
    if (!running.current) return
    const h = H.current
    const tw = TILE_W()

    // Move tiles
    for (const tile of tiles.current) {
      if (!tile.hit) tile.y += speed.current
    }

    // Spawn new tiles
    const lowestTile = tiles.current
      .filter(t => !t.hit && !t.missed)
      .reduce((min, t) => Math.min(min, t.y), Infinity)

    if (lowestTile > TILE_H * 0.8 || tiles.current.filter(t => !t.hit && !t.missed).length === 0) {
      spawnTile()
    }

    // Check missed tiles (passed the hit zone without being hit)
    for (const tile of tiles.current) {
      if (!tile.hit && !tile.missed && tile.y > h) {
        tile.missed = true
        running.current = false
        missFlash.current = 20
        draw()
        setTimeout(() => setPhase('dead'), 400)
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        return
      }
    }

    // Remove old tiles
    tiles.current = tiles.current.filter(t => t.y < h + TILE_H * 2)

    draw()
    frameRef.current = requestAnimationFrame(gameLoop)
  }, [draw, spawnTile])

  const startGame = useCallback(() => {
    tiles.current = []
    score.current = 0
    speed.current = SPEED_BASE
    missFlash.current = 0
    flashRef.current = []
    setDisplayScore(0)
    setPhase('playing')
    running.current = true
    spawnTile()
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, spawnTile])

  const handleTap = useCallback((clientX: number, clientY: number) => {
    if (!running.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = W.current / rect.width
    const scaleY = H.current / rect.height
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    const h = H.current
    const tw = TILE_W()

    const col = Math.floor(x / (tw + GAP))
    if (col < 0 || col >= COLS) return

    // Find the lowest unhit tile in this col within hit zone or above bottom
    const inZone = tiles.current
      .filter(t => t.col === col && !t.hit && !t.missed && t.y + TILE_H > h - TILE_H - 20 && t.y < h + 10)
      .sort((a, b) => b.y - a.y)

    if (inZone.length > 0) {
      const tile = inZone[0]
      tile.hit = true
      score.current++
      speed.current = SPEED_BASE + Math.floor(score.current / 10) * 0.8
      setDisplayScore(score.current)
      setBest(b => {
        const nb = Math.max(b, score.current)
        localStorage.setItem('piano-best', String(nb))
        return nb
      })
      flashRef.current.push({ col, alpha: 0.5 })

      // Remove hit tile after short delay visually
      setTimeout(() => {
        tiles.current = tiles.current.filter(t => t.id !== tile.id)
      }, 100)
    }
  }, [])

  // Resize canvas to fit screen
  useEffect(() => {
    const resize = () => {
      const maxW = Math.min(window.innerWidth, 400)
      const maxH = Math.min(window.innerHeight - 160, 640)
      W.current = maxW
      H.current = maxH
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = maxW
        canvas.height = maxH
      }
      draw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [draw])

  useEffect(() => {
    setBest(parseInt(localStorage.getItem('piano-best') || '0'))
    draw()
  }, [draw])

  useEffect(() => {
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [])

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontFamily: 'system-ui, sans-serif',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>최고</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#eee' }}>{best}</div>
        </div>
        <h1 style={{
          fontSize: '1.6rem', fontWeight: 900, letterSpacing: -1,
          background: 'linear-gradient(135deg, #fff, #888)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>피아노 타일</h1>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>레벨</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#eee' }}>
            {Math.floor(displayScore / 10) + 1}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', borderRadius: 16, touchAction: 'none' }}
          onPointerDown={e => {
            e.preventDefault()
            if (phase === 'idle' || phase === 'dead') { startGame(); return }
            handleTap(e.clientX, e.clientY)
          }}
        />

        {/* Overlay */}
        {(phase === 'idle' || phase === 'dead') && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            backdropFilter: 'blur(6px)',
          }}>
            {phase === 'dead' ? (
              <>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ff4444' }}>실패!</div>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fff' }}>{displayScore}</div>
                <div style={{ color: '#555', fontSize: '0.85rem' }}>최고기록 {best}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.5rem' }}>🎹</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>피아노 타일</div>
                <div style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
                  검은 타일을 탭하세요<br/>놓치면 게임 오버!
                </div>
              </>
            )}
            <button
              onPointerDown={e => { e.stopPropagation(); startGame() }}
              style={{
                background: '#fff', color: '#000',
                border: 'none', borderRadius: 50,
                padding: '14px 40px', fontSize: '1rem', fontWeight: 800,
                cursor: 'pointer', marginTop: 8,
              }}>
              {phase === 'dead' ? '다시 시작' : '시작'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
