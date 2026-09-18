import { BattleBridge, BattleIsland, ShipEntity } from '../types/ship';
import {
  Point2D,
  isPointInPolygon,
  getPointPolygonDistance,
  getLandClearance,
  distancePointToSegment,
} from '../utils/polygonCollision';

export interface BridgePortal {
  bridge: BattleBridge;
  islandAId: string; // Island connected to end 1 (x1, y1)
  islandBId: string; // Island connected to end 2 (x2, y2)
  end1: Point2D;
  end2: Point2D;
  ramp1: Point2D;    // Verified solid-land approach funnel on Island A (deep inland)
  ramp2: Point2D;    // Verified solid-land approach funnel on Island B (deep inland)
  funnel1: Point2D;  // Deep approach corridor node on Island A
  funnel2: Point2D;  // Deep approach corridor node on Island B
  mid: Point2D;
  dirX: number;      // Unit vector from end1 to end2
  dirY: number;
  normX: number;     // Unit normal (-dirY, dirX)
  normY: number;
  length: number;
}

export interface BridgeConnection {
  portal: BridgePortal;
  fromEnd: 1 | 2;
  toIslandId: string;
}

export interface IslandMeta {
  id: string;
  island: BattleIsland;
  center: Point2D;
  radius: number;
  isSmall: boolean;
}

export interface LandMovementPlan {
  navTargetX: number;
  navTargetY: number;
  targetSpeedLevel: number;
  onBridge: boolean;
  bridgeId?: string;
  bridgeHeading?: number;
  isCrossingBridge?: boolean;
  needsReverse?: boolean;
  reverseSteer?: number;
  isTightManeuver?: boolean;
  reason?: string;
}

export class LandPathfinder {
  public islands: BattleIsland[];
  public bridges: BattleBridge[];
  public landPolys: Point2D[][];
  public portals: BridgePortal[] = [];
  public islandMap: Map<string, BattleIsland> = new Map();
  public islandMetaMap: Map<string, IslandMeta> = new Map();
  public islandAdj: Map<string, BridgeConnection[]> = new Map();
  public solidObstacles: { x: number; y: number; radius: number }[] = [];

  constructor(islands: BattleIsland[], bridges: BattleBridge[]) {
    this.islands = islands || [];
    this.bridges = bridges || [];
    this.landPolys = [
      ...this.islands.map(i => i.points),
      ...this.bridges.map(b => b.points),
    ];

    this.buildTopology();
  }

  public getIslandId(island: BattleIsland, index?: number): string {
    if (island.id) return island.id;
    const idx = index !== undefined ? index : this.islands.indexOf(island);
    return `isl_${idx}_${Math.round(island.x)}_${Math.round(island.y)}`;
  }

  private findDeepInlandPoint(island: BattleIsland): Point2D {
    // Check island center first
    const centerClr = getLandClearance(island.x, island.y, this.landPolys);
    if (centerClr.onLand && centerClr.distanceToWater >= 28) {
      return { x: island.x, y: island.y };
    }

    // If center is in water (e.g. atoll / caldera / lagoon), sample points inside polygon
    let bestPt: Point2D = { x: island.x, y: island.y };
    let bestClearance = -Infinity;

    for (let i = 0; i < island.points.length; i++) {
      const p1 = island.points[i];
      const p2 = island.points[(i + Math.floor(island.points.length / 2)) % island.points.length];
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;
      const clr = getLandClearance(midX, midY, this.landPolys);
      if (clr.onLand && clr.distanceToWater > bestClearance) {
        bestClearance = clr.distanceToWater;
        bestPt = { x: midX, y: midY };
      }
    }

    // Fallback vertex inward shift
    if (bestClearance <= 15) {
      for (let i = 0; i < island.points.length; i += 4) {
        const p = island.points[i];
        const toCenterX = island.x - p.x;
        const toCenterY = island.y - p.y;
        const d = Math.hypot(toCenterX, toCenterY) || 1;
        const testX = p.x + (toCenterX / d) * 45;
        const testY = p.y + (toCenterY / d) * 45;
        const clr = getLandClearance(testX, testY, this.landPolys);
        if (clr.onLand && clr.distanceToWater > bestClearance) {
          bestClearance = clr.distanceToWater;
          bestPt = { x: testX, y: testY };
        }
      }
    }

    return bestPt;
  }

