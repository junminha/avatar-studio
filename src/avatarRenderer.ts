import type { AvatarOptions, LivePose, RobotPose } from './types'

type Ctx = CanvasRenderingContext2D

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
}

function drawBackground(ctx: Ctx, width: number, height: number, scene: AvatarOptions['scene'], t: number) {
  const gradients: Record<AvatarOptions['scene'], [string, string, string]> = {
    studio: ['#dce8e3', '#b7d4c8', '#f4d591'],
    sunset: ['#6670a4', '#ef8c72', '#f6d59a'],
    day: ['#7fc6df', '#cce7d4', '#f7e5a9'],
    cyber: ['#17243b', '#31526b', '#d26475'],
  }
  const [top, middle, bottom] = gradients[scene]
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, top)
  sky.addColorStop(0.62, middle)
  sky.addColorStop(1, bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalAlpha = scene === 'cyber' ? 0.34 : 0.2
  ctx.fillStyle = scene === 'cyber' ? '#80e0ce' : '#fff9e8'
  const orbX = width * (scene === 'sunset' ? 0.74 : 0.2)
  const orbY = height * 0.23
  ctx.beginPath()
  ctx.arc(orbX, orbY, 65 + Math.sin(t * 0.0007) * 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = scene === 'cyber' ? 0.45 : 0.26
  ctx.fillStyle = scene === 'cyber' ? '#07111e' : '#5d796e'
  for (let i = 0; i < 7; i++) {
    const h = 42 + ((i * 31) % 120)
    ctx.fillRect(i * (width / 6) - 24, height - h - 40, width / 7 + 22, h)
  }
  ctx.restore()

  const floor = ctx.createLinearGradient(0, height * 0.72, 0, height)
  floor.addColorStop(0, scene === 'cyber' ? 'rgba(7,17,30,.5)' : 'rgba(75,95,86,.12)')
  floor.addColorStop(1, scene === 'cyber' ? '#0b1523' : 'rgba(240,242,224,.76)')
  ctx.fillStyle = floor
  ctx.fillRect(0, height * 0.72, width, height * 0.28)

  if (scene === 'cyber') {
    ctx.save()
    ctx.strokeStyle = 'rgba(128,224,206,.2)'
    ctx.lineWidth = 1
    for (let x = -width; x < width * 2; x += 42) {
      ctx.beginPath()
      ctx.moveTo(width / 2, height * 0.72)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = height * 0.76; y < height; y += 26) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawRobot(ctx: Ctx, x: number, y: number, t: number, pose?: RobotPose | null) {
  const bob = pose ? 0 : Math.sin(t * 0.003) * 4
  const leftUpperArm = pose?.leftUpperArm ?? 0.25
  const leftForearm = pose?.leftForearm ?? 0.25
  const rightUpperArm = pose?.rightUpperArm ?? -0.25
  const rightForearm = pose?.rightForearm ?? -0.25
  const leftUpperLeg = pose?.leftUpperLeg ?? 0.04
  const leftLowerLeg = pose?.leftLowerLeg ?? 0.04
  const rightUpperLeg = pose?.rightUpperLeg ?? -0.04
  const rightLowerLeg = pose?.rightLowerLeg ?? -0.04
  const bodyLean = pose?.bodyLean ?? 0
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.rotate(bodyLean)

  const leftFoot = articulatedLimb(ctx, -13, 55, 22, 23, 8, leftUpperLeg - bodyLean, leftLowerLeg - bodyLean, '#9db5ac')
  const rightFoot = articulatedLimb(ctx, 13, 55, 22, 23, 8, rightUpperLeg - bodyLean, rightLowerLeg - bodyLean, '#9db5ac')
  ctx.fillStyle = '#273832'
  ctx.beginPath()
  ctx.ellipse(leftFoot.x, leftFoot.y + 2, 10, 4, 0, 0, Math.PI * 2)
  ctx.ellipse(rightFoot.x, rightFoot.y + 2, 10, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#273832'
  ctx.fillStyle = '#b7cbc3'
  ctx.lineWidth = 4
  roundedRect(ctx, -25, -7, 50, 64, 15)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#087f5b'
  ctx.beginPath()
  ctx.arc(0, 16, 8, 0, Math.PI * 2)
  ctx.fill()

  const leftHand = articulatedLimb(ctx, -25, 5, 27, 25, 7, leftUpperArm - bodyLean, leftForearm - bodyLean, '#a9c1b8')
  const rightHand = articulatedLimb(ctx, 25, 5, 27, 25, 7, rightUpperArm - bodyLean, rightForearm - bodyLean, '#a9c1b8')
  ctx.fillStyle = '#d7e3de'
  ctx.strokeStyle = '#273832'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(leftHand.x, leftHand.y, 6, 0, Math.PI * 2)
  ctx.arc(rightHand.x, rightHand.y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#d7e3de'
  ctx.lineWidth = 4
  roundedRect(ctx, -31, -62, 62, 51, 15)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#087f5b'
  roundedRect(ctx, -20, -49, 40, 22, 8)
  ctx.fill()
  ctx.fillStyle = '#eaf5f1'
  ctx.beginPath()
  ctx.arc(-9, -38, 4, 0, Math.PI * 2)
  ctx.arc(9, -38, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#273832'
  ctx.beginPath()
  ctx.moveTo(0, -62)
  ctx.lineTo(0, -76)
  ctx.lineTo(10, -82)
  ctx.stroke()
  ctx.restore()
}

function motionPose(motion: AvatarOptions['motion'], t: number) {
  const beat = t * 0.004
  const base = {
    bob: Math.sin(beat) * 2.5,
    body: Math.sin(beat * 0.55) * 0.018,
    head: Math.sin(beat * 0.55) * 0.025,
    neck: 0,
    armL: -0.04,
    forearmL: -0.04,
    handL: Math.PI / 2 - 0.04,
    handSpreadL: 0.56,
    armFrontL: 0.08,
    armDepthL: 0,
    armR: 0.04,
    forearmR: 0.04,
    handR: Math.PI / 2 + 0.04,
    handSpreadR: 0.56,
    armFrontR: 0.08,
    armDepthR: 0,
    legL: -0.025,
    lowerLegL: -0.025,
    footL: Math.PI,
    legR: 0.025,
    lowerLegR: 0.025,
    footR: 0,
  }
  if (motion === 'wave') {
    return {
      ...base,
      bob: Math.sin(beat) * 1.5,
      armR: -2.25,
      forearmR: -2.8 + Math.sin(beat * 2) * 0.32,
      handR: -1.3 + Math.sin(beat * 2) * 0.35,
      handSpreadR: 0.9,
      armFrontR: 0.9,
      armDepthR: -0.1,
    }
  }
  if (motion === 'dance') {
    return {
      ...base,
      bob: -Math.abs(Math.sin(beat * 1.7)) * 12,
      body: Math.sin(beat) * 0.11,
      head: -Math.sin(beat) * 0.08,
      armL: -0.72 + Math.sin(beat) * 0.52,
      forearmL: -0.25 + Math.sin(beat) * 0.45,
      handL: Math.PI / 2 + Math.sin(beat) * 0.45,
      armFrontL: 0.82,
      armDepthL: -0.07,
      armR: 0.72 + Math.sin(beat) * 0.52,
      forearmR: 0.25 + Math.sin(beat) * 0.45,
      handR: Math.PI / 2 + Math.sin(beat) * 0.45,
      armFrontR: 0.82,
      armDepthR: -0.06,
      legL: Math.sin(beat) * 0.18,
      lowerLegL: Math.sin(beat) * 0.11,
      legR: -Math.sin(beat) * 0.18,
      lowerLegR: -Math.sin(beat) * 0.11,
    }
  }
  if (motion === 'jump') {
    return {
      ...base,
      bob: -Math.abs(Math.sin(beat * 1.4)) * 34,
      armL: -1.05,
      forearmL: -1.35,
      handL: -0.25,
      armR: 1.05,
      forearmR: 1.35,
      handR: Math.PI + 0.25,
      legL: -0.14,
      lowerLegL: -0.36,
      legR: 0.14,
      lowerLegR: 0.36,
    }
  }
  if (motion === 'cross') {
    return {
      ...base,
      bob: Math.sin(beat) * 1.2,
      armL: -0.44,
      forearmL: -1.4,
      handL: 0.05,
      handSpreadL: 0.45,
      armFrontL: 1,
      armDepthL: -0.1,
      armR: 0.44,
      forearmR: 1.4,
      handR: Math.PI - 0.05,
      handSpreadR: 0.45,
      armFrontR: 1,
      armDepthR: -0.07,
    }
  }
  return base
}

function limb(ctx: Ctx, x: number, y: number, length: number, width: number, angle: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, length)
  ctx.stroke()
  ctx.restore()
}

function articulatedLimb(
  ctx: Ctx,
  x: number,
  y: number,
  upperLength: number,
  lowerLength: number,
  width: number,
  upperAngle: number,
  lowerAngle: number,
  color: string,
) {
  const elbowX = x - Math.sin(upperAngle) * upperLength
  const elbowY = y + Math.cos(upperAngle) * upperLength
  const endX = elbowX - Math.sin(lowerAngle) * lowerLength
  const endY = elbowY + Math.cos(lowerAngle) * lowerLength
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(elbowX, elbowY)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = 'rgba(25, 45, 38, .14)'
  ctx.lineWidth = width + 3
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(elbowX, elbowY)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(elbowX, elbowY, width * 0.48, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(25, 45, 38, .12)'
  ctx.lineWidth = 1.25
  ctx.stroke()
  return { jointX: elbowX, jointY: elbowY, x: endX, y: endY }
}

function drawHair(ctx: Ctx, style: AvatarOptions['hairStyle'], color: string) {
  ctx.fillStyle = color
  if (style === 'crop') {
    ctx.beginPath()
    ctx.ellipse(0, -6, 34, 29, 0, Math.PI, Math.PI * 2)
    ctx.lineTo(31, -1)
    ctx.quadraticCurveTo(4, -20, -31, 1)
    ctx.closePath()
    ctx.fill()
  } else if (style === 'wave') {
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(i * 9.7, -12 + Math.abs(i) * 1.6, 13, Math.PI, Math.PI * 2)
      ctx.fill()
    }
  } else if (style === 'bob') {
    ctx.beginPath()
    ctx.ellipse(0, 0, 39, 42, 0, Math.PI, Math.PI * 2)
    ctx.fillRect(-39, -2, 11, 47)
    ctx.fillRect(28, -2, 11, 47)
  } else {
    ctx.beginPath()
    ctx.moveTo(-33, 1)
    ctx.lineTo(-28, -33)
    ctx.lineTo(-14, -14)
    ctx.lineTo(-2, -41)
    ctx.lineTo(10, -14)
    ctx.lineTo(27, -32)
    ctx.lineTo(33, 3)
    ctx.closePath()
    ctx.fill()
  }
}

function drawHand(ctx: Ctx, x: number, y: number, angle: number, color: string, spread: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(25, 45, 38, .14)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(0, 0, 10 + spread * 3.5, 7.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(-2, 7, 4.5, 6, 0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawArm(
  ctx: Ctx,
  shoulderX: number,
  upperAngle: number,
  lowerAngle: number,
  handAngle: number,
  handSpread: number,
  angleCorrection: number,
  skin: string,
  shirt: string,
) {
  const hand = articulatedLimb(
    ctx,
    shoulderX,
    -99,
    52,
    51,
    16,
    upperAngle - angleCorrection,
    lowerAngle - angleCorrection,
    skin,
  )
  drawHand(ctx, hand.x, hand.y, handAngle - angleCorrection, skin, handSpread)
  ctx.fillStyle = shirt
  ctx.strokeStyle = 'rgba(25, 45, 38, .1)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(shoulderX, -99, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function drawFoot(ctx: Ctx, x: number, y: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = '#2d3935'
  ctx.strokeStyle = 'rgba(238, 248, 244, .24)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(8, 0, 22, 9.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawAvatar(ctx: Ctx, x: number, y: number, options: AvatarOptions, t: number, livePose?: LivePose | null) {
  const scripted = motionPose(options.motion, t)
  const isLive = Boolean(livePose && livePose.confidence > 0.42)
  const pose = isLive && livePose ? {
    bob: -livePose.hipLift * 220,
    body: livePose.bodyLean,
    head: livePose.headTilt,
    neck: livePose.neckLean,
    armL: livePose.leftUpperArm,
    forearmL: livePose.leftForearm,
    handL: livePose.leftHand,
    handSpreadL: livePose.leftHandSpread,
    armFrontL: livePose.leftArmFront,
    armDepthL: livePose.leftArmDepth,
    armR: livePose.rightUpperArm,
    forearmR: livePose.rightForearm,
    handR: livePose.rightHand,
    handSpreadR: livePose.rightHandSpread,
    armFrontR: livePose.rightArmFront,
    armDepthR: livePose.rightArmDepth,
    legL: livePose.leftUpperLeg,
    lowerLegL: livePose.leftLowerLeg,
    footL: livePose.leftFoot,
    legR: livePose.rightUpperLeg,
    lowerLegR: livePose.rightLowerLeg,
    footR: livePose.rightFoot,
  } : scripted
  const angleCorrection = isLive ? pose.body : 0
  ctx.save()
  ctx.translate(x, y + pose.bob)
  ctx.rotate(pose.body)

  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = '#17352b'
  ctx.beginPath()
  ctx.ellipse(0, 147 - pose.bob, 62, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const leftFoot = articulatedLimb(ctx, -24, 0, 64, 62, 22, pose.legL - angleCorrection, pose.lowerLegL - angleCorrection, options.trousers)
  const rightFoot = articulatedLimb(ctx, 24, 0, 64, 62, 22, pose.legR - angleCorrection, pose.lowerLegR - angleCorrection, options.trousers)
  drawFoot(ctx, leftFoot.x, leftFoot.y, pose.footL - angleCorrection)
  drawFoot(ctx, rightFoot.x, rightFoot.y, pose.footR - angleCorrection)

  const arms = [
    {
      side: 'left',
      shoulderX: -44,
      upper: pose.armL,
      lower: pose.forearmL,
      hand: pose.handL,
      spread: pose.handSpreadL,
      front: pose.armFrontL > 0.46,
      depth: pose.armDepthL,
    },
    {
      side: 'right',
      shoulderX: 44,
      upper: pose.armR,
      lower: pose.forearmR,
      hand: pose.handR,
      spread: pose.handSpreadR,
      front: pose.armFrontR > 0.46,
      depth: pose.armDepthR,
    },
  ]
  const paintArm = (arm: typeof arms[number]) => drawArm(
    ctx,
    arm.shoulderX,
    arm.upper,
    arm.lower,
    arm.hand,
    arm.spread,
    angleCorrection,
    options.skin,
    options.shirt,
  )
  arms.filter((arm) => !arm.front).sort((a, b) => b.depth - a.depth).forEach(paintArm)

  const headX = pose.neck * 24
  ctx.strokeStyle = options.skin
  ctx.lineWidth = 18
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -108)
  ctx.lineTo(headX * 0.55, -126)
  ctx.stroke()

  ctx.fillStyle = options.shirt
  ctx.beginPath()
  ctx.moveTo(-44, -100)
  ctx.quadraticCurveTo(-51, -84, -42, -66)
  ctx.lineTo(-34, -7)
  ctx.quadraticCurveTo(0, 5, 34, -7)
  ctx.lineTo(42, -66)
  ctx.quadraticCurveTo(51, -84, 44, -100)
  ctx.quadraticCurveTo(0, -112, -44, -100)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.16)'
  roundedRect(ctx, -31, -92, 62, 11, 6)
  ctx.fill()

  ctx.fillStyle = options.trousers
  roundedRect(ctx, -36, -10, 72, 19, 8)
  ctx.fill()

  ctx.fillStyle = options.shirt
  ctx.beginPath()
  ctx.arc(-44, -98, 13, 0, Math.PI * 2)
  ctx.arc(44, -98, 13, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(headX, -154)
  ctx.rotate(pose.head - angleCorrection)
  ctx.fillStyle = options.skin
  ctx.beginPath()
  ctx.arc(-34, 1, 7, 0, Math.PI * 2)
  ctx.arc(34, 1, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, 0, 34, 39, 0, 0, Math.PI * 2)
  ctx.fill()
  drawHair(ctx, options.hairStyle, options.hair)

  ctx.fillStyle = '#26342f'
  ctx.beginPath()
  ctx.ellipse(-12, -2, 3, 4.5, 0, 0, Math.PI * 2)
  ctx.ellipse(12, -2, 3, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7b3f42'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 11, 9.5, 0.15, Math.PI - 0.15)
  ctx.stroke()
  ctx.restore()

  arms.filter((arm) => arm.front).sort((a, b) => b.depth - a.depth).forEach(paintArm)
  ctx.restore()
}

export function renderAvatar(canvas: HTMLCanvasElement, options: AvatarOptions, time = 0, livePose?: LivePose | null, robotPose?: RobotPose | null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(320, rect.width)
  const height = Math.max(420, rect.height)
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  drawBackground(ctx, width, height, options.scene, time)
  const scale = Math.min(width / 520, height / 520)
  ctx.save()
  ctx.translate(width / 2, height * 0.53)
  ctx.scale(scale, scale)
  drawAvatar(ctx, 0, 0, options, time, livePose)
  const robotSide = robotPose ? (options.robot === 'left' ? 'left' : 'right') : options.robot
  if (robotSide === 'left') drawRobot(ctx, -170, 112, time, robotPose)
  if (robotSide === 'right') drawRobot(ctx, 170, 112, time, robotPose)
  ctx.restore()
}
