import { BattleIsland, BattleMapConfig } from '../types/ship';
import { connectIslands, createIslandEx } from './mapHelpers';

// ===========================================================================
// THEME 1: MEDITERRANEAN ARCHIPELAGO (Command Station Warfare)
// Gibraltar-inspired sandstone capes, rocky skerries, reefs, and old stone spans.
// ===========================================================================
const MED_ISLANDS: BattleIsland[] = [
  // The two HQ headlands are centered beyond different map edges so their
  // coastlines read as true mainland rather than oversized circular islands.
  createIslandEx({
    x: -160,
    y: 680,
    rx: 1500,
    ry: 1050,
    shape: 'continent',
    style: 'harbor',
    seed: 1.2,
    name: 'Western Gibraltar Command Headland',
    category: 'mainland',
    foliage: [
      { x: 260, y: 470, type: 'building', radius: 30, color: '#334155' },
      { x: 170, y: 900, type: 'bunker', radius: 28, color: '#475569' },
      { x: 420, y: 560, type: 'crane', radius: 24, color: '#f59e0b' },
    ],
  }),
  createIslandEx({
    x: 4960,
    y: 2420,
    rx: 1450,
    ry: 1120,
    shape: 'continent',
    style: 'harbor',
    seed: 9.6,
    name: 'Eastern Alboran Command Headland',
    category: 'mainland',
    foliage: [
      { x: 4560, y: 2250, type: 'building', radius: 32, color: '#7f1d1d' },
      { x: 4460, y: 2610, type: 'bunker', radius: 28, color: '#991b1b' },
      { x: 4650, y: 2520, type: 'crane', radius: 24, color: '#dc2626' },
    ],
  }),
  createIslandEx({
    x: 1080,
    y: 2400,
    rx: 430,
    ry: 150,
    shape: 'spit',
    style: 'sand',
    headingAngle: 0.28,
    curvature: 0.34,
    seed: 3.7,
    name: 'Tarifa Barrier Spit',
    foliage: [{ x: 1080, y: 2390, type: 'tree', radius: 20, color: '#15803d' }],
  }),
  createIslandEx({
    x: 1460,
    y: 900,
    rx: 380,
    ry: 300,
    shape: 'natural',
    style: 'rock',
    seed: 4.1,
    name: 'Ceuta Crag',
    foliage: [{ x: 1460, y: 880, type: 'bunker', radius: 22, color: '#334155' }],
  }),
  createIslandEx({
    x: 2070,
    y: 1800,
    rx: 450,
    ry: 340,
    shape: 'continent',
    style: 'sand',
    seed: 6.8,
    name: 'Isla Luna',
    foliage: [
      { x: 1940, y: 1710, type: 'bunker', radius: 24, color: '#334155' },
      { x: 2190, y: 1890, type: 'tree', radius: 20, color: '#15803d' },
    ],
  }),
  createIslandEx({
    x: 2720,
    y: 560,
    rx: 250,
    ry: 180,
    shape: 'skerry',
    style: 'rock',
    seed: 8.2,
    name: 'North Sound Skerry',
  }),
  createIslandEx({
    x: 3020,
    y: 2640,
    rx: 390,
    ry: 310,
    shape: 'natural',
    style: 'reef',
    seed: 10.4,
    name: 'Alboran Reef',
  }),
  createIslandEx({
    x: 3700,
    y: 1280,
    rx: 440,
    ry: 160,
    shape: 'spit',
    style: 'sand',
    headingAngle: -0.48,
    curvature: 0.28,
    seed: 12.7,
    name: 'Eastern Strait Cape',
  }),
];