  private computeSafeRampPoint(
    bridgeEndX: number,
    bridgeEndY: number,
    axisUx: number,
    axisUy: number,
    islandCenter: Point2D
  ): Point2D {
    // Probe along bridge axis into the island
    const candidateDistances = [35, 55, 75, 95, 120];
    let bestPt: Point2D | null = null;
    let maxClearance = -Infinity;

    for (const d of candidateDistances) {
      const tx = bridgeEndX + axisUx * d;
      const ty = bridgeEndY + axisUy * d;
      const clr = getLandClearance(tx, ty, this.landPolys);
      if (clr.onLand && clr.distanceToWater >= 28) {
        return { x: Math.round(tx), y: Math.round(ty) };
      }
      if (clr.onLand && clr.distanceToWater > maxClearance) {
        maxClearance = clr.distanceToWater;
        bestPt = { x: Math.round(tx), y: Math.round(ty) };
      }
    }

    if (bestPt && maxClearance >= 20) {
      return bestPt;
    }

    // If straight axis into island runs off or has poor clearance (common on small islands/sharp corners),
    // interpolate towards the safe inland center of the island!
    const toCenterX = islandCenter.x - bridgeEndX;
    const toCenterY = islandCenter.y - bridgeEndY;
    const distToCenter = Math.hypot(toCenterX, toCenterY) || 1;
    const stepDist = Math.min(90, Math.max(35, distToCenter * 0.45));
    const rampX = bridgeEndX + (toCenterX / distToCenter) * stepDist;
    const rampY = bridgeEndY + (toCenterY / distToCenter) * stepDist;

    return { x: Math.round(rampX), y: Math.round(rampY) };
  }

  private computeSafeFunnelPoint(
    rampPt: Point2D,
    axisUx: number,
    axisUy: number,
    islandCenter: Point2D
  ): Point2D {
    // Probe further into the island (60-120px past ramp)
    const testDistances = [50, 80, 110];
    for (const d of testDistances) {
      const tx = rampPt.x + axisUx * d;
      const ty = rampPt.y + axisUy * d;
      const clr = getLandClearance(tx, ty, this.landPolys);
      if (clr.onLand && clr.distanceToWater >= 30) {
        return { x: Math.round(tx), y: Math.round(ty) };
      }
    }

    // Connect halfway between ramp and island center
    const midX = Math.round((rampPt.x + islandCenter.x) * 0.5);
    const midY = Math.round((rampPt.y + islandCenter.y) * 0.5);
    const clr = getLandClearance(midX, midY, this.landPolys);
    if (clr.onLand && clr.distanceToWater >= 22) {
      return { x: midX, y: midY };
    }

    return islandCenter;
  }

  private buildTopology() {
    this.islandMap.clear();
    this.islandMetaMap.clear();
    this.islandAdj.clear();
    this.portals = [];

    // 1. Index all islands and compute metadata
    for (let i = 0; i < this.islands.length; i++) {
      const isl = this.islands[i];
      const id = this.getIslandId(isl, i);
      this.islandMap.set(id, isl);
      this.islandAdj.set(id, []);

      const safeCenter = this.findDeepInlandPoint(isl);
      const rad = isl.radius || 240;
      const centerClr = getLandClearance(safeCenter.x, safeCenter.y, this.landPolys);
      // Small island: radius < 270 or clearance at safe center < 110
      const isSmall = rad < 270 || centerClr.distanceToWater < 110;

      this.islandMetaMap.set(id, {
        id,
        island: isl,
        center: safeCenter,
        radius: rad,
        isSmall,
      });
    }

    // 2. Map bridges to their connected islands and compute approach funnels
    for (const bridge of this.bridges) {
      let bestIsland1Id: string | null = null;
      let minDist1 = Infinity;
      let bestIsland2Id: string | null = null;
      let minDist2 = Infinity;

      for (let i = 0; i < this.islands.length; i++) {
        const isl = this.islands[i];
        const id = this.getIslandId(isl, i);

        // Test End 1
        const pd1 = getPointPolygonDistance(bridge.x1, bridge.y1, isl.points);
        const dist1 = pd1.isInside ? 0 : pd1.distance;
        if (dist1 < minDist1) {
          minDist1 = dist1;
          bestIsland1Id = id;
        }

        // Test End 2
        const pd2 = getPointPolygonDistance(bridge.x2, bridge.y2, isl.points);
        const dist2 = pd2.isInside ? 0 : pd2.distance;
        if (dist2 < minDist2) {
          minDist2 = dist2;
          bestIsland2Id = id;
        }
      }

      if (bestIsland1Id && bestIsland2Id) {
        const dx = bridge.x2 - bridge.x1;
        const dy = bridge.y2 - bridge.y1;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len;
        const uy = dy / len;

        const meta1 = this.islandMetaMap.get(bestIsland1Id);
        const meta2 = this.islandMetaMap.get(bestIsland2Id);
        const center1 = meta1 ? meta1.center : { x: bridge.x1, y: bridge.y1 };
        const center2 = meta2 ? meta2.center : { x: bridge.x2, y: bridge.y2 };

        // Approach ramps: probe backward along bridge axis, fallback to island interior
        const ramp1 = this.computeSafeRampPoint(bridge.x1, bridge.y1, -ux, -uy, center1);
        const ramp2 = this.computeSafeRampPoint(bridge.x2, bridge.y2, ux, uy, center2);

        // Funnel nodes: deeper approach nodes inside the landmass
        const funnel1 = this.computeSafeFunnelPoint(ramp1, -ux, -uy, center1);
        const funnel2 = this.computeSafeFunnelPoint(ramp2, ux, uy, center2);

        const mid: Point2D = {
          x: Math.round((bridge.x1 + bridge.x2) * 0.5),
          y: Math.round((bridge.y1 + bridge.y2) * 0.5),
        };

        const portal: BridgePortal = {
          bridge,
          islandAId: bestIsland1Id,
          islandBId: bestIsland2Id,
          end1: { x: bridge.x1, y: bridge.y1 },
          end2: { x: bridge.x2, y: bridge.y2 },
          ramp1,
          ramp2,
          funnel1,
          funnel2,
          mid,
          dirX: ux,
          dirY: uy,
          normX: -uy,
          normY: ux,
          length: len,
        };
        this.portals.push(portal);

        // Populate adjacency graph if connecting distinct landmasses
        if (bestIsland1Id !== bestIsland2Id) {
          this.islandAdj.get(bestIsland1Id)?.push({
            portal,
            fromEnd: 1,
            toIslandId: bestIsland2Id,
          });
          this.islandAdj.get(bestIsland2Id)?.push({
            portal,
            fromEnd: 2,
            toIslandId: bestIsland1Id,
          });
        }
      }
    }
  }

