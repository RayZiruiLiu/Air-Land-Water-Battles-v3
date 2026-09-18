import { BattleIsland, BattleMapConfig } from '../types/ship';
import { connectIslands, createIslandEx } from './mapHelpers';

// ===========================================================================
// THEME 1: MEDITERRANEAN ARCHIPELAGO (Command Station Siege)
// Malta Fortified Citadels: Massive asymmetric continental headlands and island web
// ===========================================================================
const MED_ISLANDS: BattleIsland[] = [
  // 0. West Allied Base Continental Landmass (Extends beyond left & top map borders)
  createIslandEx({
    x: 350,
    y: 920,
    rx: 1400,
    ry: 1600,
    shape: 'continent',
    style: 'sand',
    seed: 2.1,
    name: 'Fort St. Elmo Continental Bastion (Allied HQ)',
    category: 'fortress',
    foliage: [
      { x: 480, y: 720, type: 'building', radius: 30, color: '#1e293b' },
      { x: 520, y: 1120, type: 'bunker', radius: 28, color: '#334155' },
      { x: 380, y: 940, type: 'crane', radius: 24, color: '#f59e0b' },
    ],
  }),

  // 1. East Hostile Base Continental Landmass (Roughly opposite side, completely asymmetric; extends beyond right & bottom)
  createIslandEx({
    x: 4450,
    y: 2280,
    rx: 1500,
    ry: 1400,
    shape: 'continent',
    style: 'sand',
    seed: 7.7,
    name: 'Valletta Eastern Continental Citadel (Hostile HQ)',
    category: 'fortress',
    foliage: [
      { x: 4320, y: 2080, type: 'building', radius: 32, color: '#7f1d1d' },
      { x: 4380, y: 2460, type: 'bunker', radius: 28, color: '#991b1b' },
      { x: 4500, y: 2220, type: 'crane', radius: 24, color: '#dc2626' },
    ],
  }),

  // 2. Gozo North Channel Cape (Allied Flank / Forward Staging)
  createIslandEx({
    x: 1600,
    y: 640,
    rx: 650,
    ry: 580,
    shape: 'bastion',
    style: 'sand',
    seed: 3.4,
    name: 'Gozo North Cape',
    foliage: [{ x: 1620, y: 620, type: 'bunker', radius: 24, color: '#475569' }],
  }),

  // 3. Marsaxlokk South Ridge (Allied South Headland)
  createIslandEx({
    x: 1320,
    y: 2150,
    rx: 700,
    ry: 620,
    shape: 'natural',
    style: 'sand',
    seed: 4.8,
    name: 'Marsaxlokk Sound Promontory',
    foliage: [{ x: 1340, y: 2120, type: 'tree', radius: 20, color: '#15803d' }],
  }),

  // 4. Comino Grand Central Atoll (High Strategic Value Mid-Map Crossing)
  createIslandEx({
    x: 2380,
    y: 1280,
    rx: 720,
    ry: 640,
    shape: 'continent',
    style: 'sand',
    seed: 5.2,
    name: 'Comino Grand Central Atoll',
    foliage: [
      { x: 2380, y: 1240, type: 'building', radius: 26, color: '#475569' },
      { x: 2460, y: 1340, type: 'bunker', radius: 22, color: '#334155' },
    ],
  }),

  // 5. Filfla Sound Bastion (South-Central Contested Isle)
  createIslandEx({
    x: 2780,
    y: 2320,
    rx: 650,
    ry: 680,
    shape: 'bastion',
    style: 'sand',
    seed: 6.1,
    name: 'Filfla Sound Bastion',
    foliage: [{ x: 2760, y: 2340, type: 'bunker', radius: 24, color: '#64748b' }],
  }),

  // 6. Mellieha Forward Outpost (Hostile North Flank Barrier)
  createIslandEx({
    x: 3480,
    y: 960,
    rx: 640,
    ry: 560,
    shape: 'natural',
    style: 'sand',
    seed: 8.3,
    name: 'Mellieha Forward Outpost',
    foliage: [{ x: 3500, y: 940, type: 'bunker', radius: 24, color: '#991b1b' }],
  }),

  // 7. Birgu Coastal Redoubt (Hostile South Approaches)
  createIslandEx({
    x: 3520,
    y: 2580,
    rx: 620,
    ry: 580,
    shape: 'bastion',
    style: 'sand',
    seed: 9.1,
    name: 'Birgu Coastal Redoubt',
    foliage: [{ x: 3540, y: 2560, type: 'bunker', radius: 24, color: '#7f1d1d' }],
  }),
];

