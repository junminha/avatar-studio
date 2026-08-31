import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowCounterClockwise,
  ArrowDown,
  Check,
  DownloadSimple,
  FloppyDisk,
  GameController,
  HandWaving,
  ImageSquare,
  MagicWand,
  PersonSimpleRun,
  Play,
  Robot,
  Shuffle,
  Sparkle,
  UploadSimple,
  VideoCamera,
  VideoCameraSlash,
  Trophy,
  Timer,
} from '@phosphor-icons/react'
import { renderAvatar } from './avatarRenderer'
import { calculateSyncScore, challengePoses, type ChallengePose } from './challengePoses'
import type { AnalysisResult, AvatarOptions, HairStyle, LeaderboardEntry, LivePose, MotionName, RobotSide, Scene } from './types'

const WebcamPose = lazy(() => import('./WebcamPose').then((module) => ({ default: module.WebcamPose })))
const leaderboardKey = 'morph-pose-leaderboard'

type StudioMode = 'customize' | 'challenge' | 'ranking'
type ChallengePhase = 'idle' | 'waiting' | 'running' | 'result'

function loadLeaderboard() {
  try {
    const stored = window.localStorage.getItem(leaderboardKey)
    return stored ? JSON.parse(stored) as LeaderboardEntry[] : []
  } catch {
    return []
  }
}

const initialOptions: AvatarOptions = {
  skin: '#c98f6b',
  hair: '#352b29',
  shirt: '#2d7f68',
  trousers: '#34433e',
  hairStyle: 'wave',
  scene: 'studio',
  motion: 'idle',
  robot: 'right',
}

const scenes: { id: Scene; label: string; colors: [string, string] }[] = [
  { id: 'studio', label: '온실', colors: ['#dce8e3', '#f4d591'] },
  { id: 'sunset', label: '노을', colors: ['#6670a4', '#ef8c72'] },
  { id: 'day', label: '한낮', colors: ['#7fc6df', '#cce7d4'] },
  { id: 'cyber', label: '사이버', colors: ['#17243b', '#d26475'] },
]

const hairStyles: { id: HairStyle; label: string }[] = [
  { id: 'crop', label: '쇼트' },
  { id: 'wave', label: '웨이브' },
  { id: 'bob', label: '보브' },
  { id: 'spike', label: '스파이크' },
]

const motions: { id: MotionName; label: string; detail: string }[] = [
  { id: 'idle', label: '살랑', detail: '자연스럽게 숨쉬기' },
  { id: 'wave', label: '인사', detail: '손 흔들어 인사하기' },
  { id: 'dance', label: '춤', detail: '리듬에 맞춰 움직이기' },
  { id: 'jump', label: '점프', detail: '가볍게 뛰어오르기' },
  { id: 'cross', label: '팔짱', detail: '두 팔을 몸 앞에서 교차하기' },
]

const swatches = {
  skin: ['#f1c7a5', '#d9a17e', '#b97755', '#82543e', '#51352f'],
  hair: ['#2b2524', '#624638', '#aa6a3f', '#d1ae73', '#55606b'],
  shirt: ['#2d7f68', '#35679a', '#c46056', '#e1aa47', '#6b5b8c'],
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function sampleRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const sx = clamp(Math.floor(x), 0, ctx.canvas.width - 1)
  const sy = clamp(Math.floor(y), 0, ctx.canvas.height - 1)
  const sw = clamp(Math.floor(w), 1, ctx.canvas.width - sx)
  const sh = clamp(Math.floor(h), 1, ctx.canvas.height - sy)
  const data = ctx.getImageData(sx, sy, sw, sh).data
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 32) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
    if (brightness < 12 || brightness > 248 || data[i + 3] < 180) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  if (!count) return '#92715f'
  return toHex(r / count, g / count, b / count)
}