  /**
   * Identifies which island or bridge contains the specified coordinates.
   */
  public findLandLocation(px: number, py: number): {
    type: 'bridge' | 'island' | 'water';
    bridge?: BattleBridge;
    portal?: BridgePortal;
    island?: BattleIsland;
    islandId?: string;
    meta?: IslandMeta;
  } {
    // 1. Check bridges first (higher priority when overlapping ramps on islands)
    for (const portal of this.portals) {
      const segDist = distancePointToSegment(px, py, portal.end1.x, portal.end1.y, portal.end2.x, portal.end2.y);
      if (segDist.dist <= portal.bridge.width * 0.55 || isPointInPolygon(px, py, portal.bridge.points)) {
        return { type: 'bridge', bridge: portal.bridge, portal };
      }
    }

    // 2. Check islands
    for (let i = 0; i < this.islands.length; i++) {
      const isl = this.islands[i];
      if (isPointInPolygon(px, py, isl.points)) {
        const id = this.getIslandId(isl, i);
        return {
          type: 'island',
          island: isl,
          islandId: id,
          meta: this.islandMetaMap.get(id),
        };
      }
    }

    // 3. Coordinate is in water or just grazing coastline: find closest island or bridge
    let closestDist = Infinity;
    let closestIsland: BattleIsland | null = null;
    let closestIslandId = '';

    for (let i = 0; i < this.islands.length; i++) {
      const isl = this.islands[i];
      const res = getPointPolygonDistance(px, py, isl.points);
      if (res.distance < closestDist) {
        closestDist = res.distance;
        closestIsland = isl;
        closestIslandId = this.getIslandId(isl, i);
      }
    }

    if (closestIsland && closestDist < 55) {
      return {
        type: 'island',
        island: closestIsland,
        islandId: closestIslandId,
        meta: this.islandMetaMap.get(closestIslandId),
      };
    }

    return { type: 'water' };
  }

  public setSolidObstacles(obstacles: { x: number; y: number; radius: number }[]) {
    this.solidObstacles = obstacles || [];
  }

  /**
   * Verifies if a line segment between two coordinates is 100% navigable on solid land
   * with a minimum clearance from water edges and avoiding solid obstacles.
   */
  public isSegmentNavigable(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    minClearance: number = 22
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 5) return true;

    // Check collision with solid physical obstacles (Command Stations, Defense Bunkers)
    for (const obs of this.solidObstacles) {
      const seg = distancePointToSegment(obs.x, obs.y, x1, y1, x2, y2);
      if (seg.dist < obs.radius + minClearance) {
        return false;
      }
    }

    // Sample every 20px along the segment
    const steps = Math.max(3, Math.ceil(dist / 20));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;

