import { BattleBridge, BattleIsland, BridgeStyle } from '../types/ship';

/**
 * Generates an organic, natural island polygon using multi-frequency harmonic perturbations.
 * Produces smooth, non-spiky, realistic coastlines, headlands, and coves.
 */
export function createNaturalIslandPolygon(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  steps: number = 32,
  seed: number = 1.0,
  roughness: number = 0.16
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const s = seed || 1.0;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(angle * 2 + s * 1.3) * (roughness * 0.48) +
      Math.cos(angle * 3 + s * 2.1) * (roughness * 0.32) +
      Math.sin(angle * 4 + s * 3.4) * (roughness * 0.16);
    const clampedWobble = Math.max(0.82, Math.min(1.18, wobble));
    points.push({
      x: Math.round(cx + Math.cos(angle) * radiusX * clampedWobble),
      y: Math.round(cy + Math.sin(angle) * radiusY * clampedWobble),
    });
  }
  return points;
}

/**
 * Generates massive, sophisticated continental landmasses with deep bays,
 * rounded capes, and curving organic coastlines (44 vertices, zero sharp spikes).
 */
export function createContinentalPolygon(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  seed: number = 1.0,
  steps: number = 44
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const s = seed || 1.0;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(angle * 2 + s * 1.2) * 0.13 +
      Math.cos(angle * 3 + s * 2.2) * 0.09 +
      Math.sin(angle * 4 + s * 3.1) * 0.05;
    const clampedWobble = Math.max(0.82, Math.min(1.18, wobble));
    points.push({
      x: Math.round(cx + Math.cos(angle) * radiusX * clampedWobble),
      y: Math.round(cy + Math.sin(angle) * radiusY * clampedWobble),
    });
  }
  return points;
}

/**
 * Generates an elongated, smoothly curving coastal barrier spit or sandbar with rounded tip.
 */
export function createSpitPolygon(
  cx: number,
  cy: number,
  length: number,
  width: number,
  headingAngle: number = 0,
  curvature: number = 0.22,
  seed: number = 1.0
): { x: number; y: number }[] {
  const steps = 36;
  const points: { x: number; y: number }[] = [];
  const cosH = Math.cos(headingAngle);
  const sinH = Math.sin(headingAngle);
  const s = seed || 1.0;

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const localX = Math.cos(a) * (length * 0.46);
    const lateralCurve = (1 - Math.cos(a)) * (length * curvature * 0.14);
    const localY = Math.sin(a) * (width * 0.44) + lateralCurve;
    const wobble = 1 + Math.sin(a * 2 + s * 1.7) * 0.07 + Math.cos(a * 3 + s * 2.5) * 0.04;

    const rx = localX * wobble;
    const ry = localY * wobble;
    const wx = cx + rx * cosH - ry * sinH;
    const wy = cy + rx * sinH + ry * cosH;
    points.push({ x: Math.round(wx), y: Math.round(wy) });
  }
  return points;
}

/**
 * Generates an organic, natural fortified coastal headland / bluff with rounded promontories.
 */
export function createBastionPolygon(
  cx: number,
  cy: number,
  radius: number,
  facets: number = 5,
  pointiness: number = 0.12,
  seed: number = 1.0
): { x: number; y: number }[] {
  const steps = 36;
  const points: { x: number; y: number }[] = [];
  const s = seed || 1.0;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wave =
      Math.sin(angle * Math.min(4, Math.max(3, facets)) + s * 1.5) * 0.09 +
      Math.cos(angle * 2 + s * 2.2) * 0.07;
    const r = radius * (1 + wave);
    points.push({
      x: Math.round(cx + Math.cos(angle) * r),
      y: Math.round(cy + Math.sin(angle) * r),
    });
  }
  return points;
}

/**
 * Generates smooth, rounded organic rocky cays and islets.
 */
export function createSkerryPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number = 1.0
): { x: number; y: number }[] {
  const steps = 28;
  const points: { x: number; y: number }[] = [];
  const s = seed || 1.0;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 2 + s * 1.8) * 0.10 + Math.cos(angle * 3 + s * 2.5) * 0.07;
    points.push({
      x: Math.round(cx + Math.cos(angle) * rx * wobble),
      y: Math.round(cy + Math.sin(angle) * ry * wobble),
    });
  }
  return points;
}

/**
 * Creates a wide, deeply anchored bridge with flared ramp bridgeheads.
 */
