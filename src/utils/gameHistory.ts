import {
  BattleSettings,
  CustomShipConfig,
  GameHistorySummary,
  GameRecord,
  VehicleDomain,
} from '../types/ship';
import { BattleState } from '../game/battleEngine';
import { SHIP_MODEL_MAP } from '../data/shipModels';
import { COMPONENT_MAP } from '../data/components';
import { TRAILER_MAP } from '../data/trailers';
import { BATTLE_MAP_MAP } from '../data/battleMaps';

const STORAGE_KEY_GAME_HISTORY = 'naval_architect_game_history';

/**
 * Default sample game history records so that the interface immediately
 * shows realistic combat operations and tactical breakdowns upon first opening.
 */
export const DEFAULT_SAMPLE_HISTORY: GameRecord[] = [
  {
    id: 'rec-sample-001',
    timestamp: Date.now() - 1000 * 60 * 24, // 24 mins ago
    result: 'victory',
    winReason: 'Hostile force eliminated (Full Annihilation)',
    durationSeconds: 114,
    vehicle: {
      name: 'Apex Sovereign',
      baseModelId: 'land-tank-m1a2',
      modelName: 'M1A2 Abrams Heavy MBT',
      hullClass: 'MBT',
      domain: 'land',
      primaryColor: '#334155',
      accentColor: '#38bdf8',
      bodyStyle: 'tank-mbt',
      equippedComponentNames: [
        '120mm Smoothbore Tank Cannon',
        'Heavy Reactive Armor Plating',
        'TOW-2B Anti-Tank Missile Launcher',
        'M2HB .50 Caliber Cupola Machine Gun',
        'Turbine Multi-Fuel 1500HP Engine',
      ],
      finalHp: 1840,
      maxHp: 2400,
      survived: true,
    },
    map: {
      id: 'strait-archipelago',
      name: 'Strait Archipelago',
      theme: 'Archipelago Channel',
      description: 'Expansive archipelago with narrow navigable straits, connected islands, and causeway bridges.',
      islandCount: 8,
      bridgeCount: 4,
    },
    settings: {
      gameMode: 'fleet-battle',
      shipsPerTeam: 3,
      alliedCount: 3,
      enemyCount: 3,
    },
    performance: {
      damageDealt: 3420,
      shipsSunk: 2,
      shotsFired: 28,
      shotsHit: 22,
      accuracy: 79,
      damageTaken: 560,
      score: 5410,
      grade: 'S',
    },
    fleetOutcome: {
      alliedRemaining: 2,
      alliedTotal: 3,
      enemyRemaining: 0,
      enemyTotal: 3,
    },
    combatHighlights: [
      'Kinetic penetrator direct hit on enemy Heavy Cruiser',
      'Neutralized hostile T-90 Main Battle Tank near Causeway Bridge',
      'Combat Victory! Division achieved complete territorial dominance.',
    ],
  },
  {
    id: 'rec-sample-002',
    timestamp: Date.now() - 1000 * 60 * 85, // 85 mins ago
    result: 'victory',
    winReason: 'Hostile naval force neutralized completely',
    durationSeconds: 156,
    vehicle: {
      name: 'USS Aegis Sentinel',
      baseModelId: 'water-destroyer-aegis',
      modelName: 'Arleigh Burke Flight III Guided Destroyer',
      hullClass: 'DDG',
      domain: 'water',
      primaryColor: '#1e293b',
      accentColor: '#38bdf8',
      bodyStyle: 'destroyer',
      equippedComponentNames: [
        'Forward 127mm Mk45 Naval Gun',
        'VLS Tomahawk Strike Missile Cell',
        'Harpoon Anti-Ship Missile Quad',
        'Phalanx 20mm Close-In Weapon System',
        'Active Sonar Array & Mk48 Torpedoes',
      ],
      finalHp: 1120,
      maxHp: 2200,
      survived: true,
    },
    map: {
      id: 'solomon-atoll',
      name: 'Solomon Atoll',
      theme: 'Tropical Atoll',
      description: 'Coral reefs, calm interior lagoon, and ring atolls offering tactical ambushes.',
      islandCount: 6,
      bridgeCount: 2,
    },
    settings: {
      gameMode: 'fleet-battle',
      shipsPerTeam: 4,
      alliedCount: 4,
      enemyCount: 4,
    },
    performance: {
      damageDealt: 4180,
      shipsSunk: 3,
      shotsFired: 46,
      shotsHit: 31,
      accuracy: 67,
      damageTaken: 1080,
      score: 6250,
      grade: 'S',
    },
    fleetOutcome: {
      alliedRemaining: 3,
      alliedTotal: 4,
      enemyRemaining: 0,
      enemyTotal: 4,
    },
    combatHighlights: [
      'Dual Harpoon salvo sunk enemy Patrol Frigate',
      'Phalanx CIWS intercepted hostile air-to-ground rocket barrage',
      'Long-range 127mm gun battery silenced enemy Coastal Gunboat',
    ],
  },
  {
    id: 'rec-sample-003',
    timestamp: Date.now() - 1000 * 60 * 180, // 3 hours ago
    result: 'defeat',
    winReason: 'All allied combat units neutralized in action',
    durationSeconds: 88,
    vehicle: {
      name: 'Viper Strike One',
      baseModelId: 'air-chopper-apache',
      modelName: 'AH-64E Apache Guardian Attack Helicopter',
      hullClass: 'ATK-HELO',
      domain: 'air',
      primaryColor: '#1e293b',
      accentColor: '#f59e0b',
      bodyStyle: 'chopper-apache',
      equippedComponentNames: [
        'M230 30mm Chain Gun Autocannon',
        'Hydra 70mm Folding-Fin Aerial Rockets',
        'AGM-114 Hellfire Anti-Armor Missiles',
        'Chaff & Flare Countermeasure Dispensers',
      ],
      finalHp: 0,
      maxHp: 1100,
      survived: false,
    },
    map: {
      id: 'baltic-estuary',
      name: 'Baltic Estuary',
      theme: 'Baltic Coastline',
      description: 'Vast continental mainland with deep maritime fjords and multi-span heavy highway bridges.',
      islandCount: 7,
      bridgeCount: 5,
    },
    settings: {
      gameMode: 'fleet-battle',
      shipsPerTeam: 3,
      alliedCount: 3,
      enemyCount: 3,
    },
    performance: {
      damageDealt: 1890,
      shipsSunk: 1,
      shotsFired: 34,
      shotsHit: 19,
      accuracy: 56,
      damageTaken: 1100,
      score: 2120,
      grade: 'B',
    },
    fleetOutcome: {
      alliedRemaining: 0,
      alliedTotal: 3,
      enemyRemaining: 1,
      enemyTotal: 3,
    },
    combatHighlights: [
      'Hellfire strike scored critical hit on enemy Armored Carrier',
      'Helicopter suffered catastrophic anti-aircraft flak fire',
      'Allied squadron overwhelmed in cross-strait crossfire',
    ],
  },
];

