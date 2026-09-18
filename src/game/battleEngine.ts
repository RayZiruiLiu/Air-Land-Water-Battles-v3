import {
  AmphibiousMissionState,
  BaseShipModel,
  BattleBridge,
  BattleIsland,
  BattleMapConfig,
  BattleSettings,
  CommandStationEntity,
  CommandStationTurret,
  CustomShipConfig,
  DefensiveWeaponConfig,
  DefensiveWeaponEntity,
  GameMode,
  HelicopterState,
  Particle,
  PlayerMissionRole,
  Projectile,
  ShipEntity,
  Team,
  TrailerEntity,
  TransportMissionState,
  VehicleDomain,
  VehicleWeaponMode,
  WaterRipple,
  hasHelicopterLandingArea,
  isFighterCarrier
} from '../types/ship';
import { BASE_SHIPS, SHIP_MODEL_MAP } from '../data/shipModels';
import { COMPONENT_MAP } from '../data/components';
import { TRAILER_MAP } from '../data/trailers';
import { BATTLE_MAPS, BATTLE_MAP_MAP } from '../data/battleMaps';
import { calculateShipStats, generateNpcShipConfig, getBalancedMatchPlan } from '../utils/shipStats';
import { sounds } from '../audio/soundEffects';
import { LandPathfinder } from './landPathfinder';
import {
  checkSegmentPolygonIntersection,
  checkShipPolygonCollision,
  constrainLandVehicleToLand,
  getLandClearance,
  getPointPolygonDistance,
  isPointInPolygon,
} from '../utils/polygonCollision';

function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { dist: number; projX: number; projY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return { dist: Math.hypot(px - projX, py - projY), projX, projY };
}

const MODE_4_FERRY_PALETTES = [
  { name: 'NATO Gray', hull: '#596168', deck: '#77786f', accent: '#d1c7a7', details: '#2f3437' },
  { name: 'Baltic Workboat', hull: '#46545a', deck: '#6d746f', accent: '#b7aa88', details: '#293136' },
  { name: 'Olive Drab', hull: '#4b5144', deck: '#6b6d5c', accent: '#c0b38e', details: '#292d27' },
  { name: 'Coastal Tan', hull: '#625c50', deck: '#807967', accent: '#d3c49d', details: '#36322b' },
];
let mode4FerryPaletteBag: number[] = [];
let lastMode4FerryPaletteIndex = -1;

function takeMode4FerryPalette() {
  if (mode4FerryPaletteBag.length === 0) {
    mode4FerryPaletteBag = MODE_4_FERRY_PALETTES.map((_, index) => index);
    for (let i = mode4FerryPaletteBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mode4FerryPaletteBag[i], mode4FerryPaletteBag[j]] = [mode4FerryPaletteBag[j], mode4FerryPaletteBag[i]];
    }
    // A newly shuffled cycle must not repeat the immediately previous game.
    if (mode4FerryPaletteBag[mode4FerryPaletteBag.length - 1] === lastMode4FerryPaletteIndex) {
      const swapIndex = mode4FerryPaletteBag.findIndex(index => index !== lastMode4FerryPaletteIndex);
      const lastIndex = mode4FerryPaletteBag.length - 1;
      [mode4FerryPaletteBag[swapIndex], mode4FerryPaletteBag[lastIndex]] =
        [mode4FerryPaletteBag[lastIndex], mode4FerryPaletteBag[swapIndex]];
    }
  }
  const paletteIndex = mode4FerryPaletteBag.pop()!;
  lastMode4FerryPaletteIndex = paletteIndex;
  return MODE_4_FERRY_PALETTES[paletteIndex];
}

function initVehicleTrailer(vehicle: ShipEntity): TrailerEntity | undefined {
  // Trailers are strictly restricted to land vehicles only
  if (vehicle.domain !== 'land' || vehicle.model.domain !== 'land') {
    return undefined;
  }
  const trailerId = vehicle.config.trailerId || (vehicle.model.canTowTrailer ? vehicle.model.defaultTrailerId : undefined);
  if (!trailerId || trailerId === 'none') return undefined;

  const def = TRAILER_MAP.get(trailerId);
  if (!def) return undefined;

  const towDistance = (vehicle.model.hullLength * 0.48 + 6) + 16 + (def.length * 0.48);
  return {
    id: `${vehicle.id}-trailer`,
    type: trailerId,
    x: vehicle.x - Math.cos(vehicle.angle) * towDistance,
    y: vehicle.y - Math.sin(vehicle.angle) * towDistance,
    angle: vehicle.angle,
    currentHp: def.hp,
    maxHp: def.hp,
    cooldown: Math.random() * 1.5,
    def,
  };
}

function initShipAircraftCapabilities(ship: ShipEntity) {
  const model = ship.model;
  // Carrier flight wing initialization
  if (isFighterCarrier(model)) {
    ship.isCarrier = true;
    ship.carrierFighterJetsMax = 5;
    ship.carrierFighterJetsRemaining = 5;
    ship.carrierDeployedJetIds = [];
    ship.carrierLaunchTimer = 10 + Math.random() * 5;
  }

  // Helipad helicopter landing facility initialization
  if (hasHelicopterLandingArea(model)) {
    ship.hasHelipad = true;
    ship.helicopterState = 'landed';
    ship.helicopterMaxHp = 680;
    ship.helicopterHp = 680;
  }
}

export interface BattleState {
  arenaWidth: number;
  arenaHeight: number;
  ships: ShipEntity[];
  projectiles: Projectile[];
  particles: Particle[];
  ripples: WaterRipple[];
  islands: BattleIsland[];
  bridges: BattleBridge[];
  mapConfig: BattleMapConfig;
  time: number;
  gameOver: boolean;
  winner: Team | null;
  winReason?:
    | 'annihilation'
    | 'area_control'
    | 'command_station_destroyed'
    | 'transport_delivered'
    | 'transport_destroyed'
    | 'assault_successful'
    | 'defense_successful'
    | string;
  camera: { x: number; y: number; zoom: number };
  mouseWorldPos: { x: number; y: number };
  playerShipId: string;
  combatLog: { id: string; text: string; time: number; team: Team }[];
  stats: {
    damageDealt: number;
    shipsSunk: number;
    shotsFired: number;
    shotsHit: number;
  };
  gameMode: GameMode;
  commandStations?: CommandStationEntity[];
  defensiveWeapons?: DefensiveWeaponEntity[];
  transportMission?: TransportMissionState;
  amphibiousMission?: AmphibiousMissionState;
  playerRole?: PlayerMissionRole;
}

export class BattleEngine {
  public state: BattleState;
  public landPathfinder!: LandPathfinder;
  public matchSeed: number = Math.floor(Math.random() * 1000000);
  public spectatorTargetId: string | null = null;
  public isFreeCam: boolean = false;
  private settings: BattleSettings;
  private nextId: number = 1;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private onStateUpdate?: (state: BattleState) => void;

  constructor(
    playerConfig: CustomShipConfig,
    settings: BattleSettings,
    onStateUpdate?: (state: BattleState) => void
  ) {
    this.settings = settings;
    this.onStateUpdate = onStateUpdate;
    this.state = this.initBattle(playerConfig, settings.shipsPerTeam);
  }