const MED_BRIDGES = [
  connectIslands('med2-b1', 'Western Masonry Arch', MED_ISLANDS[0], MED_ISLANDS[3], 135, 'arch-stone'),
  connectIslands('med2-b2', 'Tarifa Timber Trestle', MED_ISLANDS[0], MED_ISLANDS[2], 125, 'timber-trestle'),
  connectIslands('med2-b3', 'Ceuta Stone Viaduct', MED_ISLANDS[3], MED_ISLANDS[4], 125, 'arch-stone'),
  connectIslands('med2-b4', 'Luna South Trestle', MED_ISLANDS[2], MED_ISLANDS[4], 120, 'timber-trestle'),
  connectIslands('med2-b5', 'North Skerry Arch', MED_ISLANDS[4], MED_ISLANDS[5], 120, 'arch-stone'),
  connectIslands('med2-b6', 'Alboran Reef Trestle', MED_ISLANDS[4], MED_ISLANDS[6], 120, 'timber-trestle'),
  connectIslands('med2-b7', 'Eastern Cape Viaduct', MED_ISLANDS[5], MED_ISLANDS[7], 125, 'arch-stone'),
  connectIslands('med2-b8', 'Reef-Cape Trestle', MED_ISLANDS[6], MED_ISLANDS[7], 120, 'timber-trestle'),
  connectIslands('med2-b9', 'Alboran Command Arch', MED_ISLANDS[7], MED_ISLANDS[1], 140, 'arch-stone'),
];

// ===========================================================================
// THEME 2: TROPICAL RIVER DELTA (Command Station Warfare)
// Sundarbans-inspired mangrove banks, braided channels, and pontoon crossings.
// ===========================================================================
const DELTA_ISLANDS: BattleIsland[] = [
  createIslandEx({ x: 900, y: -220, rx: 1250, ry: 1200, shape: 'continent', style: 'reef', seed: 21.3, name: 'Northern Sundarbans Command Bank', category: 'mainland' }),
  createIslandEx({ x: 3880, y: 3420, rx: 1320, ry: 1250, shape: 'continent', style: 'reef', seed: 40.9, name: 'Southern Estuary Command Bank', category: 'mainland' }),
  createIslandEx({ x: 560, y: 1720, rx: 430, ry: 300, shape: 'continent', style: 'reef', seed: 22.7, name: 'Western Mangrove Marsh' }),
  createIslandEx({ x: 1740, y: 1080, rx: 360, ry: 170, shape: 'spit', style: 'sand', headingAngle: 0.22, curvature: 0.34, seed: 23.9, name: 'Upper Braided Sandbar' }),
  createIslandEx({ x: 1320, y: 2700, rx: 310, ry: 250, shape: 'natural', style: 'sand', seed: 25.1, name: 'Southwest Alluvial Cay' }),
  createIslandEx({ x: 2380, y: 1840, rx: 470, ry: 360, shape: 'continent', style: 'reef', seed: 26.8, name: 'Emerald Mangrove Island' }),
  createIslandEx({ x: 3140, y: 660, rx: 280, ry: 210, shape: 'natural', style: 'sand', seed: 29.1, name: 'Northeast River Bank' }),
  createIslandEx({ x: 2960, y: 2580, rx: 380, ry: 150, shape: 'spit', style: 'sand', headingAngle: -0.36, curvature: 0.30, seed: 33.2, name: 'Lower Estuary Sandbar' }),
  createIslandEx({ x: 4210, y: 1540, rx: 390, ry: 300, shape: 'continent', style: 'reef', seed: 37.4, name: 'Eastern Mangrove Redoubt' }),
];

const DELTA_BRIDGES = [
  connectIslands('del2-b1', 'Northern Ribbon Pontoon', DELTA_ISLANDS[0], DELTA_ISLANDS[3], 130, 'military-pontoon'),
  connectIslands('del2-b2', 'Western Marsh Truss', DELTA_ISLANDS[0], DELTA_ISLANDS[2], 125, 'truss'),
  connectIslands('del2-b3', 'Braided Channel Bailey', DELTA_ISLANDS[2], DELTA_ISLANDS[3], 120, 'truss'),
  connectIslands('del2-b4', 'Alluvial Ribbon Crossing', DELTA_ISLANDS[2], DELTA_ISLANDS[4], 120, 'military-pontoon'),
  connectIslands('del2-b5', 'Emerald West Pontoon', DELTA_ISLANDS[3], DELTA_ISLANDS[5], 130, 'military-pontoon'),
  connectIslands('del2-b6', 'South Mangrove Truss', DELTA_ISLANDS[4], DELTA_ISLANDS[5], 125, 'truss'),
  connectIslands('del2-b7', 'Upper Estuary Bailey', DELTA_ISLANDS[5], DELTA_ISLANDS[6], 125, 'truss'),
  connectIslands('del2-b8', 'Lower Estuary Pontoon', DELTA_ISLANDS[5], DELTA_ISLANDS[7], 125, 'military-pontoon'),
  connectIslands('del2-b9', 'Eastern Delta Truss', DELTA_ISLANDS[6], DELTA_ISLANDS[8], 125, 'truss'),
  connectIslands('del2-b10', 'Redoubt Ribbon Pontoon', DELTA_ISLANDS[7], DELTA_ISLANDS[8], 125, 'military-pontoon'),
  connectIslands('del2-b11', 'Southern Command Causeway', DELTA_ISLANDS[7], DELTA_ISLANDS[1], 135, 'truss'),
];