export function createBridge(
  id: string,
  name: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  style: BridgeStyle = 'suspension'
): BattleBridge {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const hw = width * 0.5;

  const rampLen = 90;
  const rampFw = width * 0.72;

  const sx1 = x1 - (dx / len) * rampLen;
  const sy1 = y1 - (dy / len) * rampLen;
  const sx2 = x2 + (dx / len) * rampLen;
  const sy2 = y2 + (dy / len) * rampLen;

  const points = [
    { x: Math.round(sx1 + nx * rampFw), y: Math.round(sy1 + ny * rampFw) },
    { x: Math.round(x1 + nx * hw), y: Math.round(y1 + ny * hw) },
    { x: Math.round(x2 + nx * hw), y: Math.round(y2 + ny * hw) },
    { x: Math.round(sx2 + nx * rampFw), y: Math.round(sy2 + ny * rampFw) },
    { x: Math.round(sx2 - nx * rampFw), y: Math.round(sy2 - ny * rampFw) },
    { x: Math.round(x2 - nx * hw), y: Math.round(y2 - ny * hw) },
    { x: Math.round(x1 - nx * hw), y: Math.round(y1 - ny * hw) },
    { x: Math.round(sx1 - nx * rampFw), y: Math.round(sy1 - ny * rampFw) },
  ];

  return {
    id,
    name,
    x1,
    y1,
    x2,
    y2,
    width,
    points,
    style,
  };
}

/**
 * Connects two islands with a bridge that is guaranteed to be 100% attached
 * with zero gaps on both ends.
 */
export function connectIslands(
  id: string,
  name: string,
  islandA: BattleIsland,
  islandB: BattleIsland,
  width: number,
  style: BridgeStyle
): BattleBridge {
  const dx = islandB.x - islandA.x;
  const dy = islandB.y - islandA.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;

  const penA = Math.min(islandA.radius * 0.42, Math.max(40, islandA.radius - 75));
  const penB = Math.min(islandB.radius * 0.42, Math.max(40, islandB.radius - 75));

  const x1 = Math.round(islandA.x + ux * penA);
  const y1 = Math.round(islandA.y + uy * penA);
  const x2 = Math.round(islandB.x - ux * penB);
  const y2 = Math.round(islandB.y - uy * penB);

  return createBridge(id, name, x1, y1, x2, y2, width, style);
}

// Basic helper to create an organic island
export function createIsland(
  x: number,
  y: number,
  rx: number,
  ry: number,
  style: BattleIsland['style'],
  seed: number,
  foliage: BattleIsland['foliage'] = [],
  lake?: BattleIsland['lake']
): BattleIsland {
  const effRx = Math.round(rx * 0.85);
  const effRy = Math.round(ry * 0.85);
  return {
    x,
    y,
    radius: Math.max(effRx, effRy),
    points: createNaturalIslandPolygon(x, y, effRx, effRy, 32, seed, 0.16),
    style,
    foliage,
    lake,
  };
}

// Advanced helper to create diverse landforms of any scale, shape, and internal water features
export function createIslandEx(params: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  shape?: 'natural' | 'continent' | 'spit' | 'bastion' | 'skerry';
  style?: BattleIsland['style'];
  seed?: number;
  headingAngle?: number;
  curvature?: number;
  facets?: number;
  pointiness?: number;
  foliage?: BattleIsland['foliage'];
  lake?: BattleIsland['lake'];
  lakes?: BattleIsland['lakes'];
  canals?: BattleIsland['canals'];
  name?: string;
  category?: BattleIsland['category'];
}): BattleIsland {
  const {
    x,
    y,
    rx,
    ry,
    shape = 'natural',
    style = 'sand',
    seed = 1.0,
    headingAngle = 0,
    curvature = 0.22,
    facets = 5,
    pointiness = 0.12,
    foliage = [],
    lake,
    lakes,
    canals,
    name,
    category,
  } = params;

  const effRx = Math.round(rx * 0.70);
  const effRy = Math.round(ry * 0.70);

  let points: { x: number; y: number }[];
  if (shape === 'continent') {
    points = createContinentalPolygon(x, y, effRx, effRy, seed, 44);
  } else if (shape === 'spit') {
    points = createSpitPolygon(x, y, effRx * 2, effRy * 2, headingAngle, curvature, seed);
  } else if (shape === 'bastion') {
    points = createBastionPolygon(x, y, Math.max(effRx, effRy), facets, pointiness, seed);
  } else if (shape === 'skerry') {
    points = createSkerryPolygon(x, y, effRx, effRy, seed);
  } else {
    points = createNaturalIslandPolygon(x, y, effRx, effRy, 32, seed, 0.16);
  }

  return {
    x,
    y,
    radius: Math.max(effRx, effRy),
    points,
    style,
    foliage,
    lake,
    lakes,
    canals,
    name,
    category,
  };
}
