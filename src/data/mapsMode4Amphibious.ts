import { BattleIsland, BattleMapConfig } from '../types/ship';
import { createIslandEx } from './mapHelpers';

// ---------------------------------------------------------------------------
// THEME 1: MEDITERRANEAN AMPHIBIOUS BEACHHEAD (Gallipoli Bastion)
// ---------------------------------------------------------------------------
const MED_AMPHIB_ISLANDS: BattleIsland[] = [
  // Major Landmass on East (Defender Territory with Command Center)
  createIslandEx({
    x: 3900,
    y: 1600,
    rx: 1500,
    ry: 1350,
    shape: 'continent',
    style: 'sand',
    seed: 41.1,
    name: 'Gallipoli Continental Mainland (Defender Fortress)',
    category: 'fortress',
    foliage: [
      { x: 3800, y: 1600, type: 'building', radius: 28, color: '#334155' },
      { x: 3900, y: 1350, type: 'bunker', radius: 26, color: '#475569' },
      { x: 3900, y: 1850, type: 'radar', radius: 24, color: '#0284c7' },
      { x: 3100, y: 1600, type: 'bunker', radius: 24, color: '#1e293b' },
    ],
  }),
  // Defensive Coastal Outpost Islets
  createIslandEx({
    x: 2100,
    y: 750,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'sand',
    seed: 41.3,
    name: 'North Point Battery Islet',
  }),
  createIslandEx({
    x: 2100,
    y: 2450,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'sand',
    seed: 41.5,
    name: 'South Point Battery Islet',
  }),
  // Staging Atoll for Attacker Fleet
  createIslandEx({
    x: 550,
    y: 700,
    rx: 280,
    ry: 250,
    shape: 'skerry',
    style: 'sand',
    seed: 41.7,
    name: 'Attacker Naval Staging Reef',
  }),
];

// ---------------------------------------------------------------------------
// THEME 2: TROPICAL DELTA BEACHHEAD (Mekong Delta Beachhead)
// ---------------------------------------------------------------------------
const DELTA_AMPHIB_ISLANDS: BattleIsland[] = [
  createIslandEx({
    x: 3900,
    y: 1600,
    rx: 1500,
    ry: 1350,
    shape: 'continent',
    style: 'sand',
    seed: 42.1,
    name: 'Mekong River Delta Mainland (Defender HQ)',
    category: 'fortress',
    foliage: [
      { x: 3800, y: 1600, type: 'building', radius: 28, color: '#14532d' },
      { x: 3900, y: 1350, type: 'bunker', radius: 26, color: '#166534' },
      { x: 3900, y: 1850, type: 'radar', radius: 24, color: '#10b981' },
      { x: 3100, y: 1600, type: 'bunker', radius: 24, color: '#064e3b' },
    ],
  }),
  createIslandEx({
    x: 2050,
    y: 800,
    rx: 330,
    ry: 290,
    shape: 'natural',
    style: 'sand',
    seed: 42.3,
    name: 'Mangrove Guard Shoal',
  }),
  createIslandEx({
    x: 2050,
    y: 2400,
    rx: 330,
    ry: 290,
    shape: 'natural',
    style: 'sand',
    seed: 42.5,
    name: 'Delta Estuary Barrier',
  }),
  createIslandEx({
    x: 550,
    y: 2500,
    rx: 280,
    ry: 250,
    shape: 'skerry',
    style: 'sand',
    seed: 42.7,
    name: 'Offshore Fleet Anchorage',
  }),
];

