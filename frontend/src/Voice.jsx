import React, { useEffect, useRef, useState } from 'react'
import { summarize } from './facts.js'
import { MerchantLogo } from './icons.jsx'
import { t, LANGS, ENGLISH_ONLY } from './i18n.js'
import { ttsSarvam } from './api.js'

const AGENTS = ['intelligence', 'risk', 'resolution', 'ledger']
const AGENT_NAMES = ['Intelligence', 'Risk', 'Resolution', 'Ledger']
const BAR_K = [0.35, 0.62, 0.88, 1, 0.88, 0.62, 0.35]
const CONFIRM_RE = /(haan|han|yes|ok|okay|theek|thik|bhej|kar do|हाँ|हां|ठीक)/i

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.2-2h6.2l1.2 2h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.4" /></svg>
)

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
)

const SpeakerIcon = ({ on }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
)

// Rank the voices installed on this device and pick the smoothest Indian one (neural/online voices first).
const VOICE_PREF = [/neerja|veena|heera|swara|kalpana|natural|neural|online/i, /google/i, /lekha|rishi|isha|samantha|aditi|raveena/i]
function bestVoice(lang) {
  try {
    const all = window.speechSynthesis.getVoices() || []
    const base = lang.split('-')[0]
    const pool = all.filter((x) => x.lang?.replace('_', '-').toLowerCase() === lang.toLowerCase())
    const loose = pool.length ? pool : all.filter((x) => x.lang?.toLowerCase().startsWith(base))
    for (const re of VOICE_PREF) { const hit = loose.find((x) => re.test(x.name)); if (hit) return hit }
    return loose[0] || null
  } catch { return null }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices() }

// Status badge: the ring draws itself, then the symbol is drawn inside it, with one soft ripple. Calm, not bouncy.
function AnswerIcon({ kind }) {
  const g = {
    ok: <path className="a-draw" pathLength="1" d="M11.5 18.6l4.6 4.6 8.6-9.8" />,
    warn: <><circle className="a-draw" pathLength="1" cx="18" cy="18" r="6.8" /><path className="a-draw" pathLength="1" d="M18 14.2V18l2.8 1.8" /></>,
    bad: <><path className="a-draw" pathLength="1" d="M13.2 13.2l9.6 9.6" /><path className="a-draw" pathLength="1" d="M22.8 13.2l-9.6 9.6" /></>,
    info: <><circle className="a-draw" pathLength="1" cx="18" cy="14.4" r="3.2" /><path className="a-draw" pathLength="1" d="M11.8 25c.8-3.3 3.2-4.9 6.2-4.9s5.4 1.6 6.2 4.9" /></>,
  }[kind] || null
  return (
    <svg className="a-ico" viewBox="0 0 36 36" width="36" height="36" fill="none" aria-hidden="true">
      <circle className="a-fill" cx="18" cy="18" r="17" />
      <circle className="a-ring a-draw" pathLength="1" cx="18" cy="18" r="16" transform="rotate(-90 18 18)" />
      <g className="a-glyph">{g}</g>
    </svg>
  )
}

// Type scale: short headlines can be bold and large, long sentences step down so they stay easy to read.
const headSize = (h) => { const n = h.replace(/[.:]\s*$/, '').length; return n <= 30 ? 'hs' : n <= 62 ? 'hm' : 'hl' }
const repeatsInHeadline = (h, val) => { const d = String(val).replace(/\D/g, ''); return d.length >= 3 && h.replace(/\D/g, '').includes(d) }