async function analyzePhoto(src: string): Promise<AnalysisResult> {
  const image = new Image()
  image.src = src
  await image.decode()
  const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('사진을 분석할 수 없습니다.')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  let face = {
    x: canvas.width * 0.29,
    y: canvas.height * 0.12,
    width: canvas.width * 0.42,
    height: canvas.height * 0.42,
  }
  let faceFound = false

  type DetectorResult = { boundingBox: DOMRectReadOnly }
  type DetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
    detect: (source: CanvasImageSource) => Promise<DetectorResult[]>
  }
  const Detector = (window as unknown as { FaceDetector?: DetectorConstructor }).FaceDetector
  if (Detector) {
    try {
      const results = await new Detector({ fastMode: true, maxDetectedFaces: 1 }).detect(canvas)
      if (results[0]) {
        const box = results[0].boundingBox
        face = { x: box.x, y: box.y, width: box.width, height: box.height }
        faceFound = true
      }
    } catch {
      faceFound = false
    }
  }

  const hair = sampleRegion(ctx, face.x + face.width * 0.18, face.y, face.width * 0.64, face.height * 0.22)
  const skin = sampleRegion(ctx, face.x + face.width * 0.27, face.y + face.height * 0.42, face.width * 0.46, face.height * 0.28)
  const shirtY = clamp(face.y + face.height * 1.28, 0, canvas.height * 0.82)
  const shirt = sampleRegion(ctx, face.x + face.width * 0.05, shirtY, face.width * 0.9, face.height * 0.34)
  return { faceFound, skin, hair, shirt }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const livePoseRef = useRef<LivePose | null>(null)
  const [options, setOptions] = useState<AvatarOptions>(initialOptions)
  const [photo, setPhoto] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'empty' | 'reading' | 'done' | 'error'>('empty')
  const [faceFound, setFaceFound] = useState(false)
  const [tab, setTab] = useState<'look' | 'move'>('look')
  const [dragging, setDragging] = useState(false)
  const [webcamEnabled, setWebcamEnabled] = useState(false)
  const [studioMode, setStudioMode] = useState<StudioMode>('customize')
  const [currentChallenge, setCurrentChallenge] = useState<ChallengePose>(challengePoses[0])
  const currentChallengeRef = useRef<ChallengePose>(challengePoses[0])
  const [challengePhase, setChallengePhase] = useState<ChallengePhase>('idle')
  const challengePhaseRef = useRef<ChallengePhase>('idle')
  const challengeDeadlineRef = useRef(0)
  const challengeScoreRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState(5)
  const [liveScore, setLiveScore] = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [captureRequest, setCaptureRequest] = useState(0)
  const [resultPhoto, setResultPhoto] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard)
  const reduceMotion = useReducedMotion()

  const beginCountdown = useCallback(() => {
    if (challengePhaseRef.current === 'running') return
    challengePhaseRef.current = 'running'
    challengeDeadlineRef.current = performance.now() + 5000
    challengeScoreRef.current = 0
    setChallengePhase('running')
    setTimeLeft(5)
    setLiveScore(0)
  }, [])

  const handleLivePose = useCallback((pose: LivePose | null) => {
    livePoseRef.current = pose
    if (!pose) return
    if (challengePhaseRef.current === 'waiting') beginCountdown()
    if (challengePhaseRef.current === 'running') {
      challengeScoreRef.current = calculateSyncScore(pose, currentChallengeRef.current)
    }
  }, [beginCountdown])

  const handleCapture = useCallback((capturedPhoto: string) => {
    setResultPhoto(capturedPhoto)
  }, [])

  useEffect(() => {
    if (challengePhase !== 'running') return
    const tick = () => {
      const remaining = Math.max(0, challengeDeadlineRef.current - performance.now())
      setTimeLeft(remaining / 1000)
      setLiveScore(challengeScoreRef.current)
      if (remaining <= 0) {
        const score = challengeScoreRef.current
        challengePhaseRef.current = 'result'
        setChallengePhase('result')
        setFinalScore(score)
        setLiveScore(score)
        setCaptureRequest((current) => current + 1)
      }
    }
    tick()
    const timer = window.setInterval(tick, 80)
    return () => window.clearInterval(timer)
  }, [challengePhase])

  useEffect(() => {
    let frame = 0
    const draw = (time: number) => {
      if (canvasRef.current) renderAvatar(canvasRef.current, options, reduceMotion ? 0 : time, livePoseRef.current, studioMode === 'challenge' ? currentChallenge : null)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    const redraw = () => canvasRef.current && renderAvatar(canvasRef.current, options, 0, livePoseRef.current, studioMode === 'challenge' ? currentChallenge : null)
    window.addEventListener('resize', redraw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', redraw)
    }
  }, [options, reduceMotion, studioMode, currentChallenge])

  const update = <K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }))
  }

  const loadFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus('error')
      return
    }
    setStatus('reading')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async () => {
      const src = String(reader.result)
      setPhoto(src)
      try {
        const result = await analyzePhoto(src)
        setOptions((current) => ({ ...current, skin: result.skin, hair: result.hair, shirt: result.shirt }))
        setFaceFound(result.faceFound)
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }
    reader.onerror = () => setStatus('error')
    reader.readAsDataURL(file)
  }

  const randomize = () => {
    const pick = <T,>(values: T[]) => values[Math.floor(Math.random() * values.length)]
    setOptions((current) => ({
      ...current,
      hair: pick(swatches.hair),
      shirt: pick(swatches.shirt),
      hairStyle: pick(hairStyles).id,
      scene: pick(scenes).id,
      robot: pick<RobotSide>(['none', 'left', 'right']),
    }))
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'morph-avatar.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const selectMode = (mode: StudioMode) => {
    setStudioMode(mode)
    if (mode !== 'challenge' && (challengePhaseRef.current === 'waiting' || challengePhaseRef.current === 'running')) {
      challengePhaseRef.current = 'idle'
      setChallengePhase('idle')
    }
  }

  const startChallenge = () => {
    const candidates = challengePoses.filter((pose) => pose.id !== currentChallengeRef.current.id)
    const nextPose = candidates[Math.floor(Math.random() * candidates.length)] ?? challengePoses[0]
    currentChallengeRef.current = nextPose
    setCurrentChallenge(nextPose)
    setStudioMode('challenge')
    setResultPhoto('')
    setPlayerName('')
    setFinalScore(0)
    setLiveScore(0)
    setTimeLeft(5)
    setWebcamEnabled(true)
    if (livePoseRef.current) {
      beginCountdown()
    } else {
      challengePhaseRef.current = 'waiting'
      setChallengePhase('waiting')
    }
  }

  const stopWebcam = () => {
    setWebcamEnabled(false)
    livePoseRef.current = null
    if (challengePhaseRef.current === 'waiting' || challengePhaseRef.current === 'running') {
      challengePhaseRef.current = 'idle'
      setChallengePhase('idle')
    }
  }

  const saveResult = () => {
    const name = playerName.trim()
    if (!name || challengePhase !== 'result') return
    const entry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.slice(0, 16),
      score: finalScore,
      photo: resultPhoto,
      poseLabel: currentChallenge.label,
      createdAt: Date.now(),
    }
    const next = [...leaderboard, entry]
      .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
      .slice(0, 30)
    setLeaderboard(next)
    try {
      window.localStorage.setItem(leaderboardKey, JSON.stringify(next))
    } catch {
      // The score remains visible for this session when storage is unavailable.
    }
    challengePhaseRef.current = 'idle'
    setChallengePhase('idle')
    setStudioMode('ranking')
  }

  const reset = () => {
    setOptions(initialOptions)
    setPhoto(null)
    setFileName('')
    setStatus('empty')
    setFaceFound(false)
    setWebcamEnabled(false)
    setStudioMode('customize')
    challengePhaseRef.current = 'idle'
    setChallengePhase('idle')
    setTimeLeft(5)
    setLiveScore(0)
    setFinalScore(0)
    setResultPhoto('')
    setPlayerName('')
    livePoseRef.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#studio" aria-label="MORPH 홈">
          <span className="brand-mark"><Sparkle weight="fill" /></span>
          <span>MORPH.</span>
        </a>
        <nav className="mode-nav" aria-label="스튜디오 메뉴">
          <button type="button" className={studioMode === 'customize' ? 'active' : ''} onClick={() => selectMode('customize')}>꾸미기</button>
          <button type="button" className={studioMode === 'challenge' ? 'active' : ''} onClick={() => selectMode('challenge')}>문제 맞추기</button>
          <button type="button" className={studioMode === 'ranking' ? 'active' : ''} onClick={() => selectMode('ranking')}>순위</button>
        </nav>
        <button className="icon-button" type="button" onClick={reset} title="처음부터 다시 만들기">
          <ArrowCounterClockwise />
          <span>초기화</span>
        </button>
      </header>

      <main id="studio" className="workspace">
        <section className="intro-panel" aria-labelledby="main-title">
          <div>
            <p className="eyebrow">나를 닮은 작은 세계</p>
            <h1 id="main-title">사진 한 장,<br />움직이는 나.</h1>
            <p className="intro-copy">모습을 읽고, 색을 고르고, 움직임을 더해 나만의 아바타를 완성하세요.</p>
          </div>

          <div
            className={`upload-box ${dragging ? 'is-dragging' : ''} ${photo ? 'has-photo' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void loadFile(event.dataTransfer.files[0])
            }}
          >
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
            {photo ? (
              <>
                <img src={photo} alt="업로드한 원본 사진" />
                <button className="replace-photo" type="button" onClick={() => inputRef.current?.click()}>
                  <ImageSquare /> 사진 바꾸기
                </button>
              </>
            ) : (
              <button className="upload-trigger" type="button" onClick={() => inputRef.current?.click()}>
                <span className="upload-icon"><UploadSimple /></span>
                <strong>사진을 놓아주세요</strong>
                <span>또는 눌러서 파일 선택</span>
              </button>
            )}
          </div>

          <div className={`analysis-line ${status}`} aria-live="polite">
            {status === 'empty' && <><span className="status-knot" /> JPG, PNG, WEBP</>}
            {status === 'reading' && <><span className="status-knot" /> 사진의 색과 얼굴을 읽는 중</>}
            {status === 'done' && <><Check weight="bold" /> {faceFound ? '얼굴을 찾아 특징을 반영했어요' : '사진의 색을 아바타에 반영했어요'}</>}
            {status === 'error' && <>이미지 파일을 다시 선택해주세요</>}
          </div>
          {fileName && <p className="file-name" title={fileName}>{fileName}</p>}
        </section>

        <section className="stage-panel" aria-label="아바타 미리보기">
          <div className="stage-head">
            <div>
              <span>LIVE STAGE</span>
              <strong>
                {studioMode === 'challenge'
                  ? `${currentChallenge.label} / ${challengePhase === 'running' ? `${timeLeft.toFixed(1)}초` : challengePhase === 'result' ? `${finalScore}%` : '도전 준비'}`
                  : webcamEnabled ? '웹캠 동작 연결 중' : `${motions.find((item) => item.id === options.motion)?.label} 동작 중`}
              </strong>
            </div>
            <div className="stage-actions">
              <button
                className={`webcam-action ${webcamEnabled ? 'active' : ''}`}
                type="button"
                onClick={() => webcamEnabled ? stopWebcam() : setWebcamEnabled(true)}
                aria-pressed={webcamEnabled}
              >
                {webcamEnabled ? <VideoCameraSlash /> : <VideoCamera />}
                <span>{webcamEnabled ? '추적 끄기' : '웹캠 연결'}</span>
              </button>
              <button className="round-action" type="button" onClick={randomize} title="스타일 섞기">
                <Shuffle />
              </button>
            </div>
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} aria-label="현재 설정으로 움직이는 아바타" />
            {webcamEnabled && (
              <Suspense fallback={<div className="webcam-preview loading"><div className="webcam-status"><VideoCamera /><span>추적 엔진 불러오는 중</span></div></div>}>
                <WebcamPose
                  enabled={webcamEnabled}
                  captureRequest={captureRequest}
                  onClose={stopWebcam}
                  onPose={handleLivePose}
                  onCapture={handleCapture}
                />
              </Suspense>
            )}
            <div className="stage-corner top-left" />
            <div className="stage-corner top-right" />
            <div className="stage-corner bottom-left" />
            <div className="stage-corner bottom-right" />
          </div>
          <div className="scene-strip" aria-label="배경 선택">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className={options.scene === scene.id ? 'active' : ''}
                onClick={() => update('scene', scene.id)}
                aria-pressed={options.scene === scene.id}
              >
                <span className="scene-swatch" style={{ background: `linear-gradient(145deg, ${scene.colors[0]}, ${scene.colors[1]})` }} />
                <span>{scene.label}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className={`control-panel mode-${studioMode}`} aria-label="아바타 편집 도구">
          {studioMode === 'customize' ? (
          <>
          <div className="control-title">
            <div>
              <p>내 아바타</p>
              <h2>어떤 모습일까요?</h2>
            </div>
            <MagicWand weight="duotone" />
          </div>

          <div className="tabs" role="tablist" aria-label="편집 종류">
            <button type="button" className={tab === 'look' ? 'active' : ''} onClick={() => setTab('look')} role="tab" aria-selected={tab === 'look'}>모습</button>
            <button type="button" className={tab === 'move' ? 'active' : ''} onClick={() => setTab('move')} role="tab" aria-selected={tab === 'move'}>움직임</button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {tab === 'look' ? (
              <motion.div key="look" className="tab-content" initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? {} : { opacity: 0, x: -10 }}>
                <fieldset>
                  <legend>헤어 스타일</legend>
                  <div className="style-grid">
                    {hairStyles.map((style) => (
                      <button key={style.id} type="button" className={options.hairStyle === style.id ? 'active' : ''} onClick={() => update('hairStyle', style.id)} aria-pressed={options.hairStyle === style.id}>
                        <span className={`hair-glyph ${style.id}`} />
                        {style.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <ColorField label="피부색" values={swatches.skin} value={options.skin} onChange={(value) => update('skin', value)} />
                <ColorField label="머리색" values={swatches.hair} value={options.hair} onChange={(value) => update('hair', value)} />
                <ColorField label="상의색" values={swatches.shirt} value={options.shirt} onChange={(value) => update('shirt', value)} />

                <fieldset>
                  <legend>로봇 친구</legend>
                  <div className="segmented">
                    {(['none', 'left', 'right'] as RobotSide[]).map((side) => (
                      <button key={side} type="button" className={options.robot === side ? 'active' : ''} onClick={() => update('robot', side)}>
                        {side === 'none' ? '없음' : side === 'left' ? '왼쪽' : '오른쪽'}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </motion.div>
            ) : (
              <motion.div key="move" className="tab-content motion-list" initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? {} : { opacity: 0, x: -10 }}>
                {webcamEnabled && (
                  <p className="live-hint"><VideoCamera weight="fill" /> 지금은 웹캠 동작이 우선 적용됩니다</p>
                )}
                {motions.map((item, index) => (
                  <button key={item.id} type="button" className={options.motion === item.id ? 'active' : ''} onClick={() => update('motion', item.id)}>
                    <span className="motion-icon">
                      {index === 0 ? <Sparkle /> : index === 1 ? <HandWaving /> : <PersonSimpleRun />}
                    </span>
                    <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                    {options.motion === item.id && <Check weight="bold" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button className="download-button" type="button" onClick={download}>
            <DownloadSimple weight="bold" /> 이미지로 저장
            <ArrowDown weight="bold" />
          </button>
          <p className="save-note"><Robot /> 현재 장면을 PNG로 저장합니다</p>
          </>
          ) : studioMode === 'challenge' ? (
          <>
            <div className="control-title">
              <div>
                <p>포즈 챌린지</p>
                <h2>로봇처럼 움직여요</h2>
              </div>
              <GameController weight="duotone" />
            </div>

            <div className="challenge-target">
              <div>
                <span>이번 문제</span>
                <h3>{currentChallenge.label}</h3>
                <p>{currentChallenge.cue}</p>
              </div>
              <Robot weight="duotone" />
            </div>

            <div className={`challenge-score ${challengePhase}`} aria-live="polite">
              <div className="score-number">
                <strong>{challengePhase === 'result' ? finalScore : liveScore}</strong>
                <span>%</span>
              </div>
              <div className="challenge-clock">
                <Timer weight="duotone" />
                <span>{challengePhase === 'running' ? `${timeLeft.toFixed(1)}초` : '제한 시간 5초'}</span>
              </div>
            </div>

            {challengePhase === 'idle' && (
              <div className="challenge-actions">
                <p>10개 포즈 중 하나가 무작위로 나옵니다. 전신이 인식되면 5초가 시작돼요.</p>
                <button className="primary-game-button" type="button" onClick={startChallenge}><Play weight="fill" /> 도전 시작</button>
              </div>
            )}

            {challengePhase === 'waiting' && (
              <div className="challenge-waiting">
                <VideoCamera weight="duotone" />
                <strong>전신을 찾고 있어요</strong>
                <p>카메라에서 조금 물러나 어깨부터 발목까지 보여주세요.</p>
              </div>
            )}

            {challengePhase === 'running' && (
              <div className="challenge-running">
                <strong>로봇 포즈를 그대로 따라하세요</strong>
                <p>시간이 끝나는 순간의 자세로 점수가 결정됩니다.</p>
              </div>
            )}

            {challengePhase === 'result' && (
              <div className="result-form">
                <div className="result-photo">
                  {resultPhoto ? <img src={resultPhoto} alt="도전 종료 순간의 웹캠 사진" /> : <span><VideoCamera /> 사진 저장 중</span>}
                  <strong>{finalScore}%</strong>
                </div>
                <label htmlFor="player-name">순위에 표시할 이름</label>
                <input id="player-name" value={playerName} maxLength={16} onChange={(event) => setPlayerName(event.target.value)} placeholder="이름을 입력하세요" autoComplete="nickname" />
                <button className="primary-game-button" type="button" onClick={saveResult} disabled={!playerName.trim() || !resultPhoto}><FloppyDisk weight="bold" /> 순위에 저장</button>
                <button className="secondary-game-button" type="button" onClick={startChallenge}>다시 도전</button>
              </div>
            )}
          </>
          ) : (
          <>
            <div className="control-title">
              <div>
                <p>명예의 전당</p>
                <h2>포즈 싱크 순위</h2>
              </div>
              <Trophy weight="duotone" />
            </div>

            <div className="ranking-list">
              {leaderboard.length === 0 ? (
                <div className="ranking-empty">
                  <Trophy weight="duotone" />
                  <strong>첫 기록을 만들어보세요</strong>
                  <p>문제 맞추기에서 포즈를 따라하면 여기에 순위가 저장됩니다.</p>
                </div>
              ) : leaderboard.map((entry, index) => (
                <article className="ranking-row" key={entry.id}>
                  <span className="rank-number">{index + 1}</span>
                  <div className="rank-photo">
                    {entry.photo ? <img src={entry.photo} alt={`${entry.name}의 도전 사진`} /> : <Robot />}
                  </div>
                  <div className="rank-person">
                    <strong>{entry.name}</strong>
                    <small>{entry.poseLabel}</small>
                  </div>
                  <strong className="rank-score">{entry.score}%</strong>
                </article>
              ))}
            </div>
            <button className="primary-game-button ranking-start" type="button" onClick={startChallenge}><Play weight="fill" /> 새 기록 도전</button>
          </>
          )}
        </aside>
      </main>
    </div>
  )
}

function ColorField({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="color-field">
      <legend>{label}</legend>
      <div className="swatches">
        {values.map((color) => (
          <button key={color} type="button" className={value.toLowerCase() === color.toLowerCase() ? 'active' : ''} style={{ '--swatch': color } as React.CSSProperties} onClick={() => onChange(color)} aria-label={`${label} ${color}`} aria-pressed={value.toLowerCase() === color.toLowerCase()}>
            {value.toLowerCase() === color.toLowerCase() && <Check weight="bold" />}
          </button>
        ))}
        {!values.includes(value.toLowerCase()) && <span className="sampled-color" style={{ '--swatch': value } as React.CSSProperties} title="사진에서 가져온 색"><Sparkle weight="fill" /></span>}
      </div>
    </fieldset>
  )
}

export default App