  private initBattle(playerConfig: CustomShipConfig, shipsPerTeam: number): BattleState {
    // Retrieve active battle map
    const mapConfig = BATTLE_MAP_MAP.get(this.settings.selectedMapId) || BATTLE_MAPS[0];
    const arenaWidth = mapConfig.dimensions?.width || 4800;
    const arenaHeight = mapConfig.dimensions?.height || 3200;
    const islands: BattleIsland[] = mapConfig.obstacles;
    const bridges: BattleBridge[] = mapConfig.bridges || [];
    this.landPathfinder = new LandPathfinder(islands, bridges);
    const landPolys = [
      ...islands.map(i => i.points),
      ...bridges.map(b => b.points),
    ];
    const gameMode: GameMode = mapConfig.gameMode || this.settings.gameMode || 'fleet-battle';
    const playerRole: PlayerMissionRole = this.settings.playerRole || (gameMode === 'transport-protection' ? 'defender' : 'attacker');
    const isTransportProtection = gameMode === 'transport-protection';
    const isAmphibiousAssault = gameMode === 'amphibious-assault';
    const amphibiousAttackerTeam: Team = playerRole === 'attacker' ? 'player' : 'enemy';
    // Mode 3 uses stable faction colors: the convoy is always blue and the
    // ambush force is always red. Selecting the ambush role therefore really
    // places the player on the red team and at its separate eastern spawn.
    const playerFactionTeam: Team = isTransportProtection && playerRole === 'attacker' ? 'enemy' : 'player';
    const opposingFactionTeam: Team = playerFactionTeam === 'player' ? 'enemy' : 'player';
    const transportingCombatCount = 2;
    const attackingCombatCount = 4;
    const playerFactionCount = isTransportProtection
      ? (playerFactionTeam === 'player' ? transportingCombatCount : attackingCombatCount)
      : shipsPerTeam;
    const opposingFactionCount = isTransportProtection
      ? (opposingFactionTeam === 'player' ? transportingCombatCount : attackingCombatCount)
      : shipsPerTeam;

    const ships: ShipEntity[] = [];
    const occupiedSpawns: { x: number; y: number }[] = [];

    // Helper to calculate safe spawn coordinates: guaranteed clearance from water boundaries
    const getSafeSpawn = (
      team: 'player' | 'enemy',
      domain: 'land' | 'water' | 'air',
      slotIndex: number
    ): { x: number; y: number } => {
      const isPlayerTeam = team === 'player';
      const baseX = isPlayerTeam ? 480 : arenaWidth - 480;
      const spreadIdx = Math.floor(slotIndex / 2);
      const sign = slotIndex % 2 === 1 ? -1 : 1;

      if (isAmphibiousAssault) {
        const isAttackingTeam = team === amphibiousAttackerTeam;
        const amphibious = mapConfig.amphibiousConfig;
        const carrierSpawn = amphibious?.carrierSpawn || { x: 430, y: arenaHeight * 0.5, angle: 0 };
        const commandCenter = amphibious?.commandCenterPos || { x: arenaWidth - 900, y: arenaHeight * 0.5 };

        if (isAttackingTeam) {
          // Land units are repositioned onto the carrier deck after the mission
          // carrier is created. Their initial point is never an active land spawn.
          if (domain === 'land') return { x: carrierSpawn.x, y: carrierSpawn.y };
          const leftFormationX = Math.max(180, carrierSpawn.x - 120 + spreadIdx * 115);
          const leftFormationY = carrierSpawn.y + sign * (260 + spreadIdx * 150);
          return {
            x: leftFormationX,
            y: Math.max(180, Math.min(arenaHeight - 180, leftFormationY)),
          };
        }

        if (domain === 'land') {
          const defensiveLand = mapConfig.spawnPoints?.playerLand || [];
          const point = defensiveLand[slotIndex % Math.max(1, defensiveLand.length)];
          return point
            ? { x: point.x, y: point.y }
            : {
                x: commandCenter.x - 260 - spreadIdx * 120,
                y: commandCenter.y + sign * (180 + spreadIdx * 105),
              };
        }
        if (domain === 'water') {
          const defensiveWater = mapConfig.spawnPoints?.playerWater || [];
          const point = defensiveWater[slotIndex % Math.max(1, defensiveWater.length)];
          return point
            ? { x: point.x, y: point.y }
            : {
                x: commandCenter.x - 1150,
                y: commandCenter.y + sign * (520 + spreadIdx * 170),
              };
        }
        return {
          x: commandCenter.x - 180 - spreadIdx * 95,
          y: Math.max(180, Math.min(arenaHeight - 180, commandCenter.y + sign * (220 + spreadIdx * 135))),
        };
      }

      // 1. If map defines explicit verified spawn points, prioritize them
      if (mapConfig.spawnPoints) {
        let pool: { x: number; y: number }[] = [];
        if (domain === 'land') {
          pool = isPlayerTeam ? mapConfig.spawnPoints.playerLand : mapConfig.spawnPoints.enemyLand;
        } else if (domain === 'water') {
          pool = isPlayerTeam ? mapConfig.spawnPoints.playerWater : mapConfig.spawnPoints.enemyWater;
        }

        if (pool && pool.length > 0) {
          // Permute pool selection with matchSeed so each session spawns in different points
          const seedOffset = Math.floor(Math.abs(Math.sin(this.matchSeed + (isPlayerTeam ? 23 : 71) + slotIndex * 13)) * pool.length);
          const pt = pool[(slotIndex + seedOffset) % pool.length];
          let cx = pt.x;
          let cy = pt.y;

          // Randomized formation offset per match (except player flagship slot 0)
          if (!isPlayerTeam || slotIndex > 0) {
            const jitterX = Math.sin(this.matchSeed * 0.17 + slotIndex * 2.3) * 45;
            const jitterY = Math.cos(this.matchSeed * 0.19 + slotIndex * 2.7) * 45;
            cx += jitterX;
            cy += jitterY;
          }

          // Apply slight dispersion if multiple units share the spawn zone
          const overflowIdx = Math.floor(slotIndex / pool.length);
          if (overflowIdx > 0) {
            cx += (isPlayerTeam ? -35 : 35) * overflowIdx;
            cy += (slotIndex % 2 === 0 ? 30 : -30) * overflowIdx;
          }

          // Ensure no exact overlapping with previous spawns
          for (const pos of occupiedSpawns) {
            if (Math.hypot(pos.x - cx, pos.y - cy) < 65) {
              cx += (isPlayerTeam ? -30 : 30);
              cy += (slotIndex % 2 === 0 ? 35 : -35);
            }
          }

          occupiedSpawns.push({ x: cx, y: cy });
          return { x: cx, y: cy };
        }
      }

      // 2. Dynamic fallback with clearance verification
      const spreadRandom = Math.sin(this.matchSeed + slotIndex * 3.1);
      let candidateX = baseX + (isPlayerTeam ? -1 : 1) * spreadRandom * 40;
      let candidateY = arenaHeight * 0.5;

      if (domain === 'land') {
        // Sample candidate positions deep inland on west/east continents
        const testPoints = isPlayerTeam
          ? [
              { x: 500, y: 700 },
              { x: 400, y: 900 },
              { x: 500, y: 2500 },
              { x: 400, y: 2300 },
              { x: 300, y: 650 },
              { x: 300, y: 2550 },
              { x: 600, y: 600 },
              { x: 600, y: 2600 },
            ]
          : [
              { x: arenaWidth - 500, y: 700 },
              { x: arenaWidth - 400, y: 900 },
              { x: arenaWidth - 500, y: 2500 },
              { x: arenaWidth - 400, y: 2300 },
              { x: arenaWidth - 300, y: 650 },
              { x: arenaWidth - 300, y: 2550 },
              { x: arenaWidth - 600, y: 600 },
              { x: arenaWidth - 600, y: 2600 },
            ];

        const pIndex = Math.floor(Math.abs(Math.sin(this.matchSeed + slotIndex * 7)) * testPoints.length) % testPoints.length;
        const p = testPoints[pIndex];
        candidateX = p.x;
        candidateY = p.y;

        // Ensure safe clearance from water boundaries (at least 150px into safe land)
        let attempts = 0;
        while (attempts < 20) {
          const clr = getLandClearance(candidateX, candidateY, landPolys);
          if (clr.onLand && clr.distanceToWater >= 140) {
            break;
          }
          if (!clr.onLand) {
            candidateX = clr.closestX + clr.inwardNx * 160;
            candidateY = clr.closestY + clr.inwardNy * 160;
          } else {
            candidateX += clr.inwardNx * 40;
            candidateY += clr.inwardNy * 40;
          }
          attempts++;
        }
      } else if (domain === 'water') {
        // Deep water navigation channel in center/bay with randomized vertical staging
        const yJitter = Math.sin(this.matchSeed + slotIndex * 5.7) * 80;
        candidateY = arenaHeight * 0.5 + sign * (spreadIdx * 125) + yJitter;
        candidateX = baseX + (isPlayerTeam ? 1 : -1) * (spreadIdx * 65);

        let attempts = 0;
        while (attempts < 20) {
          const clr = getLandClearance(candidateX, candidateY, landPolys);
          if (!clr.onLand && Math.abs(clr.distanceToWater) >= 140) {
            break;
          }
          candidateX -= clr.inwardNx * 45;
          candidateY -= clr.inwardNy * 45;
          attempts++;
        }
      } else {
        // Air units: high altitude with randomized patrol spacing
        const airJitter = Math.cos(this.matchSeed + slotIndex * 4.3) * 90;
        candidateY = arenaHeight * 0.5 + sign * (spreadIdx + 1) * 140 + airJitter;
        candidateX = baseX + (isPlayerTeam ? 1 : -1) * (spreadIdx * 65);
      }

      // Avoid exact overlapping with previous spawns
      for (const pos of occupiedSpawns) {
        if (Math.hypot(pos.x - candidateX, pos.y - candidateY) < 65) {
          candidateX += (isPlayerTeam ? -30 : 30);
          candidateY += (slotIndex % 2 === 0 ? 30 : -30);
        }
      }

      occupiedSpawns.push({ x: candidateX, y: candidateY });
      return { x: candidateX, y: candidateY };
    };

    // 1. Create Player Ship (Omega Team Flagship)
    const playerModel = SHIP_MODEL_MAP.get(playerConfig.baseModelId) || BASE_SHIPS[0];
    const playerStats = calculateShipStats(playerModel, playerConfig);

    // Determine initial weapon target mode based on equipped weapons
    let playerHasSurface = false;
    let playerHasAir = false;
    for (const hp of playerModel.hardpoints) {
      const compId = playerConfig.equippedComponents[hp.id];
      const comp = compId ? COMPONENT_MAP.get(compId) : null;
      if (!comp || comp.damage <= 0) continue;
      if (comp.targetDomain === 'surface' || comp.targetDomain === 'both') playerHasSurface = true;
      if (comp.targetDomain === 'air' || comp.targetDomain === 'both') playerHasAir = true;
    }
    const initialPlayerMode: VehicleWeaponMode = (!playerHasSurface && playerHasAir) ? 'air' : 'surface';

    const playerSpawn = getSafeSpawn(playerFactionTeam, playerModel.domain || 'land', 0);

    const playerHeading = isAmphibiousAssault
      ? (playerFactionTeam === amphibiousAttackerTeam ? 0 : Math.PI)
      : (playerFactionTeam === 'player' ? 0 : Math.PI);
    const playerShip: ShipEntity = {
      id: 'player-flagship',
      name: playerConfig.name || 'Flagship Vanguard',
      team: playerFactionTeam,
      isPlayer: true,
      model: playerModel,
      config: playerConfig,
      stats: playerStats,
      x: playerSpawn.x,
      y: playerSpawn.y,
      angle: playerHeading,
      vx: 0,
      vy: 0,
      speed: 0,
      targetSpeedLevel: 0,
      rudderAngle: 0,
      articulatedAngle: 0,
      currentHp: playerStats.maxHp,
      maxHp: playerStats.maxHp,
      isSunk: false,
      sinkProgress: 0,
      idleTimer: 0,
      fireTimer: 0,
      cooldowns: {},
      tacticalRole: isTransportProtection && playerFactionTeam === 'player' ? 'defender' : 'attacker',
      domain: playerModel.domain || 'land',
      altitude: playerModel.domain === 'air' ? 65 : 0,
      weaponTargetMode: initialPlayerMode,
      hasSurfaceWeapons: playerHasSurface,
      hasAirWeapons: playerHasAir,
    };
    playerShip.towedTrailer = initVehicleTrailer(playerShip);
    initShipAircraftCapabilities(playerShip);
    ships.push(playerShip);

    // Pre-calculate a session-wide domain plan. Mode 3's three fixed convoy
    // vehicles are created separately from its 2-person escort and 4 attackers.
    const matchPlan = getBalancedMatchPlan(Math.max(playerFactionCount, opposingFactionCount), playerModel.domain || 'land', this.matchSeed);
    // The first plan excludes the human slot; the second is a full NPC force.
    // Keep those cardinalities even when the human selected the red faction.
    const playerNpcDomains = matchPlan.allyNpcDomains;
    const opposingNpcDomains = matchPlan.enemyNpcDomains;

    const selectNpcRole = (
      team: Team,
      slot: number,
      domain: VehicleDomain,
      combatRole: string | undefined,
      speed: number,
      armorRating: number,
      hasSurfaceWeapons: boolean
    ): 'attacker' | 'defender' | 'skirmisher' => {
      if (isTransportProtection) {
        if (team === 'player') return slot % 2 === 0 ? 'defender' : 'skirmisher';
        return slot % 3 === 1 ? 'skirmisher' : 'attacker';
      }

      const formationRole: 'attacker' | 'defender' | 'skirmisher' =
        slot % 3 === 0 ? 'defender' : slot % 3 === 1 ? 'skirmisher' : 'attacker';
      if (gameMode !== 'command-station') return formationRole;

      // Keep a mixed formation while allowing each platform's strengths to
      // refine its tendency within that formation.
      if (!hasSurfaceWeapons || combatRole === 'support-tow') return 'defender';
      if (formationRole === 'skirmisher' && slot % 6 === 4
        && (combatRole === 'heavy-artillery' || armorRating >= 48)) return 'attacker';
      if (formationRole === 'attacker' && slot % 6 === 5
        && (combatRole === 'recon-skirmisher' || (domain === 'air' && speed >= 100))) return 'skirmisher';
      return formationRole;
    };

    // 2. Create Allied NPC vehicles (Omega Team) with session randomized fleet composition
    for (let i = 1; i < playerFactionCount; i++) {
      const assignedDomain = playerNpcDomains[i - 1];
      const { model, config } = generateNpcShipConfig(
        i,
        playerFactionTeam,
        playerFactionCount,
        playerModel.domain || 'land',
        this.matchSeed,
        assignedDomain
      );
      const stats = calculateShipStats(model, config);

      // Check NPC weapon capabilities
      let npcHasSurface = false;
      let npcHasAir = false;
      for (const hp of model.hardpoints) {
        const compId = config.equippedComponents[hp.id];
        const comp = compId ? COMPONENT_MAP.get(compId) : null;
        if (!comp || comp.damage <= 0) continue;
        if (comp.targetDomain === 'surface' || comp.targetDomain === 'both') npcHasSurface = true;
        if (comp.targetDomain === 'air' || comp.targetDomain === 'both') npcHasAir = true;
      }

      const role = selectNpcRole(
        playerFactionTeam,
        i,
        model.domain || 'land',
        model.combatRole,
        stats.speed,
        stats.armorRating,
        npcHasSurface
      );

      const allySpawn = getSafeSpawn(playerFactionTeam, model.domain || 'land', i);

      const npcShip: ShipEntity = {
        id: `allied-npc-${i}`,
        name: config.name,
        team: playerFactionTeam,
        isPlayer: false,
        model,
        config,
        stats,
        x: allySpawn.x,
        y: allySpawn.y,
        angle: isAmphibiousAssault
          ? (playerFactionTeam === amphibiousAttackerTeam ? 0 : Math.PI)
          : (playerFactionTeam === 'player' ? 0 : Math.PI),
        vx: 0,
        vy: 0,
        speed: 0,
        targetSpeedLevel: 2,
        rudderAngle: 0,
        articulatedAngle: playerFactionTeam === 'player' ? 0 : Math.PI,
        currentHp: stats.maxHp,
        maxHp: stats.maxHp,
        isSunk: false,
        sinkProgress: 0,
        idleTimer: 0,
        fireTimer: 0,
        cooldowns: {},
        aiState: role === 'defender' ? 'defend' : 'attack',
        aiDecisionTimer: Math.random() * 1.5,
        tacticalRole: role,
        domain: model.domain || 'land',
        altitude: model.domain === 'air' ? 65 : 0,
        weaponTargetMode: (npcHasAir && !npcHasSurface) ? 'air' : 'surface',
        hasSurfaceWeapons: npcHasSurface,
        hasAirWeapons: npcHasAir,
      };
      npcShip.towedTrailer = initVehicleTrailer(npcShip);
      initShipAircraftCapabilities(npcShip);
      ships.push(npcShip);
    }

    // 3. Create Hostile Enemy NPC vehicles (Alpha Team) with session randomized composition
    for (let i = 0; i < opposingFactionCount; i++) {
      const assignedDomain = opposingNpcDomains[i];
      const { model, config } = generateNpcShipConfig(
        i,
        opposingFactionTeam,
        opposingFactionCount,
        playerModel.domain || 'land',
        this.matchSeed,
        assignedDomain
      );
      const stats = calculateShipStats(model, config);

      let npcHasSurface = false;
      let npcHasAir = false;
      for (const hp of model.hardpoints) {
        const compId = config.equippedComponents[hp.id];
        const comp = compId ? COMPONENT_MAP.get(compId) : null;
        if (!comp || comp.damage <= 0) continue;
        if (comp.targetDomain === 'surface' || comp.targetDomain === 'both') npcHasSurface = true;
        if (comp.targetDomain === 'air' || comp.targetDomain === 'both') npcHasAir = true;
      }

      const role = selectNpcRole(
        opposingFactionTeam,
        i,
        model.domain || 'land',
        model.combatRole,
        stats.speed,
        stats.armorRating,
        npcHasSurface
      );

      const enemySpawn = getSafeSpawn(opposingFactionTeam, model.domain || 'land', i);

      const enemyShip: ShipEntity = {
        id: `enemy-npc-${i}`,
        name: config.name,
        team: opposingFactionTeam,
        isPlayer: false,
        model,
        config,
        stats,
        x: enemySpawn.x,
        y: enemySpawn.y,
        angle: isAmphibiousAssault
          ? (opposingFactionTeam === amphibiousAttackerTeam ? 0 : Math.PI)
          : (opposingFactionTeam === 'player' ? 0 : Math.PI),
        vx: 0,
        vy: 0,
        speed: 0,
        targetSpeedLevel: 2,
        rudderAngle: 0,
        articulatedAngle: opposingFactionTeam === 'player' ? 0 : Math.PI,
        currentHp: stats.maxHp,
        maxHp: stats.maxHp,
        isSunk: false,
        sinkProgress: 0,
        idleTimer: 0,
        fireTimer: 0,
        cooldowns: {},
        aiState: role === 'defender' ? 'defend' : role === 'attacker' ? 'attack' : 'chase',
        aiDecisionTimer: Math.random() * 1.5,
        tacticalRole: role,
        domain: model.domain || 'land',
        altitude: model.domain === 'air' ? 65 : 0,
        weaponTargetMode: (npcHasAir && !npcHasSurface) ? 'air' : 'surface',
        hasSurfaceWeapons: npcHasSurface,
        hasAirWeapons: npcHasAir,
      };
      enemyShip.towedTrailer = initVehicleTrailer(enemyShip);
      initShipAircraftCapabilities(enemyShip);
      ships.push(enemyShip);
    }

    let commandStations: CommandStationEntity[] | undefined = undefined;
    let defensiveWeapons: DefensiveWeaponEntity[] | undefined = undefined;
    let transportMission: TransportMissionState | undefined = undefined;
    let amphibiousMission: AmphibiousMissionState | undefined = undefined;

    if (gameMode === 'command-station') {
      const playerPos = mapConfig.commandStationPositions?.player || { x: 750, y: arenaHeight * 0.5, name: 'Allied Naval Citadel' };
      const enemyPos = mapConfig.commandStationPositions?.enemy || { x: arenaWidth - 750, y: arenaHeight * 0.5, name: 'Hostile Naval Citadel' };

      // Command stations must withstand a prolonged coordinated siege, while
      // their separate defensive emplacements receive a smaller durability bump.
      const baseStationHp = 24000;
      const defenseHpScale = 1.35;

      const playerStation: CommandStationEntity = {
        id: 'cs-player-hq',
        name: playerPos.name || 'Allied Command Station Citadel',
        team: 'player',
        x: playerPos.x,
        y: playerPos.y,
        hp: baseStationHp,
        maxHp: baseStationHp,
        radius: 90,
        isDestroyed: false,
        turrets: [],
      };

      const enemyStation: CommandStationEntity = {
        id: 'cs-enemy-hq',
        name: enemyPos.name || 'Hostile Command Station Citadel',
        team: 'enemy',
        x: enemyPos.x,
        y: enemyPos.y,
        hp: baseStationHp,
        maxHp: baseStationHp,
        radius: 90,
        isDestroyed: false,
        turrets: [],
      };

      commandStations = [playerStation, enemyStation];

      // Defensive weapons around the command station are completely separate objects
      // Each defensive weapon has its own HP and can be individually damaged and destroyed
      const playerWeapons: DefensiveWeaponEntity[] = (playerPos.defensiveWeapons || [
        { id: 'dw-p-1', name: 'Allied Coastal Battery Alpha', x: playerPos.x + 220, y: playerPos.y - 140, type: 'cannon' as const },
        { id: 'dw-p-2', name: 'Allied Surface Missile Silo', x: playerPos.x + 80, y: playerPos.y - 240, type: 'missile' as const },
        { id: 'dw-p-3', name: 'Allied Flak Defense Emplacement', x: playerPos.x + 240, y: playerPos.y + 160, type: 'ciws' as const },
      ]).map((w, idx) => ({
        id: w.id || `dw-player-${idx + 1}`,
        stationId: playerStation.id,
        name: w.name || `Allied Defense Battery ${idx + 1}`,
        team: 'player' as Team,
        x: w.x,
        y: w.y,
        angle: 0,
        hp: Math.round((w.hp || (w.type === 'missile' ? 420 : w.type === 'cannon' ? 520 : 360)) * defenseHpScale),
        maxHp: Math.round((w.hp || (w.type === 'missile' ? 420 : w.type === 'cannon' ? 520 : 360)) * defenseHpScale),
        radius: 26,
        isDestroyed: false,
        cooldown: Math.random() * 1.5,
        maxCooldown: w.type === 'missile' ? 3.8 : w.type === 'cannon' ? 2.4 : 0.65,
        range: w.range || (w.type === 'missile' ? 880 : w.type === 'cannon' ? 760 : 540),
        damage: w.damage || (w.type === 'missile' ? 80 : w.type === 'cannon' ? 55 : 20),
        type: w.type,
        style: (w.type === 'cannon' ? 'coastal-battery' : w.type === 'missile' ? 'missile-silo' : 'flak-tower') as DefensiveWeaponEntity['style'],
      }));

      const enemyWeapons: DefensiveWeaponEntity[] = (enemyPos.defensiveWeapons || [
        { id: 'dw-e-1', name: 'Hostile Coastal Battery Delta', x: enemyPos.x - 220, y: enemyPos.y + 140, type: 'cannon' as const },
        { id: 'dw-e-2', name: 'Hostile Long-Range Missile Silo', x: enemyPos.x - 80, y: enemyPos.y + 240, type: 'missile' as const },
        { id: 'dw-e-3', name: 'Hostile CIWS Flak Emplacement', x: enemyPos.x - 240, y: enemyPos.y - 160, type: 'ciws' as const },
      ]).map((w, idx) => ({
        id: w.id || `dw-enemy-${idx + 1}`,
        stationId: enemyStation.id,
        name: w.name || `Hostile Defense Battery ${idx + 1}`,
        team: 'enemy' as Team,
        x: w.x,
        y: w.y,
        angle: Math.PI,
        hp: Math.round((w.hp || (w.type === 'missile' ? 420 : w.type === 'cannon' ? 520 : 360)) * defenseHpScale),
        maxHp: Math.round((w.hp || (w.type === 'missile' ? 420 : w.type === 'cannon' ? 520 : 360)) * defenseHpScale),
        radius: 26,
        isDestroyed: false,
        cooldown: Math.random() * 1.5,
        maxCooldown: w.type === 'missile' ? 3.8 : w.type === 'cannon' ? 2.4 : 0.65,
        range: w.range || (w.type === 'missile' ? 880 : w.type === 'cannon' ? 760 : 540),
        damage: w.damage || (w.type === 'missile' ? 80 : w.type === 'cannon' ? 55 : 20),
        type: w.type,
        style: (w.type === 'cannon' ? 'coastal-battery' : w.type === 'missile' ? 'missile-silo' : 'flak-tower') as DefensiveWeaponEntity['style'],
      }));

      defensiveWeapons = [...playerWeapons, ...enemyWeapons];
    } else if (gameMode === 'transport-protection') {
      const escortTeam: Team = 'player';
      const defaultWaypoints = [
        { x: -140, y: arenaHeight * 0.5 },
        { x: arenaWidth * 0.32, y: arenaHeight * 0.38 },
        { x: arenaWidth * 0.52, y: arenaHeight * 0.62 },
        { x: arenaWidth * 0.72, y: arenaHeight * 0.42 },
        { x: arenaWidth + 140, y: arenaHeight * 0.5 },
      ];
      const waypoints = (mapConfig.convoyWaypoints && mapConfig.convoyWaypoints.length > 0)
        ? [...mapConfig.convoyWaypoints]
        : defaultWaypoints;
      const destination = mapConfig.destinationZone || {
        x: waypoints[waypoints.length - 1].x,
        y: waypoints[waypoints.length - 1].y,
        radius: 180,
        label: 'EXTRACTION ZONE',
      };

      const startPos = waypoints[0];
      const truckModel = SHIP_MODEL_MAP.get('vip-convoy-semi-truck') || BASE_SHIPS.find(s => s.domain === 'land') || BASE_SHIPS[0];
      const convoyPalettes = [
        { name: 'Woodland Camouflage', pattern: 'woodland' as const, primary: '#3f4a32', accent: '#20291d' },
        { name: 'Olive Drab', pattern: 'olivedrab' as const, primary: '#4b5320', accent: '#292f16' },
        { name: 'Night Black', pattern: 'black' as const, primary: '#20252a', accent: '#080a0c' },
        { name: 'Desert Field', pattern: 'desert' as const, primary: '#8a7b58', accent: '#4b4430' },
        { name: 'Naval Slate', pattern: 'navy' as const, primary: '#293b49', accent: '#111c25' },
      ];
      const convoyPalette = convoyPalettes[Math.abs(this.matchSeed) % convoyPalettes.length];
      const truckConfig: CustomShipConfig = {
        name: 'Allied Armored Convoy Semi',
        baseModelId: truckModel.id,
        primaryColor: convoyPalette.primary,
        accentColor: convoyPalette.accent,
        equippedComponents: {},
      };
      truckModel.hardpoints.forEach(hp => {
        if (hp.defaultComponentId) truckConfig.equippedComponents[hp.id] = hp.defaultComponentId;
      });
      const truckStats = calculateShipStats(truckModel, truckConfig);
      const initialAngle = waypoints.length > 1
        ? Math.atan2(waypoints[1].y - startPos.y, waypoints[1].x - startPos.x)
        : 0;

      const vipTruck: ShipEntity = {
        id: 'convoy-vip-truck',
        name: 'Allied Armored Convoy Semi',
        team: escortTeam,
        x: startPos.x,
        y: startPos.y,
        vx: 0,
        vy: 0,
        angle: initialAngle,
        rudderAngle: 0,
        targetRudderAngle: 0,
        speed: 0,
        targetSpeedLevel: 1,
        currentHp: 4800,
        maxHp: 4800,
        isSunk: false,
        sinkProgress: 0,
        isPlayer: false,
        model: truckModel,
        config: truckConfig,
        stats: {
          ...truckStats,
          maxHp: 4800,
          speed: 124,
          armorRating: 42,
        },
        cooldowns: {},
        idleTimer: 0,
        fireTimer: 0,
        aiState: 'defend',
        aiDecisionTimer: 1.0,
        tacticalRole: 'defender',
        domain: 'land',
        altitude: 0,
        weaponTargetMode: 'surface',
        hasSurfaceWeapons: false,
        hasAirWeapons: false,
        isConvoyTruck: true,
        convoyColorPattern: convoyPalette.pattern,
      };
      vipTruck.towedTrailer = initVehicleTrailer(vipTruck);
      ships.push(vipTruck);

      const hummerModel = SHIP_MODEL_MAP.get('mode3-convoy-gun-hummer') || BASE_SHIPS.find(s => s.domain === 'land') || BASE_SHIPS[0];
      const makeConvoyHummer = (position: 'front' | 'rear'): ShipEntity => {
        const offset = position === 'front' ? 205 : -205;
        const config: CustomShipConfig = {
          name: position === 'front' ? 'Convoy Vanguard Hummer' : 'Convoy Rearguard Hummer',
          baseModelId: hummerModel.id,
          primaryColor: convoyPalette.primary,
          accentColor: convoyPalette.accent,
          equippedComponents: {},
        };
        hummerModel.hardpoints.forEach(hp => {
          if (hp.defaultComponentId) config.equippedComponents[hp.id] = hp.defaultComponentId;
        });
        const stats = { ...calculateShipStats(hummerModel, config), speed: 128 };
        return {
          id: `convoy-${position}-hummer`,
          name: config.name,
          team: escortTeam,
          x: startPos.x + Math.cos(initialAngle) * offset,
          y: startPos.y + Math.sin(initialAngle) * offset,
          vx: 0,
          vy: 0,
          angle: initialAngle,
          rudderAngle: 0,
          targetRudderAngle: 0,
          speed: 0,
          targetSpeedLevel: 1,
          currentHp: stats.maxHp,
          maxHp: stats.maxHp,
          isSunk: false,
          sinkProgress: 0,
          isPlayer: false,
          model: hummerModel,
          config,
          stats,
          cooldowns: {},
          idleTimer: 0,
          fireTimer: 0,
          aiState: 'defend',
          aiDecisionTimer: 0.3,
          tacticalRole: 'defender',
          domain: 'land',
          altitude: 0,
          weaponTargetMode: 'surface',
          hasSurfaceWeapons: true,
          hasAirWeapons: false,
          convoyEscortPosition: position,
        };
      };
      const frontHummer = makeConvoyHummer('front');
      const rearHummer = makeConvoyHummer('rear');
      ships.push(frontHummer, rearHummer);

      transportMission = {
        truckShipId: vipTruck.id,
        frontHummerShipId: frontHummer.id,
        rearHummerShipId: rearHummer.id,
        waypoints,
        currentWaypointIndex: 1,
        frontWaypointIndex: 1,
        rearWaypointIndex: 1,
        destination,
        reachedDestination: false,
        isTruckDestroyed: false,
        progressPercent: 0,
        distanceRemaining: Math.round(Math.hypot(destination.x - startPos.x, destination.y - startPos.y)),
        colorSchemeName: convoyPalette.name,
      };
    } else if (gameMode === 'amphibious-assault') {
      const attackerTeam: Team = playerRole === 'attacker' ? 'player' : 'enemy';
      const defenderTeam: Team = attackerTeam === 'player' ? 'enemy' : 'player';

      const authoredLandingZone = mapConfig.amphibiousConfig?.landingZone || {
        x: arenaWidth * 0.58,
        y: arenaHeight * 0.5,
        radius: 240,
      };

      const fortressPos = mapConfig.amphibiousConfig?.commandCenterPos || {
        x: arenaWidth - 800,
        y: arenaHeight * 0.5,
        name: 'Coastal Redoubt Fortress HQ',
      };

      const coastalFortress: CommandStationEntity = {
        id: 'cs-coastal-fortress',
        name: fortressPos.name || 'Coastal Redoubt Citadel HQ',
        team: defenderTeam,
        x: fortressPos.x,
        y: fortressPos.y,
        hp: 14000,
        maxHp: 14000,
        radius: 135,
        isDestroyed: false,
        style: 'coastal-headquarters',
        turrets: [
          { id: 'cs-f-t1', offsetX: -72, offsetY: -58, angle: Math.PI, cooldown: 1.0, maxCooldown: 3.2, range: 1050, damage: 110, type: 'cannon' },
          { id: 'cs-f-t2', offsetX: -72, offsetY: 58, angle: Math.PI, cooldown: 2.2, maxCooldown: 3.2, range: 1050, damage: 110, type: 'cannon' },
          { id: 'cs-f-t3', offsetX: 66, offsetY: 0, angle: 0, cooldown: 4.5, maxCooldown: 6.0, range: 1300, damage: 175, type: 'missile' },
          { id: 'cs-f-t4', offsetX: -82, offsetY: 0, angle: Math.PI, cooldown: 0.5, maxCooldown: 0.28, range: 500, damage: 22, type: 'ciws' },
        ],
      };
      commandStations = [coastalFortress];

      // The two guard islands each carry a fully independent combat tower.
      // They use the existing defensive-object damage and targeting systems,
      // so either tower can continue fighting after the other is destroyed.
      defensiveWeapons = mapConfig.obstacles.slice(1, 3).map((island, index): DefensiveWeaponEntity => ({
        id: `mode4-island-defense-tower-${index + 1}`,
        stationId: coastalFortress.id,
        name: index === 0 ? 'North Island Defense Tower' : 'South Island Defense Tower',
        team: defenderTeam,
        x: island.x,
        y: island.y,
        angle: Math.PI,
        hp: 1800,
        maxHp: 1800,
        radius: 38,
        isDestroyed: false,
        cooldown: 0.4 + index * 0.35,
        maxCooldown: 0.62,
        range: 1050,
        damage: 34,
        type: 'ciws',
        style: 'defense-tower',
      }));

      const carrierSpawn = mapConfig.amphibiousConfig?.carrierSpawn || {
        x: 500,
        y: arenaHeight * 0.5,
        angle: 0,
      };

      const ferryPalette = takeMode4FerryPalette();
      // Mission-exclusive Ro-Ro vehicle ferry, authored from scratch rather
      // than inheriting any selectable warship or aircraft-carrier model.
      const carrierModel: BaseShipModel = {
        id: 'mode4-super-heavy-roro-ferry',
        name: 'Atlas Super-Heavy Vehicle Ferry',
        type: 'Military Ro-Ro Vehicle Transport Ferry',
        domain: 'water',
        hullClass: 'RO-RO',
        combatRole: 'support-tow',
        description: `Mission-exclusive roll-on/roll-off landing ferry in ${ferryPalette.name} livery, with an enclosed vehicle deck and reinforced bow ramp.`,
        hullLength: 440,
        hullWidth: 158,
        baseHp: 11000,
        baseSpeed: 24,
        baseTurnRate: 0.42,
        baseArmor: 58,
        hardpoints: [],
        svgHullPath: 'M 220,-54 L 188,-76 L -202,-76 L -220,-58 L -220,58 L -202,76 L 188,76 L 220,54 Z',
        spriteStyle: {
          bodyStyle: 'vehicle-ferry',
          hullColor: ferryPalette.hull,
          deckColor: ferryPalette.deck,
          accentColor: ferryPalette.accent,
          details: ferryPalette.details,
        },
      };

      // Convert the authored inland beach marker into a hull-safe water-side
      // deployment point. Sampling the actual map polygons makes this robust
      // across every organic shoreline instead of assuming a fixed coast X.
      const approachAngle = Math.atan2(
        authoredLandingZone.y - carrierSpawn.y,
        authoredLandingZone.x - carrierSpawn.x
      );
      const approachDistance = Math.hypot(
        authoredLandingZone.x - carrierSpawn.x,
        authoredLandingZone.y - carrierSpawn.y
      );
      const approachX = Math.cos(approachAngle);
      const approachY = Math.sin(approachAngle);
      let lastSafeDeploymentPoint = { x: carrierSpawn.x, y: carrierSpawn.y };
      for (let travel = 0; travel <= approachDistance; travel += 10) {
        const sampleX = carrierSpawn.x + approachX * travel;
        const sampleY = carrierSpawn.y + approachY * travel;
        const intersectsLand = mapConfig.obstacles.some(island => checkShipPolygonCollision(
          sampleX,
          sampleY,
          approachAngle,
          carrierModel.hullLength,
          carrierModel.hullWidth,
          island.points,
          island.canals
        ).collided);
        if (intersectsLand) break;
        lastSafeDeploymentPoint = { x: sampleX, y: sampleY };
      }
      const shorelineSafetyMargin = 24;
      const landingZone = {
        x: lastSafeDeploymentPoint.x - approachX * shorelineSafetyMargin,
        y: lastSafeDeploymentPoint.y - approachY * shorelineSafetyMargin,
        radius: Math.min(140, authoredLandingZone.radius),
      };
      const carrierConfig: CustomShipConfig = {
        name: attackerTeam === 'player' ? 'Atlas Vehicle Ferry' : 'Hostile Vehicle Ferry',
        baseModelId: carrierModel.id,
        primaryColor: ferryPalette.hull,
        accentColor: ferryPalette.accent,
        equippedComponents: {},
      };
      const carrierStats = calculateShipStats(carrierModel, carrierConfig);

      const carrierShip: ShipEntity = {
        id: 'assault-landing-carrier',
        name: attackerTeam === 'player' ? 'Atlas Vehicle Ferry' : 'Hostile Vehicle Ferry',
        team: attackerTeam,
        x: carrierSpawn.x,
        y: carrierSpawn.y,
        vx: 0,
        vy: 0,
        angle: carrierSpawn.angle || 0,
        rudderAngle: 0,
        targetRudderAngle: 0,
        speed: 0,
        targetSpeedLevel: 1,
        currentHp: 11000,
        maxHp: 11000,
        isSunk: false,
        sinkProgress: 0,
        isPlayer: false,
        model: carrierModel,
        config: carrierConfig,
        stats: {
          ...carrierStats,
          maxHp: 11000,
          speed: 34,
          armorRating: 58,
        },
        cooldowns: {},
        idleTimer: 0,
        fireTimer: 0,
        aiState: 'attack',
        aiDecisionTimer: 1.0,
        tacticalRole: 'attacker',
        domain: 'water',
        altitude: 0,
        weaponTargetMode: 'surface',
        hasSurfaceWeapons: false,
        hasAirWeapons: false,
      };
      ships.push(carrierShip);

      const onboardLandUnits = ships.filter(ship => ship.team === attackerTeam && ship.domain === 'land');
      onboardLandUnits.forEach((unit, slot) => {
        unit.isOnboardCarrier = true;
        unit.carrierId = carrierShip.id;
        unit.onboardCarrierSlot = slot;
        unit.targetSpeedLevel = 0;
        unit.speed = 0;
        const column = Math.floor(slot / 2);
        const row = slot % 2 === 0 ? -1 : 1;
        const localX = -carrierModel.hullLength * 0.22 + column * 82;
        const localY = row * carrierModel.hullWidth * 0.22;
        unit.x = carrierShip.x + Math.cos(carrierShip.angle) * localX - Math.sin(carrierShip.angle) * localY;
        unit.y = carrierShip.y + Math.sin(carrierShip.angle) * localX + Math.cos(carrierShip.angle) * localY;
        unit.angle = carrierShip.angle;
      });

      amphibiousMission = {
        carrierShipId: carrierShip.id,
        landingZone,
        commandCenter: coastalFortress,
        isCarrierBeached: false,
        isCarrierDestroyed: false,
        isDeploying: false,
        deployedUnitsCount: 0,
        maxDeployUnits: onboardLandUnits.length,
        deployTimer: 0,
        carrierHp: 11000,
        carrierMaxHp: 11000,
      };
    }

    let initialLogMessage = `Combat units deployed in ${mapConfig.name}! All vehicle cannons, missile pods, and defense systems online.`;
    if (gameMode === 'command-station') {
      initialLogMessage = `Command Station Warfare initiated! Destroy the enemy command citadel or eliminate their fleet to achieve victory.`;
    } else if (gameMode === 'transport-protection') {
      initialLogMessage = playerRole === 'defender'
        ? `VIP Convoy Escort active! Escort the armored cargo rig safely across the island causeways to the extraction zone.`
        : `Convoy Interception active! Intercept and destroy the enemy armored cargo rig before it reaches the extraction zone.`;
    } else if (gameMode === 'amphibious-assault') {
      initialLogMessage = playerRole === 'attacker'
        ? `Amphibious Assault underway! Escort the vehicle ferry to the beachhead, deploy assault armor, and breach the coastal fortress.`
        : `Coastal Fortress Defense active! Repel the hostile vehicle ferry and protect the coastal citadel.`;
    }

    const battleState: BattleState = {
      arenaWidth,
      arenaHeight,
      ships,
      projectiles: [],
      particles: [],
      ripples: [],
      islands,
      bridges,
      mapConfig,
      time: 0,
      gameOver: false,
      winner: null,
      camera: { x: playerShip.x, y: playerShip.y, zoom: 0.88 },
      mouseWorldPos: { x: arenaWidth * 0.5, y: arenaHeight * 0.5 },
      playerShipId: playerShip.id,
      combatLog: [
        {
          id: 'log-0',
          text: initialLogMessage,
          time: 0,
          team: playerFactionTeam,
        },
      ],
      stats: {
        damageDealt: 0,
        shipsSunk: 0,
        shotsFired: 0,
        shotsHit: 0,
      },
      gameMode,
      commandStations,
      defensiveWeapons,
      transportMission,
      amphibiousMission,
      playerRole,
    };

    // Register physical solid obstacles (Command Stations, Defense Bunkers) with LandPathfinder
    if (commandStations || defensiveWeapons) {
      this.landPathfinder.setSolidObstacles([
        ...(commandStations || []).map(cs => ({ x: cs.x, y: cs.y, radius: cs.radius })),
        ...(defensiveWeapons || []).map(dw => ({ x: dw.x, y: dw.y, radius: dw.radius })),
      ]);
    }

    return battleState;
  }

  public updateSettings(newSettings: Partial<BattleSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    sounds.enabled = this.settings.soundEnabled;

    // If map changed, update obstacles and map config
    if (newSettings.selectedMapId) {
      const map = BATTLE_MAP_MAP.get(newSettings.selectedMapId);
      if (map) {
        this.state.mapConfig = map;
        this.state.islands = map.obstacles;
        this.state.bridges = map.bridges || [];
        this.landPathfinder = new LandPathfinder(this.state.islands, this.state.bridges);
      }
    }
  }

  public setMouseWorldPos(worldX: number, worldY: number) {
    if (!isNaN(worldX) && !isNaN(worldY)) {
      this.state.mouseWorldPos = { x: worldX, y: worldY };
    }
  }

  public adjustPlayerThrottle(delta: number) {
    const player = this.getPlayerShip();
    if (!player || player.isSunk || player.isOnboardCarrier) return;
    const current = player.targetSpeedLevel;
    player.targetSpeedLevel = Math.max(-1, Math.min(2, current + delta));
  }

  public setPlayerThrottle(level: number) {
    const player = this.getPlayerShip();
    if (!player || player.isSunk || player.isOnboardCarrier) return;
    player.targetSpeedLevel = Math.max(-1, Math.min(2, Math.round(level)));
  }

  public setPlayerThrottleDirect(level: number) {
    this.setPlayerThrottle(level);
  }

  public setPlayerRudder(angle: number) {
    const player = this.getPlayerShip();
    if (!player || player.isSunk || player.isOnboardCarrier) return;
    const clamped = Math.max(-1, Math.min(1, angle));
    player.rudderAngle = clamped;
    player.targetRudderAngle = clamped;
  }

  /**
   * Calculates a smooth, deadband-damped steering command.
   */
  private calculateSmoothSteer(angleDiff: number): number {
    const absDiff = Math.abs(angleDiff);
    // Deadband: within +/- 2.0 degrees (~0.035 rad), hold rudder dead-center
    if (absDiff < 0.035) return 0;

    const sign = Math.sign(angleDiff);
    const normalizedDiff = Math.min(Math.PI, absDiff);
    const t = Math.min(1.0, (normalizedDiff - 0.025) / 0.75);
    return sign * (t * t * 0.65 + t * 0.35);
  }