// All land areas connected by bridges — ZERO isolated land areas
const MED_BRIDGES = [
  connectIslands('m1-b1', 'St. Elmo North Causeway', MED_ISLANDS[0], MED_ISLANDS[2], 140, 'suspension'),
  connectIslands('m1-b2', 'South Headland Bridge', MED_ISLANDS[0], MED_ISLANDS[3], 140, 'suspension'),
  connectIslands('m1-b3', 'Gozo Channel Viaduct', MED_ISLANDS[2], MED_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('m1-b4', 'Marsaxlokk Strait Bridge', MED_ISLANDS[3], MED_ISLANDS[5], 130, 'concrete-highway'),
  connectIslands('m1-b5', 'Central Sound Inter-Island Span', MED_ISLANDS[4], MED_ISLANDS[5], 130, 'suspension'),
  connectIslands('m1-b6', 'North Roadstead Viaduct', MED_ISLANDS[4], MED_ISLANDS[6], 130, 'concrete-highway'),
  connectIslands('m1-b7', 'South Channel Span', MED_ISLANDS[5], MED_ISLANDS[7], 130, 'concrete-highway'),
  connectIslands('m1-b8', 'Valletta North Approach Bridge', MED_ISLANDS[6], MED_ISLANDS[1], 140, 'suspension'),
  connectIslands('m1-b9', 'Birgu Grand Causeway', MED_ISLANDS[7], MED_ISLANDS[1], 140, 'suspension'),
];

// ===========================================================================
// THEME 2: SVALBARD ARCTIC (Glacial Fjord Command Bastions)
// Tundra glaciers, frozen basalt causeways, and stark asymmetric fortresses
// ===========================================================================
const ARCTIC_ISLANDS: BattleIsland[] = [
  // 0. Allied Arctic Base Landmass (Extends past left & bottom boundaries)
  createIslandEx({
    x: 380,
    y: 2240,
    rx: 1450,
    ry: 1550,
    shape: 'continent',
    style: 'ice',
    seed: 11.2,
    name: 'Barentsburg Allied Glacial Base',
    category: 'fortress',
    foliage: [
      { x: 500, y: 2060, type: 'building', radius: 30, color: '#334155' },
      { x: 540, y: 2360, type: 'bunker', radius: 26, color: '#475569' },
    ],
  }),

  // 1. Hostile Arctic Base Landmass (Roughly opposite in Northeast; extends past right & top boundaries)
  createIslandEx({
    x: 4420,
    y: 920,
    rx: 1500,
    ry: 1450,
    shape: 'continent',
    style: 'ice',
    seed: 12.8,
    name: 'Longyearbyen Hostile Command Bunker',
    category: 'fortress',
    foliage: [
      { x: 4280, y: 760, type: 'building', radius: 30, color: '#7f1d1d' },
      { x: 4340, y: 1120, type: 'bunker', radius: 26, color: '#991b1b' },
    ],
  }),

  // 2. Isfjorden South Promontory
  createIslandEx({
    x: 1580,
    y: 2450,
    rx: 680,
    ry: 600,
    shape: 'natural',
    style: 'ice',
    seed: 13.1,
    name: 'Isfjorden South Promontory',
  }),

  // 3. Nordenskiold West Ridge
  createIslandEx({
    x: 1350,
    y: 1120,
    rx: 650,
    ry: 640,
    shape: 'bastion',
    style: 'ice',
    seed: 13.7,
    name: 'Nordenskiold West Ridge',
  }),

  // 4. Central Ice-Shelf Basin (Mid-Straits Crossroad)
  createIslandEx({
    x: 2320,
    y: 1740,
    rx: 740,
    ry: 660,
    shape: 'continent',
    style: 'ice',
    seed: 14.5,
    name: 'Central Ice-Shelf Basin',
  }),

  // 5. Tempelfjorden Spire (Northeast Outwork)
  createIslandEx({
    x: 2920,
    y: 860,
    rx: 640,
    ry: 580,
    shape: 'natural',
    style: 'ice',
    seed: 15.2,
    name: 'Tempelfjorden Spire',
  }),

  // 6. Adventfjorden Glacier Isle (Southeast Outwork)
  createIslandEx({
    x: 3220,
    y: 2280,
    rx: 680,
    ry: 620,
    shape: 'bastion',
    style: 'ice',
    seed: 15.9,
    name: 'Adventfjorden Glacier Isle',
  }),
];

const ARCTIC_BRIDGES = [
  connectIslands('arc-b1', 'Barentsburg South Span', ARCTIC_ISLANDS[0], ARCTIC_ISLANDS[2], 140, 'suspension'),
  connectIslands('arc-b2', 'Nordenskiold Coastal Causeway', ARCTIC_ISLANDS[0], ARCTIC_ISLANDS[3], 140, 'concrete-highway'),
  connectIslands('arc-b3', 'Isfjorden Crossing', ARCTIC_ISLANDS[2], ARCTIC_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('arc-b4', 'West Fjord Viaduct', ARCTIC_ISLANDS[3], ARCTIC_ISLANDS[4], 130, 'suspension'),
  connectIslands('arc-b5', 'Tempelfjorden Approach Span', ARCTIC_ISLANDS[4], ARCTIC_ISLANDS[5], 130, 'concrete-highway'),
  connectIslands('arc-b6', 'Central Fjord Ice Bridge', ARCTIC_ISLANDS[4], ARCTIC_ISLANDS[6], 130, 'suspension'),
  connectIslands('arc-b7', 'Tempelfjorden Citadel Bridge', ARCTIC_ISLANDS[5], ARCTIC_ISLANDS[1], 140, 'concrete-highway'),
  connectIslands('arc-b8', 'Longyearbyen South Viaduct', ARCTIC_ISLANDS[6], ARCTIC_ISLANDS[1], 140, 'suspension'),
];

// ===========================================================================
// THEME 3: KRAKATOA VOLCANO (Geothermal Command Posts)
// Basalt ridges, smoking calderas, and active hydrothermal causeways
// ===========================================================================
const VOLCANO_ISLANDS: BattleIsland[] = [
  // 0. Allied Geothermal Base (Extends past left boundary)
  createIslandEx({
    x: 360,
    y: 1200,
    rx: 1400,
    ry: 1600,
    shape: 'continent',
    style: 'volcano',
    seed: 17.2,
    name: 'Allied Geothermal Reactor Base',
    category: 'fortress',
    foliage: [
      { x: 480, y: 1040, type: 'building', radius: 30, color: '#334155' },
      { x: 520, y: 1380, type: 'bunker', radius: 26, color: '#1e293b' },
    ],
  }),

  // 1. Hostile Geothermal Base (Roughly opposite side in Southeast; extends past right boundary)
  createIslandEx({
    x: 4440,
    y: 2120,
    rx: 1450,
    ry: 1480,
    shape: 'continent',
    style: 'volcano',
    seed: 18.5,
    name: 'Hostile Magma Extraction Station',
    category: 'fortress',
    foliage: [
      { x: 4320, y: 1960, type: 'building', radius: 32, color: '#7f1d1d' },
      { x: 4360, y: 2280, type: 'bunker', radius: 28, color: '#991b1b' },
    ],
  }),

  // 2. Caldera North Ridge
  createIslandEx({
    x: 1480,
    y: 720,
    rx: 660,
    ry: 580,
    shape: 'bastion',
    style: 'volcano',
    seed: 19.3,
    name: 'Caldera North Ridge',
  }),

  // 3. Basalt South Horn
  createIslandEx({
    x: 1380,
    y: 2360,
    rx: 680,
    ry: 620,
    shape: 'natural',
    style: 'volcano',
    seed: 20.1,
    name: 'Basalt South Horn',
  }),

  // 4. Central Boiling Atoll (Fuming Crater Rim Crossway)
  createIslandEx({
    x: 2380,
    y: 1540,
    rx: 760,
    ry: 680,
    shape: 'continent',
    style: 'volcano',
    seed: 21.4,
    name: 'Central Boiling Atoll',
  }),

  // 5. Obsidian North Crag
  createIslandEx({
    x: 3340,
    y: 920,
    rx: 650,
    ry: 580,
    shape: 'bastion',
    style: 'volcano',
    seed: 22.1,
    name: 'Obsidian North Crag',
  }),

  // 6. Ash Plain South Outwork
  createIslandEx({
    x: 3380,
    y: 2420,
    rx: 680,
    ry: 620,
    shape: 'natural',
    style: 'volcano',
    seed: 22.9,
    name: 'Ash Plain South Outwork',
  }),
];

const VOLCANO_BRIDGES = [
  connectIslands('vol-b1', 'Reactor North Trestle', VOLCANO_ISLANDS[0], VOLCANO_ISLANDS[2], 140, 'concrete-highway'),
  connectIslands('vol-b2', 'Basalt Flank Causeway', VOLCANO_ISLANDS[0], VOLCANO_ISLANDS[3], 140, 'suspension'),
  connectIslands('vol-b3', 'North Crater Viaduct', VOLCANO_ISLANDS[2], VOLCANO_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('vol-b4', 'South Magma Bridge', VOLCANO_ISLANDS[3], VOLCANO_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('vol-b5', 'Obsidian Traverse Span', VOLCANO_ISLANDS[4], VOLCANO_ISLANDS[5], 130, 'suspension'),
  connectIslands('vol-b6', 'Ash Plain Connecting Bridge', VOLCANO_ISLANDS[4], VOLCANO_ISLANDS[6], 130, 'concrete-highway'),
  connectIslands('vol-b7', 'Hostile North Citadel Bridge', VOLCANO_ISLANDS[5], VOLCANO_ISLANDS[1], 140, 'suspension'),
  connectIslands('vol-b8', 'Magma Station South Causeway', VOLCANO_ISLANDS[6], VOLCANO_ISLANDS[1], 140, 'concrete-highway'),
];

// ===========================================================================
// THEME 4: PANAMA ISTHMUS (Canal Control Stations)
// Dense tropical canal headlands, shipping locks, and jungle causeways
// ===========================================================================
const PANAMA_ISLANDS: BattleIsland[] = [
  // 0. Allied Pacific Canal Headland (Extends past left & bottom map borders)
  createIslandEx({
    x: 420,
    y: 2280,
    rx: 1420,
    ry: 1500,
    shape: 'continent',
    style: 'reef',
    seed: 24.2,
    name: 'Pacific Locks Allied Command Center',
    category: 'fortress',
    foliage: [
      { x: 540, y: 2120, type: 'building', radius: 30, color: '#164e63' },
      { x: 580, y: 2460, type: 'bunker', radius: 26, color: '#0e7490' },
    ],
  }),

  // 1. Hostile Atlantic Canal Headland (Roughly opposite in Northeast; extends past right & top borders)
  createIslandEx({
    x: 4400,
    y: 950,
    rx: 1480,
    ry: 1450,
    shape: 'continent',
    style: 'reef',
    seed: 25.6,
    name: 'Atlantic Locks Hostile Command Citadel',
    category: 'fortress',
    foliage: [
      { x: 4260, y: 820, type: 'building', radius: 32, color: '#7f1d1d' },
      { x: 4320, y: 1140, type: 'bunker', radius: 28, color: '#991b1b' },
    ],
  }),

  // 2. Miraflores South Basin Isle
  createIslandEx({
    x: 1620,
    y: 2440,
    rx: 680,
    ry: 600,
    shape: 'natural',
    style: 'reef',
    seed: 26.3,
    name: 'Miraflores South Basin',
  }),

  // 3. Pedro Miguel Ridge
  createIslandEx({
    x: 1340,
    y: 1140,
    rx: 650,
    ry: 640,
    shape: 'bastion',
    style: 'reef',
    seed: 27.1,
    name: 'Pedro Miguel Ridge',
  }),

  // 4. Gatun Grand Shipping Lock Isle (Central Shipping Lane Control Hub)
  createIslandEx({
    x: 2350,
    y: 1760,
    rx: 760,
    ry: 660,
    shape: 'continent',
    style: 'reef',
    seed: 28.5,
    name: 'Gatun Grand Shipping Lock Isle',
  }),

  // 5. Gamboa Cut Jungle Ridge
  createIslandEx({
    x: 2980,
    y: 880,
    rx: 640,
    ry: 580,
    shape: 'natural',
    style: 'reef',
    seed: 29.2,
    name: 'Gamboa Cut Jungle Ridge',
  }),

  // 6. Culebra Basin Outwork
  createIslandEx({
    x: 3250,
    y: 2320,
    rx: 680,
    ry: 620,
    shape: 'bastion',
    style: 'reef',
    seed: 30.1,
    name: 'Culebra Basin Outwork',
  }),
];

const PANAMA_BRIDGES = [
  connectIslands('pan-b1', 'Miraflores Lock Causeway', PANAMA_ISLANDS[0], PANAMA_ISLANDS[2], 140, 'concrete-highway'),
  connectIslands('pan-b2', 'Pedro Miguel Access Bridge', PANAMA_ISLANDS[0], PANAMA_ISLANDS[3], 140, 'suspension'),
  connectIslands('pan-b3', 'South Isthmus Viaduct', PANAMA_ISLANDS[2], PANAMA_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('pan-b4', 'West Canal Lock Bridge', PANAMA_ISLANDS[3], PANAMA_ISLANDS[4], 130, 'suspension'),
  connectIslands('pan-b5', 'Gamboa Cut Crossing', PANAMA_ISLANDS[4], PANAMA_ISLANDS[5], 130, 'concrete-highway'),
  connectIslands('pan-b6', 'Culebra Channel Span', PANAMA_ISLANDS[4], PANAMA_ISLANDS[6], 130, 'suspension'),
  connectIslands('pan-b7', 'Gamboa Atlantic Viaduct', PANAMA_ISLANDS[5], PANAMA_ISLANDS[1], 140, 'concrete-highway'),
  connectIslands('pan-b8', 'Cristobal Causeway Span', PANAMA_ISLANDS[6], PANAMA_ISLANDS[1], 140, 'suspension'),
];

// ===========================================================================
// THEME 5: BALTIC IRON STRAITS (Kronstadt Naval Fortresses)
// Reinforced concrete bastions, heavy coastal batteries, iron sea gates
// ===========================================================================
const BALTIC_ISLANDS: BattleIsland[] = [
  // 0. Allied Western Fortress Landmass (Extends past left boundary)
  createIslandEx({
    x: 360,
    y: 1720,
    rx: 1420,
    ry: 1650,
    shape: 'continent',
    style: 'industrial',
    seed: 32.4,
    name: 'Kronstadt West Bastion (Allied HQ)',
    category: 'fortress',
    foliage: [
      { x: 480, y: 1540, type: 'building', radius: 32, color: '#334155' },
      { x: 520, y: 1880, type: 'bunker', radius: 28, color: '#1e293b' },
      { x: 420, y: 1700, type: 'crane', radius: 24, color: '#f59e0b' },
    ],
  }),

  // 1. Hostile Eastern Fortress Landmass (Roughly opposite side, asymmetric y; extends past right boundary)
  createIslandEx({
    x: 4440,
    y: 1460,
    rx: 1480,
    ry: 1550,
    shape: 'continent',
    style: 'industrial',
    seed: 33.8,
    name: 'Kronstadt East Bastion (Hostile HQ)',
    category: 'fortress',
    foliage: [
      { x: 4320, y: 1300, type: 'building', radius: 32, color: '#7f1d1d' },
      { x: 4360, y: 1640, type: 'bunker', radius: 28, color: '#991b1b' },
      { x: 4460, y: 1480, type: 'crane', radius: 24, color: '#dc2626' },
    ],
  }),

  // 2. Kotlin North Bastion Shoal
  createIslandEx({
    x: 1480,
    y: 840,
    rx: 660,
    ry: 580,
    shape: 'bastion',
    style: 'industrial',
    seed: 34.6,
    name: 'Kotlin North Bastion',
  }),

  // 3. Lomonosov South Ridge
  createIslandEx({
    x: 1420,
    y: 2420,
    rx: 680,
    ry: 620,
    shape: 'natural',
    style: 'industrial',
    seed: 35.3,
    name: 'Lomonosov South Ridge',
  }),

  // 4. Grand Roadstead Central Fortress (Strategic Iron Bastion at map center)
  createIslandEx({
    x: 2380,
    y: 1580,
    rx: 760,
    ry: 680,
    shape: 'continent',
    style: 'industrial',
    seed: 36.5,
    name: 'Grand Roadstead Central Fortress',
  }),

  // 5. Fort Constantine Shoal
  createIslandEx({
    x: 3340,
    y: 860,
    rx: 640,
    ry: 560,
    shape: 'bastion',
    style: 'industrial',
    seed: 37.2,
    name: 'Fort Constantine Shoal',
  }),

  // 6. Fort Alexander Outwork
  createIslandEx({
    x: 3380,
    y: 2360,
    rx: 660,
    ry: 600,
    shape: 'bastion',
    style: 'industrial',
    seed: 38.1,
    name: 'Fort Alexander Outwork',
  }),
];

const BALTIC_BRIDGES = [
  connectIslands('bal-b1', 'Severny Canal Causeway', BALTIC_ISLANDS[0], BALTIC_ISLANDS[2], 140, 'concrete-highway'),
  connectIslands('bal-b2', 'Yuzhny Ridge Bridge', BALTIC_ISLANDS[0], BALTIC_ISLANDS[3], 140, 'concrete-highway'),
  connectIslands('bal-b3', 'Central West High Causeway', BALTIC_ISLANDS[0], BALTIC_ISLANDS[4], 150, 'suspension'),
  connectIslands('bal-b4', 'Kotlin Central Connector', BALTIC_ISLANDS[2], BALTIC_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('bal-b5', 'Lomonosov Central Span', BALTIC_ISLANDS[3], BALTIC_ISLANDS[4], 130, 'concrete-highway'),
  connectIslands('bal-b6', 'Roadstead North Viaduct', BALTIC_ISLANDS[4], BALTIC_ISLANDS[5], 130, 'concrete-highway'),
  connectIslands('bal-b7', 'Roadstead South Viaduct', BALTIC_ISLANDS[4], BALTIC_ISLANDS[6], 130, 'concrete-highway'),
  connectIslands('bal-b8', 'Central East High Causeway', BALTIC_ISLANDS[4], BALTIC_ISLANDS[1], 150, 'suspension'),
  connectIslands('bal-b9', 'Constantine Eastern Span', BALTIC_ISLANDS[5], BALTIC_ISLANDS[1], 140, 'concrete-highway'),
  connectIslands('bal-b10', 'Alexander Eastern Causeway', BALTIC_ISLANDS[6], BALTIC_ISLANDS[1], 140, 'concrete-highway'),
];

// ===========================================================================
// EXPORTED MODE 2 MAP CONFIGURATIONS
// ===========================================================================
export const MODE_2_MAPS: BattleMapConfig[] = [
  {
    id: 'mode2-malta-bastions',
    name: 'Malta Archipelago: Fortified Bastion Citadels',
    gameMode: 'command-station',
    theme: 'Mediterranean Archipelago',
    description: 'Opposing command citadels fortified on massive asymmetric continental headlands. Breach defensive coastal batteries and missile silos across the island bridge network.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0a233b',
      mid: '#0f3c5e',
      surface: '#15527a',
      wave: 'rgba(255, 255, 255, 0.15)',
      boundary: 'rgba(40, 110, 180, 0.4)',
    },
    islandStyle: 'sand',
    ambientWeather: 'clear',
    commandStationPositions: {
      player: {
        x: 560,
        y: 920,
        name: 'Fort St. Elmo Command Citadel',
        defensiveWeapons: [
          { id: 'dw-m1-p1', name: 'Coastal Battery Alpha', x: 780, y: 760, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-m1-p2', name: 'Surface Missile Silo', x: 820, y: 1080, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-m1-p3', name: 'High-Ground Flak Tower', x: 640, y: 1260, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4200,
        y: 2220,
        name: 'Valletta Eastern Command Citadel',
        defensiveWeapons: [
          { id: 'dw-m1-e1', name: 'Hostile Coastal Battery Omega', x: 3960, y: 2060, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-m1-e2', name: 'Hostile VLS Missile Silo', x: 3920, y: 2380, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-m1-e3', name: 'Hostile CIWS Flak Tower', x: 4120, y: 1900, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 620, y: 820 },
        { x: 620, y: 1020 },
        { x: 460, y: 920 },
        { x: 860, y: 880 },
        { x: 1520, y: 640 },
      ],
      playerWater: [
        { x: 1100, y: 1450 },
        { x: 1300, y: 1700 },
        { x: 950, y: 1600 },
      ],
      enemyLand: [
        { x: 4120, y: 2120 },
        { x: 4120, y: 2320 },
        { x: 4320, y: 2220 },
        { x: 3900, y: 2220 },
        { x: 3520, y: 1040 },
      ],
      enemyWater: [
        { x: 3550, y: 1650 },
        { x: 3750, y: 1400 },
        { x: 3400, y: 1800 },
      ],
    },
    obstacles: MED_ISLANDS,
    bridges: MED_BRIDGES,
  },
  {
    id: 'mode2-arctic-citadels',
    name: 'Svalbard Sound: Glacial Command Bastions',
    gameMode: 'command-station',
    theme: 'Arctic Glacial Tundra',
    description: 'Heavy automated bastions embedded in asymmetric polar continental shelves. Navigate glacial island bridges while repelling missile strikes and coastal artillery.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#061726',
      mid: '#0c273d',
      surface: '#123854',
      wave: 'rgba(220, 245, 255, 0.18)',
      boundary: 'rgba(70, 140, 200, 0.35)',
    },
    islandStyle: 'ice',
    ambientWeather: 'snow',
    commandStationPositions: {
      player: {
        x: 600,
        y: 2180,
        name: 'Barentsburg Allied Glacial HQ',
        defensiveWeapons: [
          { id: 'dw-arc-p1', name: 'Polar Heavy Howitzer Battery', x: 840, y: 2020, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-arc-p2', name: 'Glacial Hypersonic Missile Silo', x: 780, y: 2420, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-arc-p3', name: 'Arctic Perimeter CIWS Tower', x: 950, y: 2240, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4200,
        y: 980,
        name: 'Longyearbyen Hostile Command Bunker',
        defensiveWeapons: [
          { id: 'dw-arc-e1', name: 'Hostile Frozen Bastion Gun', x: 3960, y: 1140, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-arc-e2', name: 'Hardened Ice-Cap Missile Pod', x: 3920, y: 820, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-arc-e3', name: 'Arctic Rapid Flak Turret', x: 4120, y: 1260, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 680, y: 2100 },
        { x: 680, y: 2260 },
        { x: 520, y: 2180 },
        { x: 900, y: 2120 },
        { x: 1540, y: 2420 },
      ],
      playerWater: [
        { x: 1050, y: 1650 },
        { x: 1250, y: 1400 },
        { x: 850, y: 1500 },
      ],
      enemyLand: [
        { x: 4120, y: 900 },
        { x: 4120, y: 1060 },
        { x: 4300, y: 980 },
        { x: 3880, y: 980 },
        { x: 2900, y: 920 },
      ],
      enemyWater: [
        { x: 3650, y: 1500 },
        { x: 3450, y: 1750 },
        { x: 3800, y: 1650 },
      ],
    },
    obstacles: ARCTIC_ISLANDS,
    bridges: ARCTIC_BRIDGES,
  },
  {
    id: 'mode2-volcano-posts',
    name: 'Krakatoa Volcano: Geothermal Command Posts',
    gameMode: 'command-station',
    theme: 'Volcanic Ring Archipelago',
    description: 'Positioned on active volcanic continental flanks flanking a caldera sound. Autonomous defense batteries guard the geothermal core against armor advances.',
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
    commandStationPositions: {
      player: {
        x: 560,
        y: 1180,
        name: 'Allied Geothermal Station',
        defensiveWeapons: [
          { id: 'dw-vol-p1', name: 'Magma Ridge Coastal Cannon', x: 780, y: 980, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-vol-p2', name: 'Thermal VLS Rocket Battery', x: 820, y: 1350, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-vol-p3', name: 'Basalt Crest CIWS Emplacement', x: 650, y: 1480, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4220,
        y: 2080,
        name: 'Hostile Geothermal Extraction Station',
        defensiveWeapons: [
          { id: 'dw-vol-e1', name: 'Hostile Caldera Heavy Battery', x: 3980, y: 1920, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-vol-e2', name: 'Hostile Lava Tube Missile Silo', x: 3940, y: 2260, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-vol-e3', name: 'Hostile Volcanic Flak Tower', x: 4140, y: 1780, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 640, y: 1100 },
        { x: 640, y: 1260 },
        { x: 480, y: 1180 },
        { x: 840, y: 1180 },
        { x: 1440, y: 760 },
      ],
      playerWater: [
        { x: 1100, y: 1700 },
        { x: 1300, y: 1950 },
        { x: 950, y: 1850 },
      ],
      enemyLand: [
        { x: 4140, y: 2000 },
        { x: 4140, y: 2160 },
        { x: 4320, y: 2080 },
        { x: 3920, y: 2080 },
        { x: 3340, y: 2360 },
      ],
      enemyWater: [
        { x: 3550, y: 1500 },
        { x: 3750, y: 1300 },
        { x: 3400, y: 1650 },
      ],
    },
    obstacles: VOLCANO_ISLANDS,
    bridges: VOLCANO_BRIDGES,
  },
  {
    id: 'mode2-panama-locks',
    name: 'Gatun Locks: Canal Control Stations',
    gameMode: 'command-station',
    theme: 'Tropical Jungle Isthmus',
    description: 'Strategic canal command stations flanking the maritime shipping locks. Automated missile batteries control the shipping lane as armor battles across the interconnected locks.',
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
    commandStationPositions: {
      player: {
        x: 620,
        y: 2220,
        name: 'Pacific Locks Allied Command Center',
        defensiveWeapons: [
          { id: 'dw-pan-p1', name: 'Balboa Coastal Defense Battery', x: 840, y: 2020, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-pan-p2', name: 'Isthmus Surface SAM Launcher', x: 760, y: 2420, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-pan-p3', name: 'Perimeter Vulcan CIWS Tower', x: 940, y: 2220, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4200,
        y: 1020,
        name: 'Atlantic Locks Hostile Command Citadel',
        defensiveWeapons: [
          { id: 'dw-pan-e1', name: 'Cristobal Coastal Fortress Battery', x: 3960, y: 1180, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-pan-e2', name: 'High-Canopy Missile Silo Battery', x: 4020, y: 800, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-pan-e3', name: 'Lock Gate CIWS Emplacement', x: 3820, y: 980, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 700, y: 2140 },
        { x: 700, y: 2300 },
        { x: 540, y: 2220 },
        { x: 920, y: 2120 },
        { x: 1580, y: 2420 },
      ],
      playerWater: [
        { x: 1050, y: 1650 },
        { x: 1250, y: 1400 },
        { x: 900, y: 1550 },
      ],
      enemyLand: [
        { x: 4120, y: 940 },
        { x: 4120, y: 1100 },
        { x: 4280, y: 1020 },
        { x: 3880, y: 1020 },
        { x: 2960, y: 940 },
      ],
      enemyWater: [
        { x: 3650, y: 1550 },
        { x: 3450, y: 1800 },
        { x: 3800, y: 1700 },
      ],
    },
    obstacles: PANAMA_ISLANDS,
    bridges: PANAMA_BRIDGES,
  },
  {
    id: 'mode2-baltic-fortresses',
    name: 'Kronstadt Fortress: Naval Command Citadels',
    gameMode: 'command-station',
    theme: 'Baltic Iron Straits',
    description: 'Reinforced concrete bastion stations with heavy coastal artillery bunkers and CIWS defense umbrellas. Neutralize the opposing fortress command bunker to win the engagement.',
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
    commandStationPositions: {
      player: {
        x: 580,
        y: 1680,
        name: 'Kronstadt West Bastion (Allied HQ)',
        defensiveWeapons: [
          { id: 'dw-bal-p1', name: 'Fortress Battery Severny', x: 800, y: 1460, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-bal-p2', name: 'Cruise Missile Bunker Alpha', x: 840, y: 1860, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-bal-p3', name: 'Naval Flak Redoubt', x: 680, y: 2020, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4220,
        y: 1500,
        name: 'Kronstadt East Bastion (Hostile HQ)',
        defensiveWeapons: [
          { id: 'dw-bal-e1', name: 'Coastal Siege Battery Yuzhny', x: 3980, y: 1320, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-bal-e2', name: 'Hardened Silo Battery Omega', x: 3940, y: 1700, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-bal-e3', name: 'Citadel Rapid CIWS Emplacement', x: 4120, y: 1220, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 660, y: 1600 },
        { x: 660, y: 1760 },
        { x: 500, y: 1680 },
        { x: 880, y: 1680 },
        { x: 1440, y: 880 },
      ],
      playerWater: [
        { x: 1050, y: 1250 },
        { x: 1050, y: 2150 },
        { x: 1250, y: 1700 },
      ],
      enemyLand: [
        { x: 4140, y: 1420 },
        { x: 4140, y: 1580 },
        { x: 4300, y: 1500 },
        { x: 3900, y: 1500 },
        { x: 3340, y: 920 },
      ],
      enemyWater: [
        { x: 3650, y: 1250 },
        { x: 3650, y: 1750 },
        { x: 3450, y: 1500 },
      ],
    },
    obstacles: BALTIC_ISLANDS,
    bridges: BALTIC_BRIDGES,
  },
];