// ---------------------------------------------------------------------------
// THEME 3: ARCTIC FJORD AMPHIBIOUS ASSAULT (Narvik Polar Assault)
// ---------------------------------------------------------------------------
const ARCTIC_AMPHIB_ISLANDS: BattleIsland[] = [
  createIslandEx({
    x: 3900,
    y: 1600,
    rx: 1500,
    ry: 1350,
    shape: 'continent',
    style: 'ice',
    seed: 43.1,
    name: 'Narvik Coastal Ice Mass (Defender HQ)',
    category: 'fortress',
    foliage: [
      { x: 3800, y: 1600, type: 'building', radius: 28, color: '#1e293b' },
      { x: 3900, y: 1350, type: 'bunker', radius: 26, color: '#334155' },
      { x: 3900, y: 1850, type: 'radar', radius: 24, color: '#38bdf8' },
      { x: 3100, y: 1600, type: 'bunker', radius: 24, color: '#0f172a' },
    ],
  }),
  createIslandEx({
    x: 2100,
    y: 750,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'ice',
    seed: 43.3,
    name: 'North Glacier Skerry',
  }),
  createIslandEx({
    x: 2100,
    y: 2450,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'ice',
    seed: 43.5,
    name: 'South Ice Spire Bastion',
  }),
  createIslandEx({
    x: 550,
    y: 800,
    rx: 280,
    ry: 250,
    shape: 'skerry',
    style: 'ice',
    seed: 43.7,
    name: 'Fjord Naval Entry Islet',
  }),
];

// ---------------------------------------------------------------------------
// THEME 4: VOLCANO CALDERA ASSAULT (Iwo Jima Basalt Fortress)
// ---------------------------------------------------------------------------
const VOLCANO_AMPHIB_ISLANDS: BattleIsland[] = [
  createIslandEx({
    x: 3900,
    y: 1600,
    rx: 1500,
    ry: 1350,
    shape: 'continent',
    style: 'volcano',
    seed: 44.1,
    name: 'Mount Suribachi Landmass (Defender Fortress)',
    category: 'fortress',
    foliage: [
      { x: 3800, y: 1600, type: 'building', radius: 28, color: '#44403c' },
      { x: 3900, y: 1350, type: 'bunker', radius: 26, color: '#ea580c' },
      { x: 3900, y: 1850, type: 'radar', radius: 24, color: '#f97316' },
      { x: 3100, y: 1600, type: 'bunker', radius: 24, color: '#292524' },
    ],
  }),
  createIslandEx({
    x: 2100,
    y: 750,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'volcano',
    seed: 44.3,
    name: 'North Obsidian Battery',
  }),
  createIslandEx({
    x: 2100,
    y: 2450,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'volcano',
    seed: 44.5,
    name: 'South Magma Vent Bastion',
  }),
  createIslandEx({
    x: 550,
    y: 2400,
    rx: 280,
    ry: 250,
    shape: 'skerry',
    style: 'volcano',
    seed: 44.7,
    name: 'Offshore Basalt Anchorage',
  }),
];

// ---------------------------------------------------------------------------
// THEME 5: PANAMA ISTHMUS BEACHHEAD (San Lorenzo Fort Incursion)
// ---------------------------------------------------------------------------
const PANAMA_AMPHIB_ISLANDS: BattleIsland[] = [
  createIslandEx({
    x: 3900,
    y: 1600,
    rx: 1500,
    ry: 1350,
    shape: 'continent',
    style: 'reef',
    seed: 45.1,
    name: 'San Lorenzo Continental Promontory (Defender Base)',
    category: 'fortress',
    foliage: [
      { x: 3800, y: 1600, type: 'building', radius: 28, color: '#065f46' },
      { x: 3900, y: 1350, type: 'bunker', radius: 26, color: '#047857' },
      { x: 3900, y: 1850, type: 'crane', radius: 24, color: '#f59e0b' },
      { x: 3100, y: 1600, type: 'bunker', radius: 24, color: '#064e3b' },
    ],
  }),
  createIslandEx({
    x: 2100,
    y: 750,
    rx: 320,
    ry: 290,
    shape: 'natural',
    style: 'reef',
    seed: 45.3,
    name: 'Chagres River Guard Islet',
  }),
  createIslandEx({
    x: 2100,
    y: 2450,
    rx: 320,
    ry: 290,
    shape: 'natural',
    style: 'reef',
    seed: 45.5,
    name: 'Limon Bay Guard Islet',
  }),
  createIslandEx({
    x: 550,
    y: 700,
    rx: 280,
    ry: 250,
    shape: 'skerry',
    style: 'reef',
    seed: 45.7,
    name: 'Caribbean Fleet Assembly Shoal',
  }),
];

