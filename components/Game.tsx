'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { submitScore, getTopScores } from '@/lib/supabase'

const CW = 360
const CH = 600
const ITEM_R = 32
const SPEED_BASE = 2.2
const SPAWN_INTERVAL = 900

const GOOD = ['🍎','🍊','🍋','🍇','🍓','🍑','🍒','🫐','🍉','❤️','🧡','💛','💚','💙','💜','🤍']
const BAD  = ['💣','☠️','🐛']

type Item = {
  id: number; x: number; y: number; vy: number
  emoji: string; bad: boolean
  popping: boolean; popAlpha: number; popScale: number
}
type ScoreRow = { nickname: string; score: number }

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
  const [phase, setPhase] = useState<'idle' | 'playing' | 'dead' | 'submit' | 'board'>('idle')
  const [nickname, setNickname] = useState('')
  const [board, setBoard] = useState<ScoreRow[]>([])
  const [submitting, setSubmitting] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.save()
    if (screenShake.current > 0) {
      const s = screenShake.current * 3
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
      screenShake.current--
    }
    const bg = ctx.createLinearGradient(0, 0, 0, CH)
    bg.addColorStop(0, '#0f0c29')
    bg.addColorStop(1, '#302b63')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, CW, CH)
    if (bgFlash.current && bgFlash.current.alpha > 0) {
      ctx.fillStyle = bgFlash.current.color.replace('1)', `${bgFlash.current.alpha})`)
      ctx.fillRect(0, 0, CW, CH)
      bgFlash.current.alpha -= 0.06
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.beginPath(); ctx.moveTo(0, CH - 20); ctx.lineTo(CW, CH - 20); ctx.stroke()
    ctx.setLineDash([])
    for (const item of items.current) {
      ctx.save()
      if (item.popping) {
        ctx.globalAlpha = item.popAlpha
        ctx.font = `${ITEM_R * 2 * item.popScale}px serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(item.emoji, item.x, item.y)
        item.popAlpha -= 0.05; item.popScale += 0.08
      } else {
        ctx.globalAlpha = 0.2; ctx.filter = 'blur(5px)'
        ctx.font = `${ITEM_R * 2}px serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(item.emoji, item.x + 4, item.y + 6)
        ctx.filter = 'none'; ctx.globalAlpha = 1
        const wobble = 1 + Math.sin(Date.now() / 200 + item.id) * 0.04
        ctx.font = `${ITEM_R * 2 * wobble}px serif`
        ctx.fillText(item.emoji, item.x, item.y)
        if (item.bad) {
          ctx.globalAlpha = 0.25 + Math.sin(Date.now() / 150) * 0.15
          ctx.fillStyle = 'rgba(255,50,50,0.4)'
          ctx.beginPath(); ctx.arc(item.x, item.y, ITEM_R + 8, 0, Math.PI * 2); ctx.fill()
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
    items.current.push({
      id: uid++, x: margin + Math.random() * (CW - margin * 2),
      y: -ITEM_R, vy: SPEED_BASE * speed.current,
      emoji, bad, popping: false, popAlpha: 1, popScale: 1,
    })
    const interval = Math.max(350, SPAWN_INTERVAL - score.current * 8)
    spawnTimer.current = setTimeout(spawnItem, interval)
  }, [])

  const endGame = useCallback(() => {
    running.current = false
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    setTimeout(() => setPhase('dead'), 500)
  }, [])

  const gameLoop = useCallback(() => {
    if (!running.current) return
    for (const t of items.current) { if (!t.popping) t.y += t.vy * speed.current }
    for (const t of items.current) {
      if (!t.popping && t.y > CH - 20 + ITEM_R) {
        t.popping = true
        if (!t.bad) {
          lives.current = Math.max(0, lives.current - 1)
          setDisplayLives(lives.current)
          screenShake.current = 6
          bgFlash.current = { color: 'rgba(255,0,0,1)', alpha: 0.3 }
          if (lives.current <= 0) { endGame(); draw(); return }
        }
      }
    }
    items.current = items.current.filter(i => !(i.popping && i.popAlpha <= 0) && i.y < CH + 100)
    draw()
    frameRef.current = requestAnimationFrame(gameLoop)
  }, [draw, endGame])

  const startGame = useCallback(() => {
    items.current = []; score.current = 0; lives.current = 3; speed.current = 1
    screenShake.current = 0; bgFlash.current = null; uid = 0
    setDisplayScore(0); setDisplayLives(3); setPhase('playing')
    running.current = true
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    spawnTimer.current = setTimeout(spawnItem, 300)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, spawnItem])

  const tap = useCallback((clientX: number, clientY: number) => {
    if (!running.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const tx = (clientX - rect.left) * (CW / rect.width)
    const ty = (clientY - rect.top) * (CH / rect.height)
    let hit: Item | null = null, minDist = ITEM_R * 2.2
    for (const item of items.current) {
      if (item.popping) continue
      const d = Math.hypot(item.x - tx, item.y - ty)
      if (d < minDist) { minDist = d; hit = item }
    }
    if (!hit) return
    hit.popping = true
    if (hit.bad) {
      lives.current = Math.max(0, lives.current - 1)
      setDisplayLives(lives.current)
      screenShake.current = 8
      bgFlash.current = { color: 'rgba(255,50,0,1)', alpha: 0.45 }
      if (lives.current <= 0) endGame()
    } else {
      score.current++
      speed.current = 1 + Math.floor(score.current / 10) * 0.25
      setDisplayScore(score.current)
      setBest(b => { const nb = Math.max(b, score.current); localStorage.setItem('catch-best', String(nb)); return nb })
      bgFlash.current = { color: 'rgba(255,255,255,1)', alpha: 0.07 }
    }
  }, [endGame])

  const handleSubmit = async () => {
    if (!nickname.trim()) return
    setSubmitting(true)
    await submitScore(nickname.trim(), displayScore)
    const rows = await getTopScores()
    setBoard(rows)
    setSubmitting(false)
    setPhase('board')
  }

  const showBoard = async () => {
    const rows = await getTopScores()
    setBoard(rows)
    setPhase('board')
  }

  useEffect(() => { setBest(parseInt(localStorage.getItem('catch-best') || '0')); draw() }, [draw])
  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
  }, [])

  const hearts = (n: number) => Array.from({ length: 3 }, (_, i) => (
    <span key={i} style={{ fontSize: '1.3rem', opacity: i < n ? 1 : 0.15 }}>❤️</span>
  ))

  const overlayStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, borderRadius: 20,
    background: 'rgba(5,3,20,0.92)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 14,
    backdropFilter: 'blur(10px)', padding: '24px 20px',
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#0a0814',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, fontFamily: 'system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', width: CW, maxWidth: '95vw', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>최고</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#eee' }}>{best}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>{hearts(displayLives)}</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>점수</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#eee' }}>{displayScore}</div>
        </div>
      </div>

      <div style={{ position: 'relative', lineHeight: 0 }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ display: 'block', borderRadius: 20, touchAction: 'none', maxWidth: '95vw' }}
          onPointerDown={e => {
            e.preventDefault()
            if (phase === 'idle') { startGame(); return }
            if (phase === 'playing') tap(e.clientX, e.clientY)
          }}
        />

        {/* 시작 화면 */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={{ fontSize: '2.5rem' }}>🍎❤️🍊</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>캐치!</div>
            <div style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.9 }}>
              떨어지는 걸 탭해서 잡으세요<br/>
              <span style={{ color: '#ff6b6b' }}>💣 폭탄</span>은 피하세요!<br/>
              놓치면 ❤️ 하나 잃어요
            </div>
            <button onPointerDown={e => { e.stopPropagation(); startGame() }}
              style={btnStyle('#a855f7', '#ec4899')}>시작하기</button>
            <button onPointerDown={e => { e.stopPropagation(); showBoard() }}
              style={{ ...btnStyle('#1e1e3a', '#1e1e3a'), border: '1px solid #333', color: '#aaa' }}>
              🏆 리더보드
            </button>
          </div>
        )}

        {/* 게임 오버 */}
        {phase === 'dead' && (
          <div style={overlayStyle}>
            <div style={{ fontSize: '2.8rem' }}>😵</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ff4444' }}>게임 오버</div>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{displayScore}</div>
            <div style={{ color: '#555', fontSize: '0.8rem' }}>최고기록 {best}</div>
            <button onPointerDown={e => { e.stopPropagation(); setPhase('submit') }}
              style={btnStyle('#a855f7', '#ec4899')}>🏆 점수 등록</button>
            <button onPointerDown={e => { e.stopPropagation(); startGame() }}
              style={{ ...btnStyle('#1e1e3a', '#1e1e3a'), border: '1px solid #333', color: '#aaa' }}>
              다시 시작
            </button>
          </div>
        )}

        {/* 닉네임 입력 */}
        {phase === 'submit' && (
          <div style={overlayStyle}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>닉네임 입력</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#a855f7' }}>{displayScore}점</div>
            <input
              autoFocus
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={10}
              placeholder="닉네임 (최대 10자)"
              style={{
                background: '#1a1a2e', border: '1px solid #333', borderRadius: 10,
                color: '#fff', fontSize: '1rem', padding: '12px 16px',
                width: '100%', maxWidth: 240, outline: 'none', textAlign: 'center',
              }}
            />
            <button
              onPointerDown={e => { e.stopPropagation(); handleSubmit() }}
              disabled={submitting || !nickname.trim()}
              style={{ ...btnStyle('#a855f7', '#ec4899'), opacity: submitting || !nickname.trim() ? 0.5 : 1 }}>
              {submitting ? '등록 중...' : '등록하기'}
            </button>
            <button onPointerDown={e => { e.stopPropagation(); startGame() }}
              style={{ color: '#555', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>
              건너뛰고 다시 시작
            </button>
          </div>
        )}

        {/* 리더보드 */}
        {phase === 'board' && (
          <div style={overlayStyle}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>🏆 리더보드</div>
            <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {board.length === 0 && <div style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem' }}>아직 기록이 없어요</div>}
              {board.map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: i === 0 ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 10, padding: '10px 14px',
                  border: i === 0 ? '1px solid rgba(168,85,247,0.4)' : '1px solid transparent',
                }}>
                  <span style={{ fontSize: '0.9rem', color: i === 0 ? '#ffd700' : i === 1 ? '#ccc' : i === 2 ? '#cd7f32' : '#888' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <span style={{ fontWeight: 700, color: '#eee', flex: 1, marginLeft: 10 }}>{row.nickname}</span>
                  <span style={{ fontWeight: 900, color: '#a855f7' }}>{row.score}</span>
                </div>
              ))}
            </div>
            <button onPointerDown={e => { e.stopPropagation(); startGame() }}
              style={btnStyle('#a855f7', '#ec4899')}>시작하기</button>
            <button onPointerDown={e => { e.stopPropagation(); setPhase('idle') }}
              style={{ color: '#555', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>
              돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(from: string, to: string): React.CSSProperties {
  return {
    background: `linear-gradient(135deg,${from},${to})`,
    color: '#fff', border: 'none', borderRadius: 50,
    padding: '13px 40px', fontSize: '1rem', fontWeight: 800,
    cursor: 'pointer', boxShadow: `0 4px 20px ${from}66`,
    width: '100%', maxWidth: 240,
  }
}