  /**
   * Ultra-smooth, critically damped autopilot heading controller.
   * Eliminates both overshoot and high-frequency micro-oscillation:
   * 1. Low-pass exponential filter on desired heading to suppress 60Hz micro-fluctuations.
   * 2. Smoothstep Hermite curve across deadband edge: zero command jump, continuous derivative.
   * 3. Angular velocity anticipation (derivative lead) guarantees zero heading overshoot.
   * 4. Rudder slews strictly through physics rather than instantaneous assignment.
   */
  private applyAutopilotHeading(ship: ShipEntity, desiredAngle: number, dt: number) {
    if (isNaN(desiredAngle)) return;

    // 1. Exponential low-pass filter on desired heading to suppress micro-fluctuations
    if (ship.filteredHeading === undefined || isNaN(ship.filteredHeading)) {
      ship.filteredHeading = desiredAngle;
    } else {
      const headingDelta = this.normalizeAngle(desiredAngle - ship.filteredHeading);
      // Responsive yet buttery smooth (filters out 60Hz noise while smoothly tracking course changes)
      const filterRate = ship.domain === 'air' ? 12.0 : 6.0;
      ship.filteredHeading = this.normalizeAngle(ship.filteredHeading + headingDelta * Math.min(1.0, dt * filterRate));
    }

    const headingDiff = this.normalizeAngle(ship.filteredHeading - ship.angle);

    const turnRate = ship.stats.turnRate;
    const speedRatio = ship.domain === 'air'
      ? Math.max(0.65, Math.abs(ship.speed) / Math.max(1, ship.stats.speed))
      : (ship.domain === 'land'
          ? Math.max(0.70, Math.abs(ship.speed) / Math.max(1, ship.stats.speed))
          : Math.max(0.25, Math.abs(ship.speed) / Math.max(1, ship.stats.speed)));
    const maxTurnSpeed = Math.max(0.08, turnRate * speedRatio); // rad/s

    // 2. Deadband and smooth ramp zone
    // Ships holding course within ~2.8 deg (0.048 rad) require 0 steering
    const deadband = ship.domain === 'air' ? 0.035 : 0.048;
    const rampZone = 0.28; // ~16 degrees

    // Current turn rate
    const currentOmega = ship.rudderAngle * maxTurnSpeed;
    const leadTime = ship.domain === 'air' ? 0.35 : 0.60;
    const predictedError = headingDiff - currentOmega * leadTime;
    const absPredError = Math.abs(predictedError);

    if (absPredError <= deadband) {
      // Clean, quiet zero command - physics gently centers rudder without snapping
      ship.targetRudderAngle = 0;
      return;
    }

    // 3. Continuous Hermite smoothstep transition from deadband edge to rampZone
    // Since smoothstep S(x) = 3x^2 - 2x^3 has derivative 0 at x=0, there is ZERO torque jump at the deadband threshold!
    const s = Math.min(1.0, (absPredError - deadband) / rampZone);
    const smoothGain = s * s * (3 - 2 * s);

    // Command saturates smoothly between -1.0 and 1.0
    const steerCommand = Math.sign(predictedError) * smoothGain;
    ship.targetRudderAngle = Math.max(-1.0, Math.min(1.0, steerCommand));
  }

  public firePlayerWeapons(customTargetX?: number, customTargetY?: number): boolean {
    const player = this.getPlayerShip();
    if (!player || player.isSunk || player.isOnboardCarrier) return false;
    const targetX = customTargetX !== undefined && !isNaN(customTargetX) ? customTargetX : this.state.mouseWorldPos.x;
    const targetY = customTargetY !== undefined && !isNaN(customTargetY) ? customTargetY : this.state.mouseWorldPos.y;
    if (isNaN(targetX) || isNaN(targetY)) return false;
    return this.fireShipWeapons(player, targetX, targetY);
  }

  public getPlayerWeaponModeInfo(): {
    hasSurfaceWeapons: boolean;
    hasAirWeapons: boolean;
    canToggle: boolean;
    currentMode: VehicleWeaponMode;
    modeType: 'both' | 'air-only' | 'surface-only' | 'none';
  } {
    const player = this.getPlayerShip();
    if (!player) {
      return {
        hasSurfaceWeapons: true,
        hasAirWeapons: false,
        canToggle: false,
        currentMode: 'surface',
        modeType: 'surface-only',
      };
    }
    let hasSurface = false;
    let hasAir = false;
    for (const hp of player.model.hardpoints) {
      const compId = player.config.equippedComponents[hp.id];
      if (!compId) continue;
      const comp = COMPONENT_MAP.get(compId);
      if (!comp || comp.damage <= 0) continue;
      const coversSurface = comp.targetDomain === 'surface' || comp.targetDomain === 'both' || (!comp.targetDomain && !comp.isAirTargeting);
      const coversAir = comp.targetDomain === 'air' || comp.targetDomain === 'both' || !!comp.isAirTargeting;
      if (coversSurface) hasSurface = true;
      if (coversAir) hasAir = true;
    }

    const canToggle = hasSurface && hasAir;
    let modeType: 'both' | 'air-only' | 'surface-only' | 'none';
    if (canToggle) {
      modeType = 'both';
    } else if (hasAir && !hasSurface) {
      modeType = 'air-only';
    } else if (hasSurface && !hasAir) {
      modeType = 'surface-only';
    } else {
      modeType = 'none';
    }

    let currentMode: VehicleWeaponMode = 'surface';
    if (modeType === 'air-only') {
      currentMode = 'air';
    } else if (modeType === 'surface-only') {
      currentMode = 'surface';
    } else if (player.weaponTargetMode) {
      currentMode = player.weaponTargetMode;
    } else {
      currentMode = 'surface';
    }
    player.weaponTargetMode = currentMode;

    return {
      hasSurfaceWeapons: hasSurface,
      hasAirWeapons: hasAir,
      canToggle,
      currentMode,
      modeType,
    };
  }

  public togglePlayerWeaponMode(): VehicleWeaponMode {
    const player = this.getPlayerShip();
    if (!player) return 'surface';

    const info = this.getPlayerWeaponModeInfo();
    if (!info.canToggle) {
      return info.currentMode;
    }

    player.weaponTargetMode = player.weaponTargetMode === 'surface' ? 'air' : 'surface';

    sounds.playCannonShot('swivel');
    const focusLabel = player.weaponTargetMode === 'air' ? 'AIR FOCUS' : 'SURFACE FOCUS';
    this.addCombatLog(
      `Tactical targeting switched to ${focusLabel}`,
      'player'
    );
    return player.weaponTargetMode;
  }

  public getPlayerShip(): ShipEntity | undefined {
    return this.state.ships.find(s => s.id === this.state.playerShipId);
  }

  public getPlayerAircraftCapabilities(): {
    hasHelipad: boolean;
    helicopterState: HelicopterState | null;
    helicopterHp: number;
    helicopterMaxHp: number;
    isCarrier: boolean;
    carrierFighterJetsRemaining: number;
    carrierFighterJetsMax: number;
  } {
    const player = this.getPlayerShip();
    if (!player || player.isSunk) {
      return {
        hasHelipad: false,
        helicopterState: null,
        helicopterHp: 0,
        helicopterMaxHp: 0,
        isCarrier: false,
        carrierFighterJetsRemaining: 0,
        carrierFighterJetsMax: 0,
      };
    }
    return {
      hasHelipad: !!player.hasHelipad,
      helicopterState: player.helicopterState || null,
      helicopterHp: player.helicopterHp ?? 680,
      helicopterMaxHp: player.helicopterMaxHp ?? 680,
      isCarrier: !!player.isCarrier,
      carrierFighterJetsRemaining: player.carrierFighterJetsRemaining ?? 0,
      carrierFighterJetsMax: player.carrierFighterJetsMax ?? 5,
    };
  }

  public deployShipHelicopter(shipId?: string): boolean {
    const ship = shipId ? this.state.ships.find(s => s.id === shipId) : this.getPlayerShip();
    if (!ship || ship.isSunk || !ship.hasHelipad) return false;
    if (ship.helicopterState !== 'landed') return false;

    const helipadOffset = ship.model.hullLength * -0.38;
    const spawnX = ship.x + Math.cos(ship.angle) * helipadOffset;
    const spawnY = ship.y + Math.sin(ship.angle) * helipadOffset;

    const heloModel = SHIP_MODEL_MAP.get('air-attack-helicopter') || BASE_SHIPS.find(m => m.id === 'air-attack-helicopter');
    if (!heloModel) return false;

    const heloConfig: CustomShipConfig = {
      name: `${ship.name} Combat Chopper`,
      baseModelId: heloModel.id,
      primaryColor: ship.config.primaryColor || '#27272a',
      accentColor: ship.config.accentColor || '#3f3f46',
      equippedComponents: {},
    };
    for (const hp of heloModel.hardpoints) {
      if (hp.defaultComponentId) {
        heloConfig.equippedComponents[hp.id] = hp.defaultComponentId;
      }
    }

    const heloStats = calculateShipStats(heloModel, heloConfig);
    const heloId = `${ship.id}-helo`;

    const existingHelo = this.state.ships.find(s => s.id === heloId);
    if (existingHelo) {
      existingHelo.x = spawnX;
      existingHelo.y = spawnY;
      existingHelo.angle = ship.angle;
      existingHelo.speed = ship.speed + 40;
      existingHelo.vx = Math.cos(ship.angle) * (ship.speed + 40);
      existingHelo.vy = Math.sin(ship.angle) * (ship.speed + 40);
      existingHelo.targetSpeedLevel = 2;
      existingHelo.rudderAngle = 0;
      existingHelo.isSunk = false;
      existingHelo.sinkProgress = 0;
      existingHelo.isDocked = false;
      existingHelo.altitude = 12;
      existingHelo.currentHp = ship.helicopterHp ?? heloStats.maxHp;
      existingHelo.maxHp = ship.helicopterMaxHp ?? heloStats.maxHp;
      existingHelo.aiState = 'attack';
      existingHelo.tacticalRole = 'attacker';
    } else {
      const newHelo: ShipEntity = {
        id: heloId,
        name: heloConfig.name,
        team: ship.team,
        isPlayer: false,
        model: heloModel,
        config: heloConfig,
        stats: heloStats,
        x: spawnX,
        y: spawnY,
        angle: ship.angle,
        vx: Math.cos(ship.angle) * (ship.speed + 40),
        vy: Math.sin(ship.angle) * (ship.speed + 40),
        speed: ship.speed + 40,
        targetSpeedLevel: 2,
        rudderAngle: 0,
        currentHp: ship.helicopterHp ?? heloStats.maxHp,
        maxHp: ship.helicopterMaxHp ?? heloStats.maxHp,
        isSunk: false,
        sinkProgress: 0,
        idleTimer: 0,
        fireTimer: 0,
        cooldowns: {},
        tacticalRole: 'attacker',
        aiState: 'attack',
        aiDecisionTimer: 0.5,
        domain: 'air',
        altitude: 12,
        weaponTargetMode: 'surface',
        hasSurfaceWeapons: true,
        hasAirWeapons: true,
        mothershipId: ship.id,
        isDocked: false,
      };
      this.state.ships.push(newHelo);
    }

    ship.helicopterState = 'deployed';
    ship.helicopterEntityId = heloId;

    sounds.playHelicopterAction('deploy');
    for (let i = 0; i < 16; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pSpeed = 30 + Math.random() * 45;
      this.addParticle({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        life: 0.55,
        maxLife: 0.55,
        size: 5 + Math.random() * 4,
        color: '#cbd5e1',
        type: 'water',
      });
    }

    this.addCombatLog(`🚁 ${ship.name} deployed attack helicopter into combat!`, ship.team);
    this.onStateUpdate?.(this.state);
    return true;
  }

  public recallShipHelicopter(shipId?: string): boolean {
    const ship = shipId ? this.state.ships.find(s => s.id === shipId) : this.getPlayerShip();
    if (!ship || ship.isSunk || !ship.hasHelipad) return false;
    if (ship.helicopterState !== 'deployed') return false;

    ship.helicopterState = 'returning';
    sounds.playHelicopterAction('recall');
    this.addCombatLog(`🚁 ${ship.name} ordered helicopter to return and land on deck.`, ship.team);
    this.onStateUpdate?.(this.state);
    return true;
  }

  public togglePlayerHelicopter(): boolean {
    const ship = this.getPlayerShip();
    if (!ship || ship.isSunk || !ship.hasHelipad) return false;
    if (ship.helicopterState === 'landed') {
      return this.deployShipHelicopter(ship.id);
    } else if (ship.helicopterState === 'deployed') {
      return this.recallShipHelicopter(ship.id);
    } else if (ship.helicopterState === 'returning') {
      ship.helicopterState = 'deployed';
      sounds.playHelicopterAction('deploy');
      this.addCombatLog(`🚁 ${ship.name} cancelled return: helicopter re-engaged in combat!`, ship.team);
      this.onStateUpdate?.(this.state);
      return true;
    }
    return false;
  }

  public launchCarrierFighterJet(shipId?: string): boolean {
    const ship = shipId ? this.state.ships.find(s => s.id === shipId) : this.getPlayerShip();
    if (!ship || ship.isSunk || !ship.isCarrier) return false;
    const remaining = ship.carrierFighterJetsRemaining ?? 0;
    if (remaining <= 0) return false;

    ship.carrierFighterJetsRemaining = remaining - 1;
    const jetIndex = (ship.carrierFighterJetsMax ?? 5) - remaining + 1;

    // Alternate models: multirole strike jet and air superiority fighter
    const modelId = jetIndex % 2 === 1 ? 'air-fighter-multirole' : 'air-fighter-interceptor';
    const jetModel = SHIP_MODEL_MAP.get(modelId) || BASE_SHIPS.find(m => m.id === modelId) || BASE_SHIPS.find(m => m.domain === 'air')!;

    const catOffset = ship.model.hullLength * 0.28;
    const launchX = ship.x + Math.cos(ship.angle) * catOffset;
    const launchY = ship.y + Math.sin(ship.angle) * catOffset;

    const jetConfig: CustomShipConfig = {
      name: `${ship.name} Strike Jet #${jetIndex}`,
      baseModelId: jetModel.id,
      primaryColor: ship.config.primaryColor || jetModel.spriteStyle.hullColor,
      accentColor: ship.config.accentColor || jetModel.spriteStyle.accentColor,
      equippedComponents: {},
    };
    for (const hp of jetModel.hardpoints) {
      if (hp.defaultComponentId) {
        jetConfig.equippedComponents[hp.id] = hp.defaultComponentId;
      }
    }

    const jetStats = calculateShipStats(jetModel, jetConfig);
    const jetId = `${ship.id}-jet-${jetIndex}-${Date.now()}`;

    const jetEntity: ShipEntity = {
      id: jetId,
      name: jetConfig.name,
      team: ship.team,
      isPlayer: false,
      model: jetModel,
      config: jetConfig,
      stats: jetStats,
      x: launchX,
      y: launchY,
      angle: ship.angle,
      vx: Math.cos(ship.angle) * (ship.speed + 190),
      vy: Math.sin(ship.angle) * (ship.speed + 190),
      speed: ship.speed + 190,
      targetSpeedLevel: 2,
      rudderAngle: 0,
      currentHp: jetStats.maxHp,
      maxHp: jetStats.maxHp,
      isSunk: false,
      sinkProgress: 0,
      idleTimer: 0,
      fireTimer: 0,
      cooldowns: {},
      tacticalRole: 'attacker',
      aiState: 'attack',
      aiDecisionTimer: 0.3,
      domain: 'air',
      altitude: 18,
      weaponTargetMode: 'surface',
      hasSurfaceWeapons: true,
      hasAirWeapons: true,
      mothershipId: ship.id,
      isDocked: false,
    };

    this.state.ships.push(jetEntity);
    if (!ship.carrierDeployedJetIds) {
      ship.carrierDeployedJetIds = [];
    }
    ship.carrierDeployedJetIds.push(jetId);

    sounds.playAircraftLaunch();
    for (let i = 0; i < 22; i++) {
      const streamSpeed = -30 - Math.random() * 85;
      const spreadAngle = ship.angle + Math.PI + (Math.random() - 0.5) * 0.45;
      this.addParticle({
        x: launchX,
        y: launchY,
        vx: Math.cos(spreadAngle) * streamSpeed,
        vy: Math.sin(spreadAngle) * streamSpeed,
        life: 0.45,
        maxLife: 0.45,
        size: 4 + Math.random() * 6,
        color: i % 2 === 0 ? '#f97316' : '#f8fafc',
        type: i % 2 === 0 ? 'fire' : 'smoke',
      });
    }

    const remainingMsg = ship.carrierFighterJetsRemaining > 0
      ? `${ship.carrierFighterJetsRemaining} jets remaining aboard`
      : `all 5 carrier jets deployed!`;
    this.addCombatLog(`✈️ Catapult launch: ${ship.name} launched ${jetModel.name} (${remainingMsg}).`, ship.team);

    this.onStateUpdate?.(this.state);
    return true;
  }

  public launchPlayerFighterJet(): boolean {
    const player = this.getPlayerShip();
    if (!player || player.isSunk) return false;
    return this.launchCarrierFighterJet(player.id);
  }

  public panCamera(deltaX: number, deltaY: number) {
    this.isFreeCam = true;
    this.spectatorTargetId = null;
    const zoom = this.state.camera.zoom || 1;
    this.state.camera.x = Math.max(100, Math.min(this.state.arenaWidth - 100, this.state.camera.x + deltaX / zoom));
    this.state.camera.y = Math.max(100, Math.min(this.state.arenaHeight - 100, this.state.camera.y + deltaY / zoom));
  }

  public zoomCamera(factor: number) {
    const currentZoom = this.state.camera.zoom || 1;
    const newZoom = Math.max(0.35, Math.min(1.85, currentZoom * factor));
    this.state.camera.zoom = newZoom;
  }

  public setSpectatorTarget(unitId: string | null) {
    this.spectatorTargetId = unitId;
    this.isFreeCam = !unitId;
    if (unitId) {
      const ship = this.state.ships.find(s => s.id === unitId);
      if (ship) {
        this.state.camera.x = ship.x;
        this.state.camera.y = ship.y;
      }
    }
  }

  public cycleSpectator(forward: boolean = true) {
    const livingShips = this.state.ships.filter(s => !s.isSunk);
    if (livingShips.length === 0) return;
    const curIdx = livingShips.findIndex(s => s.id === this.spectatorTargetId);
    let nextIdx: number;
    if (curIdx === -1) {
      nextIdx = 0;
    } else {
      nextIdx = (curIdx + (forward ? 1 : -1) + livingShips.length) % livingShips.length;
    }
    this.setSpectatorTarget(livingShips[nextIdx].id);
  }