// ---------------------------------------------------------------------------
// THEME 6: BALTIC REDOUBT BEACHHEAD (Moon Sound Coastal Assault)
// ---------------------------------------------------------------------------
const BALTIC_AMPHIB_ISLANDS: BattleIsland[] = [
  createIslandEx({
    x: 3900,
    y: 1600,
    rx: 1500,
    ry: 1350,
    shape: 'continent',
    style: 'industrial',
    seed: 46.1,
    name: 'Saaremaa Mainland Fortress (Defender HQ)',
    category: 'fortress',
    foliage: [
      { x: 3800, y: 1600, type: 'building', radius: 28, color: '#334155' },
      { x: 3900, y: 1350, type: 'radar', radius: 24, color: '#0284c7' },
      { x: 3900, y: 1850, type: 'bunker', radius: 26, color: '#1e293b' },
      { x: 3100, y: 1600, type: 'bunker', radius: 24, color: '#475569' },
    ],
  }),
  createIslandEx({
    x: 2100,
    y: 750,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'industrial',
    seed: 46.3,
    name: 'Zerel Coastal Battery',
  }),
  createIslandEx({
    x: 2100,
    y: 2450,
    rx: 320,
    ry: 290,
    shape: 'bastion',
    style: 'industrial',
    seed: 46.5,
    name: 'Tagalaht Guard Bastion',
  }),
  createIslandEx({
    x: 550,
    y: 2500,
    rx: 280,
    ry: 250,
    shape: 'skerry',
    style: 'industrial',
    seed: 46.7,
    name: 'Baltic Fleet Staging Reef',
  }),
];