// Counts a money value up from zero once, so the number feels earned.
function CountUp({ value }) {
  const m = String(value).match(/^(.*?)([\d,]+(?:\.\d+)?)(.*)$/)
  const target = m ? parseFloat(m[2].replace(/,/g, '')) : 0
  const dec = m ? (m[2].split('.')[1] || '').length : 0
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!m) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return undefined }
    let raf, t0
    const step = (t) => { t0 = t0 ?? t; const p = Math.min(1, (t - t0) / 850); setN(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  if (!m) return value
  return <>{m[1]}{n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}{m[3]}</>
}

export default function Voice({ m, chat, busy, run, reveal, speak, setSpeak, mode, prompts, nudge, lang, setLang, onText, onAudio, onPreset, onConfirm, onMenu, onKhata, onGo, onAttach }) {
  const [phase, setPhase] = useState('idle') // idle | listening | speaking (thinking comes from `busy`)
  const [live, setLive] = useState('')
  const [spoken, setSpoken] = useState(0)
  const [note, setNote] = useState('')
  const [typed, setTyped] = useState('') // typing fallback: when the mic mishears or voice is off
  const orb = useRef(null)
  const rec = useRef({})
  const sim = useRef(null)
  const seen = useRef(chat.length)
  const speakTimer = useRef(null)
  const safety = useRef(null)
  const latest = useRef({})
  const capRef = useRef(null) // the answer area scrolls; each new answer starts at its top

  const setLevel = (v) => orb.current && orb.current.style.setProperty('--lvl', Math.max(0, Math.min(1, v)).toFixed(3))
  const last = chat[chat.length - 1]
  const lastMe = [...chat].reverse().find((c) => c.who === 'me')
  const [home, setHome] = useState(false) // 'Back' hides the answer and shows the full start screen again
  useEffect(() => { setHome(false) }, [chat.length])
  const reply = !home && last && last.who === 'ai' && chat.length > 1 ? last : null
  const shown = reply ? { ...reply, text: (reply.texts && reply.texts[lang]) || reply.text } : null
  const info = summarize(run, shown, lang)
  const T = (k, ...a) => t(lang, k, ...a)
  const state = busy ? 'thinking' : phase
  const agentsDone = run ? run.steps.filter((s, i) => AGENTS.includes(s.key) && i < reveal).length : 0

  /* ---------- speaking the reply (TTS or backend audio), with karaoke highlight ---------- */
  const stopSpeaking = () => {
    clearInterval(speakTimer.current); clearTimeout(safety.current)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (rec.current.audioEl) { rec.current.audioEl.pause(); rec.current.audioEl = null }
  }
  useEffect(() => {
    if (chat.length === seen.current) return
    seen.current = chat.length
    capRef.current?.scrollTo(0, 0)
    const msg = chat[chat.length - 1]
    if (!msg || msg.who !== 'ai') return
    const ws = msg.text.split(/\s+/)
    if (!speak) { setSpoken(ws.length); setPhase('idle'); return }
    stopSpeaking()
    setSpoken(0); setPhase('speaking')
    const done = () => { clearInterval(speakTimer.current); clearTimeout(safety.current); setSpoken(ws.length); setPhase('idle'); setLevel(0) }
    // Safety net: some browsers never fire onend (no Hindi voice installed), so never get stuck in 'speaking'.
    safety.current = setTimeout(done, ws.length * 450 + 3000)
    const wobble = () => { let t = 0; speakTimer.current = setInterval(() => { t += 0.35; setLevel(0.35 + 0.3 * Math.abs(Math.sin(t)) + 0.15 * Math.random()) }, 90) }
    const playAudio = (b64) => {
      try {
        const a = new Audio('data:audio/wav;base64,' + b64); rec.current.audioEl = a
        a.onended = done; a.onerror = done; a.play().catch(done)
        wobble()
        const per = Math.max(240, Math.min(420, 330)); let i = 0; const kt = setInterval(() => { i += 1; setSpoken(i); if (i >= ws.length) clearInterval(kt) }, per)
        return true
      } catch { return false }
    }
    // The voice says the short spoken form (8003 voice.py); the screen keeps the full answer.
    const said = msg.say || msg.text
    const browserSpeak = () => {
      if (!('speechSynthesis' in window)) { // no TTS available: simulate timing
        wobble(); let i = 0
        const kt = setInterval(() => { i += 1; setSpoken(i); if (i >= ws.length) { clearInterval(kt); done() } }, 320)
        return
      }
      const hi = /[\u0900-\u097F]/.test(said)
      const u = new SpeechSynthesisUtterance(said); u.lang = hi ? 'hi-IN' : 'en-IN'
      const v = bestVoice(u.lang); if (v) u.voice = v
      u.rate = 0.96; u.pitch = 1.04 // a touch slower and warmer reads as calmer, less robotic
      const starts = []; let pos = 0; ws.forEach((w) => { starts.push(pos); pos += w.length + 1 })
      u.onboundary = (e) => {
        if (said !== msg.text) { setSpoken(Math.max(1, Math.round((e.charIndex / said.length) * ws.length))); return } // short spoken form: advance proportionally
        let idx = 0; for (let k = 0; k < starts.length; k++) if (starts[k] <= e.charIndex) idx = k; setSpoken(idx + 1)
      }
      u.onend = done; u.onerror = done
      wobble()
      window.speechSynthesis.speak(u)
    }
    // One consistent voice: Sarvam's natural Indian voice when the service is up, otherwise the best Indian voice this device has.
    if (msg.audio && playAudio(msg.audio)) return
    {
      ttsSarvam(said, /[\u0900-\u097F]/.test(said) ? 'hi-IN' : 'en-IN').then((b64) => { if (seen.current !== chat.length) return; if (!(b64 && playAudio(b64))) browserSpeak() })
    }
  }, [chat.length])
  useEffect(() => () => { stopSpeaking(); cleanup() }, [])

  /* ---------- listening: mic level, live captions, silence detection ---------- */
  const cleanup = () => {
    const r = rec.current
    cancelAnimationFrame(r.raf); clearInterval(sim.current)
    if (r.stream) r.stream.getTracks().forEach((t) => t.stop())
    if (r.ctx) { try { r.ctx.close() } catch { /* ignore */ } }
    if (r.sr) { try { r.sr.onend = null; r.sr.stop() } catch { /* ignore */ } }
    r.stream = r.ctx = r.sr = null
    setLevel(0)
  }
  const route = (blob) => {
    const r = rec.current
    setPhase('idle')
    const text = (r.final || '').trim() // the browser's own recognizer: live captions, and a fallback only
    const X = latest.current
    const handle = (heard) => {
      setLive('')
      if (X.pending && CONFIRM_RE.test(heard)) return X.onConfirm(X.reply, X.chat.length - 1)
      return X.onText(heard)
    }
    if (X.pending && text && CONFIRM_RE.test(text)) return handle(text) // a quick spoken "haan" for a sign-off
    // Live mode: Sarvam STT (built for Hinglish/Hindi) decides what was said. The browser's hi-IN recognizer
    // garbles Hinglish ("UTR", amounts) and used to be trusted first.
    if (X.mode === 'live' && blob && blob.size > 1500 && r.heard) return X.onAudio(blob, text, handle)
    if (text) return handle(text)
    setNote(t(X.lang, r.heard ? 'unclear' : 'silent'))
  }
  const finish = () => {
    const r = rec.current
    if (r.done) return
    r.done = true
    const mr = r.mr
    cleanup()
    if (mr && mr.state !== 'inactive') {
      mr.onstop = () => route(new Blob(r.chunks, { type: mr.mimeType || 'audio/webm' }))
      try { mr.stop() } catch { route(null) }
    } else route(null)
    r.mr = null
  }
  const startListening = async () => {
    if (busy) return
    if (phase === 'listening') return finish()
    stopSpeaking()
    const r = rec.current
    r.done = false; r.final = ''; r.heard = false; r.chunks = []
    setNote(''); setLive(''); setPhase('listening')
    let stream = null
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { stream = null }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (stream) {
      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = new AC(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an)
      const buf = new Uint8Array(an.fftSize); let quietSince = performance.now(); const t0 = performance.now()
      const tick = () => {
        an.getByteTimeDomainData(buf)
        let s = 0; for (const v of buf) { const d = (v - 128) / 128; s += d * d }
        const lvl = Math.min(1, Math.sqrt(s / buf.length) * 5)
        setLevel(lvl)
        const now = performance.now()
        if (lvl > 0.12) { r.heard = true; quietSince = now }
        // 2 s of quiet ends the turn (1.6 s cut people off mid-sentence, e.g. while reading out a UTR)
        if ((r.heard && now - quietSince > 2000) || now - t0 > 15000) return finish()
        r.raf = requestAnimationFrame(tick)
      }
      r.raf = requestAnimationFrame(tick)
      r.stream = stream; r.ctx = ctx
      if (window.MediaRecorder) { try { const mr = new MediaRecorder(stream); mr.ondataavailable = (e) => e.data.size && r.chunks.push(e.data); mr.start(); r.mr = mr } catch { /* no recorder */ } }
    } else {
      let t = 0; sim.current = setInterval(() => { t += 0.4; setLevel(0.25 + 0.2 * Math.abs(Math.sin(t))) }, 90)
    }
    if (SR) {
      try {
        // continuous: with continuous=false Chrome ended the whole recording at the first pause
        const sr = new SR(); sr.lang = latest.current.lang === 'en' ? 'en-IN' : 'hi-IN'; sr.interimResults = true; sr.continuous = true
        sr.onresult = (e) => { let t = ''; for (const res of e.results) t += res[0].transcript; r.final = t; r.heard = true; setLive(t) }
        sr.onerror = () => {}
        sr.onend = () => { if (!rec.current.stream) finish() } // with a mic stream, silence detection decides
        sr.start(); r.sr = sr
      } catch { /* ignore */ }
    }
    if (!stream && !SR) { cleanup(); r.done = true; setPhase('idle'); setNote(t(latest.current.lang, 'nomic')) }
  }

  /* ---------- "say it for me": tapping a prompt animates speaking, then runs it ---------- */
  const sayPrompt = (p) => {
    if (busy || phase === 'listening') return
    stopSpeaking(); setNote(''); setLive(''); setPhase('listening')
    const ws = p.say.split(/\s+/); let i = 0; let t = 0
    sim.current = setInterval(() => { t += 0.5; setLevel(0.3 + 0.35 * Math.abs(Math.sin(t)) + 0.15 * Math.random()) }, 80)
    const typer = setInterval(() => {
      i += 1; setLive(ws.slice(0, i).join(' '))
      if (i >= ws.length) { clearInterval(typer); clearInterval(sim.current); setTimeout(() => { setPhase('idle'); setLive(''); setLevel(0); onPreset(p.id) }, 380) }
    }, 120)
  }

  // Voice sign-off: when a confirm button is pending, saying "haan" works too.
  const pending = reply && reply.confirm && !reply.done
  latest.current = { pending, reply, chat, mode, onText, onAudio, onConfirm, lang }

  const intentNow = run?.sc?.intent || ''
  const nextAct = /SETTLEMENT|HOLD|CHARGEBACK/.test(intentNow) ? { l: 'View settlements', to: 'settlements' } : /MANDATE|EDI|LOAN/.test(intentNow) ? { l: 'See loan status', to: 'loans' } : null
  const shareAnswer = async () => {
    if (!info) return
    const text = `${info.headline.replace(/[.:]\s*$/, '')}\n${info.facts.map((f) => `${f.k}: ${f.v}`).join('\n')}\n${info.detail || ''}\n- Paytm for Business`.replace(/\n{2,}/g, '\n')
    try { if (navigator.share) await navigator.share({ text }); else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener') } catch { /* user closed the share sheet */ }
  }
  const introOn = state === 'idle' && !reply && !note && !!nudge
  const cls = `voice ${introOn ? 'intro-on' : ''} ${state} ${speak ? '' : 'muted'} ${reply ? 'has-reply' : ''}`
  return (
    <div className={cls}>
      <div className="aurora" /><div className="aurora a2" />
      <div className="v-top">
        {reply && <button className="v-back" onClick={() => { stopSpeaking(); setPhase('idle'); setHome(true) }} aria-label="Back to start"><svg width="9" height="15" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L2 10l8 8" /></svg>Back</button>}
        <span className="v-who"><MerchantLogo d={m.d} size={22} /><span className="v-name">{m.profile.name}</span></span>
        {!ENGLISH_ONLY && <div className="lang" role="group" aria-label="Language">{Object.entries(LANGS).map(([k, lab]) => <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>{lab}</button>)}</div>}
        <button className="v-mute" onClick={() => { if (speak) stopSpeaking(); setSpeak(!speak) }} aria-label={speak ? T('mute') : T('unmute')}><SpeakerIcon on={speak} /></button>
      </div>

      <div className="orb-stage">
        <div ref={orb} className={`orb-wrap ${state}`} onClick={startListening} role="button" aria-label={T('idle')}>
          <span className="halo" />
          <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
          <span className="sweep" />
          {Array.from({ length: 10 }).map((_, i) => <span key={i} className="pt" style={{ '--i': i }} />)}
          <div className="orb">
            <div className="shine" />
            <div className="vbars">{BAR_K.map((k, i) => <i key={i} style={{ '--k': k, '--d': `${(i % 4) * 0.12}s` }} />)}</div>
          </div>
        </div>
        <div className="reflect"><i /></div>
        <div className="state-lbl">{state === 'listening' ? T('listen') : state === 'thinking' ? T('think') : state === 'speaking' ? T('speak') : reply ? T('more') : T('idle')}</div>
        {state === 'idle' && <button className="upbtn" onClick={() => onAttach()}><CameraIcon /> {T('up')}</button>}
      </div>

      <div className="v-cap" ref={capRef}>
        {state === 'listening' && <div className="cap speech">{live || <span className="ph">{T('ph')}</span>}</div>}
        {state === 'thinking' && lastMe && <div className="cap me">“{lastMe.text}”</div>}
        {(state === 'speaking' || state === 'idle') && reply && info && (
          <div className="answer">
            {lastMe && <div className="a-q">“{lastMe.text}”</div>}
            <div className={`a-card ${info.kind}`}>
              <div className="a-top">
                <span className={`a-badge ${info.kind}`}><AnswerIcon kind={info.kind} /></span>
                <span className="a-chip-t">{info.chip}</span>
                <button className="a-share" aria-label="Share this answer" onClick={shareAnswer}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>
                </button>
              </div>
              {info.context && <p className="a-ctx">{info.context}</p>}
              <h3 className={`a-head ${headSize(info.headline)}`}>{info.headline.replace(/[.:]\s*$/, '')}</h3>
              {info.facts.length === 1 && /₹/.test(info.facts[0].v) && (
                <div className={`a-hero ${/save|releas|credit|receiv|back|refund/i.test(info.facts[0].k) ? 'pos' : ''}`}>
                  <span>{info.facts[0].k}</span><b><CountUp value={info.facts[0].v} /></b>
                </div>
              )}
              {info.facts.length === 1 && !/₹/.test(info.facts[0].v) && !repeatsInHeadline(info.headline, info.facts[0].v) && (
                <div className="a-meta"><span>{info.facts[0].k}</span><b>{info.facts[0].v}</b></div>
              )}
              {info.facts.length > 1 && (
                <div className="facts">{info.facts.map((f) => <div key={f.k}><span>{f.k}</span><b>{f.v}</b></div>)}</div>
              )}
              {info.detail && <div className="a-next"><i aria-hidden="true">→</i><p>{info.detail}</p></div>}
              {nextAct && onGo && <button className="a-link" onClick={() => onGo(nextAct.to)}><span>{nextAct.l}</span><i aria-hidden="true">›</i></button>}
            </div>
          </div>
        )}
        {state === 'idle' && !reply && !note && (
          <div className="cap intro">
            {nudge ? (
              <div className="nudge">
                <em>{T('nudgeLabel')}</em>
                <b>{nudge.title}</b>
                <span>{nudge.text}</span>
                <div className="n-act">
                  <button className="n-main" onClick={() => onAttach('pod')}><CameraIcon /> {T('nudgeCta')}</button>
                  <button className="n-alt" onClick={() => sayPrompt(nudge)}>{T('nudgeDemo')}</button>
                </div>
              </div>
            ) : (<>{T('intro')}</>)}
          </div>
        )}
        {note && state === 'idle' && <div className="cap note">{note}</div>}
      </div>
      {/* outside the scrolling answer: the sign-off button must always be visible */}
      {pending && (
        <div className="sign pinned">
          <button className="yes" onClick={() => onConfirm(reply, chat.length - 1)} disabled={busy}>{reply.confirm.label}</button>
          <span>{T('yesSay')}</span>
        </div>
      )}

      {state === 'listening' && <div className="v-act"><button className="stop-btn" onClick={finish}>{T('stop')}</button></div>}
      {(state === 'idle' || state === 'speaking') && reply && !pending && (
        <div className="v-act"><button className="ask-more" onClick={startListening}><MicIcon /> {T('ask')}</button></div>
      )}

      <div className={`v-prompts ${state === 'idle' ? '' : 'dim'}`}>
        <div className="vp-h">Ya neeche se chuniye</div>
        <div className="vp-row">
          {prompts.map((p) => (
            <button key={p.id} className="vp" disabled={busy || !p.ok} onClick={() => sayPrompt(p)}>
              <b>{p.label}</b><span>{T('askVoice')}</span>
            </button>
          ))}
        </div>
        {!pending && <form className="vp-type" onSubmit={(e) => {
          e.preventDefault()
          const v = typed.trim()
          if (!v || busy) return
          setTyped(''); setNote('')
          if (pending && CONFIRM_RE.test(v)) return onConfirm(reply, chat.length - 1)
          onText(v)
        }}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={T('typePh')} aria-label={T('typePh')} disabled={busy} />
          <button type="submit" disabled={busy || !typed.trim()}>{T('send')}</button>
        </form>}
        <div className="vp-links">
          <button onClick={onMenu}>{T('menu')}</button>
          <button onClick={onKhata}>{T('khata')}</button>
          
        </div>
      </div>
    </div>
  )
}