// ===========================================================================
// THEME 3: SVALBARD ARCTIC (Glacial Fjord Command Bastions)
// Tundra glaciers, frozen basalt causeways, and stark asymmetric fortresses
// ===========================================================================
const ARCTIC_ISLANDS: BattleIsland[] = [
  // 0. Allied Arctic Base Landmass (Extends past left & bottom boundaries)
  createIslandEx({
    x: -220,
    y: 2500,
    rx: 1550,
    ry: 1050,
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
    x: 4100,
    y: -250,
    rx: 1200,
    ry: 1300,
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
    x: 1450,
    y: 2850,
    rx: 450,
    ry: 370,
    shape: 'natural',
    style: 'ice',
    seed: 13.1,
    name: 'Isfjorden South Promontory',
  }),

  // 3. Nordenskiold West Ridge
  createIslandEx({
    x: 900,
    y: 1150,
    rx: 420,
    ry: 460,
    shape: 'bastion',
    style: 'ice',
    seed: 13.7,
    name: 'Nordenskiold West Ridge',
  }),

  // 4. Central Ice-Shelf Basin (Mid-Straits Crossroad)
  createIslandEx({
    x: 2250,
    y: 2050,
    rx: 470,
    ry: 410,
    shape: 'continent',
    style: 'ice',
    seed: 14.5,
    name: 'Central Ice-Shelf Basin',
  }),

  // 5. Tempelfjorden Spire (Northeast Outwork)
  createIslandEx({
    x: 2850,
    y: 620,
    rx: 390,
    ry: 370,
    shape: 'natural',
    style: 'ice',
    seed: 15.2,
    name: 'Tempelfjorden Spire',
  }),

  // 6. Adventfjorden Glacier Isle (Southeast Outwork)
  createIslandEx({
    x: 3560,
    y: 2400,
    rx: 450,
    ry: 390,
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
// THEME 4: KRAKATOA VOLCANO (Geothermal Command Posts)
// Basalt ridges, smoking calderas, and active hydrothermal causeways
// ===========================================================================
const VOLCANO_ISLANDS: BattleIsland[] = [
  // 0. Allied Geothermal Base (Extends past left boundary)
  createIslandEx({
    x: -220,
    y: 900,
    rx: 1500,
    ry: 1200,
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
    x: 5020,
    y: 2520,
    rx: 1500,
    ry: 1150,
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
    x: 1250,
    y: 420,
    rx: 430,
    ry: 350,
    shape: 'bastion',
    style: 'volcano',
    seed: 19.3,
    name: 'Caldera North Ridge',
  }),

  // 3. Basalt South Horn
  createIslandEx({
    x: 980,
    y: 2500,
    rx: 450,
    ry: 390,
    shape: 'natural',
    style: 'volcano',
    seed: 20.1,
    name: 'Basalt South Horn',
  }),

  // 4. Central Boiling Atoll (Fuming Crater Rim Crossway)
  createIslandEx({
    x: 2180,
    y: 1450,
    rx: 470,
    ry: 420,
    shape: 'continent',
    style: 'volcano',
    seed: 21.4,
    name: 'Central Boiling Atoll',
  }),

  // 5. Obsidian North Crag
  createIslandEx({
    x: 3300,
    y: 520,
    rx: 410,
    ry: 360,
    shape: 'bastion',
    style: 'volcano',
    seed: 22.1,
    name: 'Obsidian North Crag',
  }),

  // 6. Ash Plain South Outwork
  createIslandEx({
    x: 3180,
    y: 2720,
    rx: 430,
    ry: 400,
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
// THEME 5: PANAMA ISTHMUS (Canal Control Stations)
// Dense tropical canal headlands, shipping locks, and jungle causeways
// ===========================================================================
const PANAMA_ISLANDS: BattleIsland[] = [
  // 0. Allied Pacific Canal Headland (Extends past left & bottom map borders)
  createIslandEx({
    x: 700,
    y: 3420,
    rx: 1400,
    ry: 1250,
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
    x: 5000,
    y: 500,
    rx: 1500,
    ry: 1100,
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
    x: 1700,
    y: 2200,
    rx: 450,
    ry: 350,
    shape: 'natural',
    style: 'reef',
    seed: 26.3,
    name: 'Miraflores South Basin',
  }),

  // 3. Pedro Miguel Ridge
  createIslandEx({
    x: 900,
    y: 1100,
    rx: 400,
    ry: 450,
    shape: 'bastion',
    style: 'reef',
    seed: 27.1,
    name: 'Pedro Miguel Ridge',
  }),

  // 4. Gatun Grand Shipping Lock Isle (Central Shipping Lane Control Hub)
  createIslandEx({
    x: 2300,
    y: 1600,
    rx: 480,
    ry: 400,
    shape: 'continent',
    style: 'reef',
    seed: 28.5,
    name: 'Gatun Grand Shipping Lock Isle',
  }),

  // 5. Gamboa Cut Jungle Ridge
  createIslandEx({
    x: 3000,
    y: 500,
    rx: 390,
    ry: 350,
    shape: 'natural',
    style: 'reef',
    seed: 29.2,
    name: 'Gamboa Cut Jungle Ridge',
  }),

  // 6. Culebra Basin Outwork
  createIslandEx({
    x: 3500,
    y: 2450,
    rx: 450,
    ry: 390,
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
// THEME 6: BALTIC IRON STRAITS (Kronstadt Naval Fortresses)
// Reinforced concrete bastions, heavy coastal batteries, iron sea gates
// ===========================================================================
const BALTIC_ISLANDS: BattleIsland[] = [
  // 0. Allied Western Fortress Landmass (Extends past left boundary)
  createIslandEx({
    x: -200,
    y: 1600,
    rx: 1500,
    ry: 1250,
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
    x: 5000,
    y: 1050,
    rx: 1500,
    ry: 1200,
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
    x: 1100,
    y: 450,
    rx: 420,
    ry: 360,
    shape: 'bastion',
    style: 'industrial',
    seed: 34.6,
    name: 'Kotlin North Bastion',
  }),

  // 3. Lomonosov South Ridge
  createIslandEx({
    x: 1450,
    y: 2700,
    rx: 450,
    ry: 370,
    shape: 'natural',
    style: 'industrial',
    seed: 35.3,
    name: 'Lomonosov South Ridge',
  }),

  // 4. Grand Roadstead Central Fortress (Strategic Iron Bastion at map center)
  createIslandEx({
    x: 2300,
    y: 1250,
    rx: 470,
    ry: 410,
    shape: 'continent',
    style: 'industrial',
    seed: 36.5,
    name: 'Grand Roadstead Central Fortress',
  }),

  // 5. Fort Constantine Shoal
  createIslandEx({
    x: 3400,
    y: 350,
    rx: 400,
    ry: 350,
    shape: 'bastion',
    style: 'industrial',
    seed: 37.2,
    name: 'Fort Constantine Shoal',
  }),

  // 6. Fort Alexander Outwork
  createIslandEx({
    x: 2950,
    y: 2750,
    rx: 430,
    ry: 380,
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
const BASE_MODE_2_MAPS: BattleMapConfig[] = [
  {
    id: 'mode2-mediterranean-bastion',
    name: 'Straits of Gibraltar: Command Headlands',
    gameMode: 'command-station',
    theme: 'Mediterranean Archipelago • Stone Arch & Timber Trestle Bridges',
    description: 'Gibraltar-inspired sandstone capes, reef islands, and rocky skerries link two opposing mainland command headlands with old stone arches and timber trestles.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0f2942',
      mid: '#153b5c',
      surface: '#1d507d',
      wave: 'rgba(210, 230, 250, 0.14)',
      boundary: 'rgba(100, 140, 180, 0.35)',
    },
    islandStyle: 'sand',
    ambientWeather: 'clear',
    commandStationPositions: {
      player: {
        x: 400,
        y: 550,
        name: 'Western Gibraltar Command Citadel',
        defensiveWeapons: [
          { id: 'dw-m1-p1', name: 'Gibraltar Coastal Battery', x: 150, y: 500, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-m1-p2', name: 'Western Headland Missile Silo', x: 700, y: 650, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-m1-p3', name: 'Tarifa Flak Tower', x: 300, y: 1050, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4400,
        y: 2400,
        name: 'Eastern Alboran Command Citadel',
        defensiveWeapons: [
          { id: 'dw-m1-e1', name: 'Alboran Coastal Battery', x: 4500, y: 2150, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-m1-e2', name: 'Eastern Headland VLS', x: 4250, y: 2650, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-m1-e3', name: 'Strait CIWS Tower', x: 4650, y: 2600, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 300, y: 650 },
        { x: 500, y: 850 },
        { x: 160, y: 930 },
        { x: 590, y: 470 },
        { x: 1460, y: 900 },
      ],
      playerWater: [
        { x: 850, y: 1350 },
        { x: 1160, y: 1620 },
        { x: 720, y: 1910 },
      ],
      enemyLand: [
        { x: 4440, y: 2260 },
        { x: 4560, y: 2470 },
        { x: 4300, y: 2540 },
        { x: 4650, y: 2700 },
        { x: 3700, y: 1280 },
      ],
      enemyWater: [
        { x: 4010, y: 920 },
        { x: 4140, y: 1410 },
        { x: 3710, y: 1960 },
      ],
    },
    obstacles: MED_ISLANDS,
    bridges: MED_BRIDGES,
  },
  {
    id: 'mode2-delta-redoubts',
    name: 'Sundarbans Delta: Command Redoubts',
    gameMode: 'command-station',
    theme: 'Tropical River Delta • Military Pontoon & Steel Truss Bridges',
    description: 'Mangrove command banks rise from opposite edges of a braided estuary linked by irregular sandbars, marsh islands, tactical pontoons, and Bailey trusses.',
    dimensions: { width: 4800, height: 3200 },
    waterColors: {
      deep: '#0f2b24',
      mid: '#163f35',
      surface: '#1e5447',
      wave: 'rgba(180, 225, 200, 0.12)',
      boundary: 'rgba(90, 150, 125, 0.35)',
    },
    islandStyle: 'sand',
    ambientWeather: 'storm',
    commandStationPositions: {
      player: {
        x: 1000, y: 400, name: 'Northern Sundarbans Command Redoubt',
        defensiveWeapons: [
          { id: 'dw-del-p1', name: 'Mangrove Coastal Battery', x: 600, y: 350, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-del-p2', name: 'Delta Missile Silo', x: 1100, y: 600, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-del-p3', name: 'Northern Estuary CIWS', x: 1300, y: 200, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 3900, y: 2800, name: 'Southern Estuary Command Redoubt',
        defensiveWeapons: [
          { id: 'dw-del-e1', name: 'Southern Mudbank Battery', x: 3600, y: 2850, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-del-e2', name: 'Estuary VLS Battery', x: 4150, y: 2650, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-del-e3', name: 'Mangrove Flak Emplacement', x: 4050, y: 3000, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [{ x: 720, y: 300 }, { x: 900, y: 550 }, { x: 800, y: 600 }, { x: 1120, y: 140 }, { x: 1740, y: 1080 }],
      playerWater: [{ x: 520, y: 1080 }, { x: 1060, y: 1320 }, { x: 1450, y: 1580 }],
      enemyLand: [{ x: 3770, y: 2690 }, { x: 3800, y: 3100 }, { x: 3720, y: 3030 }, { x: 4200, y: 2920 }, { x: 2960, y: 2580 }],
      enemyWater: [{ x: 4270, y: 2180 }, { x: 3680, y: 2110 }, { x: 3480, y: 1530 }],
    },
    obstacles: DELTA_ISLANDS,
    bridges: DELTA_BRIDGES,
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
        x: 500,
        y: 2350,
        name: 'Barentsburg Allied Glacial HQ',
        defensiveWeapons: [
          { id: 'dw-arc-p1', name: 'Polar Heavy Howitzer Battery', x: 250, y: 2150, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-arc-p2', name: 'Glacial Hypersonic Missile Silo', x: 550, y: 2800, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-arc-p3', name: 'Arctic Perimeter CIWS Tower', x: 850, y: 2400, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4150,
        y: 500,
        name: 'Longyearbyen Hostile Command Bunker',
        defensiveWeapons: [
          { id: 'dw-arc-e1', name: 'Hostile Frozen Bastion Gun', x: 3850, y: 410, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-arc-e2', name: 'Hardened Ice-Cap Missile Pod', x: 4400, y: 300, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-arc-e3', name: 'Arctic Rapid Flak Turret', x: 4300, y: 600, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 420, y: 2240 },
        { x: 650, y: 2460 },
        { x: 210, y: 2580 },
        { x: 650, y: 2250 },
        { x: 1450, y: 2850 },
      ],
      playerWater: [
        { x: 900, y: 1770 },
        { x: 1460, y: 1700 },
        { x: 1770, y: 2400 },
      ],
      enemyLand: [
        { x: 4040, y: 390 },
        { x: 3950, y: 700 },
        { x: 3970, y: 680 },
        { x: 4500, y: 450 },
        { x: 2850, y: 620 },
      ],
      enemyWater: [
        { x: 3600, y: 1180 },
        { x: 3190, y: 1460 },
        { x: 3970, y: 1510 },
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
        x: 500,
        y: 1050,
        name: 'Allied Geothermal Station',
        defensiveWeapons: [
          { id: 'dw-vol-p1', name: 'Magma Ridge Coastal Cannon', x: 300, y: 850, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-vol-p2', name: 'Thermal VLS Rocket Battery', x: 700, y: 850, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-vol-p3', name: 'Basalt Crest CIWS Emplacement', x: 350, y: 1350, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4300,
        y: 2400,
        name: 'Hostile Geothermal Extraction Station',
        defensiveWeapons: [
          { id: 'dw-vol-e1', name: 'Hostile Caldera Heavy Battery', x: 4500, y: 2200, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-vol-e2', name: 'Hostile Lava Tube Missile Silo', x: 4100, y: 2750, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-vol-e3', name: 'Hostile Volcanic Flak Tower', x: 4550, y: 2450, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 380, y: 920 },
        { x: 590, y: 1150 },
        { x: 210, y: 1260 },
        { x: 720, y: 680 },
        { x: 1250, y: 420 },
      ],
      playerWater: [
        { x: 1100, y: 1700 },
        { x: 1300, y: 1950 },
        { x: 950, y: 1850 },
      ],
      enemyLand: [
        { x: 4200, y: 2290 },
        { x: 4420, y: 2440 },
        { x: 4160, y: 2590 },
        { x: 4550, y: 2740 },
        { x: 3180, y: 2720 },
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
        x: 550,
        y: 2800,
        name: 'Pacific Locks Allied Command Center',
        defensiveWeapons: [
          { id: 'dw-pan-p1', name: 'Balboa Coastal Defense Battery', x: 400, y: 2900, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-pan-p2', name: 'Isthmus Surface SAM Launcher', x: 900, y: 3000, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-pan-p3', name: 'Perimeter Vulcan CIWS Tower', x: 1050, y: 2700, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4300,
        y: 700,
        name: 'Atlantic Locks Hostile Command Citadel',
        defensiveWeapons: [
          { id: 'dw-pan-e1', name: 'Cristobal Coastal Fortress Battery', x: 4550, y: 350, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-pan-e2', name: 'High-Canopy Missile Silo Battery', x: 4200, y: 350, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-pan-e3', name: 'Lock Gate CIWS Emplacement', x: 4500, y: 950, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 600, y: 2660 },
        { x: 820, y: 2830 },
        { x: 480, y: 3020 },
        { x: 1040, y: 2940 },
        { x: 1700, y: 2200 },
      ],
      playerWater: [
        { x: 1050, y: 1650 },
        { x: 1660, y: 1450 },
        { x: 900, y: 1550 },
      ],
      enemyLand: [
        { x: 4210, y: 620 },
        { x: 4430, y: 770 },
        { x: 4180, y: 930 },
        { x: 4580, y: 1010 },
        { x: 3000, y: 500 },
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
        x: 500,
        y: 1700,
        name: 'Kronstadt West Bastion (Allied HQ)',
        defensiveWeapons: [
          { id: 'dw-bal-p1', name: 'Fortress Battery Severny', x: 250, y: 1350, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-bal-p2', name: 'Cruise Missile Bunker Alpha', x: 450, y: 1900, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-bal-p3', name: 'Naval Flak Redoubt', x: 800, y: 1750, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
      enemy: {
        x: 4300,
        y: 1300,
        name: 'Kronstadt East Bastion (Hostile HQ)',
        defensiveWeapons: [
          { id: 'dw-bal-e1', name: 'Coastal Siege Battery Yuzhny', x: 4500, y: 950, type: 'cannon', hp: 520, range: 780, damage: 55 },
          { id: 'dw-bal-e2', name: 'Hardened Silo Battery Omega', x: 4100, y: 1000, type: 'missile', hp: 420, range: 880, damage: 75 },
          { id: 'dw-bal-e3', name: 'Citadel Rapid CIWS Emplacement', x: 4500, y: 1300, type: 'ciws', hp: 360, range: 540, damage: 22 },
        ],
      },
    },
    spawnPoints: {
      playerLand: [
        { x: 410, y: 1490 },
        { x: 640, y: 1690 },
        { x: 250, y: 1830 },
        { x: 750, y: 1370 },
        { x: 1100, y: 450 },
      ],
      playerWater: [
        { x: 1050, y: 1250 },
        { x: 1050, y: 2150 },
        { x: 1250, y: 1700 },
      ],
      enemyLand: [
        { x: 4200, y: 1100 },
        { x: 4420, y: 1250 },
        { x: 4170, y: 1400 },
        { x: 4580, y: 1510 },
        { x: 3400, y: 350 },
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

const ORIGINAL_WIDTH = 4800;
const ORIGINAL_HEIGHT = 3200;
const HORIZONTAL_EXPANSION = 500;
const VERTICAL_EXPANSION = 400;

const expandMode2Map = (map: BattleMapConfig, mapIndex: number): BattleMapConfig => {
  const width = ORIGINAL_WIDTH + HORIZONTAL_EXPANSION * 2;
  const height = ORIGINAL_HEIGHT + VERTICAL_EXPANSION * 2;
  const translatePoint = (point: { x: number; y: number }) => ({
    x: point.x + HORIZONTAL_EXPANSION,
    y: point.y + VERTICAL_EXPANSION,
  });
  const expandBoundaryPoint = (point: { x: number; y: number }) => ({
    x: point.x <= 0
      ? point.x
      : point.x >= ORIGINAL_WIDTH
        ? point.x + HORIZONTAL_EXPANSION * 2
        : point.x + HORIZONTAL_EXPANSION,
    y: point.y <= 0
      ? point.y
      : point.y >= ORIGINAL_HEIGHT
        ? point.y + VERTICAL_EXPANSION * 2
        : point.y + VERTICAL_EXPANSION,
  });

  const obstacles = map.obstacles.map(island => ({
    ...island,
    ...translatePoint(island),
    points: island.points.map(expandBoundaryPoint),
    foliage: island.foliage.map(feature => ({ ...feature, ...translatePoint(feature) })),
    lake: island.lake
      ? {
        ...island.lake,
        ...translatePoint(island.lake),
        points: island.lake.points?.map(translatePoint),
      }
      : undefined,
    lakes: island.lakes?.map(lake => ({
      ...lake,
      ...translatePoint(lake),
      points: lake.points?.map(translatePoint),
    })),
    canals: island.canals?.map(canal => ({
      ...canal,
      x1: canal.x1 + HORIZONTAL_EXPANSION,
      y1: canal.y1 + VERTICAL_EXPANSION,
      x2: canal.x2 + HORIZONTAL_EXPANSION,
      y2: canal.y2 + VERTICAL_EXPANSION,
      points: canal.points?.map(translatePoint),
    })),
  }));

  const chooseOuterIsland = (bandY: number, seedOffset: number, label: string) => {
    const candidates = [0.22, 0.34, 0.47, 0.61, 0.74, 0.84].map(fraction => ({ x: width * fraction, y: bandY }));
    const location = candidates.reduce<{ x: number; y: number; clearance: number }>((best, candidate) => {
      const clearance = Math.min(...obstacles.map(island =>
        Math.hypot(candidate.x - island.x, candidate.y - island.y) - island.radius * 0.72
      ));
      return clearance > best.clearance ? { ...candidate, clearance } : best;
    }, { ...candidates[0], clearance: -Infinity });
    return createIslandEx({
      x: Math.round(location.x),
      y: Math.round(location.y),
      rx: label === 'North' ? 250 : 285,
      ry: label === 'North' ? 165 : 185,
      shape: label === 'North' ? 'skerry' : 'natural',
      style: map.islandStyle,
      seed: 80 + mapIndex * 7.3 + seedOffset,
      name: `${label} Outer Approach`,
    });
  };

  const northIsland = chooseOuterIsland(165, 1.1, 'North');
  const southIsland = chooseOuterIsland(height - 170, 4.7, 'South');
  const outerIslands = [northIsland, southIsland];
  const bridgeStyle = map.bridges?.[0]?.style || 'concrete-highway';
  const outerBridges = outerIslands.map((island, index) => {
    const connectedIsland = obstacles.reduce((nearest, candidate) =>
      Math.hypot(candidate.x - island.x, candidate.y - island.y)
        < Math.hypot(nearest.x - island.x, nearest.y - island.y)
        ? candidate
        : nearest
    );
    return connectIslands(
      `${map.id}-outer-${index + 1}`,
      `${island.name} Link`,
      island,
      connectedIsland,
      115 + index * 5,
      bridgeStyle
    );
  });

  const translateStation = (station: NonNullable<BattleMapConfig['commandStationPositions']>['player']) => ({
    ...station,
    ...translatePoint(station),
    defensiveWeapons: station.defensiveWeapons?.map(weapon => ({ ...weapon, ...translatePoint(weapon) })),
  });

  return {
    ...map,
    dimensions: { width, height },
    obstacles: [...obstacles, ...outerIslands],
    bridges: [
      ...(map.bridges || []).map(bridge => ({
        ...bridge,
        x1: bridge.x1 + HORIZONTAL_EXPANSION,
        y1: bridge.y1 + VERTICAL_EXPANSION,
        x2: bridge.x2 + HORIZONTAL_EXPANSION,
        y2: bridge.y2 + VERTICAL_EXPANSION,
        points: bridge.points.map(translatePoint),
      })),
      ...outerBridges,
    ],
    roads: map.roads?.map(road => ({ ...road, points: road.points.map(translatePoint) })),
    spawnPoints: map.spawnPoints
      ? {
        playerLand: map.spawnPoints.playerLand.map(translatePoint),
        playerWater: map.spawnPoints.playerWater.map(translatePoint),
        enemyLand: map.spawnPoints.enemyLand.map(translatePoint),
        enemyWater: map.spawnPoints.enemyWater.map(translatePoint),
      }
      : undefined,
    commandStationPositions: map.commandStationPositions
      ? {
        player: translateStation(map.commandStationPositions.player),
        enemy: translateStation(map.commandStationPositions.enemy),
      }
      : undefined,
  };
};

export const MODE_2_MAPS: BattleMapConfig[] = BASE_MODE_2_MAPS.map(expandMode2Map);
