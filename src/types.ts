export type Scene = 'studio' | 'sunset' | 'day' | 'cyber'
export type MotionName = 'idle' | 'wave' | 'dance' | 'jump' | 'cross'
export type HairStyle = 'crop' | 'wave' | 'bob' | 'spike'
export type RobotSide = 'none' | 'left' | 'right'

export interface AvatarOptions {
  skin: string
  hair: string
  shirt: string
  trousers: string
  hairStyle: HairStyle
  scene: Scene
  motion: MotionName
  robot: RobotSide
}

export interface AnalysisResult {
  faceFound: boolean
  skin: string
  hair: string
  shirt: string
}

export interface LivePose {
  bodyLean: number
  headTilt: number
  neckLean: number
  hipLift: number
  leftUpperArm: number
  leftForearm: number
  leftHand: number
  leftHandSpread: number
  leftArmFront: number
  leftArmDepth: number
  rightUpperArm: number
  rightForearm: number
  rightHand: number
  rightHandSpread: number
  rightArmFront: number
  rightArmDepth: number
  leftUpperLeg: number
  leftLowerLeg: number
  leftFoot: number
  rightUpperLeg: number
  rightLowerLeg: number
  rightFoot: number
  confidence: number
}

export interface RobotPose {
  bodyLean: number
  leftUpperArm: number
  leftForearm: number
  rightUpperArm: number
  rightForearm: number
  leftUpperLeg: number
  leftLowerLeg: number
  rightUpperLeg: number
  rightLowerLeg: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  photo: string
  poseLabel: string
  createdAt: number
}