// ===========================================================================
// EXPORT 6 MODE 4 MAPS (One for each theme)
// ===========================================================================
export const MODE_4_MAPS: BattleMapConfig[] = [
  {
    id: 'mode4-mediterranean-landing',
    name: 'Gallipoli Beachhead: Mediterranean Assault',
    gameMode: 'amphibious-assault',
    theme: 'Mediterranean Archipelago',
    description: 'Allied naval invasion task force assaults the Gallipoli peninsula. The vehicle transport carrier moves toward the beachhead to deploy armor while warships provide naval gunfire support against the fortified command center.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0d324d',
      mid: '#154e79',
      surface: '#1b6ca8',
      wave: 'rgba(255, 255, 255, 0.12)',
      boundary: 'rgba(27, 108, 168, 0.35)',
    },
    islandStyle: 'sand',
    ambientWeather: 'clear',
    amphibiousConfig: {
      carrierSpawn: { x: 450, y: 1600, angle: 0 },
      landingZone: { x: 2750, y: 1600, radius: 240 },
      commandCenterPos: { x: 3800, y: 1600, name: 'Gallipoli Command Citadel' },
    },
    spawnPoints: {
      playerLand: [
        { x: 3500, y: 1350 },
        { x: 3500, y: 1850 },
        { x: 3350, y: 1600 },
        { x: 3700, y: 1450 },
      ],
      playerWater: [
        { x: 2700, y: 950 },
        { x: 2700, y: 2250 },
      ],
      enemyLand: [
        { x: 3450, y: 1400 },
        { x: 3450, y: 1800 },
      ],
      enemyWater: [
        { x: 600, y: 1200 },
        { x: 600, y: 2000 },
        { x: 800, y: 1600 },
      ],
    },
    obstacles: MED_AMPHIB_ISLANDS,
  },
  {
    id: 'mode4-delta-incursion',
    name: 'Mekong Delta Beachhead: Estuary Incursion',
    gameMode: 'amphibious-assault',
    theme: 'Tropical River Delta',
    description: 'Amphibious task group penetrates deep into mangrove river mouths. Defending armor and aircraft fortify the command complex while the heavy carrier makes for the shoreline to unload armor battalions.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#143828',
      mid: '#1d523b',
      surface: '#297353',
      wave: 'rgba(230, 255, 240, 0.1)',
      boundary: 'rgba(41, 115, 83, 0.35)',
    },
    islandStyle: 'sand',
    ambientWeather: 'clear',
    amphibiousConfig: {
      carrierSpawn: { x: 450, y: 1600, angle: 0 },
      landingZone: { x: 2750, y: 1600, radius: 240 },
      commandCenterPos: { x: 3800, y: 1600, name: 'Delta Command Complex' },
    },
    spawnPoints: {
      playerLand: [
        { x: 3500, y: 1350 },
        { x: 3500, y: 1850 },
        { x: 3350, y: 1600 },
        { x: 3700, y: 1450 },
      ],
      playerWater: [
        { x: 2700, y: 950 },
        { x: 2700, y: 2250 },
      ],
      enemyLand: [
        { x: 3450, y: 1400 },
        { x: 3450, y: 1800 },
      ],
      enemyWater: [
        { x: 600, y: 1200 },
        { x: 600, y: 2000 },
        { x: 800, y: 1600 },
      ],
    },
    obstacles: DELTA_AMPHIB_ISLANDS,
  },
  {
    id: 'mode4-arctic-fjord-strike',
    name: 'Narvik Amphibious Siege: Fjord Assault',
    gameMode: 'amphibious-assault',
    theme: 'Arctic Glacial Fjord',
    description: 'Sub-zero naval invasion navigating icy glacial channels. Land-vehicle carrier ship must reach the snow beachhead to deploy tracked armor against the mountain command station.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0f2438',
      mid: '#183852',
      surface: '#234c6e',
      wave: 'rgba(220, 240, 255, 0.15)',
      boundary: 'rgba(70, 130, 180, 0.35)',
    },
    islandStyle: 'ice',
    ambientWeather: 'snow',
    amphibiousConfig: {
      carrierSpawn: { x: 450, y: 1600, angle: 0 },
      landingZone: { x: 2750, y: 1600, radius: 240 },
      commandCenterPos: { x: 3800, y: 1600, name: 'Narvik Polar Command HQ' },
    },
    spawnPoints: {
      playerLand: [
        { x: 3500, y: 1350 },
        { x: 3500, y: 1850 },
        { x: 3350, y: 1600 },
        { x: 3700, y: 1450 },
      ],
      playerWater: [
        { x: 2700, y: 950 },
        { x: 2700, y: 2250 },
      ],
      enemyLand: [
        { x: 3450, y: 1400 },
        { x: 3450, y: 1800 },
      ],
      enemyWater: [
        { x: 600, y: 1200 },
        { x: 600, y: 2000 },
        { x: 800, y: 1600 },
      ],
    },
    obstacles: ARCTIC_AMPHIB_ISLANDS,
  },
  {
    id: 'mode4-volcano-invasion',
    name: 'Iwo Jima Basalt Fortress: Caldera Beach Assault',
    gameMode: 'amphibious-assault',
    theme: 'Volcanic Ring Archipelago',
    description: 'Black sand beach invasion beneath volcanic crags. The transport carrier beaches under heavy mortar and artillery fire to deliver tanks directly to the crater entrance.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#1a181e',
      mid: '#2b232a',
      surface: '#3d3036',
      wave: 'rgba(255, 120, 50, 0.1)',
      boundary: 'rgba(180, 80, 40, 0.35)',
    },
    islandStyle: 'volcano',
    ambientWeather: 'magma',
    amphibiousConfig: {
      carrierSpawn: { x: 450, y: 1600, angle: 0 },
      landingZone: { x: 2750, y: 1600, radius: 240 },
      commandCenterPos: { x: 3800, y: 1600, name: 'Basalt Caldera Command HQ' },
    },
    spawnPoints: {
      playerLand: [
        { x: 3500, y: 1350 },
        { x: 3500, y: 1850 },
        { x: 3350, y: 1600 },
        { x: 3700, y: 1450 },
      ],
      playerWater: [
        { x: 2700, y: 950 },
        { x: 2700, y: 2250 },
      ],
      enemyLand: [
        { x: 3450, y: 1400 },
        { x: 3450, y: 1800 },
      ],
      enemyWater: [
        { x: 600, y: 1200 },
        { x: 600, y: 2000 },
        { x: 800, y: 1600 },
      ],
    },
    obstacles: VOLCANO_AMPHIB_ISLANDS,
  },
  {
    id: 'mode4-panama-breach',
    name: 'San Lorenzo Fortress: Isthmus Beachhead',
    gameMode: 'amphibious-assault',
    theme: 'Tropical Jungle Isthmus',
    description: 'Tropical coastal invasion targeting the San Lorenzo continental fort. The vehicle carrier pushes past defensive coral heads to establish a beachhead for the armored breakthrough.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0c2e3b',
      mid: '#154555',
      surface: '#1f5f73',
      wave: 'rgba(180, 240, 230, 0.12)',
      boundary: 'rgba(31, 95, 115, 0.35)',
    },
    islandStyle: 'reef',
    ambientWeather: 'clear',
    amphibiousConfig: {
      carrierSpawn: { x: 450, y: 1600, angle: 0 },
      landingZone: { x: 2750, y: 1600, radius: 240 },
      commandCenterPos: { x: 3800, y: 1600, name: 'San Lorenzo Command Fort' },
    },
    spawnPoints: {
      playerLand: [
        { x: 3500, y: 1350 },
        { x: 3500, y: 1850 },
        { x: 3350, y: 1600 },
        { x: 3700, y: 1450 },
      ],
      playerWater: [
        { x: 2700, y: 950 },
        { x: 2700, y: 2250 },
      ],
      enemyLand: [
        { x: 3450, y: 1400 },
        { x: 3450, y: 1800 },
      ],
      enemyWater: [
        { x: 600, y: 1200 },
        { x: 600, y: 2000 },
        { x: 800, y: 1600 },
      ],
    },
    obstacles: PANAMA_AMPHIB_ISLANDS,
  },
  {
    id: 'mode4-baltic-redoubt',
    name: 'Moon Sound Operation: Coastal Fortress Siege',
    gameMode: 'amphibious-assault',
    theme: 'Baltic Iron Straits',
    description: 'Cold-water Baltic assault on a reinforced continental citadel. The carrier vessel must weather coastal artillery salvos to deposit heavy tanks on the sandy shoals of Saaremaa.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0b1f33',
      mid: '#122d4a',
      surface: '#1a3c61',
      wave: 'rgba(190, 220, 240, 0.14)',
      boundary: 'rgba(80, 110, 140, 0.4)',
    },
    islandStyle: 'industrial',
    ambientWeather: 'storm',
    amphibiousConfig: {
      carrierSpawn: { x: 450, y: 1600, angle: 0 },
      landingZone: { x: 2750, y: 1600, radius: 240 },
      commandCenterPos: { x: 3800, y: 1600, name: 'Saaremaa Citadel Command HQ' },
    },
    spawnPoints: {
      playerLand: [
        { x: 3500, y: 1350 },
        { x: 3500, y: 1850 },
        { x: 3350, y: 1600 },
        { x: 3700, y: 1450 },
      ],
      playerWater: [
        { x: 2700, y: 950 },
        { x: 2700, y: 2250 },
      ],
      enemyLand: [
        { x: 3450, y: 1400 },
        { x: 3450, y: 1800 },
      ],
      enemyWater: [
        { x: 600, y: 1200 },
        { x: 600, y: 2000 },
        { x: 800, y: 1600 },
      ],
    },
    obstacles: BALTIC_AMPHIB_ISLANDS,
  },
];