/**
 * Retrieves all stored game records from localStorage.
 * Initializes with sample records if user has not stored any yet.
 */
export function getGameHistory(): GameRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAME_HISTORY);
    if (!raw) {
      // Seed with initial realistic records so the interface is immediately functional
      localStorage.setItem(STORAGE_KEY_GAME_HISTORY, JSON.stringify(DEFAULT_SAMPLE_HISTORY));
      return DEFAULT_SAMPLE_HISTORY;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse stored game history:', err);
  }
  return DEFAULT_SAMPLE_HISTORY;
}

/**
 * Saves a new game record to the top of the history list.
 * Limits history length to the 100 most recent operations.
 */
export function saveGameRecord(record: GameRecord): void {
  try {
    const existing = getGameHistory();
    // Guard against duplicate ID
    const filtered = existing.filter(r => r.id !== record.id);
    const updated = [record, ...filtered].slice(0, 100);
    localStorage.setItem(STORAGE_KEY_GAME_HISTORY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save game record:', err);
  }
}

/**
 * Deletes a specific game record by ID.
 */
export function deleteGameRecord(id: string): void {
  try {
    const existing = getGameHistory();
    const updated = existing.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY_GAME_HISTORY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete game record:', err);
  }
}

/**
 * Clears all game records from localStorage.
 */
export function clearGameHistory(): void {
  try {
    localStorage.setItem(STORAGE_KEY_GAME_HISTORY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear game history:', err);
  }
}

/**
 * Calculates a tactical combat score based on battle outcome and stats.
 */
export function calculateCombatScore(
  damageDealt: number,
  kills: number,
  result: 'victory' | 'defeat',
  survived: boolean,
  accuracy: number
): number {
  const winBonus = result === 'victory' ? 1200 : 200;
  const survivalBonus = survived ? 600 : 0;
  const killScore = kills * 500;
  const damageScore = Math.round(damageDealt * 1.2);
  const accuracyBonus = Math.round(accuracy * 10);
  return winBonus + survivalBonus + killScore + damageScore + accuracyBonus;
}

/**
 * Computes tactical grade: S, A, B, C, or D.
 */
export function calculateTacticalGrade(
  score: number,
  result: 'victory' | 'defeat',
  survived: boolean,
  accuracy: number,
  kills: number
): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (result === 'victory' && survived && (kills >= 2 || accuracy >= 65 || score >= 4000)) {
    return 'S';
  }
  if (score >= 2600 || (result === 'victory' && kills >= 1)) {
    return 'A';
  }
  if (score >= 1600 || kills >= 1) {
    return 'B';
  }
  if (score >= 800) {
    return 'C';
  }
  return 'D';
}

/**
 * Formats seconds into a human-readable duration (e.g., "2m 14s").
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Formats a timestamp into a clean, military-style date string.
 */
export function formatGameDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Creates a complete, structured GameRecord from an active BattleState upon game completion.
 */
export function createGameRecordFromBattle(
  state: BattleState,
  playerConfig: CustomShipConfig,
  settings: BattleSettings
): GameRecord {
  const playerShip = state.ships.find(s => s.id === state.playerShipId) ||
                     state.ships.find(s => s.isPlayer) ||
                     state.ships[0];

  const model = SHIP_MODEL_MAP.get(playerConfig.baseModelId) || playerShip?.model;
  const mapConfig = state.mapConfig || BATTLE_MAP_MAP.get(settings.selectedMapId);

  const result: 'victory' | 'defeat' = state.winner === 'player' ? 'victory' : 'defeat';
  const survived = playerShip ? !playerShip.isSunk : false;

  const damageDealt = state.stats.damageDealt || 0;
  const shipsSunk = state.stats.shipsSunk || 0;
  const shotsFired = state.stats.shotsFired || 0;
  const shotsHit = state.stats.shotsHit || 0;
  const accuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;

  const score = calculateCombatScore(damageDealt, shipsSunk, result, survived, accuracy);
  const grade = calculateTacticalGrade(score, result, survived, accuracy, shipsSunk);

  // Extract equipped weapon & module names
  const equippedComponentNames: string[] = [];
  if (playerConfig.equippedComponents) {
    Object.values(playerConfig.equippedComponents).forEach(compId => {
      const comp = COMPONENT_MAP.get(compId);
      if (comp && !equippedComponentNames.includes(comp.name)) {
        equippedComponentNames.push(comp.name);
      }
    });
  }

  // Check trailer
  let trailerName: string | undefined;
  if (playerConfig.trailerId && playerConfig.trailerId !== 'none') {
    const tr = TRAILER_MAP.get(playerConfig.trailerId);
    if (tr) trailerName = tr.name;
  }

  // Allied & enemy counts
  const alliedShips = state.ships.filter(s => s.team === 'player' && !s.isDocked);
  const alliedRemaining = alliedShips.filter(s => !s.isSunk).length;
  const enemyShips = state.ships.filter(s => s.team === 'enemy' && !s.isDocked);
  const enemyRemaining = enemyShips.filter(s => !s.isSunk).length;

  // Extract top highlights from combat log
  const combatHighlights: string[] = [];
  if (state.combatLog && state.combatLog.length > 0) {
    // Grab the last 4 log entries
    const recentLogs = state.combatLog.slice(-4);
    recentLogs.forEach(entry => combatHighlights.push(entry.text));
  } else {
    combatHighlights.push(
      result === 'victory'
        ? 'Division secured tactical victory across the operational theater.'
        : 'Allied units neutralized under sustained enemy fire.'
    );
  }

  const winReason =
    state.winReason === 'annihilation'
      ? (result === 'victory' ? 'Hostile forces completely eliminated' : 'All allied units lost in action')
      : (result === 'victory' ? 'Tactical victory achieved' : 'Forces neutralized');

  return {
    id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    result,
    winReason,
    durationSeconds: Math.max(1, Math.round(state.time)),
    vehicle: {
      name: playerConfig.name || model?.name || 'Custom Combat Unit',
      baseModelId: playerConfig.baseModelId,
      modelName: model?.name || 'Combat Vehicle',
      hullClass: model?.hullClass || 'AFV',
      domain: (model?.domain || playerShip?.domain || 'water') as VehicleDomain,
      primaryColor: playerConfig.primaryColor || '#1e293b',
      accentColor: playerConfig.accentColor || '#38bdf8',
      bodyStyle: model?.spriteStyle.bodyStyle,
      equippedComponentNames,
      trailerName,
      finalHp: playerShip ? Math.max(0, Math.round(playerShip.currentHp)) : 0,
      maxHp: playerShip ? Math.round(playerShip.maxHp) : 1000,
      survived,
    },
    map: {
      id: mapConfig?.id || settings.selectedMapId,
      name: mapConfig?.name || 'Contested Theater',
      theme: mapConfig?.theme || 'Archipelago',
      description: mapConfig?.description || 'Naval and terrestrial conflict zone.',
      islandCount: state.islands?.length || mapConfig?.obstacles?.length || 4,
      bridgeCount: state.bridges?.length || mapConfig?.bridges?.length || 0,
    },
    settings: {
      gameMode: settings.gameMode || 'fleet-battle',
      shipsPerTeam: settings.shipsPerTeam,
      alliedCount: alliedShips.length || settings.shipsPerTeam,
      enemyCount: enemyShips.length || settings.shipsPerTeam,
    },
    performance: {
      damageDealt,
      shipsSunk,
      shotsFired,
      shotsHit,
      accuracy,
      score,
      grade,
    },
    fleetOutcome: {
      alliedRemaining,
      alliedTotal: alliedShips.length || settings.shipsPerTeam,
      enemyRemaining,
      enemyTotal: enemyShips.length || settings.shipsPerTeam,
    },
    combatHighlights,
  };
}

/**
 * Computes aggregated statistics across an array of game records.
 */
export function computeGameHistorySummary(records: GameRecord[]): GameHistorySummary {
  if (records.length === 0) {
    return {
      totalGames: 0,
      victories: 0,
      defeats: 0,
      winRate: 0,
      totalDamageDealt: 0,
      totalKills: 0,
      averageAccuracy: 0,
      averageDamage: 0,
      highestScore: 0,
    };
  }

  let victories = 0;
  let defeats = 0;
  let totalDamage = 0;
  let totalKills = 0;
  let totalShotsFired = 0;
  let totalShotsHit = 0;
  let highestScore = 0;

  const vehicleCountMap = new Map<string, number>();
  const domainCountMap = new Map<VehicleDomain, number>();
  const mapCountMap = new Map<string, number>();

  records.forEach(r => {
    if (r.result === 'victory') victories++;
    else defeats++;

    totalDamage += r.performance.damageDealt;
    totalKills += r.performance.shipsSunk;
    totalShotsFired += r.performance.shotsFired;
    totalShotsHit += r.performance.shotsHit;
    if (r.performance.score > highestScore) {
      highestScore = r.performance.score;
    }

    const vName = r.vehicle.modelName || r.vehicle.name;
    vehicleCountMap.set(vName, (vehicleCountMap.get(vName) || 0) + 1);

    const domain = r.vehicle.domain;
    domainCountMap.set(domain, (domainCountMap.get(domain) || 0) + 1);

    const mName = r.map.name;
    mapCountMap.set(mName, (mapCountMap.get(mName) || 0) + 1);
  });

  const winRate = Math.round((victories / records.length) * 100);
  const averageDamage = Math.round(totalDamage / records.length);
  const averageAccuracy =
    totalShotsFired > 0 ? Math.round((totalShotsHit / totalShotsFired) * 100) : 0;

  // Find favorite vehicle
  let favoriteVehicleName = '';
  let maxVCount = 0;
  vehicleCountMap.forEach((count, name) => {
    if (count > maxVCount) {
      maxVCount = count;
      favoriteVehicleName = name;
    }
  });

  // Find favorite domain
  let favoriteDomain: VehicleDomain = 'water';
  let maxDCount = 0;
  domainCountMap.forEach((count, d) => {
    if (count > maxDCount) {
      maxDCount = count;
      favoriteDomain = d;
    }
  });

  // Find most played map
  let mostPlayedMapName = '';
  let maxMCount = 0;
  mapCountMap.forEach((count, name) => {
    if (count > maxMCount) {
      maxMCount = count;
      mostPlayedMapName = name;
    }
  });

  return {
    totalGames: records.length,
    victories,
    defeats,
    winRate,
    totalDamageDealt: totalDamage,
    totalKills,
    averageAccuracy,
    averageDamage,
    highestScore,
    favoriteVehicleName,
    favoriteDomain,
    mostPlayedMapName,
  };
}