  public start() {
    this.lastTimestamp = performance.now();
    const loop = (timestamp: number) => {
      const dtMs = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      const dt = Math.min(0.08, dtMs / 1000) * (this.settings.gameSpeed || 1);

      this.update(dt);
      if (this.onStateUpdate) {
        this.onStateUpdate(this.state);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public update(dt: number) {
    this.state.time += dt;

    // 1. Update Ship Physics, Cooldowns, Repair Systems
    for (const ship of this.state.ships) {
      this.updateShip(ship, dt);
    }

    // 2. Update NPCs AI
    for (const ship of this.state.ships) {
      if (!ship.isPlayer && !ship.isSunk) {
        this.updateNpcAi(ship, dt);
      }
    }

    // 3. Player Auto-fire if enabled
    if (this.settings.autoFire) {
      const player = this.getPlayerShip();
      if (player && !player.isSunk && !player.isOnboardCarrier) {
        const hostileTeam: Team = player.team === 'player' ? 'enemy' : 'player';
        const enemies = this.state.ships.filter(s => s.team === hostileTeam && !s.isSunk && !s.isOnboardCarrier);
        let nearest: ShipEntity | null = null;
        let minDist = Infinity;
        const targetMode = player.weaponTargetMode || 'surface';

        // Seek targets matching player's current weapon targeting focus:
        // In Air Focus, target aircraft only; in Surface Focus, target surface vessels & vehicles only
        for (const e of enemies) {
          const isTargetAir = e.domain === 'air';
          const matchesFocus = targetMode === 'air' ? isTargetAir : !isTargetAir;
          if (!matchesFocus) continue;
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d < minDist && d < (player.stats.effectiveRange || 780)) {
            minDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          this.fireShipWeapons(player, nearest.x, nearest.y);
        }
      }
    }

    // 4. Update Projectiles
    this.updateProjectiles(dt);

    // 5. Update Particles & Ripples
    this.updateParticles(dt);

    // 6. Camera follows player, or spectator target / freecam
    const player = this.getPlayerShip();
    if (player && !player.isSunk && !this.isFreeCam) {
      const targetCamX = player.x;
      const targetCamY = player.y;
      this.state.camera.x += (targetCamX - this.state.camera.x) * 0.1;
      this.state.camera.y += (targetCamY - this.state.camera.y) * 0.1;
    } else if (this.spectatorTargetId) {
      const specShip = this.state.ships.find(s => s.id === this.spectatorTargetId && !s.isSunk);
      if (specShip) {
        this.state.camera.x += (specShip.x - this.state.camera.x) * 0.1;
        this.state.camera.y += (specShip.y - this.state.camera.y) * 0.1;
      }
    }

    // 7. Update Mission Mode Systems
    if (this.state.commandStations) {
      this.updateCommandStations(dt);
    }
    if (this.state.defensiveWeapons) {
      this.updateDefensiveWeapons(dt);
    }
    if (this.state.transportMission) {
      this.updateTransportMission(dt);
    }
    if (this.state.amphibiousMission) {
      this.updateAmphibiousMission(dt);
    }

    // 8. Check Game Over conditions across all 4 modes
    this.checkGameOverConditions();
  }

  private updateCommandStations(dt: number) {
    if (!this.state.commandStations) return;

    for (const station of this.state.commandStations) {
      if (station.isDestroyed) continue;

      const hostileTeam: Team = station.team === 'player' ? 'enemy' : 'player';
      const potentialTargets = this.state.ships.filter(s => s.team === hostileTeam && !s.isSunk && !s.isOnboardCarrier);

      for (const turret of station.turrets) {
        turret.cooldown = Math.max(0, turret.cooldown - dt);

        // Find nearest hostile target within range
        let nearest: ShipEntity | null = null;
        let minDist = Infinity;
        const tx = station.x + turret.offsetX;
        const ty = station.y + turret.offsetY;

        for (const target of potentialTargets) {
          const d = Math.hypot(target.x - tx, target.y - ty);
          if (d < minDist && d <= turret.range) {
            minDist = d;
            nearest = target;
          }
        }

        if (nearest) {
          turret.angle = Math.atan2(nearest.y - ty, nearest.x - tx);

          if (turret.cooldown <= 0) {
            turret.cooldown = turret.maxCooldown;

            const vx = Math.cos(turret.angle) * (turret.type === 'missile' ? 440 : turret.type === 'ciws' ? 640 : 530);
            const vy = Math.sin(turret.angle) * (turret.type === 'missile' ? 440 : turret.type === 'ciws' ? 640 : 530);
            const projLife = minDist / Math.hypot(vx, vy);

            this.state.projectiles.push({
              id: `proj-cs-${this.nextId++}`,
              x: tx,
              y: ty,
              startX: tx,
              startY: ty,
              targetX: nearest.x,
              targetY: nearest.y,
              vx,
              vy,
              damage: turret.damage,
              splashRadius: turret.type === 'missile' ? 45 : turret.type === 'cannon' ? 25 : 0,
              type: turret.type === 'missile' ? 'missile' : turret.type === 'ciws' ? 'flak' : 'shell',
              team: station.team,
              sourceShipId: station.id,
              life: 0,
              maxLife: Math.max(0.4, projLife),
              color: station.team === 'player' ? '#34d399' : '#f43f5e',
              targetDomain: 'surface',
              altitude: 10,
            });

            sounds.playCannonShot(turret.type === 'missile' ? 'missile' : turret.type === 'ciws' ? 'swivel' : 'heavy');
          }
        }
      }
    }
  }

  private updateDefensiveWeapons(dt: number) {
    if (!this.state.defensiveWeapons) return;

    for (const weapon of this.state.defensiveWeapons) {
      if (weapon.isDestroyed) continue;

      weapon.cooldown = Math.max(0, weapon.cooldown - dt);

      const hostileTeam: Team = weapon.team === 'player' ? 'enemy' : 'player';
      const potentialTargets = this.state.ships.filter(s => s.team === hostileTeam && !s.isSunk && !s.isOnboardCarrier);

      let nearest: ShipEntity | null = null;
      let minDist = weapon.range;

      for (const target of potentialTargets) {
        if (weapon.type !== 'ciws' && target.domain === 'air') continue;
        const d = Math.hypot(target.x - weapon.x, target.y - weapon.y);
        if (d <= minDist) {
          minDist = d;
          nearest = target;
        }
      }

      if (nearest) {
        weapon.angle = Math.atan2(nearest.y - weapon.y, nearest.x - weapon.x);

        if (weapon.cooldown <= 0) {
          weapon.cooldown = weapon.maxCooldown;

          const vx = Math.cos(weapon.angle) * (weapon.type === 'missile' ? 440 : weapon.type === 'ciws' ? 640 : 530);
          const vy = Math.sin(weapon.angle) * (weapon.type === 'missile' ? 440 : weapon.type === 'ciws' ? 640 : 530);
          const projLife = minDist / Math.hypot(vx, vy);

          this.state.projectiles.push({
            id: `proj-dw-${this.nextId++}`,
            x: weapon.x,
            y: weapon.y,
            startX: weapon.x,
            startY: weapon.y,
            targetX: nearest.x,
            targetY: nearest.y,
            vx,
            vy,
            damage: weapon.damage,
            splashRadius: weapon.type === 'missile' ? 45 : weapon.type === 'cannon' ? 25 : 0,
            type: weapon.type === 'missile' ? 'missile' : weapon.type === 'ciws' ? 'flak' : 'shell',
            team: weapon.team,
            sourceShipId: weapon.id,
            life: 0,
            maxLife: Math.max(0.4, projLife),
            color: weapon.team === 'player' ? '#34d399' : '#f43f5e',
            targetDomain: nearest.domain === 'air' ? 'air' : 'surface',
            altitude: nearest.domain === 'air' ? 45 : 10,
          });

          sounds.playCannonShot(weapon.type === 'missile' ? 'missile' : weapon.type === 'ciws' ? 'swivel' : 'heavy');
        }
      }
    }
  }

  private buildConvoyTurningPath(
    route: { x: number; y: number }[],
    truck: ShipEntity
  ): { x: number; y: number; turnSeverity?: number }[] {
    if (route.length < 3) return route.map(point => ({ ...point }));

    const path: { x: number; y: number; turnSeverity?: number }[] = [{ ...route[0] }];
    const hitchToTrailerAxle = truck.model.hullLength * 0.62;
    // A broad curve lets the tractor begin rotating before the bridge joint and
    // gives the long trailer room to track inside without touching the edge.
    const rigTurningRadius = Math.max(truck.model.hullLength * 0.95, hitchToTrailerAxle * 1.55);

    for (let i = 1; i < route.length - 1; i++) {
      const previous = route[i - 1];
      const corner = route[i];
      const next = route[i + 1];
      const incomingX = corner.x - previous.x;
      const incomingY = corner.y - previous.y;
      const outgoingX = next.x - corner.x;
      const outgoingY = next.y - corner.y;
      const incomingLength = Math.hypot(incomingX, incomingY) || 1;
      const outgoingLength = Math.hypot(outgoingX, outgoingY) || 1;
      const incomingUnitX = incomingX / incomingLength;
      const incomingUnitY = incomingY / incomingLength;
      const outgoingUnitX = outgoingX / outgoingLength;
      const outgoingUnitY = outgoingY / outgoingLength;
      const incomingAngle = Math.atan2(incomingUnitY, incomingUnitX);
      const outgoingAngle = Math.atan2(outgoingUnitY, outgoingUnitX);
      const turnSeverity = Math.abs(this.normalizeAngle(outgoingAngle - incomingAngle));

      if (turnSeverity < 0.16) {
        path.push({ ...corner });
        continue;
      }

      // Tangent distance for a rounded corner, capped so both tangent points
      // remain well inside the land area joining the two bridge centerlines.
      const geometricTangent = rigTurningRadius * Math.tan(Math.min(1.18, turnSeverity * 0.5));
      const tangentDistance = Math.min(
        incomingLength * 0.34,
        outgoingLength * 0.34,
        Math.max(truck.model.hullLength * 0.72, geometricTangent),
        285
      );
      const entry = {
        x: corner.x - incomingUnitX * tangentDistance,
        y: corner.y - incomingUnitY * tangentDistance,
      };
      const exit = {
        x: corner.x + outgoingUnitX * tangentDistance,
        y: corner.y + outgoingUnitY * tangentDistance,
      };
      path.push({ ...entry, turnSeverity });

      // Quadratic Bezier samples form the pre-planned tractor centerline. The
      // sample spacing is shorter than the cab so steering changes progressively.
      const sampleCount = Math.max(5, Math.ceil((tangentDistance * 2) / 42));
      for (let sample = 1; sample <= sampleCount; sample++) {
        const t = sample / sampleCount;
        const inverse = 1 - t;
        path.push({
          x: inverse * inverse * entry.x + 2 * inverse * t * corner.x + t * t * exit.x,
          y: inverse * inverse * entry.y + 2 * inverse * t * corner.y + t * t * exit.y,
          turnSeverity,
        });
      }
    }

    path.push({ ...route[route.length - 1] });
    return path;
  }

  private updateTransportMission(dt: number) {
    if (!this.state.transportMission) return;
    const tm = this.state.transportMission;
    const truck = this.state.ships.find(s => s.id === tm.truckShipId);

    if (!truck || truck.isSunk) {
      tm.isTruckDestroyed = true;
      return;
    }

    const frontHummer = this.state.ships.find(s => s.id === tm.frontHummerShipId);
    const rearHummer = this.state.ships.find(s => s.id === tm.rearHummerShipId);

    // Extend the authored road heading beyond the extraction point. The
    // vanguard follows this invisible continuation and clears the circle/map
    // edge instead of stopping at the semi-truck's extraction position.
    const routeEnd = tm.waypoints[tm.waypoints.length - 1] || tm.destination;
    const routeBeforeEnd = tm.waypoints[tm.waypoints.length - 2] || routeEnd;
    const exitDx = routeEnd.x - routeBeforeEnd.x;
    const exitDy = routeEnd.y - routeBeforeEnd.y;
    const exitLength = Math.hypot(exitDx, exitDy) || 1;
    const exitClearanceDistance = 900;
    const authoredNavigationRoute = [
      ...tm.waypoints,
      {
        x: routeEnd.x + (exitDx / exitLength) * exitClearanceDistance,
        y: routeEnd.y + (exitDy / exitLength) * exitClearanceDistance,
      },
    ];
    // Build the complete articulated-rig path once, before the truck reaches
    // any corner. All three fixed convoy vehicles then follow the same curve.
    const navigationWaypoints = tm.plannedRoute
      || (tm.plannedRoute = this.buildConvoyTurningPath(authoredNavigationRoute, truck));

    // Fixed convoy units use the authored road centerline directly. They never
    // invoke tactical land pathfinding, so they cannot choose branches, circle
    // an island, or wander away from the mission route.
    const nearestPathIndex = (vehicle: ShipEntity): number => {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < navigationWaypoints.length; i++) {
        const distance = Math.hypot(navigationWaypoints[i].x - vehicle.x, navigationWaypoints[i].y - vehicle.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      return Math.min(navigationWaypoints.length - 1, bestIndex + 1);
    };

    const followRoad = (vehicle: ShipEntity, index: number | undefined, speedLevel: number): number => {
      let nextIndex = Math.min(index ?? nearestPathIndex(vehicle), navigationWaypoints.length - 1);
      let waypoint = navigationWaypoints[nextIndex] || tm.destination;
      let distance = Math.hypot(waypoint.x - vehicle.x, waypoint.y - vehicle.y);
      while (distance < 58 && nextIndex < navigationWaypoints.length - 1) {
        nextIndex++;
        waypoint = navigationWaypoints[nextIndex];
        distance = Math.hypot(waypoint.x - vehicle.x, waypoint.y - vehicle.y);
      }

      // Aim a short distance through the sampled curve instead of at the corner
      // itself. This makes steering begin at the entry tangent without cutting
      // across the inside bridge edge.
      const lookAheadDistance = vehicle.isConvoyTruck ? truck.model.hullLength * 0.58 : vehicle.model.hullLength * 0.8;
      let lookAheadIndex = nextIndex;
      let accumulatedLookAhead = distance;
      while (lookAheadIndex < navigationWaypoints.length - 1 && accumulatedLookAhead < lookAheadDistance) {
        const a = navigationWaypoints[lookAheadIndex];
        const b = navigationWaypoints[lookAheadIndex + 1];
        accumulatedLookAhead += Math.hypot(b.x - a.x, b.y - a.y);
        lookAheadIndex++;
      }
      const steeringTarget = navigationWaypoints[lookAheadIndex] || waypoint;
      const desiredHeading = Math.atan2(steeringTarget.y - vehicle.y, steeringTarget.x - vehicle.x);
      const headingError = Math.abs(this.normalizeAngle(desiredHeading - vehicle.angle));
      this.applyAutopilotHeading(vehicle, desiredHeading, dt);
      const upcomingTurnSeverity = navigationWaypoints
        .slice(nextIndex, Math.min(navigationWaypoints.length, lookAheadIndex + 3))
        .reduce((maximum, point) => Math.max(maximum, point.turnSeverity || 0), 0);
      const curveSpeedLevel = upcomingTurnSeverity > 0.78 ? Math.min(1, speedLevel) : speedLevel;
      vehicle.targetSpeedLevel = headingError > 1.05 ? 0 : headingError > 0.58 ? Math.min(1, curveSpeedLevel) : curveSpeedLevel;
      const location = this.landPathfinder.findLandLocation(vehicle.x, vehicle.y);
      vehicle.landRouteBridgeId = location.type === 'bridge' ? location.bridge?.id : undefined;
      return nextIndex;
    };

    // Measure spacing along the road polyline instead of using direct distance.
    // This preserves vehicle order through corners where Euclidean distance can
    // shrink even though the vehicles are correctly separated along the road.
    const routeProgress = (
      vehicle: ShipEntity,
      route: { x: number; y: number }[] = navigationWaypoints
    ): number => {
      let accumulated = 0;
      let bestProgress = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i];
        const b = route[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        const length = Math.sqrt(lengthSq);
        const rawT = lengthSq > 0
          ? ((vehicle.x - a.x) * dx + (vehicle.y - a.y) * dy) / lengthSq
          : 0;
        // The rear guard starts on the authored road extension behind the first
        // in-bounds waypoint, so preserve negative progress on that first leg.
        const t = i === 0 ? Math.min(1, rawT) : Math.max(0, Math.min(1, rawT));
        const projectedX = a.x + dx * t;
        const projectedY = a.y + dy * t;
        const distance = Math.hypot(vehicle.x - projectedX, vehicle.y - projectedY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestProgress = accumulated + length * t;
        }
        accumulated += length;
      }
      return bestProgress;
    };

    const truckProgress = routeProgress(truck);
    const frontLead = frontHummer && !frontHummer.isSunk ? routeProgress(frontHummer) - truckProgress : 205;
    const rearLag = rearHummer && !rearHummer.isSunk ? truckProgress - routeProgress(rearHummer) : 210;

    const previousTruckWaypoint = tm.currentWaypointIndex;
    const truckSpeed = frontHummer && !frontHummer.isSunk && frontLead < 165 ? 0 : 1;
    tm.truckPathIndex = followRoad(truck, tm.truckPathIndex, truckSpeed);

    // Preserve authored checkpoint state for the HUD while the physical convoy
    // follows the denser rounded path between those checkpoints.
    const authoredProgress = routeProgress(truck, tm.waypoints);
    let checkpointDistance = 0;
    let nextCheckpoint = 1;
    for (let i = 1; i < tm.waypoints.length; i++) {
      checkpointDistance += Math.hypot(
        tm.waypoints[i].x - tm.waypoints[i - 1].x,
        tm.waypoints[i].y - tm.waypoints[i - 1].y
      );
      if (authoredProgress >= checkpointDistance - 55) {
        nextCheckpoint = Math.min(tm.waypoints.length - 1, i + 1);
      } else {
        break;
      }
    }
    tm.currentWaypointIndex = nextCheckpoint;
    if (tm.currentWaypointIndex > previousTruckWaypoint) {
      this.addCombatLog(`Convoy transport cleared Checkpoint ${tm.currentWaypointIndex}/${tm.waypoints.length}!`, truck.team);
    }

    if (frontHummer && !frontHummer.isSunk) {
      const frontSpeed = frontLead > 225 ? 0 : frontLead < 185 ? 2 : 1;
      tm.frontPathIndex = followRoad(frontHummer, tm.frontPathIndex, frontSpeed);
    }
    if (rearHummer && !rearHummer.isSunk) {
      // A 195px minimum center gap leaves ample clearance behind the new
      // 190px semi body even while the trailer swings through a turn.
      const rearSpeed = rearLag > 230 ? 2 : rearLag < 195 ? 0 : 1;
      tm.rearPathIndex = followRoad(rearHummer, tm.rearPathIndex, rearSpeed);
    }

    // Fixed convoy weapons remain active without allowing combat AI to seize
    // movement control from the predetermined route.
    for (const escort of [frontHummer, rearHummer]) {
      if (!escort || escort.isSunk) continue;
      const nearest = this.state.ships
        .filter(s => s.team !== escort.team && !s.isSunk)
        .map(s => ({ ship: s, distance: Math.hypot(s.x - escort.x, s.y - escort.y) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest) this.executeNpcGunnery(escort, nearest.ship, nearest.distance, dt);
    }

    // Check distance to destination extraction zone
    const distToDest = Math.hypot(tm.destination.x - truck.x, tm.destination.y - truck.y);
    tm.distanceRemaining = Math.round(distToDest);

    // Calculate progress percentage
    const authoredRouteLength = tm.waypoints.slice(1).reduce((total, waypoint, index) => (
      total + Math.hypot(
        waypoint.x - tm.waypoints[index].x,
        waypoint.y - tm.waypoints[index].y
      )
    ), 0);
    const pct = Math.min(99, Math.round((authoredProgress / Math.max(1, authoredRouteLength)) * 100));
    tm.progressPercent = pct;

    // Extraction is awarded only when the semi-truck itself enters the green
    // destination circle; escort position and waypoint state cannot trigger it.
    if (distToDest <= tm.destination.radius) {
      tm.reachedDestination = true;
      tm.progressPercent = 100;
    }
  }

  private updateAmphibiousMission(dt: number) {
    if (!this.state.amphibiousMission) return;
    const am = this.state.amphibiousMission;
    const carrier = this.state.ships.find(s => s.id === am.carrierShipId);

    if (!carrier || carrier.isSunk) {
      am.isCarrierDestroyed = true;
      am.carrierHp = 0;
      for (const onboardUnit of this.state.ships.filter(ship => ship.isOnboardCarrier && !ship.isSunk)) {
        this.sinkShip(onboardUnit, carrier?.id);
      }
      return;
    }

    am.carrierHp = Math.round(carrier.currentHp);
    am.carrierMaxHp = carrier.maxHp;

    if (!am.isCarrierBeached) {
      const distToLz = Math.hypot(am.landingZone.x - carrier.x, am.landingZone.y - carrier.y);
      const deploymentTriggerDistance = Math.max(42, am.landingZone.radius * 0.55);
      if (distToLz <= deploymentTriggerDistance) {
        am.isCarrierBeached = true;
        am.isDeploying = am.maxDeployUnits > 0;
        carrier.speed = 0;
        carrier.targetSpeedLevel = 0;
        this.addCombatLog(
          am.maxDeployUnits > 0
            ? 'Vehicle ferry reached the deployment shore! Lowering the bow ramp for embarked land vehicles.'
            : 'Vehicle ferry reached the deployment shore with no embarked land vehicles.',
          carrier.team
        );
        sounds.playWaterSplash();
      } else {
        const targetAngle = Math.atan2(am.landingZone.y - carrier.y, am.landingZone.x - carrier.x);
        const angleDiff = this.normalizeAngle(targetAngle - carrier.angle);
        carrier.targetRudderAngle = Math.max(-1, Math.min(1, angleDiff * 2.0));
        carrier.targetSpeedLevel = 1;
      }
    } else if (am.isDeploying && am.deployedUnitsCount < am.maxDeployUnits) {
      am.deployTimer += dt;
      if (am.deployTimer >= 4.5) {
        am.deployTimer = 0;
        const deployingUnit = this.state.ships
          .filter(ship => ship.carrierId === carrier.id && ship.isOnboardCarrier && !ship.isSunk)
          .sort((a, b) => (a.onboardCarrierSlot || 0) - (b.onboardCarrierSlot || 0))[0];
        if (!deployingUnit) {
          am.isDeploying = false;
          return;
        }

        const deploymentNumber = am.deployedUnitsCount;
        const spawnDistance = carrier.model.hullLength * 0.52 + 42;
        const lateralOffset = (deploymentNumber % 2 === 0 ? -1 : 1) * (42 + Math.floor(deploymentNumber / 2) * 24);
        let spawnX = carrier.x + Math.cos(carrier.angle) * spawnDistance - Math.sin(carrier.angle) * lateralOffset;
        let spawnY = carrier.y + Math.sin(carrier.angle) * spawnDistance + Math.cos(carrier.angle) * lateralOffset;
        const landPolygons = [
          ...this.state.islands.map(island => island.points),
          ...(this.state.bridges || []).map(bridge => bridge.points),
        ];
        let clearance = getLandClearance(spawnX, spawnY, landPolygons);
        const requiredClearance = Math.max(deployingUnit.model.hullWidth, 36) * 0.65 + 18;
        if (!clearance.onLand || clearance.distanceToWater < requiredClearance) {
          spawnX = clearance.closestX + clearance.inwardNx * requiredClearance;
          spawnY = clearance.closestY + clearance.inwardNy * requiredClearance;
          // Organic coastlines can have shallow concavities. Recheck the
          // candidate and walk it farther inland until the whole vehicle has
          // usable land clearance rather than merely touching the shoreline.
          for (let attempt = 0; attempt < 6; attempt++) {
            clearance = getLandClearance(spawnX, spawnY, landPolygons);
            if (clearance.onLand && clearance.distanceToWater >= requiredClearance) break;
            spawnX += clearance.inwardNx * 24;
            spawnY += clearance.inwardNy * 24;
          }
        }

        deployingUnit.x = spawnX;
        deployingUnit.y = spawnY;
        deployingUnit.angle = carrier.angle;
        deployingUnit.vx = 0;
        deployingUnit.vy = 0;
        deployingUnit.speed = 0;
        deployingUnit.targetSpeedLevel = deployingUnit.isPlayer ? 0 : 2;
        deployingUnit.rudderAngle = 0;
        deployingUnit.targetRudderAngle = 0;
        deployingUnit.isOnboardCarrier = false;
        deployingUnit.carrierId = undefined;
        deployingUnit.onboardCarrierSlot = undefined;
        if (deployingUnit.towedTrailer) {
          const towDistance = deployingUnit.model.hullLength * 0.48
            + 22
            + deployingUnit.towedTrailer.def.length * 0.48;
          deployingUnit.towedTrailer.x = spawnX - Math.cos(deployingUnit.angle) * towDistance;
          deployingUnit.towedTrailer.y = spawnY - Math.sin(deployingUnit.angle) * towDistance;
          deployingUnit.towedTrailer.angle = deployingUnit.angle;
        }

        am.deployedUnitsCount++;
        if (am.deployedUnitsCount >= am.maxDeployUnits) am.isDeploying = false;
        this.addCombatLog(
          `Beachhead: ${deployingUnit.name} deployed from the vehicle ferry and is advancing inland.`,
          carrier.team
        );
      }
    }
  }

  private applyCommandStationHit(station: CommandStationEntity, projectile: Projectile) {
    // Full damage with zero heavy armor reduction so attacking & destroying HQ is achievable!
    const finalDamage = Math.max(1, Math.round(projectile.damage));

    station.hp = Math.max(0, station.hp - finalDamage);

    if (projectile.sourceShipId === this.state.playerShipId) {
      this.state.stats.damageDealt += finalDamage;
      this.state.stats.shotsHit++;
    }

    const fatal = station.hp <= 0;
    station.isDestroyed = fatal;

    for (let i = 0; i < (fatal ? 24 : 6); i++) {
      this.addParticle({
        x: projectile.x,
        y: projectile.y,
        vx: (Math.random() - 0.5) * (fatal ? 140 : 60),
        vy: (Math.random() - 0.5) * (fatal ? 140 : 60),
        life: fatal ? 0.9 : 0.4,
        maxLife: fatal ? 0.9 : 0.4,
        size: fatal ? 8 : 4,
        color: fatal ? '#ef4444' : '#f59e0b',
        type: fatal ? 'smoke' : 'spark',
      });
    }

    sounds.playHit(fatal);

    if (fatal) {
      this.addCombatLog(`${station.name} was obliterated in a massive catastrophic detonation!`, station.team);
    }
  }

  private applyDefensiveWeaponHit(weapon: DefensiveWeaponEntity, projectile: Projectile) {
    const finalDamage = Math.max(1, Math.round(projectile.damage));

    weapon.hp = Math.max(0, weapon.hp - finalDamage);

    if (projectile.sourceShipId === this.state.playerShipId) {
      this.state.stats.damageDealt += finalDamage;
      this.state.stats.shotsHit++;
    }

    const fatal = weapon.hp <= 0;
    weapon.isDestroyed = fatal;

    for (let i = 0; i < (fatal ? 18 : 5); i++) {
      this.addParticle({
        x: projectile.x,
        y: projectile.y,
        vx: (Math.random() - 0.5) * (fatal ? 120 : 50),
        vy: (Math.random() - 0.5) * (fatal ? 120 : 50),
        life: fatal ? 0.85 : 0.35,
        maxLife: fatal ? 0.85 : 0.35,
        size: fatal ? 6 : 3.5,
        color: fatal ? '#ef4444' : '#f59e0b',
        type: fatal ? 'smoke' : 'spark',
      });
    }

    sounds.playHit(fatal);

    if (fatal) {
      this.addCombatLog(
        `${weapon.name} (${weapon.team === 'player' ? 'Allied' : 'Hostile'}) was destroyed!`,
        weapon.team === 'player' ? 'enemy' : 'player'
      );
    }
  }

  private checkGameOverConditions() {
    if (this.state.gameOver) return;

    const livingPlayers = this.state.ships.filter(s => s.team === 'player' && !s.isSunk && !s.isDocked);
    const livingEnemies = this.state.ships.filter(s => s.team === 'enemy' && !s.isSunk && !s.isDocked);

    // MODE 2: COMMAND STATION
    if (this.state.gameMode === 'command-station' && this.state.commandStations) {
      const playerHQ = this.state.commandStations.find(cs => cs.team === 'player');
      const enemyHQ = this.state.commandStations.find(cs => cs.team === 'enemy');

      if (playerHQ && playerHQ.isDestroyed) {
        this.state.gameOver = true;
        this.state.winner = 'enemy';
        this.state.winReason = 'command_station_destroyed';
        sounds.playDefeat();
        this.addCombatLog('Defeat! Allied Command Station Citadel has fallen!', 'enemy');
        return;
      }

      if (enemyHQ && enemyHQ.isDestroyed) {
        this.state.gameOver = true;
        this.state.winner = 'player';
        this.state.winReason = 'command_station_destroyed';
        sounds.playVictory();
        this.addCombatLog('Victory! Enemy Command Station Citadel completely neutralized!', 'player');
        return;
      }
    }

    // MODE 3: TRANSPORT PROTECTION
    if (this.state.gameMode === 'transport-protection' && this.state.transportMission) {
      const tm = this.state.transportMission;
      const isPlayerDefender = this.state.playerRole === 'defender';

      if (tm.reachedDestination) {
        this.state.gameOver = true;
        this.state.winner = 'player';
        this.state.winReason = 'transport_delivered';
        if (isPlayerDefender) {
          sounds.playVictory();
          this.addCombatLog('Mission Accomplished! VIP Convoy delivered safely to extraction zone!', 'player');
        } else {
          sounds.playDefeat();
          this.addCombatLog('Mission Failed! Hostile transport reached extraction zone and escaped!', 'enemy');
        }
        return;
      }

      if (tm.isTruckDestroyed) {
        this.state.gameOver = true;
        this.state.winner = 'enemy';
        this.state.winReason = 'transport_destroyed';
        if (isPlayerDefender) {
          sounds.playDefeat();
          this.addCombatLog('Convoy Lost! Allied armored transport destroyed in transit!', 'enemy');
        } else {
          sounds.playVictory();
          this.addCombatLog('Target Destroyed! Hostile armored transport neutralized before delivery!', 'player');
        }
        return;
      }
    }

    // MODE 4: AMPHIBIOUS ASSAULT
    if (this.state.gameMode === 'amphibious-assault' && this.state.amphibiousMission) {
      const am = this.state.amphibiousMission;
      const isPlayerAttacker = this.state.playerRole === 'attacker';

      if (am.commandCenter.isDestroyed) {
        this.state.gameOver = true;
        this.state.winner = isPlayerAttacker ? 'player' : 'enemy';
        this.state.winReason = 'assault_successful';
        if (isPlayerAttacker) {
          sounds.playVictory();
          this.addCombatLog('Victory! Coastal Fortress Citadel breached and overrun by landing forces!', 'player');
        } else {
          sounds.playDefeat();
          this.addCombatLog('Defeat! Coastal Fortress Citadel destroyed by hostile assault wave!', 'enemy');
        }
        return;
      }

      const attackerTeam: Team = isPlayerAttacker ? 'player' : 'enemy';
      const livingAttackers = this.state.ships.filter(s => s.team === attackerTeam && !s.isSunk);
      if (am.isCarrierDestroyed && livingAttackers.length === 0) {
        this.state.gameOver = true;
        this.state.winner = isPlayerAttacker ? 'enemy' : 'player';
        this.state.winReason = 'defense_successful';
        if (isPlayerAttacker) {
          sounds.playDefeat();
          this.addCombatLog('Defeat! Amphibious assault repelled! Vehicle ferry lost and landing forces eliminated.', 'enemy');
        } else {
          sounds.playVictory();
          this.addCombatLog('Coastal Fortress Defended! Hostile vehicle ferry and assault forces annihilated!', 'player');
        }
        return;
      }
    }

    // ALL MODES: Elimination fallback
    if (livingPlayers.length === 0) {
      this.state.gameOver = true;
      this.state.winner = 'enemy';
      this.state.winReason = 'annihilation';
      sounds.playDefeat();
      this.addCombatLog('Fleet defeated! All allied warships have been lost.', 'enemy');
    } else if (livingEnemies.length === 0) {
      this.state.gameOver = true;
      this.state.winner = 'player';
      this.state.winReason = 'annihilation';
      sounds.playVictory();
      this.addCombatLog('Victory! Hostile naval force neutralized completely!', 'player');
    }
  }

  private updateShip(ship: ShipEntity, dt: number) {
    if (ship.isSunk) {
      ship.sinkProgress = Math.min(1, ship.sinkProgress + dt * 0.3);
      if (Math.random() < 0.25) {
        this.addParticle({
          x: ship.x + (Math.random() - 0.5) * 30,
          y: ship.y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 15,
          vy: -20 - Math.random() * 20,
          life: 0.8,
          maxLife: 0.8,
          size: 4 + Math.random() * 6,
          color: '#64748b',
          type: 'smoke',
        });
      }
      return;
    }

    // Mode 4 attacking land vehicles are cargo until the carrier reaches the
    // beach. Lock them to deck slots and prevent independent physics/control.
    if (ship.isOnboardCarrier && ship.carrierId) {
      const carrier = this.state.ships.find(candidate => candidate.id === ship.carrierId);
      if (!carrier || carrier.isSunk) {
        this.sinkShip(ship, carrier?.id);
        return;
      }
      const slot = ship.onboardCarrierSlot || 0;
      const column = Math.floor(slot / 2);
      const row = slot % 2 === 0 ? -1 : 1;
      const localX = -carrier.model.hullLength * 0.22 + column * 82;
      const localY = row * carrier.model.hullWidth * 0.22;
      ship.x = carrier.x + Math.cos(carrier.angle) * localX - Math.sin(carrier.angle) * localY;
      ship.y = carrier.y + Math.sin(carrier.angle) * localX + Math.cos(carrier.angle) * localY;
      ship.angle = carrier.angle;
      ship.speed = 0;
      ship.targetSpeedLevel = 0;
      ship.vx = carrier.vx;
      ship.vy = carrier.vy;
      ship.rudderAngle = 0;
      ship.targetRudderAngle = 0;
      if (ship.towedTrailer) {
        const towDistance = ship.model.hullLength * 0.48 + 22 + ship.towedTrailer.def.length * 0.48;
        ship.towedTrailer.x = ship.x - Math.cos(ship.angle) * towDistance;
        ship.towedTrailer.y = ship.y - Math.sin(ship.angle) * towDistance;
        ship.towedTrailer.angle = ship.angle;
      }
      return;
    }

    // Docked aircraft maintenance and position locking (parked aboard mothership)
    if (ship.isDocked) {
      if (ship.mothershipId) {
        const mothership = this.state.ships.find(s => s.id === ship.mothershipId);
        if (mothership && !mothership.isSunk) {
          const helipadOffset = mothership.model.hullLength * -0.38;
          ship.x = mothership.x + Math.cos(mothership.angle) * helipadOffset;
          ship.y = mothership.y + Math.sin(mothership.angle) * helipadOffset;
          ship.angle = mothership.angle;
          ship.speed = 0;
          ship.vx = mothership.vx;
          ship.vy = mothership.vy;
          ship.altitude = 0;
          if (ship.currentHp < ship.maxHp) {
            ship.currentHp = Math.min(ship.maxHp, ship.currentHp + 22 * dt);
            mothership.helicopterHp = ship.currentHp;
          }
          return;
        } else {
          this.sinkShip(ship);
          return;
        }
      }
    }

    // Deck maintenance for landed helicopter aboard mothership
    if (ship.hasHelipad && ship.helicopterState === 'landed') {
      if ((ship.helicopterHp ?? 0) < (ship.helicopterMaxHp ?? 680)) {
        ship.helicopterHp = Math.min(ship.helicopterMaxHp ?? 680, (ship.helicopterHp ?? 0) + 22 * dt);
      }
    }

    // Returning helicopter navigation towards mothership stern helipad
    if (ship.domain === 'air' && ship.mothershipId) {
      const mothership = this.state.ships.find(s => s.id === ship.mothershipId);
      if (mothership && !mothership.isSunk && mothership.helicopterState === 'returning') {
        const helipadOffset = mothership.model.hullLength * -0.38;
        const targetX = mothership.x + Math.cos(mothership.angle) * helipadOffset;
        const targetY = mothership.y + Math.sin(mothership.angle) * helipadOffset;
        const dist = Math.hypot(targetX - ship.x, targetY - ship.y);
        const targetAngle = Math.atan2(targetY - ship.y, targetX - ship.x);
        this.applyAutopilotHeading(ship, targetAngle, dt);

        if (dist > 280) {
          ship.targetSpeedLevel = 2;
        } else if (dist > 75) {
          ship.targetSpeedLevel = 1;
        } else {
          ship.targetSpeedLevel = 0;
        }

        if (dist <= 200) {
          const approachRatio = Math.max(0, dist / 200);
          const targetAlt = approachRatio * 65;
          ship.altitude = (ship.altitude ?? 65) * 0.9 + targetAlt * 0.1;
        }

        if (dist < 32 && (ship.altitude ?? 65) <= 18) {
          mothership.helicopterState = 'landed';
          mothership.helicopterHp = ship.currentHp;
          mothership.helicopterMaxHp = ship.maxHp;
          ship.isDocked = true;
          ship.altitude = 0;
          ship.speed = 0;
          ship.x = targetX;
          ship.y = targetY;
          ship.angle = mothership.angle;
          sounds.playHelicopterAction('land');
          this.addCombatLog(`🚁 Combat helicopter safely landed back on ${mothership.name} deck.`, mothership.team);
          for (let i = 0; i < 14; i++) {
            const pAngle = Math.random() * Math.PI * 2;
            const pSpeed = 20 + Math.random() * 35;
            this.addParticle({
              x: targetX,
              y: targetY,
              vx: Math.cos(pAngle) * pSpeed,
              vy: Math.sin(pAngle) * pSpeed,
              life: 0.5,
              maxLife: 0.5,
              size: 4 + Math.random() * 4,
              color: '#e2e8f0',
              type: 'water',
            });
          }
          this.onStateUpdate?.(this.state);
          return;
        }
      }
    }

    // Aircraft altitude climb after deployment
    if (ship.domain === 'air' && !ship.isDocked && (ship.altitude ?? 0) < 65) {
      ship.altitude = Math.min(65, (ship.altitude ?? 0) + dt * 25);
    }

    // Cooldown timers
    for (const key of Object.keys(ship.cooldowns)) {
      if (ship.cooldowns[key] > 0) {
        ship.cooldowns[key] = Math.max(0, ship.cooldowns[key] - dt);
      }
    }

    // Idle timer and automatic damage control repairs
    ship.idleTimer += dt;
    if (ship.idleTimer > 4.0 && ship.currentHp < ship.maxHp) {
      let repairRate = 4; // base passive crew damage control
      for (const hp of ship.model.hardpoints) {
        const compId = ship.config.equippedComponents[hp.id];
        const comp = compId ? COMPONENT_MAP.get(compId) : null;
        if (comp?.repairRate) {
          repairRate += comp.repairRate;
        }
      }
      ship.currentHp = Math.min(ship.maxHp, ship.currentHp + repairRate * dt);
    }

    // Fire damage over time
    if (ship.fireTimer > 0) {
      ship.fireTimer -= dt;
      ship.currentHp = Math.max(0, ship.currentHp - 8 * dt);
      if (Math.random() < 0.3) {
        this.addParticle({
          x: ship.x + (Math.random() - 0.5) * 20,
          y: ship.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 10,
          vy: -30,
          life: 0.4,
          maxLife: 0.4,
          size: 5,
          color: '#f97316',
          type: 'fire',
        });
      }
      if (ship.currentHp <= 0) {
        this.sinkShip(ship);
        return;
      }
    }

    // Physics: Smooth Rudder Steering Slew Rate
    if (ship.targetRudderAngle !== undefined) {
      // Stately, realistic naval slew rate suppresses any residual high-frequency jitter
      const maxRudderSlew = (ship.domain === 'air' ? 5.0 : 2.4) * dt;
      const rDelta = ship.targetRudderAngle - ship.rudderAngle;
      if (Math.abs(rDelta) <= maxRudderSlew) {
        ship.rudderAngle = ship.targetRudderAngle;
      } else {
        ship.rudderAngle += Math.sign(rDelta) * maxRudderSlew;
      }
    }
    // Clean deadband snap: if target rudder is zero and rudder is close, zero it out completely
    if (ship.targetRudderAngle === 0 && Math.abs(ship.rudderAngle) < 0.02) {
      ship.rudderAngle = 0;
    }
    ship.rudderAngle = Math.max(-1, Math.min(1, ship.rudderAngle));

    const turnRate = ship.stats.turnRate;
    const speedRatio = ship.domain === 'air'
      ? Math.max(0.65, Math.abs(ship.speed) / Math.max(1, ship.stats.speed))
      : Math.max(0.25, Math.abs(ship.speed) / Math.max(1, ship.stats.speed));
    ship.angle += ship.rudderAngle * turnRate * speedRatio * dt;
    ship.angle = this.normalizeAngle(ship.angle);

    // Articulated joint physics for semi-truck (tractor cab + missile trailer)
    if (ship.model.spriteStyle.bodyStyle === 'semi-sam' || ship.model.spriteStyle.bodyStyle === 'convoy-semi') {
      if (ship.articulatedAngle === undefined) {
        ship.articulatedAngle = ship.angle;
      }
      const angleDiff = this.normalizeAngle(ship.angle - ship.articulatedAngle);
      const isConvoySemi = ship.model.spriteStyle.bodyStyle === 'convoy-semi';
      if (isConvoySemi) {
        // Real trailer kinematics: the trailer heading changes only as its axle
        // is pulled through the fifth wheel. It therefore lags the tractor in
        // turns instead of rotating as part of one rigid vehicle body.
        const hitchToTrailerAxle = ship.model.hullLength * 0.62;
        const trailerAngularVelocity = (ship.speed / hitchToTrailerAxle) * Math.sin(angleDiff);
        ship.articulatedAngle += trailerAngularVelocity * dt;
      } else {
        const motionFactor = Math.max(0.4, Math.abs(ship.speed) / Math.max(1, ship.stats.speed * 0.45));
        const followRate = (ship.speed >= 0 ? 4.8 : -3.6) * motionFactor;
        ship.articulatedAngle += angleDiff * Math.min(1.0, Math.abs(followRate) * dt) * Math.sign(followRate);
      }
      ship.articulatedAngle = this.normalizeAngle(ship.articulatedAngle);

      // The purpose-built convoy fifth wheel allows a much broader, natural
      // trailer swing through the route's tight organic curves.
      const currentRel = this.normalizeAngle(ship.articulatedAngle - ship.angle);
      const maxArticulation = isConvoySemi ? 1.30 : 0.84;
      if (Math.abs(currentRel) > maxArticulation) {
        ship.articulatedAngle = this.normalizeAngle(ship.angle + Math.sign(currentRel) * maxArticulation);
      }
    }

    // Physics: Throttle Acceleration
    let targetSpeed = 0;
    if (ship.targetSpeedLevel === 2) targetSpeed = ship.stats.speed;
    else if (ship.targetSpeedLevel === 1) targetSpeed = ship.stats.speed * 0.55;
    else if (ship.targetSpeedLevel === -1) targetSpeed = -ship.stats.speed * 0.35;

    // Strict invariant: All non-helicopter NPC aircraft must ALWAYS move at full speed
    if (ship.domain === 'air' && !ship.isPlayer && !this.isHelicopterAircraft(ship)) {
      ship.targetSpeedLevel = 2;
      targetSpeed = ship.stats.speed;
    }

    // Domain-tailored acceleration & deceleration:
    // Aircraft surge rapidly with jet/turboprop thrust; ships move with stately naval momentum.
    const accel = ship.domain === 'air' ? Math.max(120, ship.stats.speed * 0.45) : (ship.domain === 'water' ? 16 : 35);
    const decel = ship.domain === 'air' ? Math.max(70, ship.stats.speed * 0.30) : (ship.domain === 'water' ? 14 : 25);
    if (ship.speed < targetSpeed) {
      ship.speed = Math.min(targetSpeed, ship.speed + accel * dt);
    } else if (ship.speed > targetSpeed) {
      ship.speed = Math.max(targetSpeed, ship.speed - decel * dt);
    }

    // Forward velocity components
    ship.vx = Math.cos(ship.angle) * ship.speed;
    ship.vy = Math.sin(ship.angle) * ship.speed;

    const nextX = ship.x + ship.vx * dt;
    const nextY = ship.y + ship.vy * dt;

    // Domain-aware terrain restriction:
    // Land vehicles are restricted to land areas only (mainland/islands).
    // Ships are restricted to water areas only (cannot sail onto land).
    // Aircraft fly unimpeded over all terrain at high altitude.
    const hullLength = ship.model.hullLength;
    const hullWidth = ship.model.hullWidth;
    let hitIsland = false;

    if (ship.domain === 'land') {
      const landPolys = [
        ...this.state.islands.map(i => i.points),
        ...(this.state.bridges || []).map(b => b.points),
      ];
      const res = constrainLandVehicleToLand(
        nextX,
        nextY,
        ship.angle,
        hullLength,
        hullWidth,
        landPolys
      );

      if (res.strayedIntoWater) {
        hitIsland = true;
        // Shift vehicle onto safe land gently without shaking or blinking
        ship.x = nextX + res.pushX;
        ship.y = nextY + res.pushY;

        // Slide along shoreline: cancel velocity directed outward into water
        const outwardNx = -res.inwardNx;
        const outwardNy = -res.inwardNy;
        const velDot = ship.vx * outwardNx + ship.vy * outwardNy;
        if (velDot > 0) {
          ship.vx -= velDot * outwardNx * 1.15;
          ship.vy -= velDot * outwardNy * 1.15;
          ship.speed = (ship.vx * Math.cos(ship.angle) + ship.vy * Math.sin(ship.angle));
        }

        ship.lastCollisionNormalX = res.inwardNx;
        ship.lastCollisionNormalY = res.inwardNy;

        if (velDot > 35) {
          sounds.playHit(false);
        }

        // Steer AI smoothly away using rudderAngle without snapping vehicle angle
        if (!ship.isPlayer) {
          const targetInwardAngle = Math.atan2(res.inwardNy, res.inwardNx);
          const angleDiff = this.normalizeAngle(targetInwardAngle - ship.angle);
          ship.targetRudderAngle = this.calculateSmoothSteer(angleDiff);
          // Only trigger reverse if the vehicle has been completely immobilized (speed near 0) for over 2 seconds
          if (ship.targetSpeedLevel > 0) {
            if (Math.abs(ship.speed) < 8) {
              ship.stuckTimer = (ship.stuckTimer || 0) + dt;
              if (ship.stuckTimer >= 2.0 && (!ship.recoveryTimer || ship.recoveryTimer <= 0)) {
                ship.recoveryTimer = 2.0;
                ship.stuckTimer = 0;
                ship.targetSpeedLevel = -1; // Firm reverse gear to back away
                ship.recoverySteer = angleDiff >= 0 ? -1 : 1;
                ship.targetRudderAngle = ship.recoverySteer;
              }
            } else {
              ship.stuckTimer = 0;
            }
          }
        }
      }

      // Physical Solid Obstacle Collision: Command Stations & Defensive Weapons
      // Land vehicles can hit them, but can NEVER drive onto them or pass through them!
      if (this.state.commandStations) {
        for (const station of this.state.commandStations) {
          const effectiveRadius = station.radius + Math.max(hullLength, hullWidth) * 0.45;
          const curX = hitIsland ? ship.x : nextX;
          const curY = hitIsland ? ship.y : nextY;
          const dx = curX - station.x;
          const dy = curY - station.y;
          const dist = Math.hypot(dx, dy);

          if (dist < effectiveRadius && dist > 0.001) {
            hitIsland = true;
            const overlap = effectiveRadius - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Push vehicle strictly outside the solid command station perimeter
            ship.x = curX + nx * overlap;
            ship.y = curY + ny * overlap;

            // Deflect/cancel inward velocity directed into the station
            const velDot = ship.vx * (-nx) + ship.vy * (-ny);
            if (velDot > 0) {
              ship.vx += velDot * nx * 1.25;
              ship.vy += velDot * ny * 1.25;
              ship.speed = ship.vx * Math.cos(ship.angle) + ship.vy * Math.sin(ship.angle);
            }

            ship.lastCollisionNormalX = nx;
            ship.lastCollisionNormalY = ny;

            if (velDot > 25) {
              sounds.playHit(false);
            }

            if (!ship.isPlayer) {
              const pushAngle = Math.atan2(ny, nx);
              const angleDiff = this.normalizeAngle(pushAngle - ship.angle);
              ship.targetRudderAngle = angleDiff >= 0 ? 1 : -1;
              ship.stuckTimer = (ship.stuckTimer || 0) + dt * 2.0;
              if (ship.stuckTimer >= 0.8 && Math.abs(ship.speed) < 10) {
                if (!ship.recoveryTimer || ship.recoveryTimer <= 0) {
                  ship.recoveryTimer = 2.0;
                  ship.stuckTimer = 0;
                  ship.targetSpeedLevel = -1;
                  ship.recoverySteer = angleDiff >= 0 ? -1 : 1;
                  ship.targetRudderAngle = ship.recoverySteer;
                }
              }
            }
          }
        }
      }

      if (this.state.defensiveWeapons) {
        for (const weapon of this.state.defensiveWeapons) {
          if (weapon.isDestroyed) continue;
          const effectiveRadius = weapon.radius + Math.max(hullLength, hullWidth) * 0.4;
          const curX = hitIsland ? ship.x : nextX;
          const curY = hitIsland ? ship.y : nextY;
          const dx = curX - weapon.x;
          const dy = curY - weapon.y;
          const dist = Math.hypot(dx, dy);

          if (dist < effectiveRadius && dist > 0.001) {
            hitIsland = true;
            const overlap = effectiveRadius - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            ship.x = curX + nx * overlap;
            ship.y = curY + ny * overlap;

            const velDot = ship.vx * (-nx) + ship.vy * (-ny);
            if (velDot > 0) {
              ship.vx += velDot * nx * 1.2;
              ship.vy += velDot * ny * 1.2;
              ship.speed = ship.vx * Math.cos(ship.angle) + ship.vy * Math.sin(ship.angle);
            }
          }
        }
      }
    } else if (ship.domain === 'water') {
      for (const island of this.state.islands) {
        const col = checkShipPolygonCollision(
          nextX,
          nextY,
          ship.angle,
          hullLength,
          hullWidth,
          island.points,
          island.canals
        );

        if (col.collided) {
          hitIsland = true;
          // Shift ship position clear of the obstacle back into water
          ship.x = nextX + col.pushX;
          ship.y = nextY + col.pushY;

          // Slide velocity along polygon surface (remove velocity into obstacle)
          const pushDist = Math.hypot(col.pushX, col.pushY);
          if (pushDist > 0.001) {
            const nx = col.pushX / pushDist;
            const ny = col.pushY / pushDist;
            const dot = ship.vx * nx + ship.vy * ny;
            if (dot < 0) {
              ship.vx -= dot * nx * 1.2;
              ship.vy -= dot * ny * 1.2;
            }
            ship.lastCollisionNormalX = nx;
            ship.lastCollisionNormalY = ny;
          }

          ship.speed *= 0.45;
          if (Math.abs(ship.speed) > 20) {
            sounds.playHit(false);
          }

          // Track collision contact for NPC unstuck recovery
          if (!ship.isPlayer) {
            ship.stuckTimer = (ship.stuckTimer || 0) + dt * 2.2;
            const pushDist = Math.hypot(col.pushX, col.pushY);
            const nx = pushDist > 0.001 ? col.pushX / pushDist : -Math.cos(ship.angle);
            const ny = pushDist > 0.001 ? col.pushY / pushDist : -Math.sin(ship.angle);
            const pushAngle = Math.atan2(ny, nx);
            const angleDiff = this.normalizeAngle(pushAngle - ship.angle);

            // Proactively steer rudder outward into open water
            ship.targetRudderAngle = angleDiff >= 0 ? 1 : -1;

            // Trigger reverse unstuck maneuver when vessel is pinned or contact persists
            if ((ship.stuckTimer || 0) >= 0.85 && Math.abs(ship.speed) < 12) {
              if (!ship.recoveryTimer || ship.recoveryTimer <= 0) {
                ship.recoveryTimer = 2.0;
                ship.stuckTimer = 0;
                ship.targetSpeedLevel = -1; // Reverse gear to back off into open water
                ship.recoverySteer = angleDiff >= 0 ? -1 : 1;
                ship.targetRudderAngle = ship.recoverySteer;
              }
            }
          }
          break;
        }
      }
    }

    // Decay stuck counter when moving freely, or increment if stalled
    if (!hitIsland && !ship.isPlayer) {
      if (Math.abs(ship.speed) > 18) {
        ship.stuckTimer = Math.max(0, (ship.stuckTimer || 0) - dt * 2.5);
      } else if (ship.targetSpeedLevel > 0 && Math.abs(ship.speed) < 10) {
        // Trying to move forward but stuck against an obstacle corner
        ship.stuckTimer = (ship.stuckTimer || 0) + dt * 0.7;
      }
    }

    // Boundary bounce & inward deflection logic
    // Prevents ships from scraping along or getting stuck on edge
    if (!hitIsland) {
      const isFixedConvoyVehicle = this.state.gameMode === 'transport-protection'
        && (ship.isConvoyTruck || !!ship.convoyEscortPosition);
      if (isFixedConvoyVehicle) {
        // The authored convoy road intentionally continues beyond the chart.
        // Allow mission vehicles to be clipped naturally as they drive out.
        ship.x = nextX;
        ship.y = nextY;
      } else {
        const padding = 85;
        let bounced = false;

        if (nextX < padding) {
          ship.x = padding;
          ship.vx = Math.abs(ship.vx);
          if (Math.cos(ship.angle) < 0) {
            // If heading into left wall, turn inward towards center
            ship.angle = Math.atan2(Math.sin(ship.angle), 0.5);
            ship.rudderAngle = 0;
          }
          bounced = true;
        } else if (nextX > this.state.arenaWidth - padding) {
          ship.x = this.state.arenaWidth - padding;
          ship.vx = -Math.abs(ship.vx);
          if (Math.cos(ship.angle) > 0) {
            // If heading into right wall, turn inward towards center
            ship.angle = Math.atan2(Math.sin(ship.angle), -0.5);
            ship.rudderAngle = 0;
          }
          bounced = true;
        } else {
          ship.x = nextX;
        }

        if (nextY < padding) {
          ship.y = padding;
          ship.vy = Math.abs(ship.vy);
          if (Math.sin(ship.angle) < 0) {
            // If heading into top wall, turn downward towards center
            ship.angle = Math.atan2(0.5, Math.cos(ship.angle));
            ship.rudderAngle = 0;
          }
          bounced = true;
        } else if (nextY > this.state.arenaHeight - padding) {
          ship.y = this.state.arenaHeight - padding;
          ship.vy = -Math.abs(ship.vy);
          if (Math.sin(ship.angle) > 0) {
            // If heading into bottom wall, turn upward towards center
            ship.angle = Math.atan2(-0.5, Math.cos(ship.angle));
            ship.rudderAngle = 0;
          }
          bounced = true;
        } else {
          ship.y = nextY;
        }

        if (bounced) {
          ship.speed = Math.max(30, Math.abs(ship.speed) * 0.7);
        }
      }
    }

    // Domain-specific motion particles (exhaust jet flame, water wake, or ground dust)
    if (Math.abs(ship.speed) > 15) {
      if (ship.domain === 'air' && Math.random() < 0.45) {
        const sternOffset = -ship.model.hullLength * 0.48;
        this.addParticle({
          x: ship.x + Math.cos(ship.angle) * sternOffset,
          y: ship.y + Math.sin(ship.angle) * sternOffset,
          vx: -ship.vx * 0.2 + (Math.random() - 0.5) * 10,
          vy: -ship.vy * 0.2 + (Math.random() - 0.5) * 10,
          life: 0.35,
          maxLife: 0.35,
          size: 4 + Math.random() * 3,
          color: '#94a3b8',
          type: 'smoke',
        });
      } else if (ship.domain === 'water' && Math.random() < 0.35) {
        const sternOffset = -ship.model.hullLength * 0.45;
        this.addParticle({
          x: ship.x + Math.cos(ship.angle) * sternOffset,
          y: ship.y + Math.sin(ship.angle) * sternOffset,
          vx: -ship.vx * 0.1,
          vy: -ship.vy * 0.1,
          life: 0.65,
          maxLife: 0.65,
          size: 6 + Math.random() * 4,
          color: '#e0f2fe',
          type: 'wake',
        });
      } else if (ship.domain === 'land' && Math.random() < 0.4) {
        const sternOffset = -ship.model.hullLength * 0.45;
        const flankOffset = ship.model.hullWidth * 0.38;
        const leftX = ship.x + Math.cos(ship.angle) * sternOffset - Math.sin(ship.angle) * flankOffset;
        const leftY = ship.y + Math.sin(ship.angle) * sternOffset + Math.cos(ship.angle) * flankOffset;
        const rightX = ship.x + Math.cos(ship.angle) * sternOffset + Math.sin(ship.angle) * flankOffset;
        const rightY = ship.y + Math.sin(ship.angle) * sternOffset - Math.cos(ship.angle) * flankOffset;
        const emitX = Math.random() < 0.5 ? leftX : rightX;
        const emitY = Math.random() < 0.5 ? leftY : rightY;

        this.addParticle({
          x: emitX + (Math.random() - 0.5) * 6,
          y: emitY + (Math.random() - 0.5) * 6,
          vx: -ship.vx * 0.15 + (Math.random() - 0.5) * 12,
          vy: -ship.vy * 0.15 + (Math.random() - 0.5) * 12,
          life: 0.55,
          maxLife: 0.55,
          size: 5 + Math.random() * 6,
          color: this.state.mapConfig.waterColors.surface || '#854d0e',
          type: 'dust',
        });
      }
    }

    // Towed Trailer physics and tactical automation
    if (ship.towedTrailer) {
      const trailer = ship.towedTrailer;
      const hitchDist = ship.model.hullLength * 0.48 + 5;
      const hitchX = ship.x - Math.cos(ship.angle) * hitchDist;
      const hitchY = ship.y - Math.sin(ship.angle) * hitchDist;
      const towBarLength = 22 + trailer.def.length * 0.46;

      const dx = hitchX - trailer.x;
      const dy = hitchY - trailer.y;
      trailer.angle = Math.atan2(dy, dx);
      trailer.x = hitchX - Math.cos(trailer.angle) * towBarLength;
      trailer.y = hitchY - Math.sin(trailer.angle) * towBarLength;

      trailer.cooldown = Math.max(0, trailer.cooldown - dt);

      // Support functions (Nanite repair / Electronic Warfare radar)
      if (trailer.def.category === 'support') {
        if (trailer.def.repairRate) {
          // Field repair towing vehicle and allied armor
          ship.currentHp = Math.min(ship.maxHp, ship.currentHp + trailer.def.repairRate * dt);
          const nearbyAllies = this.state.ships.filter(s => s.team === ship.team && !s.isSunk && s.id !== ship.id);
          for (const ally of nearbyAllies) {
            if (Math.hypot(ally.x - trailer.x, ally.y - trailer.y) < 320) {
              ally.currentHp = Math.min(ally.maxHp, ally.currentHp + (trailer.def.repairRate * 0.6) * dt);
            }
          }
          if (Math.random() < 0.18) {
            this.addParticle({
              x: trailer.x + (Math.random() - 0.5) * 22,
              y: trailer.y + (Math.random() - 0.5) * 22,
              vx: (Math.random() - 0.5) * 16,
              vy: -22 - Math.random() * 18,
              life: 0.45,
              maxLife: 0.45,
              size: 3.5,
              color: '#34d399',
              type: 'spark',
            });
          }
        }

        if (trailer.def.electronicWarfare) {
          // EW Countermeasures: jam and detonate enemy incoming missiles
          for (const p of this.state.projectiles) {
            if (p.team !== ship.team && p.type === 'missile') {
              const d = Math.hypot(p.x - trailer.x, p.y - trailer.y);
              if (d < 240 && Math.random() < 0.3) {
                p.life = p.maxLife; // neutralize missile
                this.addParticle({
                  x: p.x,
                  y: p.y,
                  vx: (Math.random() - 0.5) * 45,
                  vy: (Math.random() - 0.5) * 45,
                  life: 0.35,
                  maxLife: 0.35,
                  size: 6,
                  color: '#818cf8',
                  type: 'spark',
                });
              }
            }
          }
        }
      } else if (trailer.def.damage > 0 && trailer.cooldown <= 0) {
        // Trailer weapon automation: auto-target hostiles within range according to trailer's targetDomain
        const tDomain = trailer.def.targetDomain || (trailer.def.category === 'defense' ? 'both' : 'surface');
        const hostiles = this.state.ships.filter(s => s.team !== ship.team && !s.isSunk);
        let bestTarget: ShipEntity | null = null;
        let minDist = trailer.def.range;

        const player = this.getPlayerShip();
        const trailerDistToPlayer = player ? Math.hypot(trailer.x - player.x, trailer.y - player.y) : 0;

        for (const h of hostiles) {
          if (tDomain === 'surface' && h.domain === 'air') continue;
          if (tDomain === 'air' && h.domain !== 'air') continue;
          const d = Math.hypot(h.x - trailer.x, h.y - trailer.y);
          // Fair engagement guard: If hostile trailer is targeting player, enforce visible combat range (<= 600px)
          if (ship.team === 'enemy' && h.isPlayer && (d > 600 || trailerDistToPlayer > 620)) {
            continue;
          }
          if (d < minDist) {
            minDist = d;
            bestTarget = h;
          }
        }

        if (bestTarget) {
          trailer.cooldown = trailer.def.reloadTime;
          const aimAngle = Math.atan2(bestTarget.y - trailer.y, bestTarget.x - trailer.x);
          const vx = Math.cos(aimAngle) * trailer.def.projectileSpeed;
          const vy = Math.sin(aimAngle) * trailer.def.projectileSpeed;
          const projLife = minDist / trailer.def.projectileSpeed;
          const projDomain = tDomain === 'both' ? (bestTarget.domain === 'air' ? 'air' : 'surface') : tDomain;

          this.state.projectiles.push({
            id: `trailer-proj-${this.nextId++}`,
            x: trailer.x,
            y: trailer.y,
            startX: trailer.x,
            startY: trailer.y,
            targetX: bestTarget.x,
            targetY: bestTarget.y,
            vx,
            vy,
            damage: trailer.def.damage,
            splashRadius: trailer.def.splashRadius || 0,
            type: trailer.def.projectileType as Projectile['type'],
            team: ship.team,
            sourceShipId: ship.id,
            life: 0,
            maxLife: Math.max(0.2, projLife),
            color: trailer.def.accentColor,
            targetDomain: projDomain,
          });

          this.addParticle({
            x: trailer.x,
            y: trailer.y,
            vx: Math.cos(aimAngle) * 35,
            vy: Math.sin(aimAngle) * 35,
            life: 0.25,
            maxLife: 0.25,
            size: 5,
            color: trailer.def.accentColor,
            type: 'spark',
          });

          if (trailer.def.projectileType === 'missile') {
            sounds.playCannonShot('missile');
          } else if (trailer.def.projectileType === 'flak') {
            sounds.playCannonShot('swivel');
          } else {
            sounds.playCannonShot('heavy');
          }
        }
      }
    }
  }

  /**
   * Helper to check if an aircraft is a helicopter.
   * Only helicopters can hover, slow down, or adjust speed in combat.
   * All other aircraft (jets, bombers, drones) must always fly at full speed.
   */
  public isHelicopterAircraft(ship: ShipEntity): boolean {
    if (ship.domain !== 'air') return false;
    const style = ship.model.spriteStyle?.bodyStyle;
    if (style === 'chopper' || style === 'chopper-apache') return true;
    if (ship.model.hullClass === 'HELI') return true;
    const id = (ship.model.id || '').toLowerCase();
    if (id.includes('chopper') || id.includes('heli') || id.includes('apache') || id.includes('hind') || id.includes('huey') || id.includes('blackhawk')) return true;
    const name = (ship.model.name || '').toLowerCase();
    if (name.includes('helicopter') || name.includes('chopper') || name.includes('apache') || name.includes('hind')) return true;
    if (ship.id && ship.id.startsWith('helo-')) return true;
    return false;
  }

  private updateNpcAi(ship: ShipEntity, dt: number) {
    if (ship.isOnboardCarrier) return;
    // Fixed Mode 3 convoy movement and defensive gunnery are driven by
    // updateTransportMission so combat AI cannot pull them off the road.
    if (this.state.gameMode === 'transport-protection' && (ship.isConvoyTruck || ship.convoyEscortPosition)) {
      return;
    }
    ship.aiDecisionTimer = (ship.aiDecisionTimer || 0) - dt;

    // Returning helicopter bypasses standard AI to complete landing
    if (ship.domain === 'air' && ship.mothershipId) {
      const mothership = this.state.ships.find(s => s.id === ship.mothershipId);
      if (mothership && mothership.helicopterState === 'returning') {
        return;
      }
    }

    // Find valid hostile targets based on vehicle domain and weapon capabilities:
    // Land vehicles and ships can ONLY attack aircraft if equipped with an air-targeting weapon.
    const targetTeam = ship.team === 'player' ? 'enemy' : 'player';
    const allHostiles = this.state.ships.filter(s =>
      s.team === targetTeam && !s.isSunk && !s.isDocked && !s.isOnboardCarrier
    );

    // AI Aircraft Operations:
    // AI Carrier auto-launches fighter jets into combat
    if (ship.isCarrier && (ship.carrierFighterJetsRemaining ?? 0) > 0 && !ship.isPlayer && !ship.isSunk) {
      ship.carrierLaunchTimer = (ship.carrierLaunchTimer ?? (7 + Math.random() * 5)) - dt;
      if (ship.carrierLaunchTimer <= 0) {
        ship.carrierLaunchTimer = 12 + Math.random() * 6;
        this.launchCarrierFighterJet(ship.id);
      }
    }

    // AI Helipad ship deploys helicopter into combat or recalls when critically damaged
    if (ship.hasHelipad && !ship.isPlayer && !ship.isSunk) {
      if (ship.helicopterState === 'landed') {
        if (allHostiles.length > 0) {
          const nearestDist = Math.min(...allHostiles.map(h => Math.hypot(h.x - ship.x, h.y - ship.y)));
          if (nearestDist < 1400) {
            this.deployShipHelicopter(ship.id);
          }
        }
      } else if (ship.helicopterState === 'deployed') {
        if (ship.helicopterEntityId) {
          const helo = this.state.ships.find(s => s.id === ship.helicopterEntityId);
          if (helo && !helo.isSunk && helo.currentHp < helo.maxHp * 0.25) {
            this.recallShipHelicopter(ship.id);
          }
        }
      }
    }

    let canEngageAir = false;
    let canEngageSurface = false;
    if (ship.domain === 'air') {
      canEngageAir = true;
      canEngageSurface = true;
    } else {
      for (const hp of ship.model.hardpoints) {
        const compId = ship.config.equippedComponents[hp.id];
        const comp = compId ? COMPONENT_MAP.get(compId) : null;
        if (!comp || comp.damage <= 0) continue;
        if (comp.targetDomain === 'air' || comp.targetDomain === 'both') canEngageAir = true;
        if (comp.targetDomain === 'surface' || comp.targetDomain === 'both') canEngageSurface = true;
      }
    }

    const hostiles = allHostiles.filter(h => {
      if (h.domain === 'air' && !canEngageAir) return false;
      if (h.domain !== 'air' && !canEngageSurface) return false;
      return true;
    });

    // =========================================================================
    // 0. ACTIVE OBSTACLE RECOVERY (UNSTUCK MANEUVER)
    // =========================================================================
    if (ship.recoveryTimer && ship.recoveryTimer > 0) {
      ship.recoveryTimer -= dt;

      if (ship.recoveryTimer > 0.9) {
        // Phase 1: Firm reverse gear to back away from obstacle face or shoreline
        ship.targetSpeedLevel = -1;
        ship.targetRudderAngle = ship.recoverySteer || 1;
      } else {
        // Phase 2: Shift into forward gear and steer decisively away onto open land / water
        ship.targetSpeedLevel = 1;
        ship.targetRudderAngle = -(ship.recoverySteer || 1);
        const normX = ship.lastCollisionNormalX || -Math.cos(ship.angle);
        const normY = ship.lastCollisionNormalY || -Math.sin(ship.angle);
        const safeHeading = Math.atan2(normY, normX);
        this.applyAutopilotHeading(ship, safeHeading, dt);
      }

      if (ship.recoveryTimer <= 0) {
        ship.recoveryTimer = 0;
        ship.stuckTimer = 0;
        const normX = ship.lastCollisionNormalX || -Math.cos(ship.angle);
        const normY = ship.lastCollisionNormalY || -Math.sin(ship.angle);
        ship.aiWaypoint = { x: ship.x + normX * 160, y: ship.y + normY * 160 };
        ship.avoidanceLockTimer = 2.5;
        ship.landBypassWaypoint = undefined;
      }

      // Check for opportunistic combat shots while maneuvering
      if (hostiles.length > 0) {
        let nearestHostile: ShipEntity | null = null;
        let minDistHostile = Infinity;
        for (const h of hostiles) {
          const d = Math.hypot(h.x - ship.x, h.y - ship.y);
          if (d < minDistHostile) {
            minDistHostile = d;
            nearestHostile = h;
          }
        }
        if (nearestHostile && minDistHostile <= 580) {
          this.executeNpcGunnery(ship, nearestHostile, minDistHostile, dt);
        }
      }
      return;
    }

    // 0b. POST-RECOVERY CLEARANCE: Navigate safely clear of hazard along aiWaypoint
    if (ship.avoidanceLockTimer && ship.avoidanceLockTimer > 0) {
      ship.avoidanceLockTimer -= dt;
      if (ship.aiWaypoint) {
        const dWp = Math.hypot(ship.aiWaypoint.x - ship.x, ship.aiWaypoint.y - ship.y);
        if (dWp > 35) {
          const wpAngle = Math.atan2(ship.aiWaypoint.y - ship.y, ship.aiWaypoint.x - ship.x);
          this.applyAutopilotHeading(ship, wpAngle, dt);
          ship.targetSpeedLevel = 1; // Controlled half speed to safely establish clearance

          if (hostiles.length > 0) {
            let nearestHostile: ShipEntity | null = null;
            let minDistHostile = Infinity;
            for (const h of hostiles) {
              const d = Math.hypot(h.x - ship.x, h.y - ship.y);
              if (d < minDistHostile) {
                minDistHostile = d;
                nearestHostile = h;
              }
            }
            if (nearestHostile && minDistHostile <= 580) {
              this.executeNpcGunnery(ship, nearestHostile, minDistHostile, dt);
            }
          }
          return;
        } else {
          ship.avoidanceLockTimer = 0;
        }
      }
    }

    // Temporal progress tracking: detects if vehicle has forward throttle but fails to make progress
    ship.stuckCheckTimer = (ship.stuckCheckTimer || 0) + dt;
    if (ship.stuckCheckTimer >= 0.4) {
      ship.stuckCheckTimer = 0;
      const lastX = ship.prevCheckX ?? ship.x;
      const lastY = ship.prevCheckY ?? ship.y;
      const distProgress = Math.hypot(ship.x - lastX, ship.y - lastY);
      ship.prevCheckX = ship.x;
      ship.prevCheckY = ship.y;

      if (ship.targetSpeedLevel !== 0 && distProgress < 6) {
        ship.stuckTimer = (ship.stuckTimer || 0) + 0.45;
      } else if (distProgress >= 12) {
        ship.stuckTimer = Math.max(0, (ship.stuckTimer || 0) - 0.4);
      }
    }

    const enemyCommandStation = this.state.gameMode === 'command-station'
      || this.state.gameMode === 'amphibious-assault'
      ? this.state.commandStations?.find(cs => cs.team !== ship.team && !cs.isDestroyed)
      : undefined;
    const friendlyCommandStation = this.state.gameMode === 'command-station'
      ? this.state.commandStations?.find(cs => cs.team === ship.team && !cs.isDestroyed)
      : undefined;
    const enemyConvoyTruck = this.state.gameMode === 'transport-protection' && ship.team === 'enemy' && canEngageSurface
      ? this.state.ships.find(s => s.id === this.state.transportMission?.truckShipId && !s.isSunk)
      : undefined;
    const friendlyConvoyTruck = this.state.gameMode === 'transport-protection' && ship.team === 'player'
      ? this.state.ships.find(s => s.id === this.state.transportMission?.truckShipId && !s.isSunk)
      : undefined;

    // Mode 2 roles are tactical tendencies, not permanent assignments. Read
    // the current battle line every update so rear guards become midfield
    // screens, and screens become attackers, as hostile pressure recedes.
    let activeStrategicRole = ship.tacticalRole || 'attacker';
    let homePressureTargets: ShipEntity[] = [];
    let middlePressureTargets: ShipEntity[] = [];
    if (enemyCommandStation && friendlyCommandStation) {
      const axisX = enemyCommandStation.x - friendlyCommandStation.x;
      const axisY = enemyCommandStation.y - friendlyCommandStation.y;
      const axisLengthSq = Math.max(1, axisX * axisX + axisY * axisY);
      const battleLineProgress = (hostile: ShipEntity) =>
        ((hostile.x - friendlyCommandStation.x) * axisX + (hostile.y - friendlyCommandStation.y) * axisY) / axisLengthSq;

      homePressureTargets = allHostiles.filter(hostile =>
        battleLineProgress(hostile) <= 0.34
        || Math.hypot(hostile.x - friendlyCommandStation.x, hostile.y - friendlyCommandStation.y) < 1150
      );
      middlePressureTargets = allHostiles.filter(hostile => {
        const progress = battleLineProgress(hostile);
        return progress > 0.34 && progress <= 0.72;
      });

      const livingFriendlies = this.state.ships.filter(candidate =>
        candidate.team === ship.team && !candidate.isSunk && !candidate.isDocked
      );
      const enemyForceIsDepleted = allHostiles.length <= Math.max(1, Math.floor(livingFriendlies.length * 0.35));
      const ownStationHpRatio = friendlyCommandStation.hp / Math.max(1, friendlyCommandStation.maxHp);

      if (homePressureTargets.length > 0) {
        if (ship.tacticalRole === 'defender'
          || (ship.tacticalRole === 'skirmisher' && homePressureTargets.length > 1)
          || ownStationHpRatio < 0.58) {
          activeStrategicRole = 'defender';
        }
      } else if (middlePressureTargets.length > 0) {
        // With the home approach secure, former guards advance to contest the
        // center instead of remaining parked around an empty defensive area.
        activeStrategicRole = enemyForceIsDepleted
          ? (ship.tacticalRole === 'skirmisher' ? 'skirmisher' : (canEngageSurface ? 'attacker' : 'skirmisher'))
          : (ship.tacticalRole === 'defender' ? 'skirmisher' : (ship.tacticalRole || 'attacker'));
      } else {
        // Once meaningful pressure has collapsed, every surface-capable unit
        // contributes to the siege. Pure AA platforms advance as screens.
        activeStrategicRole = canEngageSurface ? 'attacker' : 'skirmisher';
      }

      ship.aiState = activeStrategicRole === 'defender'
        ? 'defend'
        : activeStrategicRole === 'skirmisher'
          ? 'chase'
          : 'attack';
    }

    if (hostiles.length === 0 && !enemyCommandStation && !enemyConvoyTruck && !friendlyConvoyTruck) {
      // No targets left, return to gentle center cruise
      if (ship.domain === 'land') {
        const myIsland = this.landPathfinder.findLandLocation(ship.x, ship.y).island || this.state.islands[0];
        const toCenter = Math.atan2(myIsland.y - ship.y, myIsland.x - ship.x);
        this.applyAutopilotHeading(ship, toCenter, dt);
        ship.targetSpeedLevel = 1;
        return;
      }
      const centerX = this.state.arenaWidth * 0.5;
      const centerY = this.state.arenaHeight * 0.5;
      const toCenter = Math.atan2(centerY - ship.y, centerX - ship.x);
      this.applyAutopilotHeading(ship, toCenter, dt);
      ship.targetSpeedLevel = 1;
      return;
    }

    // Target selection with tactical scoring (focus fire on vulnerable ships or objective threats)
    let bestScore = -Infinity;
    let target: ShipEntity | null = null;
    let minDist = Infinity;

    for (const h of hostiles) {
      const d = Math.hypot(h.x - ship.x, h.y - ship.y);
      const hpLossRatio = 1 - Math.max(0, h.currentHp / h.maxHp);
      let domainBonus = 0;
      // If NPC has only surface weapons, penalize aircraft
      if (!ship.hasAirWeapons && h.domain === 'air') {
        domainBonus -= 1500;
      }
      // If NPC has only anti-air weapons, penalize surface targets
      if (!ship.hasSurfaceWeapons && h.domain !== 'air') {
        domainBonus -= 1500;
      }
      let stickyBonus = 0;
      if (ship.aiTargetId && h.id === ship.aiTargetId) {
        stickyBonus = 260; // Strong stickiness so ship doesn't oscillate between targets
      }

      // Convoy interception remains the mission priority, but screening units
      // retain enough target latitude to engage escorts around the route.
      let missionBonus = 0;
      if (this.state.transportMission && h.id === this.state.transportMission.truckShipId) {
        missionBonus = ship.tacticalRole === 'attacker' ? 2200 : 850;
      }

      if (enemyCommandStation && friendlyCommandStation) {
        if (activeStrategicRole === 'defender') {
          const threatDistance = Math.hypot(h.x - friendlyCommandStation.x, h.y - friendlyCommandStation.y);
          missionBonus += Math.max(0, 1400 - threatDistance) * 1.25;
        } else if (activeStrategicRole === 'skirmisher') {
          const centerX = (friendlyCommandStation.x + enemyCommandStation.x) * 0.5;
          const centerY = (friendlyCommandStation.y + enemyCommandStation.y) * 0.5;
          const centerDistance = Math.hypot(h.x - centerX, h.y - centerY);
          missionBonus += Math.max(0, 1300 - centerDistance) * 0.55;
        }
      }

      // Base score: closer ships + damaged ships (focus fire) + domain compatibility + target stickiness + mission priority
      const score = -d * 0.8 + (hpLossRatio * 320) + domainBonus + stickyBonus + missionBonus;

      if (score > bestScore) {
        bestScore = score;
        target = h;
        minDist = d;
      }
    }

    const tacticalTarget = target;
    const tacticalTargetDistance = minDist;

    if (enemyCommandStation) {
      const ownHpRatio = friendlyCommandStation
        ? friendlyCommandStation.hp / Math.max(1, friendlyCommandStation.maxHp)
        : 1;
      const stationThreat = friendlyCommandStation
        ? hostiles
          .filter(hostile => homePressureTargets.some(threat => threat.id === hostile.id))
          .map(hostile => ({ hostile, distance: Math.hypot(hostile.x - friendlyCommandStation.x, hostile.y - friendlyCommandStation.y) }))
          .sort((a, b) => Math.hypot(a.hostile.x - ship.x, a.hostile.y - ship.y) - Math.hypot(b.hostile.x - ship.x, b.hostile.y - ship.y))[0]?.hostile
        : undefined;
      const immediateThreat = tacticalTarget && tacticalTargetDistance < (activeStrategicRole === 'attacker' ? 300 : 620)
        ? tacticalTarget
        : undefined;

      if (stationThreat && (activeStrategicRole === 'defender' || ownHpRatio < 0.6)) {
        target = stationThreat;
      } else if (activeStrategicRole === 'defender' && friendlyCommandStation) {
        // Hold a mobile defensive orbit around the home station until a threat
        // enters its approaches.
        target = {
          x: friendlyCommandStation.x,
          y: friendlyCommandStation.y,
          domain: ship.domain,
        } as ShipEntity;
      } else if (activeStrategicRole === 'skirmisher' && !immediateThreat) {
        const midpoint = {
          x: ((friendlyCommandStation?.x ?? ship.x) + enemyCommandStation.x) * 0.5,
          y: ((friendlyCommandStation?.y ?? ship.y) + enemyCommandStation.y) * 0.5,
        };
        if (ship.domain === 'land' && this.state.islands.length > 0) {
          const middleIsland = this.state.islands.reduce((best, island) =>
            Math.hypot(island.x - midpoint.x, island.y - midpoint.y) < Math.hypot(best.x - midpoint.x, best.y - midpoint.y)
              ? island
              : best
          );
          target = { x: middleIsland.x, y: middleIsland.y, domain: 'land' } as ShipEntity;
        } else {
          target = { ...midpoint, domain: ship.domain } as ShipEntity;
        }
      } else if (immediateThreat) {
        target = immediateThreat;
      } else {
        target = {
          x: enemyCommandStation.x,
          y: enemyCommandStation.y,
          domain: 'land',
        } as ShipEntity;
      }

      minDist = Math.hypot(target.x - ship.x, target.y - ship.y);
      ship.aiTargetId = target.id || (target.x === enemyCommandStation.x && target.y === enemyCommandStation.y
        ? enemyCommandStation.id
        : undefined);
      ship.weaponTargetMode = target.id && target.domain === 'air' ? 'air' : 'surface';
    } else if (enemyConvoyTruck) {
      const truckHpRatio = enemyConvoyTruck.currentHp / Math.max(1, enemyConvoyTruck.maxHp);
      const escortInterception = hostiles
        .filter(hostile => hostile.id !== enemyConvoyTruck.id)
        .map(hostile => ({
          hostile,
          shipDistance: Math.hypot(hostile.x - ship.x, hostile.y - ship.y),
          truckDistance: Math.hypot(hostile.x - enemyConvoyTruck.x, hostile.y - enemyConvoyTruck.y),
          threateningAttacker: hostile.aiTargetId === ship.id,
          threateningTruck: hostile.aiTargetId === enemyConvoyTruck.id,
        }))
        .filter(candidate => candidate.shipDistance < 700 && (
          candidate.shipDistance < 400
          || candidate.truckDistance < 680
          || candidate.threateningAttacker
          || candidate.threateningTruck
        ))
        .sort((a, b) => {
          const aThreatBonus = (a.threateningAttacker ? 420 : 0) + (a.threateningTruck ? 220 : 0);
          const bThreatBonus = (b.threateningAttacker ? 420 : 0) + (b.threateningTruck ? 220 : 0);
          return (a.shipDistance + a.truckDistance * 0.3 - aThreatBonus)
            - (b.shipDistance + b.truckDistance * 0.3 - bThreatBonus);
        })[0];
      const shouldEngageEscort = !!escortInterception && truckHpRatio > 0.12 && (
        ship.tacticalRole === 'skirmisher'
        || escortInterception.threateningAttacker
        || escortInterception.threateningTruck
        || escortInterception.shipDistance < 320
        || (escortInterception.truckDistance < 520 && escortInterception.shipDistance < 600)
      );
      target = shouldEngageEscort ? escortInterception.hostile : enemyConvoyTruck;
      minDist = Math.hypot(target.x - ship.x, target.y - ship.y);
      ship.aiTargetId = target.id;
      ship.weaponTargetMode = target.domain === 'air' ? 'air' : 'surface';
    } else if (target) {
      ship.aiTargetId = target.id;
      ship.weaponTargetMode = target.domain === 'air' ? 'air' : 'surface';
    } else if (friendlyConvoyTruck) {
      // Unarmed or domain-specialized escorts still need a navigation objective
      // even when none of the current attackers are valid weapon targets.
      target = friendlyConvoyTruck;
      minDist = Math.hypot(target.x - ship.x, target.y - ship.y);
    } else {
      return;
    }

    // Mode 3 transporting NPCs use a point slightly ahead of the moving semi as
    // their formation anchor. Engagements are protective interceptions rather
    // than duels: escorts break contact when either they or the fight falls behind.
    let movementTarget: Pick<ShipEntity, 'x' | 'y' | 'domain'> = target;
    let convoyCatchUp = false;
    if (friendlyConvoyTruck) {
      const convoyDistance = Math.hypot(friendlyConvoyTruck.x - ship.x, friendlyConvoyTruck.y - ship.y);
      const headingX = Math.cos(friendlyConvoyTruck.angle);
      const headingY = Math.sin(friendlyConvoyTruck.angle);
      const escortProgress = (ship.x - friendlyConvoyTruck.x) * headingX
        + (ship.y - friendlyConvoyTruck.y) * headingY;
      const combatTargetIsHostile = target.team !== ship.team;
      const combatTargetDistance = combatTargetIsHostile
        ? Math.hypot(target.x - ship.x, target.y - ship.y)
        : Infinity;
      const targetDistanceFromConvoy = combatTargetIsHostile
        ? Math.hypot(target.x - friendlyConvoyTruck.x, target.y - friendlyConvoyTruck.y)
        : Infinity;
      const targetProgress = combatTargetIsHostile
        ? (target.x - friendlyConvoyTruck.x) * headingX + (target.y - friendlyConvoyTruck.y) * headingY
        : -Infinity;
      const threatInsideProtectiveEnvelope = targetDistanceFromConvoy < 780 && targetProgress > -240;
      const immediateSelfDefense = target.aiTargetId === ship.id && combatTargetDistance < 280;
      const immediateTacticalReason = combatTargetIsHostile
        && combatTargetDistance < 520
        && (threatInsideProtectiveEnvelope || immediateSelfDefense);
      const hasFallenBehind = escortProgress < -280;
      convoyCatchUp = hasFallenBehind
        || convoyDistance > 1050
        || (convoyDistance > 700 && !immediateTacticalReason);

      if (convoyCatchUp || !immediateTacticalReason) {
        const idSeed = Array.from(ship.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const side = idSeed % 2 === 0 ? 1 : -1;
        const leadDistance = ship.domain === 'air' ? 250 : ship.domain === 'water' ? 190 : 270;
        // Land escorts aim along the road ahead of the semi; a lateral offset
        // can place their formation point in water on narrow causeways.
        const lateralDistance = ship.domain === 'water' ? 520 : ship.domain === 'air' ? 260 : 0;
        movementTarget = {
          x: Math.max(100, Math.min(
            this.state.arenaWidth - 100,
            friendlyConvoyTruck.x + headingX * leadDistance - headingY * side * lateralDistance
          )),
          y: Math.max(100, Math.min(
            this.state.arenaHeight - 100,
            friendlyConvoyTruck.y + headingY * leadDistance + headingX * side * lateralDistance
          )),
          domain: ship.domain,
        };
        if (ship.domain === 'water') {
          // A simple offset from the truck can land on the road island itself,
          // leaving a ship orbiting an unreachable point near its spawn. Sample
          // open water around the moving convoy and pick a reachable flank.
          const flankAngles = [
            side * Math.PI * 0.5,
            -side * Math.PI * 0.5,
            side * Math.PI * 0.7,
            -side * Math.PI * 0.7,
            side * Math.PI * 0.35,
            -side * Math.PI * 0.35,
          ];
          let bestWaterAnchor: { x: number; y: number } | undefined;
          let bestWaterAnchorScore = Infinity;
          for (const radius of [420, 620, 820]) {
            for (let angleIndex = 0; angleIndex < flankAngles.length; angleIndex++) {
              const angle = friendlyConvoyTruck.angle + flankAngles[angleIndex];
              const candidate = {
                x: friendlyConvoyTruck.x + headingX * leadDistance + Math.cos(angle) * radius,
                y: friendlyConvoyTruck.y + headingY * leadDistance + Math.sin(angle) * radius,
              };
              if (candidate.x < 120 || candidate.x > this.state.arenaWidth - 120
                || candidate.y < 120 || candidate.y > this.state.arenaHeight - 120) continue;

              let shorelineClearance = Infinity;
              let insideLand = false;
              for (const island of this.state.islands) {
                const clearance = getPointPolygonDistance(candidate.x, candidate.y, island.points);
                if (clearance.isInside) {
                  insideLand = true;
                  break;
                }
                shorelineClearance = Math.min(shorelineClearance, clearance.distance);
              }
              if (insideLand || shorelineClearance < 130) continue;

              const continuityCost = Math.hypot(candidate.x - ship.x, candidate.y - ship.y);
              const sidePreferenceCost = angleIndex === 0 ? 0 : angleIndex === 1 ? 90 : 180;
              const score = continuityCost + sidePreferenceCost - Math.min(shorelineClearance, 300) * 0.35;
              if (score < bestWaterAnchorScore) {
                bestWaterAnchorScore = score;
                bestWaterAnchor = candidate;
              }
            }
          }
          if (bestWaterAnchor) {
            movementTarget = { ...bestWaterAnchor, domain: 'water' };
          }
        }
        if (ship.domain === 'land' && convoyCatchUp && this.state.transportMission) {
          // When far behind, rejoin through the authored connected road rather
          // than trying to cut across water toward the semi's current island.
          // Once caught up, ordinary land pathfinding is free to use branches.
          const route = this.state.transportMission.waypoints;
          let closestSegment = 0;
          let closestRouteDistance = Infinity;
          for (let i = 0; i < route.length - 1; i++) {
            const routeDistance = distancePointToSegment(
              ship.x,
              ship.y,
              route[i].x,
              route[i].y,
              route[i + 1].x,
              route[i + 1].y
            ).dist;
            if (routeDistance < closestRouteDistance) {
              closestRouteDistance = routeDistance;
              closestSegment = i;
            }
          }
          if (ship.convoyCatchUpWaypointIndex === undefined) {
            ship.convoyCatchUpWaypointIndex = Math.min(route.length - 1, closestSegment + 1);
          }
          let catchUpWaypoint = route[ship.convoyCatchUpWaypointIndex];
          if (catchUpWaypoint
            && Math.hypot(catchUpWaypoint.x - ship.x, catchUpWaypoint.y - ship.y) < 140
            && ship.convoyCatchUpWaypointIndex < route.length - 1) {
            ship.convoyCatchUpWaypointIndex++;
            catchUpWaypoint = route[ship.convoyCatchUpWaypointIndex];
          }
          if (catchUpWaypoint) {
            movementTarget = { ...catchUpWaypoint, domain: 'land' };
          }
        }
        ship.aiState = convoyCatchUp ? 'chase' : 'defend';
      }
    }

    // =========================================================================
    // OBSTACLE STUCK DETECTION & UNSTUCK TRIGGER
    // =========================================================================
    // Only trigger reverse unstuck maneuver if the vessel is genuinely immobilized/pinned
    const isStuckByTimer = (ship.stuckTimer || 0) >= 0.95 && Math.abs(ship.speed) < 10;

    if (isStuckByTimer) {
      ship.recoveryTimer = 2.0;
      ship.stuckTimer = 0;

      const normX = ship.lastCollisionNormalX || -Math.cos(ship.angle);
      const normY = ship.lastCollisionNormalY || -Math.sin(ship.angle);
      const pushAngle = Math.atan2(normY, normX);
      const relAngle = this.normalizeAngle(pushAngle - ship.angle);

      ship.recoverySteer = relAngle >= 0 ? -1 : 1;
      ship.targetSpeedLevel = -1;
      ship.targetRudderAngle = ship.recoverySteer;
      return;
    }

    // =========================================================================
    // 1. TACTICAL DESTINATION & BYPASS ROUTING
    // =========================================================================
    let navTargetX = movementTarget.x;
    let navTargetY = movementTarget.y;

    if (ship.domain === 'water') {
      // Step A: Find closest island coastline and clearance
      let closestCoastDist = Infinity;
      let closestCoastNormX = 0;
      let closestCoastNormY = 0;
      let closestIsland: BattleIsland | null = null;

      for (const island of this.state.islands) {
        const pd = getPointPolygonDistance(ship.x, ship.y, island.points);
        const d = pd.isInside ? -25 : pd.distance;
        if (d < closestCoastDist) {
          closestCoastDist = d;
          closestCoastNormX = pd.normalX;
          closestCoastNormY = pd.normalY;
          closestIsland = island;
        }
      }

      // Step B: Shoreline detection & contour escape
      // When a ship is close to an island coastline (within 140px), its primary directive is to
      // maneuver away from the shore, following the contour toward open water while actively
      // pushing outward into deep water. This completely eliminates coastline scraping.
      if (closestIsland && closestCoastDist < 140) {
        // Coastline tangent vectors (along the shore)
        const tang1X = -closestCoastNormY;
        const tang1Y = closestCoastNormX;
        const tang2X = closestCoastNormY;
        const tang2Y = -closestCoastNormX;

        // Choose the tangent that progresses toward the target
        const toTgtX = movementTarget.x - ship.x;
        const toTgtY = movementTarget.y - ship.y;
        const dot1 = tang1X * toTgtX + tang1Y * toTgtY;
        const dot2 = tang2X * toTgtX + tang2Y * toTgtY;
        const bestTangX = dot1 >= dot2 ? tang1X : tang2X;
        const bestTangY = dot1 >= dot2 ? tang1Y : tang2Y;

        // Blend along-coast progress with a strong outward push away from land into deep water
        const outwardWeight = Math.max(0.7, 1.3 - (closestCoastDist / 140));
        const escDirX = bestTangX * 0.75 + closestCoastNormX * outwardWeight;
        const escDirY = bestTangY * 0.75 + closestCoastNormY * outwardWeight;
        const escLen = Math.hypot(escDirX, escDirY) || 1;
        const escNormX = escDirX / escLen;
        const escNormY = escDirY / escLen;

        const escapeLead = Math.max(180, 260 - closestCoastDist);
        const rawWpX = ship.x + escNormX * escapeLead;
        const rawWpY = ship.y + escNormY * escapeLead;

        // Safe bounds within arena
        const arenaPad = 140;
        const safeWpX = Math.max(arenaPad, Math.min(this.state.arenaWidth - arenaPad, rawWpX));
        const safeWpY = Math.max(arenaPad, Math.min(this.state.arenaHeight - arenaPad, rawWpY));

        navTargetX = safeWpX;
        navTargetY = safeWpY;
        ship.targetSpeedLevel = closestCoastDist < 60 ? 1 : 2;
        ship.aiWaypoint = undefined; // Defer remote waypoint until safely in open water
      } else {
        // Step C: Open water navigation - check for islands obstructing direct path to target
        if (ship.aiWaypoint) {
          const dToWp = Math.hypot(ship.aiWaypoint.x - ship.x, ship.aiWaypoint.y - ship.y);
          if (dToWp < 120) {
            ship.aiWaypoint = undefined;
            ship.aiBypassIslandId = undefined;
            ship.aiBypassSide = undefined;
          } else {
            // Check if direct line-of-sight to target has cleared of all islands
            let blocked = false;
            for (const island of this.state.islands) {
              if (checkSegmentPolygonIntersection(ship.x, ship.y, movementTarget.x, movementTarget.y, island.points)) {
                blocked = true;
                break;
              }
            }
            if (blocked) {
              navTargetX = ship.aiWaypoint.x;
              navTargetY = ship.aiWaypoint.y;
            } else {
              ship.aiWaypoint = undefined;
              ship.aiBypassIslandId = undefined;
              ship.aiBypassSide = undefined;
            }
          }
        }

        if (!ship.aiWaypoint) {
          let blockingIsland: BattleIsland | null = null;
          let minBlockingDist = Infinity;

          for (const island of this.state.islands) {
            const segHit = checkSegmentPolygonIntersection(ship.x, ship.y, movementTarget.x, movementTarget.y, island.points);
            const dShip = Math.hypot(island.x - ship.x, island.y - ship.y);
            if (segHit || isPointInPolygon(movementTarget.x, movementTarget.y, island.points)) {
              if (dShip < minBlockingDist) {
                minBlockingDist = dShip;
                blockingIsland = island;
              }
            }
          }

          if (blockingIsland) {
            const dirX = movementTarget.x - ship.x;
            const dirY = movementTarget.y - ship.y;
            const len = Math.hypot(dirX, dirY) || 1;
            const perpX = -dirY / len;
            const perpY = dirX / len;

            let minDot = Infinity;
            let maxDot = -Infinity;
            let minVertex = blockingIsland.points[0];
            let maxVertex = blockingIsland.points[0];

            for (const pt of blockingIsland.points) {
              const dot = (pt.x - ship.x) * perpX + (pt.y - ship.y) * perpY;
              if (dot < minDot) { minDot = dot; minVertex = pt; }
              if (dot > maxDot) { maxDot = dot; maxVertex = pt; }
            }

            const margin = Math.max(180, ship.model.hullWidth * 4.2);
            let p1x = minVertex.x - perpX * margin;
            let p1y = minVertex.y - perpY * margin;
            let p2x = maxVertex.x + perpX * margin;
            let p2y = maxVertex.y + perpY * margin;

            // Ensure bypass points are positioned in open water clear of the island
            const pd1 = getPointPolygonDistance(p1x, p1y, blockingIsland.points);
            if (pd1.isInside || pd1.distance < 110) {
              const push = 120 - (pd1.isInside ? -20 : pd1.distance);
              p1x += pd1.normalX * push;
              p1y += pd1.normalY * push;
            }
            const pd2 = getPointPolygonDistance(p2x, p2y, blockingIsland.points);
            if (pd2.isInside || pd2.distance < 110) {
              const push = 120 - (pd2.isInside ? -20 : pd2.distance);
              p2x += pd2.normalX * push;
              p2y += pd2.normalY * push;
            }

            const arenaPad = 120;
            p1x = Math.max(arenaPad, Math.min(this.state.arenaWidth - arenaPad, p1x));
            p1y = Math.max(arenaPad, Math.min(this.state.arenaHeight - arenaPad, p1y));
            p2x = Math.max(arenaPad, Math.min(this.state.arenaWidth - arenaPad, p2x));
            p2y = Math.max(arenaPad, Math.min(this.state.arenaHeight - arenaPad, p2y));

            const d1 = Math.hypot(ship.x - p1x, ship.y - p1y) + Math.hypot(movementTarget.x - p1x, movementTarget.y - p1y);
            const d2 = Math.hypot(ship.x - p2x, ship.y - p2y) + Math.hypot(movementTarget.x - p2x, movementTarget.y - p2y);

            const islandId = blockingIsland.id || `${blockingIsland.x}_${blockingIsland.y}`;
            let score1 = d1;
            let score2 = d2;
            if (ship.aiBypassIslandId === islandId) {
              if (ship.aiBypassSide === 'p1') score1 -= 80;
              else if (ship.aiBypassSide === 'p2') score2 -= 80;
            }

            const chosenSide = score1 <= score2 ? 'p1' : 'p2';
            ship.aiBypassIslandId = islandId;
            ship.aiBypassSide = chosenSide;
            const chosenP = chosenSide === 'p1' ? { x: p1x, y: p1y } : { x: p2x, y: p2y };
            ship.aiWaypoint = chosenP;
            navTargetX = chosenP.x;
            navTargetY = chosenP.y;
          }
        }
      }
    } else if (ship.domain === 'land') {
      const plan = this.landPathfinder.planLandMovement(ship, movementTarget as ShipEntity);

      if (plan.needsReverse) {
        // Vehicle is facing a shoreline, corner, or dead-end with no forward clearance:
        // Immediately execute reverse maneuver to back out and swing away into open land!
        ship.recoveryTimer = 2.0;
        ship.stuckTimer = 0;
        ship.targetSpeedLevel = -1;
        ship.recoverySteer = plan.reverseSteer || 1;
        ship.targetRudderAngle = ship.recoverySteer;
        return;
      }

      navTargetX = plan.navTargetX;
      navTargetY = plan.navTargetY;
      ship.targetSpeedLevel = plan.targetSpeedLevel;

      if (plan.onBridge) {
        ship.landRouteBridgeId = plan.bridgeId || 'bridge';
      } else {
        ship.landRouteBridgeId = undefined;
      }

      if (plan.onBridge && plan.bridgeHeading !== undefined) {
        ship.aiWaypoint = { x: navTargetX, y: navTargetY };
      }
    }

    // Tactical escort and screening behavior
    if (activeStrategicRole === 'defender'
      && this.state.gameMode !== 'command-station'
      && this.state.gameMode !== 'transport-protection') {
      const friendlyLead = this.state.ships.find(s => s.team === ship.team && s.id !== ship.id && !s.isSunk);
      if (friendlyLead && Math.hypot(friendlyLead.x - ship.x, friendlyLead.y - ship.y) > 380) {
        navTargetX = (friendlyLead.x + target.x) * 0.5;
        navTargetY = (friendlyLead.y + target.y) * 0.5;
      }
    }

    // =========================================================================
    // 2. TACTICAL COMBAT RANGE & SPEED SELECTION (WITH HYSTERESIS)
    // =========================================================================
    const dx = navTargetX - ship.x;
    const dy = navTargetY - ship.y;
    const directAngle = Math.atan2(dy, dx);
    const hasBroadsides = ship.model.hardpoints.some(hp => hp.allowedArc.startsWith('broadside'));
    const idealRange = hasBroadsides ? 360 : 280;

    // Hysteresis on combat maneuver to prevent border flipping
    if (ship.combatManeuver === 'broadside') {
      if (minDist > idealRange + 150) {
        ship.combatManeuver = 'approach';
        ship.preferredBroadside = undefined;
      }
    } else {
      if (minDist < idealRange + 40) {
        ship.combatManeuver = 'broadside';
      } else {
        ship.combatManeuver = 'approach';
      }
    }

    let goalAngle = directAngle;

    if (ship.domain === 'land') {
      // Land vehicle speed is guided primarily by pathfinder (island size, bridges, corners)
      goalAngle = directAngle;
    } else if (ship.combatManeuver === 'broadside' && hasBroadsides) {
      if (!ship.preferredBroadside) {
        const portAngle = this.normalizeAngle(directAngle + Math.PI / 2);
        const starAngle = this.normalizeAngle(directAngle - Math.PI / 2);
        const diffP = Math.abs(this.normalizeAngle(portAngle - ship.angle));
        const diffS = Math.abs(this.normalizeAngle(starAngle - ship.angle));
        ship.preferredBroadside = diffP <= diffS ? 'port' : 'starboard';
      }
      goalAngle = this.normalizeAngle(directAngle + (ship.preferredBroadside === 'port' ? Math.PI / 2 : -Math.PI / 2));
      ship.targetSpeedLevel = (ship.domain === 'air' && !this.isHelicopterAircraft(ship)) ? 2 : 1; // Non-helicopter aircraft always stay full speed
    } else if (minDist < idealRange - 80) {
      if (!ship.evasionTurnDir) {
        const diff = this.normalizeAngle(directAngle - ship.angle);
        ship.evasionTurnDir = diff >= 0 ? -1 : 1;
      }
      // Steer consistently away from target heading (not vehicle instantaneous angle)
      goalAngle = this.normalizeAngle(directAngle + ship.evasionTurnDir * 1.8);
      ship.targetSpeedLevel = (ship.domain === 'air' && !this.isHelicopterAircraft(ship)) ? 2 : 1;
    } else {
      ship.evasionTurnDir = undefined;
      goalAngle = directAngle;
      ship.targetSpeedLevel = 2; // Full speed on approach
    }

    if (convoyCatchUp) {
      // Catch-up movement takes priority over range-keeping maneuvers so an
      // escort cannot keep circling a fight that the convoy has already left.
      ship.combatManeuver = 'approach';
      ship.preferredBroadside = undefined;
      goalAngle = directAngle;
      ship.targetSpeedLevel = 2;
    }

    // Aircraft / Helicopter Speed Control (Full, Half, Stop / Hover):
    // Only helicopters should be able to slow down or hover. All other NPC aircraft should always move at full speed.
    if (ship.domain === 'air') {
      const isHelicopter = this.isHelicopterAircraft(ship);
      if (isHelicopter) {
        const angleDiffToTarget = Math.abs(this.normalizeAngle(directAngle - ship.angle));
        if (minDist <= 460) {
          if (angleDiffToTarget < 0.35) {
            // Directly on target in attack cone: HOVER / STOP to deliver sustained missile & rocket volleys
            ship.targetSpeedLevel = 0;
          } else {
            // Banking into firing solution: half speed
            ship.targetSpeedLevel = 1;
          }
        } else if (minDist < 620 || angleDiffToTarget > 0.75) {
          // Tactical approach: half speed
          ship.targetSpeedLevel = 1;
        } else {
          // Long-distance flight: full speed
          ship.targetSpeedLevel = 2;
        }
      } else {
        // Strict invariant: All other aircraft (jets, bombers, drones) must ALWAYS fly at full speed
        ship.targetSpeedLevel = 2;
      }
    }

    // Speed reduction during large turns for tighter turning radius and no overshooting
    // Note: Non-helicopter aircraft must NEVER slow down, even during turns
    const headingDiff = Math.abs(this.normalizeAngle(goalAngle - ship.angle));
    if (headingDiff > 0.65 && ship.targetSpeedLevel > 1) {
      if (ship.domain !== 'air' || this.isHelicopterAircraft(ship)) {
        ship.targetSpeedLevel = 1; // Half speed to execute a tighter, controlled turn
      }
    }

    // =========================================================================
    // 3. CONTINUOUS POTENTIAL FIELD: BLEND GOAL WITH PROACTIVE AVOIDANCE
    // =========================================================================
    let steerVx = Math.cos(goalAngle);
    let steerVy = Math.sin(goalAngle);

    // 3a. Arena boundary repulsion
    const boundarySafetyMargin = ship.domain === 'air' ? 480 : 280;
    let boundPushX = 0;
    let boundPushY = 0;
    if (ship.x < boundarySafetyMargin) {
      boundPushX += (boundarySafetyMargin - ship.x) / boundarySafetyMargin;
    } else if (ship.x > this.state.arenaWidth - boundarySafetyMargin) {
      boundPushX -= (ship.x - (this.state.arenaWidth - boundarySafetyMargin)) / boundarySafetyMargin;
    }
    if (ship.y < boundarySafetyMargin) {
      boundPushY += (boundarySafetyMargin - ship.y) / boundarySafetyMargin;
    } else if (ship.y > this.state.arenaHeight - boundarySafetyMargin) {
      boundPushY -= (ship.y - (this.state.arenaHeight - boundarySafetyMargin)) / boundarySafetyMargin;
    }
    if (Math.hypot(boundPushX, boundPushY) > 0.05) {
      steerVx += boundPushX * 2.2;
      steerVy += boundPushY * 2.2;
    }

    // 3b. Continuous shoreline avoidance and corner escape for water ships
    if (ship.domain === 'water') {
      const shorelineRep = this.calculateWaterShorelineRepulsion(ship);
      if (Math.hypot(shorelineRep.repX, shorelineRep.repY) > 0.05) {
        steerVx += shorelineRep.repX;
        steerVy += shorelineRep.repY;
      }
      if (shorelineRep.mustStopOrReverse) {
        // Ship trapped in tight shoreline corner or heading straight into shore:
        // Trigger reverse recovery to back away into open water
        ship.recoveryTimer = 2.2;
        ship.stuckTimer = 0;
        ship.targetSpeedLevel = -1; // Reverse gear
        ship.recoverySteer = shorelineRep.reverseSteer || 1;
        ship.targetRudderAngle = ship.recoverySteer;
        return;
      } else if (shorelineRep.slowDown) {
        ship.targetSpeedLevel = Math.min(ship.targetSpeedLevel, 1); // Half speed
      }
    }

    // 3c. Proactive shoreline and corner avoidance for land vehicles
    if (ship.domain === 'land' && !ship.landRouteBridgeId) {
      const landAvoidance = this.landPathfinder.calculateLandShorelineAvoidance(ship);
      if (Math.hypot(landAvoidance.repX, landAvoidance.repY) > 0.05) {
        steerVx += landAvoidance.repX;
        steerVy += landAvoidance.repY;
      }
      if (landAvoidance.mustStopOrReverse && Math.abs(ship.speed) < 10) {
        ship.recoveryTimer = 2.0;
        ship.stuckTimer = 0;
        ship.targetSpeedLevel = -1; // Reverse gear
        const steerDir = landAvoidance.inwardNx * Math.sin(ship.angle) - landAvoidance.inwardNy * Math.cos(ship.angle) >= 0 ? 1 : -1;
        ship.recoverySteer = steerDir;
        ship.targetRudderAngle = steerDir;
        return;
      } else if (landAvoidance.slowDown) {
        ship.targetSpeedLevel = Math.min(ship.targetSpeedLevel, 1); // Half speed
      }
    }

    // Strict invariant: All non-helicopter aircraft must always move at full speed
    if (ship.domain === 'air' && !this.isHelicopterAircraft(ship)) {
      ship.targetSpeedLevel = 2;
    }

    // =========================================================================
    // 4. APPLY CRITICALLY DAMPED AUTOPILOT
    // =========================================================================
    const finalDesiredAngle = Math.atan2(steerVy, steerVx);
    this.applyAutopilotHeading(ship, finalDesiredAngle, dt);

    // =========================================================================
    // 5. WEAPON FIRING & TARGETING
    // =========================================================================
    if (enemyCommandStation) {
      const maxRange = ship.stats.effectiveRange || 580;
      const immediateThreat = tacticalTarget && tacticalTargetDistance <= Math.min(560, maxRange * 1.1)
        ? tacticalTarget
        : null;
      const nearbyDefense = this.state.defensiveWeapons
        ?.filter(w => w.team !== ship.team && !w.isDestroyed)
        .map(w => ({ weapon: w, distance: Math.hypot(w.x - ship.x, w.y - ship.y) }))
        .filter(candidate => candidate.distance <= Math.min(620, maxRange * 1.1))
        .sort((a, b) => a.distance - b.distance)[0];

      if (immediateThreat) {
        this.executeNpcGunnery(ship, immediateThreat, tacticalTargetDistance, dt);
      } else {
        ship.aiFireTimer = (ship.aiFireTimer || 0) - dt;
        if (ship.aiFireTimer <= 0) {
          const aimTarget = nearbyDefense?.weapon || enemyCommandStation;
          const aimDistance = nearbyDefense?.distance
            || Math.hypot(enemyCommandStation.x - ship.x, enemyCommandStation.y - ship.y);
          if (aimDistance <= maxRange * 1.1) {
            ship.weaponTargetMode = 'surface';
            const didFire = this.fireShipWeapons(ship, aimTarget.x, aimTarget.y);
            ship.aiFireTimer = didFire ? 0.45 + Math.random() * 0.35 : 0.15 + Math.random() * 0.15;
          } else {
            ship.aiFireTimer = 0.25;
          }
        }
      }
    } else if (enemyConvoyTruck) {
      const maxRange = ship.stats.effectiveRange || 580;
      if (target.id !== enemyConvoyTruck.id) {
        this.executeNpcGunnery(ship, target, minDist, dt);
      } else {
        const immediateThreat = tacticalTarget && tacticalTarget.id !== enemyConvoyTruck.id
          && tacticalTargetDistance <= Math.min(360, maxRange * 0.7)
          ? tacticalTarget
          : enemyConvoyTruck;
        const fireDistance = immediateThreat.id === enemyConvoyTruck.id ? minDist : tacticalTargetDistance;
        this.executeNpcGunnery(ship, immediateThreat, fireDistance, dt);
      }
    } else if (target.team !== ship.team) {
      this.executeNpcGunnery(ship, target, minDist, dt);
    }
  }

  /**
   * Calculates continuous, proactive shoreline avoidance force for naval vessels.
   * Employs geometry-anchored potential fields, flank sensors, and bow lookahead
   * to detect tight corners, shoreline traps, and shallow bays.
   */
  private calculateWaterShorelineRepulsion(ship: ShipEntity): {
    repX: number;
    repY: number;
    slowDown: boolean;
    mustStopOrReverse: boolean;
    reverseSteer: number;
  } {
    if (ship.domain !== 'water') {
      return { repX: 0, repY: 0, slowDown: false, mustStopOrReverse: false, reverseSteer: 0 };
    }

    let repX = 0;
    let repY = 0;
    let minClearance = Infinity;
    let minBowClearance = Infinity;

    const halfLen = ship.model.hullLength * 0.5;
    const cosA = Math.cos(ship.angle);
    const sinA = Math.sin(ship.angle);
    const bowX = ship.x + cosA * halfLen;
    const bowY = ship.y + sinA * halfLen;

    // Lookahead distance based on speed
    const lookDist = Math.max(80, Math.min(200, Math.abs(ship.speed) * 2.2 + halfLen + 15));
    const probeX = bowX + cosA * lookDist;
    const probeY = bowY + sinA * lookDist;

    let closestNormalX = -cosA;
    let closestNormalY = -sinA;

    for (const island of this.state.islands) {
      // 1. Hull center distance & outward normal
      const dHull = getPointPolygonDistance(ship.x, ship.y, island.points);
      const hullClearance = dHull.isInside ? -25 : dHull.distance;
      if (hullClearance < minClearance) {
        minClearance = hullClearance;
        closestNormalX = dHull.normalX;
        closestNormalY = dHull.normalY;
      }

      if (hullClearance < 190) {
        const normDist = Math.max(0, hullClearance);
        const t = (190 - normDist) / 190;
        const strength = t * t * 4.2;
        repX += dHull.normalX * strength;
        repY += dHull.normalY * strength;
      }

      // 2. Forward bow lookahead repulsion
      const dFwd = getPointPolygonDistance(probeX, probeY, island.points);
      const fwdClearance = dFwd.isInside ? -20 : dFwd.distance;
      if (fwdClearance < minBowClearance) {
        minBowClearance = fwdClearance;
      }

      if (fwdClearance < 120) {
        const tFwd = (120 - Math.max(0, fwdClearance)) / 120;
        const fwdStrength = tFwd * 3.8;
        repX += dFwd.normalX * fwdStrength;
        repY += dFwd.normalY * fwdStrength;
      }
    }

    // Left and right flank probes to detect narrow coves or tight corners
    const leftCos = Math.cos(ship.angle - 0.6);
    const leftSin = Math.sin(ship.angle - 0.6);
    const rightCos = Math.cos(ship.angle + 0.6);
    const rightSin = Math.sin(ship.angle + 0.6);
    const flankDist = lookDist * 0.7;

    let leftClearance = Infinity;
    let rightClearance = Infinity;

    for (const island of this.state.islands) {
      const dL = getPointPolygonDistance(ship.x + leftCos * flankDist, ship.y + leftSin * flankDist, island.points);
      const dR = getPointPolygonDistance(ship.x + rightCos * flankDist, ship.y + rightSin * flankDist, island.points);
      leftClearance = Math.min(leftClearance, dL.isInside ? -20 : dL.distance);
      rightClearance = Math.min(rightClearance, dR.isInside ? -20 : dR.distance);
    }

    if (leftClearance < 70) {
      repX += rightCos * ((70 - Math.max(0, leftClearance)) / 70) * 2.5;
      repY += rightSin * ((70 - Math.max(0, leftClearance)) / 70) * 2.5;
    }
    if (rightClearance < 70) {
      repX += leftCos * ((70 - Math.max(0, rightClearance)) / 70) * 2.5;
      repY += leftSin * ((70 - Math.max(0, rightClearance)) / 70) * 2.5;
    }

    // Multi-tier speed assessment:
    const slowDown = minClearance < 90 || minBowClearance < 85;

    const isHeadingIntoShore = (cosA * (-closestNormalX) + sinA * (-closestNormalY)) > 0.1;
    const isTrappedInCorner = (minBowClearance < 40 || (leftClearance < 40 && rightClearance < 40)) && isHeadingIntoShore;
    const mustStopOrReverse = (minClearance < 38 && isHeadingIntoShore) || isTrappedInCorner || minBowClearance < 25;

    const reverseSteer = leftClearance > rightClearance ? 1 : -1;

    return { repX, repY, slowDown, mustStopOrReverse, reverseSteer };
  }

  private executeNpcGunnery(ship: ShipEntity, target: ShipEntity, minDist: number, dt: number) {
    // Set weapon targeting mode according to target domain
    ship.weaponTargetMode = target.domain === 'air' ? 'air' : 'surface';

    ship.aiFireTimer = (ship.aiFireTimer || 0) - dt;
    if (ship.aiFireTimer > 0) return;

    // Check weapon effective range
    const maxRange = ship.stats.effectiveRange || 580;
    if (minDist > maxRange * 1.1) {
      ship.aiFireTimer = 0.25;
      return;
    }

    const projSpeed = 500;
    const travelTime = Math.min(1.2, minDist / projSpeed);

    // Balanced accuracy and predictive lead for both allied and enemy NPCs
    const leadFactor = 0.65;
    const jitter = 16;
    const aimX = target.x + target.vx * travelTime * leadFactor + (Math.random() - 0.5) * jitter;
    const aimY = target.y + target.vy * travelTime * leadFactor + (Math.random() - 0.5) * jitter;

    const didFire = this.fireShipWeapons(ship, aimX, aimY);
    if (didFire) {
      ship.aiFireTimer = 0.45 + Math.random() * 0.35;
    } else {
      // Rapid retry if waiting for turret turn or arc alignment
      ship.aiFireTimer = 0.15 + Math.random() * 0.15;
    }
  }

  public fireShipWeapons(ship: ShipEntity, targetX: number, targetY: number): boolean {
    if (ship.isSunk) return false;
    if (isNaN(targetX) || isNaN(targetY)) return false;

    let firedAny = false;

    // Determine target category based on active targeting mode
    const targetMode = ship.weaponTargetMode || 'surface';
    const targetTeam = ship.team === 'player' ? 'enemy' : 'player';
    const hostiles = this.state.ships.filter(s => s.team === targetTeam && !s.isSunk && !s.isOnboardCarrier);
    
    // First find nearest hostile matching the current weapon target mode
    const domainHostiles = hostiles.filter(h => targetMode === 'air' ? h.domain === 'air' : h.domain !== 'air');
    let nearestHostile: ShipEntity | null = null;
    let minD = Infinity;

    for (const h of domainHostiles) {
      const d = Math.hypot(h.x - targetX, h.y - targetY);
      if (d < minD && d < 260) {
        minD = d;
        nearestHostile = h;
      }
    }

    // If no mode-matching hostile found in close range, check other hostiles to prevent targeting mismatches
    if (!nearestHostile) {
      for (const h of hostiles) {
        const d = Math.hypot(h.x - targetX, h.y - targetY);
        if (d < minD && d < 220) {
          minD = d;
          nearestHostile = h;
        }
      }
    }

    for (const hardpoint of ship.model.hardpoints) {
      const compId = ship.config.equippedComponents[hardpoint.id];
      if (!compId) continue;

      const comp = COMPONENT_MAP.get(compId);
      if (!comp || comp.damage <= 0 || comp.reloadTime <= 0) continue;

      // Strict Weapon Targeting Rules:
      // 1. Air-targeted-only weapons should only fire when Air Targeting is selected, and only target aircraft
      // 2. Surface-targeted-only weapons should only fire when Surface Targeting is selected, and only target surface targets
      // 3. Weapons supporting both only target aircraft in Air Targeting mode, and only target surface in Surface Targeting mode
      const wDomain = comp.targetDomain || 'surface';

      if (wDomain === 'air') {
        if (targetMode !== 'air') continue;
        if (nearestHostile && nearestHostile.domain !== 'air') continue;
      } else if (wDomain === 'surface') {
        if (targetMode !== 'surface') continue;
        if (nearestHostile && nearestHostile.domain === 'air') continue;
      } else if (wDomain === 'both') {
        if (targetMode === 'air' && nearestHostile && nearestHostile.domain !== 'air') continue;
        if (targetMode === 'surface' && nearestHostile && nearestHostile.domain === 'air') continue;
      }

      const remainingCd = ship.cooldowns[hardpoint.id] || 0;
      if (remainingCd > 0) continue;

      const localForward = hardpoint.x * (ship.model.hullLength * 0.5);
      const localSide = hardpoint.y * (ship.model.hullWidth * 0.5);

      const cos = Math.cos(ship.angle);
      const sin = Math.sin(ship.angle);
      const hpWorldX = ship.x + localForward * cos - localSide * sin;
      const hpWorldY = ship.y + localForward * sin + localSide * cos;

      const rawDist = Math.hypot(targetX - hpWorldX, targetY - hpWorldY);
      if (rawDist < 1) continue;

      const angleToTarget = Math.atan2(targetY - hpWorldY, targetX - hpWorldX);
      const relAngle = this.normalizeAngle(angleToTarget - ship.angle);

      let inArc = false;
      if (ship.isPlayer) {
        // Generous, responsive player firing arcs so turrets and weapon mounts can track and fire freely
        if (hardpoint.allowedArc === 'all') {
          inArc = true;
        } else if (hardpoint.allowedArc === 'bow') {
          inArc = Math.abs(relAngle) <= Math.PI * 0.88; // 316-degree forward sweep
        } else if (hardpoint.allowedArc === 'stern') {
          inArc = Math.abs(relAngle) >= Math.PI * 0.12; // wide rear hemisphere
        } else if (hardpoint.allowedArc === 'broadside-left') {
          inArc = relAngle < 0.15; // port hemisphere + forward overlap
        } else if (hardpoint.allowedArc === 'broadside-right') {
          inArc = relAngle > -0.15; // starboard hemisphere + forward overlap
        } else {
          inArc = true;
        }
      } else {
        if (hardpoint.allowedArc === 'all') {
          inArc = true;
        } else if (hardpoint.allowedArc === 'bow') {
          inArc = Math.abs(relAngle) <= Math.PI * 0.80;
        } else if (hardpoint.allowedArc === 'stern') {
          inArc = Math.abs(relAngle) >= Math.PI * 0.20;
        } else if (hardpoint.allowedArc === 'broadside-left') {
          inArc = relAngle < 0.10 && relAngle > -Math.PI * 0.95;
        } else if (hardpoint.allowedArc === 'broadside-right') {
          inArc = relAngle > -0.10 && relAngle < Math.PI * 0.95;
        } else {
          inArc = true;
        }
      }

      if (!inArc) continue;

      // NPCs don't waste shots beyond effective weapon range
      if (!ship.isPlayer && rawDist > comp.range * 1.15) {
        continue;
      }

      // Trajectory calculation: projectiles fire outward toward the target up to maximum weapon range.
      const isArcedMortar = comp.projectileType === 'mortar';
      const flightDist = isArcedMortar ? Math.max(160, Math.min(rawDist, comp.range)) : comp.range;
      const endTargetX = hpWorldX + Math.cos(angleToTarget) * flightDist;
      const endTargetY = hpWorldY + Math.sin(angleToTarget) * flightDist;

      // Weapon fired! Reset cooldown
      ship.cooldowns[hardpoint.id] = comp.reloadTime;
      firedAny = true;

      const count = comp.projectilesPerShot || 1;
      const projTargetDomain = wDomain === 'both' ? targetMode : wDomain;

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * (comp.spreadAngle || 0.05);
        const fireAngle = angleToTarget + spread;
        const vx = Math.cos(fireAngle) * comp.projectileSpeed;
        const vy = Math.sin(fireAngle) * comp.projectileSpeed;

        const projLife = flightDist / comp.projectileSpeed;
        // Projectiles spawn directly from the hardpoint turret with minimal muzzle offset
        const muzzleOffset = 10;
        const spawnX = hpWorldX + Math.cos(fireAngle) * muzzleOffset;
        const spawnY = hpWorldY + Math.sin(fireAngle) * muzzleOffset;

        this.state.projectiles.push({
          id: `proj-${this.nextId++}`,
          x: spawnX,
          y: spawnY,
          startX: spawnX,
          startY: spawnY,
          targetX: endTargetX,
          targetY: endTargetY,
          vx,
          vy,
          damage: comp.damage,
          splashRadius: comp.splashRadius || 0,
          type: comp.projectileType as Projectile['type'],
          team: ship.team,
          sourceShipId: ship.id,
          life: 0,
          maxLife: Math.max(0.4, projLife),
          color: comp.color,
          targetDomain: projTargetDomain,
          altitude: ship.domain === 'air' ? 65 : (projTargetDomain === 'air' ? 50 : 0),
        });

        if (ship.isPlayer) {
          this.state.stats.shotsFired++;
        }
      }

      // Muzzle flash particle effect right at the weapon hardpoint
      const muzzleX = hpWorldX + Math.cos(angleToTarget) * 12;
      const muzzleY = hpWorldY + Math.sin(angleToTarget) * 12;
      this.addParticle({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angleToTarget) * 40 + (Math.random() - 0.5) * 15,
        vy: Math.sin(angleToTarget) * 40 + (Math.random() - 0.5) * 15,
        life: 0.25,
        maxLife: 0.25,
        size: 6 + Math.random() * 4,
        color: comp.projectileType === 'railgun' ? '#93c5fd' : '#fdba74',
        type: 'spark',
      });

      // Sound dispatch
      if (comp.projectileType === 'railgun') sounds.playCannonShot('railgun');
      else if (comp.projectileType === 'missile') sounds.playCannonShot('missile');
      else if (comp.projectileType === 'swivel' || comp.projectileType === 'flak') sounds.playCannonShot('swivel');
      else if (comp.projectileType === 'torpedo') sounds.playCannonShot('torpedo');
      else sounds.playCannonShot('heavy');
    }

    return firedAny;
  }

  private updateProjectiles(dt: number) {
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const p = this.state.projectiles[i];
      p.life += dt;

      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Missile rocket exhaust trail
      if (p.type === 'missile' && Math.random() < 0.7) {
        this.addParticle({
          x: p.x - p.vx * 0.02,
          y: p.y - p.vy * 0.02,
          vx: -p.vx * 0.1 + (Math.random() - 0.5) * 20,
          vy: -p.vy * 0.1 + (Math.random() - 0.5) * 20,
          life: 0.35,
          maxLife: 0.35,
          size: 4 + Math.random() * 4,
          color: '#f97316',
          type: 'smoke',
        });
      }

      // Railgun plasma discharge trail
      if (p.type === 'railgun') {
        this.addParticle({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 25,
          vy: (Math.random() - 0.5) * 25,
          life: 0.25,
          maxLife: 0.25,
          size: 3,
          color: '#60a5fa',
          type: 'plasma',
        });
      }

      // Torpedo water wake
      if (p.type === 'torpedo' && Math.random() < 0.6) {
        this.addParticle({
          x: p.x,
          y: p.y,
          vx: -p.vx * 0.1,
          vy: -p.vy * 0.1,
          life: 0.45,
          maxLife: 0.45,
          size: 3,
          color: '#ffffff',
          type: 'wake',
        });
      }

      // Check collision with ships
      let collided = false;
      for (const ship of this.state.ships) {
        if (ship.team === p.team || ship.isSunk || ship.isOnboardCarrier) continue;

        // Strict Target Domain Restrictions:
        // 1. Air-targeted-only projectiles can ONLY hit aircraft
        if (p.targetDomain === 'air' && ship.domain !== 'air') {
          continue;
        }

        // 2. Surface-targeted-only projectiles can ONLY hit surface targets (water or land)
        if (p.targetDomain === 'surface' && ship.domain === 'air') {
          continue;
        }

        // Torpedoes are strictly water weapons and cannot hit aircraft or land vehicles
        if (p.type === 'torpedo' && ship.domain !== 'water') {
          continue;
        }

        // Mortar / slow low-angle ground artillery cannot hit high-speed high-altitude aircraft
        if (p.type === 'mortar' && ship.domain === 'air') {
          continue;
        }

        // Swept line-segment collision from previous frame position to current frame position
        const seg = distancePointToSegment(ship.x, ship.y, prevX, prevY, p.x, p.y);
        const dist = Math.min(seg.dist, Math.hypot(ship.x - p.x, ship.y - p.y));

        // Generous physical hit radius based on vehicle dimensions
        const hitRadius = Math.max(30, Math.max(ship.model.hullLength, ship.model.hullWidth) * 0.48);

        if (dist <= hitRadius || (p.splashRadius > 0 && p.life >= p.maxLife && dist <= p.splashRadius + hitRadius)) {
          collided = true;
          this.applyHit(ship, p);
          break;
        }

        // Check collision against attached trailer (trailers are surface land targets)
        if (ship.towedTrailer && ship.domain === 'land' && p.targetDomain !== 'air') {
          const tr = ship.towedTrailer;
          const trSeg = distancePointToSegment(tr.x, tr.y, prevX, prevY, p.x, p.y);
          const trDist = Math.min(trSeg.dist, Math.hypot(tr.x - p.x, tr.y - p.y));
          const trRadius = Math.max(22, tr.def.length * 0.48);
          if (trDist <= trRadius || (p.splashRadius > 0 && p.life >= p.maxLife && trDist <= p.splashRadius + trRadius)) {
            collided = true;
            tr.currentHp = Math.max(0, tr.currentHp - p.damage);
            this.addParticle({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60,
              life: 0.35,
              maxLife: 0.35,
              size: 5,
              color: '#f59e0b',
              type: 'spark',
            });
            sounds.playHit(false);
            if (tr.currentHp <= 0) {
              this.state.combatLog.unshift({
                id: `log-${this.nextId++}`,
                text: `${ship.name}'s towed trailer was destroyed in combat!`,
                time: this.state.time,
                team: ship.team,
              });
              ship.towedTrailer = undefined;
            }
            break;
          }
        }
      }

      // Check collision with Command Stations (Mode 2: Command Station Warfare & Mode 4: Amphibious Redoubt HQ)
      if (!collided && this.state.commandStations && p.targetDomain !== 'air') {
        for (const station of this.state.commandStations) {
          if (station.isDestroyed || station.team === p.team) continue;
          const seg = distancePointToSegment(station.x, station.y, prevX, prevY, p.x, p.y);
          const dist = Math.min(seg.dist, Math.hypot(station.x - p.x, station.y - p.y));
          if (dist <= station.radius || (p.splashRadius > 0 && p.life >= p.maxLife && dist <= p.splashRadius + station.radius)) {
            collided = true;
            this.applyCommandStationHit(station, p);
            break;
          }
        }
      }

      // Check collision with Standalone Defensive Weapons (Mode 2: Defense Batteries & Bunkers)
      if (!collided && this.state.defensiveWeapons && p.targetDomain !== 'air') {
        for (const weapon of this.state.defensiveWeapons) {
          if (weapon.isDestroyed || weapon.team === p.team) continue;
          const seg = distancePointToSegment(weapon.x, weapon.y, prevX, prevY, p.x, p.y);
          const dist = Math.min(seg.dist, Math.hypot(weapon.x - p.x, weapon.y - p.y));
          if (dist <= weapon.radius || (p.splashRadius > 0 && p.life >= p.maxLife && dist <= p.splashRadius + weapon.radius)) {
            collided = true;
            this.applyDefensiveWeaponHit(weapon, p);
            break;
          }
        }
      }

      // Check collision with islands:
      // Aerial, ballistic, and missile projectiles fly through the air above ground and water.
      // Underwater torpedoes cannot navigate across dry land; they detonate upon hitting an island shoreline.
      if (!collided && p.type === 'torpedo') {
        for (const island of this.state.islands) {
          if (isPointInPolygon(p.x, p.y, island.points)) {
            collided = true;
            this.addParticle({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 35,
              vy: (Math.random() - 0.5) * 35,
              life: 0.5,
              maxLife: 0.5,
              size: 6,
              color: '#64748b',
              type: 'spark',
            });
            sounds.playWaterSplash();
            break;
          }
        }
      }

      // Expired without hit or exploded
      if (p.life >= p.maxLife || collided) {
        if (!collided) {
          this.state.ripples.push({
            x: p.x,
            y: p.y,
            radius: 4,
            maxRadius: 30,
            alpha: 0.8,
          });
          sounds.playWaterSplash();
        }
        this.state.projectiles.splice(i, 1);
      }
    }
  }

  private applyHit(ship: ShipEntity, projectile: Projectile) {
    const reduction = Math.min(0.65, ship.stats.armorRating / 100);
    const finalDamage = Math.round(projectile.damage * (1 - reduction));

    ship.currentHp = Math.max(0, ship.currentHp - finalDamage);
    ship.idleTimer = 0; // reset repair countdown

    if (projectile.sourceShipId === this.state.playerShipId) {
      this.state.stats.damageDealt += finalDamage;
      this.state.stats.shotsHit++;
    }

    const fatal = ship.currentHp <= 0;
    sounds.playHit(fatal);

    const debrisCount = fatal ? 18 : 8;
    for (let i = 0; i < debrisCount; i++) {
      this.addParticle({
        x: projectile.x,
        y: projectile.y,
        vx: (Math.random() - 0.5) * 140,
        vy: (Math.random() - 0.5) * 140,
        life: 0.6,
        maxLife: 0.6,
        size: 3 + Math.random() * 5,
        color: Math.random() < 0.6 ? '#475569' : '#f97316',
        type: 'spark',
      });
    }

    this.state.ripples.push({
      x: projectile.x,
      y: projectile.y,
      radius: 6,
      maxRadius: 45,
      alpha: 0.9,
    });

    if (fatal) {
      this.sinkShip(ship, projectile.sourceShipId);
    }
  }

  private sinkShip(ship: ShipEntity, killerId?: string) {
    if (ship.isSunk) return;
    ship.isSunk = true;
    ship.speed = 0;
    ship.targetSpeedLevel = 0;

    // Aircraft / Mothership state synchronization
    if (ship.mothershipId) {
      const mothership = this.state.ships.find(s => s.id === ship.mothershipId);
      if (mothership && mothership.helicopterEntityId === ship.id) {
        mothership.helicopterState = 'destroyed';
        mothership.helicopterHp = 0;
      }
    }

    if (ship.hasHelipad) {
      if (ship.helicopterState === 'landed') {
        ship.helicopterState = 'destroyed';
        ship.helicopterHp = 0;
        if (ship.helicopterEntityId) {
          const helo = this.state.ships.find(s => s.id === ship.helicopterEntityId);
          if (helo) helo.isSunk = true;
        }
      }
    }

    const killer = this.state.ships.find(s => s.id === killerId);
    const killerName = killer ? killer.name : 'Concentrated Fire';

    if (killer?.isPlayer) {
      this.state.stats.shipsSunk++;
    }

    this.addCombatLog(
      `${ship.name} (${ship.team === 'player' ? 'Allied' : 'Hostile'}) was destroyed by ${killerName}!`,
      ship.team === 'player' ? 'enemy' : 'player'
    );

    this.state.ripples.push({
      x: ship.x,
      y: ship.y,
      radius: 15,
      maxRadius: 90,
      alpha: 1.0,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const part = this.state.particles[i];
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;

      if (part.life <= 0) {
        this.state.particles.splice(i, 1);
      }
    }

    for (let i = this.state.ripples.length - 1; i >= 0; i--) {
      const r = this.state.ripples[i];
      r.radius += 25 * dt;
      r.alpha -= 0.6 * dt;

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.state.ripples.splice(i, 1);
      }
    }
  }

  public addParticle(particle: Particle) {
    if (this.state.particles.length > 250) {
      this.state.particles.shift();
    }
    this.state.particles.push(particle);
  }

  public addCombatLog(text: string, team: Team) {
    this.state.combatLog.unshift({
      id: `log-${this.nextId++}`,
      text,
      time: Math.round(this.state.time),
      team,
    });
    if (this.state.combatLog.length > 15) {
      this.state.combatLog.pop();
    }
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}
