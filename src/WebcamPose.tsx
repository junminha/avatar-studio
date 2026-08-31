import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { CameraRotate, CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import type { LivePose } from './types'

type TrackerStatus = 'loading' | 'ready' | 'searching' | 'error'

interface WebcamPoseProps {
  enabled: boolean
  captureRequest: number
  onClose: () => void
  onPose: (pose: LivePose | null) => void
  onCapture: (photo: string) => void
}

const majorLandmarks = [7, 8, 11, 12, 13, 14, 15, 16, 19, 20, 23, 24, 25, 26, 27, 28, 31, 32]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function mirror(point: NormalizedLandmark) {
  return { x: 1 - point.x, y: point.y }
}

function angleFromDown(a: NormalizedLandmark, b: NormalizedLandmark) {
  const start = mirror(a)
  const end = mirror(b)
  return Math.atan2(-(end.x - start.x), end.y - start.y)
}

function angleFromRight(a: NormalizedLandmark, b: NormalizedLandmark) {
  const start = mirror(a)
  const end = mirror(b)
  return Math.atan2(end.y - start.y, end.x - start.x)
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function palmDirection(wrist: NormalizedLandmark, index: NormalizedLandmark, pinky: NormalizedLandmark) {
  const palm = { ...index, x: (index.x + pinky.x) / 2, y: (index.y + pinky.y) / 2 }
  return angleFromRight(wrist, palm)
}

function handSpread(wrist: NormalizedLandmark, index: NormalizedLandmark, pinky: NormalizedLandmark) {
  const palmLength = Math.max(distance(wrist, index), 0.001)
  return clamp(distance(index, pinky) / palmLength, 0.28, 1.15)
}

function lerp(previous: number, next: number, amount = 0.38) {
  return previous + (next - previous) * amount
}

function smoothPose(previous: LivePose | null, next: LivePose): LivePose {
  if (!previous) return next
  return {
    bodyLean: lerp(previous.bodyLean, next.bodyLean),
    headTilt: lerp(previous.headTilt, next.headTilt),
    neckLean: lerp(previous.neckLean, next.neckLean),
    hipLift: lerp(previous.hipLift, next.hipLift, 0.28),
    leftUpperArm: lerp(previous.leftUpperArm, next.leftUpperArm),
    leftForearm: lerp(previous.leftForearm, next.leftForearm),
    leftHand: lerp(previous.leftHand, next.leftHand),
    leftHandSpread: lerp(previous.leftHandSpread, next.leftHandSpread),
    leftArmFront: lerp(previous.leftArmFront, next.leftArmFront, 0.24),
    leftArmDepth: lerp(previous.leftArmDepth, next.leftArmDepth, 0.24),
    rightUpperArm: lerp(previous.rightUpperArm, next.rightUpperArm),
    rightForearm: lerp(previous.rightForearm, next.rightForearm),
    rightHand: lerp(previous.rightHand, next.rightHand),
    rightHandSpread: lerp(previous.rightHandSpread, next.rightHandSpread),
    rightArmFront: lerp(previous.rightArmFront, next.rightArmFront, 0.24),
    rightArmDepth: lerp(previous.rightArmDepth, next.rightArmDepth, 0.24),
    leftUpperLeg: lerp(previous.leftUpperLeg, next.leftUpperLeg, 0.3),
    leftLowerLeg: lerp(previous.leftLowerLeg, next.leftLowerLeg, 0.3),
    leftFoot: lerp(previous.leftFoot, next.leftFoot, 0.3),
    rightUpperLeg: lerp(previous.rightUpperLeg, next.rightUpperLeg, 0.3),
    rightLowerLeg: lerp(previous.rightLowerLeg, next.rightLowerLeg, 0.3),
    rightFoot: lerp(previous.rightFoot, next.rightFoot, 0.3),
    confidence: next.confidence,
  }
}

function toLivePose(landmarks: NormalizedLandmark[], baselineHip: number) {
  const leftShoulder = mirror(landmarks[11])
  const rightShoulder = mirror(landmarks[12])
  const nose = mirror(landmarks[0])
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2
  const hipY = (landmarks[23].y + landmarks[24].y) / 2
  const torsoDepth = (landmarks[11].z + landmarks[12].z + landmarks[23].z + landmarks[24].z) / 4
  const shoulderMinX = Math.min(leftShoulder.x, rightShoulder.x)
  const shoulderMaxX = Math.max(leftShoulder.x, rightShoulder.x)
  const armLayer = (elbowIndex: number, wristIndex: number) => {
    const wrist = mirror(landmarks[wristIndex])
    const depth = (landmarks[elbowIndex].z * 0.35 + landmarks[wristIndex].z * 0.65) - torsoDepth
    const crossingTorso = wrist.x > shoulderMinX - 0.03
      && wrist.x < shoulderMaxX + 0.03
      && wrist.y > Math.min(leftShoulder.y, rightShoulder.y) - 0.07
      && wrist.y < hipY + 0.08
    return {
      depth,
      front: crossingTorso ? 1 : depth < -0.035 ? 0.82 : 0.08,
    }
  }
  const leftLayer = armLayer(13, 15)
  const rightLayer = armLayer(14, 16)
  const confidence = majorLandmarks.reduce((sum, index) => sum + (landmarks[index].visibility ?? 0), 0) / majorLandmarks.length

  return {
    bodyLean: clamp(Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x), -0.3, 0.3),
    headTilt: clamp(angleFromRight(landmarks[7], landmarks[8]), -0.42, 0.42),
    neckLean: clamp((nose.x - shoulderMidX) * 1.8, -0.34, 0.34),
    hipLift: clamp((baselineHip - hipY) * 3.2, 0, 0.25),
    leftUpperArm: angleFromDown(landmarks[11], landmarks[13]),
    leftForearm: angleFromDown(landmarks[13], landmarks[15]),
    leftHand: palmDirection(landmarks[15], landmarks[19], landmarks[17]),
    leftHandSpread: handSpread(landmarks[15], landmarks[19], landmarks[17]),
    leftArmFront: leftLayer.front,
    leftArmDepth: leftLayer.depth,
    rightUpperArm: angleFromDown(landmarks[12], landmarks[14]),
    rightForearm: angleFromDown(landmarks[14], landmarks[16]),
    rightHand: palmDirection(landmarks[16], landmarks[20], landmarks[18]),
    rightHandSpread: handSpread(landmarks[16], landmarks[20], landmarks[18]),
    rightArmFront: rightLayer.front,
    rightArmDepth: rightLayer.depth,
    leftUpperLeg: angleFromDown(landmarks[23], landmarks[25]),
    leftLowerLeg: angleFromDown(landmarks[25], landmarks[27]),
    leftFoot: angleFromRight(landmarks[27], landmarks[31]),
    rightUpperLeg: angleFromDown(landmarks[24], landmarks[26]),
    rightLowerLeg: angleFromDown(landmarks[26], landmarks[28]),
    rightFoot: angleFromRight(landmarks[28], landmarks[32]),
    confidence,
  }
}

export function WebcamPose({ enabled, captureRequest, onClose, onPose, onCapture }: WebcamPoseProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<TrackerStatus>('loading')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let frame = 0
    let stream: MediaStream | null = null
    let landmarker: PoseLandmarker | null = null
    let lastVideoTime = -1
    let nextDetectionAt = 0
    let hadPose = false
    let baselineHip: number | null = null
    let smoothedPose: LivePose | null = null

    const start = async () => {
      setStatus('loading')
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const vision = await FilesetResolver.forVisionTasks('/wasm')
        const options = {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'GPU' as const,
          },
          runningMode: 'VIDEO' as const,
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
        }
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, options)
        } catch {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'CPU' },
          })
        }
        if (cancelled) {
          landmarker.close()
          return
        }
        setStatus('searching')

        const detect = (time: number) => {
          if (cancelled || !landmarker || !videoRef.current) return
          const currentVideo = videoRef.current
          if (currentVideo.readyState >= 2 && currentVideo.currentTime !== lastVideoTime && time >= nextDetectionAt) {
            lastVideoTime = currentVideo.currentTime
            nextDetectionAt = time + 50
            const result = landmarker.detectForVideo(currentVideo, time)
            const landmarks = result.landmarks[0]
            if (landmarks) {
              const hipY = (landmarks[23].y + landmarks[24].y) / 2
              if (baselineHip === null) baselineHip = hipY
              if (hipY > baselineHip) baselineHip = lerp(baselineHip, hipY, 0.025)
              else baselineHip = lerp(baselineHip, hipY, 0.002)
              const next = toLivePose(landmarks, baselineHip)
              if (next.confidence > 0.42) {
                smoothedPose = smoothPose(smoothedPose, next)
                onPose(smoothedPose)
                if (!hadPose) {
                  hadPose = true
                  setStatus('ready')
                }
              }
            } else if (hadPose) {
              hadPose = false
              smoothedPose = null
              onPose(null)
              setStatus('searching')
            }
          }
          frame = requestAnimationFrame(detect)
        }
        frame = requestAnimationFrame(detect)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void start()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      landmarker?.close()
      onPose(null)
    }
  }, [enabled, onPose])

  useEffect(() => {
    if (captureRequest === 0) return
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      onCapture('')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onCapture('')
      return
    }
    const sourceRatio = video.videoWidth / video.videoHeight
    const targetRatio = canvas.width / canvas.height
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight
    let sourceX = 0
    let sourceY = 0
    if (sourceRatio > targetRatio) {
      sourceWidth = video.videoHeight * targetRatio
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      sourceHeight = video.videoWidth / targetRatio
      sourceY = (video.videoHeight - sourceHeight) / 2
    }
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.76))
  }, [captureRequest, onCapture])

  const label = status === 'loading'
    ? '포즈 모델 준비 중'
    : status === 'ready'
      ? '동작을 따라가는 중'
      : status === 'searching'
        ? '전신이 보이게 서주세요'
        : '카메라를 사용할 수 없어요'

  return (
    <div className={`webcam-preview ${status}`} aria-live="polite">
      <video ref={videoRef} muted playsInline aria-label="웹캠 동작 추적 영상" />
      <div className="webcam-shade" />
      <div className="webcam-status">
        {status === 'ready' ? <CheckCircle weight="fill" /> : status === 'error' ? <WarningCircle weight="fill" /> : <CameraRotate />}
        <span>{label}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="웹캠 추적 닫기"><X weight="bold" /></button>
    </div>
  )
}