      const clr = getLandClearance(px, py, this.landPolys);
      if (!clr.onLand || clr.distanceToWater < minClearance) {
        return false;
      }
    }
    return true;
  }

  /**
   * Breadth-First Search to find the shortest bridge route between two islands.
   */
  public findIslandRoute(
    fromIslandId: string,
    toIslandId: string
  ): BridgeConnection[] {
    if (fromIslandId === toIslandId) return [];

    const queue: { currentId: string; path: BridgeConnection[] }[] = [
      { currentId: fromIslandId, path: [] },
    ];
    const visited = new Set<string>([fromIslandId]);

    while (queue.length > 0) {
      const { currentId, path } = queue.shift()!;
      const neighbors = this.islandAdj.get(currentId) || [];

      for (const edge of neighbors) {
        if (edge.toIslandId === toIslandId) {
          return [...path, edge];
        }
        if (!visited.has(edge.toIslandId)) {
          visited.add(edge.toIslandId);
          queue.push({
            currentId: edge.toIslandId,
            path: [...path, edge],
          });
        }
      }
    }

    return []; // No bridge path connects the two islands
  }

  /**
   * For water or air targets, finds the closest safe firing vantage point
   * on the accessible land network, guaranteed to be safely inside land (> 45px from water).
   */
  public findSafeCoastalVantage(
    targetX: number,
    targetY: number,
    currentIsland: BattleIsland
  ): Point2D {
    const meta = this.islandMetaMap.get(this.getIslandId(currentIsland));
    const safeCenter = meta ? meta.center : { x: currentIsland.x, y: currentIsland.y };

    // Ray from island safe center towards target
    const toTgtX = targetX - safeCenter.x;
    const toTgtY = targetY - safeCenter.y;
    const dist = Math.hypot(toTgtX, toTgtY) || 1;
    const dirX = toTgtX / dist;
    const dirY = toTgtY / dist;

    // Search outwards from island center towards coastline
    let bestX = safeCenter.x;
    let bestY = safeCenter.y;

    const maxRadius = (currentIsland.radius || 300) * 0.85;
    const step = 20;
    for (let r = 20; r < maxRadius; r += step) {
      const testX = safeCenter.x + dirX * r;
      const testY = safeCenter.y + dirY * r;
      const clr = getLandClearance(testX, testY, this.landPolys);

      if (clr.onLand && clr.distanceToWater >= 45) {
        bestX = testX;
        bestY = testY;
      } else {
        break; // Approaching shoreline edge
      }
    }

    return { x: bestX, y: bestY };
  }

  /**
   * PRE-PLANS A SAFE NAVIGABLE ROUTE AHEAD OF TIME (150-250px Horizon).
   * Detects shorelines, bridge edges, corners, and obstacles ahead of time,
   * then evaluates valid routes across land and chooses a smooth steering trajectory
   * with preemptive speed throttling to ensure the vehicle NEVER hits the boundary.
   */
  public prePlanNavigablePath(
    ship: ShipEntity,
    destX: number,
    destY: number,
    island: BattleIsland,
    isSmallIsland: boolean
  ): {
    navTargetX: number;
    navTargetY: number;
    targetSpeedLevel: number;
    reason: string;
  } {
    const meta = this.islandMetaMap.get(this.getIslandId(island));
    const safeCenter = meta ? meta.center : { x: island.x, y: island.y };

    const toDestX = destX - ship.x;
    const toDestY = destY - ship.y;
    const distToDest = Math.hypot(toDestX, toDestY) || 1;
    const angleToDest = Math.atan2(toDestY, toDestX);

    const headingDiffToDest = Math.abs(
      Math.atan2(Math.sin(angleToDest - ship.angle), Math.cos(angleToDest - ship.angle))
    );

    // =========================================================================
    // 1. DIRECT LINE-OF-SIGHT & FORWARD HORIZON CHECK
    // =========================================================================
    const directNavigable = this.isSegmentNavigable(ship.x, ship.y, destX, destY, 32);

    if (directNavigable) {
      // Direct path to target is clear! Still test forward lookahead whiskers
      // to ensure turning towards destination has sufficient turning clearance.
      const halfLen = (ship.model.hullLength || 60) * 0.5;
      const lookDist = Math.max(90, Math.min(180, Math.abs(ship.speed) * 1.8 + halfLen + 30));

      const fwdX = ship.x + Math.cos(ship.angle) * lookDist;
      const fwdY = ship.y + Math.sin(ship.angle) * lookDist;
      const fwdClr = getLandClearance(fwdX, fwdY, this.landPolys);

      // If heading directly toward dest, or forward clearance is generous (> 40px)
      if (headingDiffToDest < 0.35 || (fwdClr.onLand && fwdClr.distanceToWater >= 36)) {
        let speed = isSmallIsland ? 1 : 2;
        if (headingDiffToDest > 0.65) speed = 1;
        if (isSmallIsland && headingDiffToDest > 1.15) speed = 0; // Pivot in place safely

        return {
          navTargetX: destX,
          navTargetY: destY,
          targetSpeedLevel: speed,
          reason: 'direct-clear-corridor',
        };
      }
    }

    // =========================================================================
    // 2. ISLAND HUB CORRIDOR ROUTING (DEEP INLAND BYPASS)
    // =========================================================================
    // If destination or vehicle is obstructed by a cove, bay, or corner,
    // route through the safe inland center of the island.
    const distToCenter = Math.hypot(safeCenter.x - ship.x, safeCenter.y - ship.y);
    if (distToCenter > 65) {
      const pathToCenterClear = this.isSegmentNavigable(ship.x, ship.y, safeCenter.x, safeCenter.y, 26);
      if (pathToCenterClear) {
        const toCenterAngle = Math.atan2(safeCenter.y - ship.y, safeCenter.x - ship.x);
        const diffToCenter = Math.abs(
          Math.atan2(Math.sin(toCenterAngle - ship.angle), Math.cos(toCenterAngle - ship.angle))
        );

        let speed = isSmallIsland ? 1 : 2;
        if (diffToCenter > 0.60) speed = 1;
        if (isSmallIsland && diffToCenter > 1.10) speed = 0;

        return {
          navTargetX: safeCenter.x,
          navTargetY: safeCenter.y,
          targetSpeedLevel: speed,
          reason: 'preplanned-island-hub-corridor',
        };
      }
    }

    // =========================================================================
    // 3. MULTI-RAY HORIZON WHISKERS FAN SCAN (19 RADIAL CANDIDATE VECTORS)
    // =========================================================================
    // Cast an arc of candidate lookahead rays covering [-90°, +90°] around angleToDest
    // to proactively identify the widest, deepest open land corridor ahead of time.
    const probeRange = Math.max(150, Math.min(240, Math.abs(ship.speed) * 2.2 + 90));
    const angleDeltas = [
      0,
      -0.18, 0.18,
      -0.35, 0.35,
      -0.52, 0.52,
      -0.70, 0.70,
      -0.88, 0.88,
      -1.05, 1.05,
      -1.22, 1.22,
      -1.40, 1.40,
      -1.57, 1.57,
    ];

    let bestAngle = ship.angle;
    let bestScore = -Infinity;
    let bestSafeDist = 70;

    for (const delta of angleDeltas) {
      const candAngle = angleToDest + delta;
      const cosC = Math.cos(candAngle);
      const sinC = Math.sin(candAngle);

      // Probe along candidate ray in steps of 20px
      let safeDist = 0;
      let minClearanceAlongRay = Infinity;
      const maxSteps = Math.ceil(probeRange / 20);

      for (let s = 1; s <= maxSteps; s++) {
        const px = ship.x + cosC * (s * 20);
        const py = ship.y + sinC * (s * 20);
        const clr = getLandClearance(px, py, this.landPolys);

        if (!clr.onLand || clr.distanceToWater < 24) {
          break; // Hit shoreline boundary or water
        }
        safeDist = s * 20;
        minClearanceAlongRay = Math.min(minClearanceAlongRay, clr.distanceToWater);
      }

      // If ray is blocked almost immediately, reject
      if (safeDist < 60) continue;

      // Scoring factors:
      // 1. Safe distance penetration (how far can we go before water?)
      const distScore = (safeDist / probeRange) * 120;
      // 2. Alignment with true destination direction
      const alignScore = Math.cos(delta) * 55;
      // 3. Continuity with current vehicle heading (penalize abrupt 180 snap)
      const headingAlign = Math.cos(candAngle - ship.angle) * 35;
      // 4. Minimum clearance along corridor (prefer wide landmasses over thin spits)
      const clearScore = Math.min(50, minClearanceAlongRay) * 1.2;

      const totalScore = distScore + alignScore + headingAlign + clearScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAngle = candAngle;
        bestSafeDist = safeDist;
      }
    }

    // Place navigation target comfortably along the best safe corridor
    const wpDist = Math.max(75, Math.min(140, bestSafeDist * 0.82));
    const targetX = Math.round(ship.x + Math.cos(bestAngle) * wpDist);
    const targetY = Math.round(ship.y + Math.sin(bestAngle) * wpDist);

    const turnDiff = Math.abs(
      Math.atan2(Math.sin(bestAngle - ship.angle), Math.cos(bestAngle - ship.angle))
    );

    // Preemptive speed throttling based on turn severity and island dimensions
    let speed = 2;
    if (turnDiff > 0.50 || bestSafeDist < 120 || isSmallIsland) {
      speed = 1; // Preemptively slow to half speed before entering turn!
    }
    if (isSmallIsland && turnDiff > 1.05) {
      speed = 0; // Stop and pivot in-place to avoid swinging tail into water!
    }

    return {
      navTargetX: targetX,
      navTargetY: targetY,
      targetSpeedLevel: speed,
      reason: 'preplanned-horizon-whiskers-corridor',
    };
  }

  /**
   * Plans the comprehensive tactical waypoint and throttle for a land vehicle.
   * Features:
   * - Strict bridge centerline guidance (virtual rail) preventing vehicles from hitting edges
   * - Pre-aligned bridge entrances with funnel corridors
   * - Ahead-of-time horizon planning for island terrain and shorelines
   * - Small island speed regulation and pivot turns
   */
  public planLandMovement(
    ship: ShipEntity,
    target: ShipEntity
  ): LandMovementPlan {
    const curLoc = this.findLandLocation(ship.x, ship.y);
    const myIsland = curLoc.island || this.islands[0];
    const myMeta = curLoc.meta || (myIsland ? this.islandMetaMap.get(this.getIslandId(myIsland)) : undefined);
    const isSmallIsland = myMeta ? myMeta.isSmall : false;

    // Resolve target location on land or safe coastal firing vantage
    let destX = target.x;
    let destY = target.y;
    let destLoc = this.findLandLocation(destX, destY);

    if (target.domain !== 'land' || destLoc.type === 'water') {
      const safeVantage = this.findSafeCoastalVantage(target.x, target.y, myIsland);
      destX = safeVantage.x;
      destY = safeVantage.y;
      destLoc = this.findLandLocation(destX, destY);
    }

    const myIslandId = curLoc.islandId || (myIsland ? this.getIslandId(myIsland) : '');
    const destIslandId = destLoc.islandId || (destLoc.island ? this.getIslandId(destLoc.island) : myIslandId);

    // =========================================================================
    // SITUATION 1: VEHICLE IS CURRENTLY CROSSING A BRIDGE
    // =========================================================================
    if (curLoc.type === 'bridge' && curLoc.portal) {
      const portal = curLoc.portal;
      const b = portal.bridge;
      ship.landRouteBridgeId = b.id;

      // Project vehicle position onto bridge centerline (end1 -> end2)
      const vx = ship.x - portal.end1.x;
      const vy = ship.y - portal.end1.y;
      const len = portal.length;
      // Normalized progress t along bridge [0.0 to 1.0]
      const t = Math.max(0, Math.min(1, (vx * portal.dirX + vy * portal.dirY) / len));

      // Lateral offset from bridge centerline
      const lateralOffset = vx * portal.normX + vy * portal.normY;

      // Determine which end the vehicle should exit through
      let exitTowardsEnd2 = true;
      if (destIslandId === portal.islandAId) {
        exitTowardsEnd2 = false;
      } else if (destIslandId === portal.islandBId) {
        exitTowardsEnd2 = true;
      } else {
        const dTargetTo1 = Math.hypot(target.x - portal.ramp1.x, target.y - portal.ramp1.y);
        const dTargetTo2 = Math.hypot(target.x - portal.ramp2.x, target.y - portal.ramp2.y);
        exitTowardsEnd2 = dTargetTo2 <= dTargetTo1;
      }

      const exitEnd = exitTowardsEnd2 ? portal.end2 : portal.end1;
      const exitRamp = exitTowardsEnd2 ? portal.ramp2 : portal.ramp1;
      const bridgeAngle = exitTowardsEnd2
        ? Math.atan2(portal.dirY, portal.dirX)
        : Math.atan2(-portal.dirY, -portal.dirX);

      // Remaining distance to exit end along the bridge span
      const distToExitEnd = exitTowardsEnd2 ? (1 - t) * len : t * len;

      // If near exit end (< 65px), smoothly pull vehicle along bridge axis onto the island ramp
      if (distToExitEnd < 65) {
        const distToRamp = Math.hypot(ship.x - exitRamp.x, ship.y - exitRamp.y);
        if (distToRamp < 45) {
          ship.landRouteBridgeId = undefined;
        }
        return {
          navTargetX: exitRamp.x,
          navTargetY: exitRamp.y,
          targetSpeedLevel: 1, // Controlled dismount onto solid land
          onBridge: true,
          bridgeId: b.id,
          bridgeHeading: bridgeAngle,
          isCrossingBridge: true,
          reason: 'exiting-bridge-to-ramp',
        };
      }

      // Advance lookahead point on centerline (75px ahead)
      const lookaheadDist = 75;
      const dtAhead = lookaheadDist / len;
      const targetT = exitTowardsEnd2
        ? Math.min(1.0, t + dtAhead)
        : Math.max(0.0, t - dtAhead);

      // Base point on centerline
      let targetX = portal.end1.x + portal.dirX * (targetT * len);
      let targetY = portal.end1.y + portal.dirY * (targetT * len);

      // ACTIVE CENTERLINE RESTORATION:
      // Pull lateral drift back toward centerline. This acts as a virtual rail
      // that strictly prevents vehicle from scraping or hitting bridge railings/edges.
      targetX -= portal.normX * (lateralOffset * 1.30);
      targetY -= portal.normY * (lateralOffset * 1.30);

      return {
        navTargetX: targetX,
        navTargetY: targetY,
        targetSpeedLevel: 2, // Full speed on straight bridge span
        onBridge: true,
        bridgeId: b.id,
        bridgeHeading: bridgeAngle,
        isCrossingBridge: true,
        reason: 'bridge-centerline-rail-tracking',
      };
    }

    // =========================================================================
    // SITUATION 2: VEHICLE & DESTINATION ON DIFFERENT ISLANDS (CROSS BRIDGES)
    // =========================================================================
    if (myIslandId && destIslandId && myIslandId !== destIslandId) {
      const route = this.findIslandRoute(myIslandId, destIslandId);
      if (route.length > 0) {
        const nextConn = route[0];
        const portal = nextConn.portal;
        ship.landRouteBridgeId = portal.bridge.id;

        // Corridor nodes leading onto bridge
        const rampIn = nextConn.fromEnd === 1 ? portal.ramp1 : portal.ramp2;
        const funnelIn = nextConn.fromEnd === 1 ? portal.funnel1 : portal.funnel2;
        const bridgeIn = nextConn.fromEnd === 1 ? portal.end1 : portal.end2;

        const bridgeAngle = nextConn.fromEnd === 1
          ? Math.atan2(portal.dirY, portal.dirX)
          : Math.atan2(-portal.dirY, -portal.dirX);

        const distToRamp = Math.hypot(ship.x - rampIn.x, ship.y - rampIn.y);
        const distToBridgeIn = Math.hypot(ship.x - bridgeIn.x, ship.y - bridgeIn.y);

        // Heading error relative to the bridge axis
        const headingDiffToBridge = Math.abs(
          Math.atan2(Math.sin(bridgeAngle - ship.angle), Math.cos(bridgeAngle - ship.angle))
        );

        // STAGE A: Within bridgehead entrance corridor (close to ramp or bridge entrance)
        if (distToBridgeIn < 75 || distToRamp < 55) {
          // If vehicle is NOT aligned with bridge centerline axis,
          // pivot on the solid ground of the ramp BEFORE entering the bridge span!
          if (headingDiffToBridge > 0.38) {
            return {
              navTargetX: bridgeIn.x,
              navTargetY: bridgeIn.y,
              targetSpeedLevel: headingDiffToBridge > 0.85 ? 0 : 1, // Stop or crawl to align cleanly
              onBridge: false,
              bridgeId: portal.bridge.id,
              bridgeHeading: bridgeAngle,
              isTightManeuver: true,
              reason: 'pre-aligning-bridgehead-entrance',
            };
          }

          // Vehicle is cleanly aligned with bridge axis: drive straight onto bridge!
          return {
            navTargetX: bridgeIn.x,
            navTargetY: bridgeIn.y,
            targetSpeedLevel: 2,
            onBridge: true,
            bridgeId: portal.bridge.id,
            bridgeHeading: bridgeAngle,
            isCrossingBridge: true,
            reason: 'aligned-entering-bridge-span',
          };
        }

        // STAGE B: Navigating across current island toward the bridge entrance
        // Check if direct path to rampIn is navigable
        if (this.isSegmentNavigable(ship.x, ship.y, rampIn.x, rampIn.y, 24)) {
          const toRampAngle = Math.atan2(rampIn.y - ship.y, rampIn.x - ship.x);
          const diffToRamp = Math.abs(
            Math.atan2(Math.sin(toRampAngle - ship.angle), Math.cos(toRampAngle - ship.angle))
          );
          const speed = (diffToRamp > 0.60 || isSmallIsland) ? 1 : 2;

          return {
            navTargetX: rampIn.x,
            navTargetY: rampIn.y,
            targetSpeedLevel: speed,
            onBridge: false,
            bridgeId: portal.bridge.id,
            bridgeHeading: bridgeAngle,
            reason: 'direct-approach-to-ramp',
          };
        }

        // Direct path to rampIn is blocked by shoreline/corner: pre-plan detour ahead of time!
        const planned = this.prePlanNavigablePath(ship, rampIn.x, rampIn.y, myIsland, isSmallIsland);
        return {
          navTargetX: planned.navTargetX,
          navTargetY: planned.navTargetY,
          targetSpeedLevel: planned.targetSpeedLevel,
          onBridge: false,
          bridgeId: portal.bridge.id,
          bridgeHeading: bridgeAngle,
          reason: planned.reason,
        };
      }
    }

    // =========================================================================
    // SITUATION 3: INTRA-ISLAND NAVIGATION (SAME ISLAND OR COMBAT MANEUVER)
    // =========================================================================
    ship.landRouteBridgeId = undefined;
    const planned = this.prePlanNavigablePath(ship, destX, destY, myIsland, isSmallIsland);

    return {
      navTargetX: planned.navTargetX,
      navTargetY: planned.navTargetY,
      targetSpeedLevel: planned.targetSpeedLevel,
      onBridge: false,
      reason: planned.reason,
    };
  }

  /**
   * Calculates continuous, proactive shoreline and corner avoidance for land vehicles.
   * Prevents vehicles from clipping coastline edges or grinding along water boundaries.
   * When on a bridge, returns 0 repulsion so the vehicle stays smoothly on the centerline rail.
   */
  public calculateLandShorelineAvoidance(ship: ShipEntity): {
    repX: number;
    repY: number;
    slowDown: boolean;
    mustStopOrReverse: boolean;
    centerClearance: number;
    inwardNx: number;
    inwardNy: number;
  } {
    // If vehicle is navigating on a bridge span, bypass generic shoreline repulsion completely!
    if (ship.landRouteBridgeId) {
      return {
        repX: 0,
        repY: 0,
        slowDown: false,
        mustStopOrReverse: false,
        centerClearance: 100,
        inwardNx: 0,
        inwardNy: 0,
      };
    }

    const curLoc = this.findLandLocation(ship.x, ship.y);
    if (curLoc.type === 'bridge') {
      return {
        repX: 0,
        repY: 0,
        slowDown: false,
        mustStopOrReverse: false,
        centerClearance: 100,
        inwardNx: 0,
        inwardNy: 0,
      };
    }

    let repX = 0;
    let repY = 0;
    let slowDown = false;
    let mustStopOrReverse = false;

    const centerClr = getLandClearance(ship.x, ship.y, this.landPolys);
    const inNx = centerClr.inwardNx;
    const inNy = centerClr.inwardNy;

    // 1. Center clearance repulsion: increases smoothly when within 42px of water
    if (centerClr.distanceToWater < 42) {
      const normDist = Math.max(0, centerClr.distanceToWater);
      const t = (42 - normDist) / 42;
      const strength = t * t * 4.2;
      repX += inNx * strength;
      repY += inNy * strength;
      if (centerClr.distanceToWater < 25) {
        slowDown = true;
      }
      // Only trigger emergency reverse if vehicle is literally immobilized near shoreline
      if (centerClr.distanceToWater < 10 && Math.abs(ship.speed) < 10) {
        mustStopOrReverse = true;
      }
    }

    // 2. Forward nose lookahead probe (100-160px lookahead)
    const cosA = Math.cos(ship.angle);
    const sinA = Math.sin(ship.angle);
    const halfLen = (ship.model.hullLength || 60) * 0.5;
    const lookDist = Math.max(65, Math.min(140, Math.abs(ship.speed) * 2.0 + halfLen + 20));
    const noseX = ship.x + cosA * lookDist;
    const noseY = ship.y + sinA * lookDist;

    const noseClr = getLandClearance(noseX, noseY, this.landPolys);
    if (!noseClr.onLand || noseClr.distanceToWater < 36) {
      const effDist = noseClr.onLand ? noseClr.distanceToWater : -10;
      const tFwd = (36 - effDist) / 46;
      const fwdStrength = Math.max(0, tFwd) * 3.8;
      repX += noseClr.inwardNx * fwdStrength;
      repY += noseClr.inwardNy * fwdStrength;
      slowDown = true;
    }

    // 3. Left and right flank clearance probes
    const flankDist = lookDist * 0.7;
    const leftCos = Math.cos(ship.angle - 0.52);
    const leftSin = Math.sin(ship.angle - 0.52);
    const rightCos = Math.cos(ship.angle + 0.52);
    const rightSin = Math.sin(ship.angle + 0.52);

    const leftClr = getLandClearance(ship.x + leftCos * flankDist, ship.y + leftSin * flankDist, this.landPolys);
    if (!leftClr.onLand || leftClr.distanceToWater < 22) {
      repX += leftClr.inwardNx * 2.4;
      repY += leftClr.inwardNy * 2.4;
      slowDown = true;
    }

    const rightClr = getLandClearance(ship.x + rightCos * flankDist, ship.y + rightSin * flankDist, this.landPolys);
    if (!rightClr.onLand || rightClr.distanceToWater < 22) {
      repX += rightClr.inwardNx * 2.4;
      repY += rightClr.inwardNy * 2.4;
      slowDown = true;
    }

    return {
      repX,
      repY,
      slowDown,
      mustStopOrReverse,
      centerClearance: centerClr.distanceToWater,
      inwardNx: inNx,
      inwardNy: inNy,
    };
  }
}
