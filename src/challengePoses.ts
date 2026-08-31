import type { LivePose, RobotPose } from './types'

export interface ChallengePose extends RobotPose {
  id: string
  label: string
  cue: string
}

export const challengePoses: ChallengePose[] = [
  { id: 'hands-up', label: '두 손 번쩍', cue: '양팔을 머리 위로 올리세요', bodyLean: 0, leftUpperArm: 2.7, leftForearm: 2.85, rightUpperArm: -2.7, rightForearm: -2.85, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'letter-t', label: '알파벳 T', cue: '양팔을 어깨 높이로 펴세요', bodyLean: 0, leftUpperArm: 1.57, leftForearm: 1.57, rightUpperArm: -1.57, rightForearm: -1.57, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'left-up', label: '왼손 들기', cue: '왼팔만 높이 들어보세요', bodyLean: 0, leftUpperArm: 2.85, leftForearm: 2.95, rightUpperArm: -0.05, rightForearm: -0.05, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'right-up', label: '오른손 들기', cue: '오른팔만 높이 들어보세요', bodyLean: 0, leftUpperArm: 0.05, leftForearm: 0.05, rightUpperArm: -2.85, rightForearm: -2.95, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'cross-arms', label: '팔짱 끼기', cue: '두 팔을 가슴 앞에서 교차하세요', bodyLean: 0, leftUpperArm: -0.44, leftForearm: -1.4, rightUpperArm: 0.44, rightForearm: 1.4, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'victory', label: '승리의 V', cue: '양팔을 넓게 위로 뻗으세요', bodyLean: 0, leftUpperArm: 2.35, leftForearm: 2.55, rightUpperArm: -2.35, rightForearm: -2.55, leftUpperLeg: 0.08, leftLowerLeg: 0.04, rightUpperLeg: -0.08, rightLowerLeg: -0.04 },
  { id: 'point-left', label: '왼쪽 가리키기', cue: '왼팔을 옆으로 펴고 오른손은 허리에', bodyLean: -0.06, leftUpperArm: 1.57, leftForearm: 1.57, rightUpperArm: -0.58, rightForearm: 0.78, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'point-right', label: '오른쪽 가리키기', cue: '오른팔을 옆으로 펴고 왼손은 허리에', bodyLean: 0.06, leftUpperArm: 0.58, leftForearm: -0.78, rightUpperArm: -1.57, rightForearm: -1.57, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'hands-hips', label: '양손 허리', cue: '양손을 허리에 올리세요', bodyLean: 0, leftUpperArm: 0.58, leftForearm: -0.78, rightUpperArm: -0.58, rightForearm: 0.78, leftUpperLeg: 0, leftLowerLeg: 0, rightUpperLeg: 0, rightLowerLeg: 0 },
  { id: 'star', label: '별 모양', cue: '양팔과 양다리를 넓게 펴세요', bodyLean: 0, leftUpperArm: 1.75, leftForearm: 1.75, rightUpperArm: -1.75, rightForearm: -1.75, leftUpperLeg: 0.34, leftLowerLeg: 0.34, rightUpperLeg: -0.34, rightLowerLeg: -0.34 },
]

function angleDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

export function calculateSyncScore(live: LivePose, target: RobotPose) {
  const comparisons: [number, number, number][] = [
    [live.leftUpperArm, target.leftUpperArm, 1.35],
    [live.leftForearm, target.leftForearm, 1.4],
    [live.rightUpperArm, target.rightUpperArm, 1.35],
    [live.rightForearm, target.rightForearm, 1.4],
    [live.leftUpperLeg, target.leftUpperLeg, 0.95],
    [live.leftLowerLeg, target.leftLowerLeg, 1.05],
    [live.rightUpperLeg, target.rightUpperLeg, 0.95],
    [live.rightLowerLeg, target.rightLowerLeg, 1.05],
  ]
  const jointScore = comparisons.reduce((sum, [actual, expected, tolerance]) => {
    return sum + Math.max(0, 1 - angleDistance(actual, expected) / tolerance)
  }, 0) / comparisons.length
  const bodyScore = Math.max(0, 1 - Math.abs(live.bodyLean - target.bodyLean) / 0.55)
  const confidenceWeight = Math.min(1, Math.max(0.72, live.confidence))
  return Math.round((jointScore * 0.9 + bodyScore * 0.1) * confidenceWeight * 100)
}
