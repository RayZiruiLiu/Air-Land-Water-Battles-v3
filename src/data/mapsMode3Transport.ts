import { BattleIsland, BattleMapConfig } from '../types/ship';
import { connectIslands, createIslandEx } from './mapHelpers';

type IslandSpec = { x: number; y: number; rx: number; ry: number; shape: 'continent' | 'natural' | 'bastion' | 'skerry'; seed: number; name: string };
type ThemeSpec = {
  id: string; name: string; theme: string; description: string;
  islandStyle: 'sand' | 'ice' | 'volcano' | 'reef' | 'industrial';
  ambientWeather: 'clear' | 'snow' | 'magma' | 'storm';
  waterColors: BattleMapConfig['waterColors']; route: IslandSpec[];
  bridgeStyles: Array<'suspension' | 'truss' | 'concrete-highway' | 'timber-trestle' | 'arch-stone'>;
};

const buildMode3Map = (spec: ThemeSpec, mapIndex: number): BattleMapConfig => {
  const islands: BattleIsland[] = spec.route.map((land, index) => createIslandEx({
    ...land,
    style: spec.islandStyle,
    category: index === 0 || index === spec.route.length - 1 ? 'mainland' : undefined,
  }));
  const bridges = islands.slice(0, -1).map((island, index) => connectIslands(
    `m3-${mapIndex}-bridge-${index + 1}`, `${spec.theme} Route Span ${index + 1}`,
    island, islands[index + 1], 170, spec.bridgeStyles[index % spec.bridgeStyles.length],
  ));
  const startY = spec.route[0].y;
  const endY = spec.route[spec.route.length - 1].y;
  return {
    id: spec.id, name: spec.name, gameMode: 'transport-protection', theme: spec.theme,
    description: spec.description, dimensions: { width: 4800, height: 3200 },
    waterColors: spec.waterColors, islandStyle: spec.islandStyle, ambientWeather: spec.ambientWeather,
    // Both mainlands and the route endpoints continue beyond the chart; the
    // renderer crops their excess geometry at the playable boundary.
    convoyWaypoints: [
      { x: -150, y: startY },
      ...spec.route.slice(1, -1).map(({ x, y }) => ({ x, y })),
      { x: 4950, y: endY },
    ],
    destinationZone: { x: 4660, y: endY, radius: 190, label: 'EXTRACTION CORRIDOR' },
    spawnPoints: {
      playerLand: [
        { x: 120, y: startY - 400 }, { x: 170, y: startY + 400 },
        { x: 220, y: startY - 300 }, { x: 90, y: startY + 300 },
        { x: 130, y: startY - 500 }, { x: 190, y: startY + 500 },
        { x: 245, y: startY - 210 }, { x: 75, y: startY + 210 },
      ],
      playerWater: [
        { x: 520, y: Math.max(300, startY - 760) }, { x: 620, y: Math.min(2900, startY + 720) },
        { x: 880, y: Math.max(280, startY - 620) },
      ],
      enemyLand: [
        { x: 4560, y: endY - 190 }, { x: 4440, y: endY + 150 }, { x: 4650, y: endY - 20 },
      ],
      enemyWater: [
        { x: 4240, y: Math.max(280, endY - 760) }, { x: 4390, y: Math.min(2920, endY + 720) },
        { x: 3970, y: Math.min(2920, endY + 590) },
      ],
    },
    obstacles: islands, bridges,
  };
};

const THEMES: ThemeSpec[] = [
  {
    id: 'mode3-mediterranean-transit', name: 'Gibraltar Highway: Broken-Coast Transit', theme: 'Mediterranean Archipelago',
    description: 'An irregular coastal military road crosses mismatched limestone shelves before disappearing into the far eastern headland.',
    islandStyle: 'sand', ambientWeather: 'clear',
    waterColors: { deep: '#0d324d', mid: '#154e79', surface: '#1b6ca8', wave: 'rgba(255, 255, 255, 0.12)', boundary: 'rgba(27, 108, 168, 0.35)' },
    bridgeStyles: ['suspension', 'truss', 'concrete-highway'],
    route: [
      { x: -430, y: 2180, rx: 930, ry: 900, shape: 'continent', seed: 51.11, name: 'Tarifa Western Headland' },
      { x: 860, y: 1780, rx: 330, ry: 470, shape: 'natural', seed: 51.27, name: 'Caleta Crooked Shelf' },
      { x: 1600, y: 930, rx: 360, ry: 300, shape: 'skerry', seed: 51.43, name: 'Alboran High Rock' },
      { x: 2360, y: 1510, rx: 300, ry: 510, shape: 'bastion', seed: 51.68, name: 'Chafarinas Spur' },
      { x: 3140, y: 2370, rx: 430, ry: 320, shape: 'natural', seed: 51.91, name: 'Habibas Low Shelf' },
      { x: 3870, y: 1830, rx: 290, ry: 420, shape: 'skerry', seed: 52.14, name: 'Oran Gate Rock' },
      { x: 5250, y: 1210, rx: 1030, ry: 980, shape: 'continent', seed: 52.39, name: 'Eastern Oran Headland' },
    ],
  },
  {
    id: 'mode3-delta-causeway', name: 'Brahmaputra Crossing: Meandering Causeway', theme: 'Tropical River Delta',
    description: 'A wandering military causeway follows unrelated mangrove bars and broad river bends with no repeated alignment.',
    islandStyle: 'sand', ambientWeather: 'clear',
    waterColors: { deep: '#143828', mid: '#1d523b', surface: '#297353', wave: 'rgba(230, 255, 240, 0.1)', boundary: 'rgba(41, 115, 83, 0.35)' },
    bridgeStyles: ['timber-trestle', 'arch-stone', 'concrete-highway'],
    route: [
      { x: -390, y: 870, rx: 860, ry: 760, shape: 'continent', seed: 53.08, name: 'Padma Floodplain' },
      { x: 810, y: 1280, rx: 310, ry: 520, shape: 'natural', seed: 53.22, name: 'Char Kaliganj' },
      { x: 1430, y: 2310, rx: 390, ry: 310, shape: 'skerry', seed: 53.47, name: 'Lower Meghna Bar' },
      { x: 2240, y: 1940, rx: 280, ry: 450, shape: 'natural', seed: 53.63, name: 'Barisal Hook' },
      { x: 2940, y: 820, rx: 460, ry: 330, shape: 'natural', seed: 53.89, name: 'Noakhali Bend' },
      { x: 3790, y: 1390, rx: 340, ry: 510, shape: 'bastion', seed: 54.06, name: 'Feni Lock Island' },
      { x: 5220, y: 2250, rx: 1050, ry: 880, shape: 'continent', seed: 54.31, name: 'Chittagong East Bank' },
    ],
  },
  {
    id: 'mode3-arctic-highway', name: 'Nordkapp Ice Highway: Fractured Fjord Run', theme: 'Arctic Glacial Fjord',
    description: 'Uneven ice shelves force the convoy through a long, irregular sequence of offset cantilever spans.',
    islandStyle: 'ice', ambientWeather: 'snow',
    waterColors: { deep: '#0f2438', mid: '#183852', surface: '#234c6e', wave: 'rgba(220, 240, 255, 0.15)', boundary: 'rgba(70, 130, 180, 0.35)' },
    bridgeStyles: ['concrete-highway', 'truss', 'suspension'],
    route: [
      { x: -470, y: 2500, rx: 970, ry: 780, shape: 'continent', seed: 55.13, name: 'Nordkapp Ice Shelf' },
      { x: 900, y: 2200, rx: 360, ry: 280, shape: 'skerry', seed: 55.36, name: 'Mageroya Floe' },
      { x: 1510, y: 1210, rx: 300, ry: 500, shape: 'natural', seed: 55.51, name: 'Porsanger Needle' },
      { x: 2290, y: 650, rx: 440, ry: 270, shape: 'natural', seed: 55.77, name: 'Tana Ice Bar' },
      { x: 3040, y: 1580, rx: 320, ry: 560, shape: 'bastion', seed: 56.02, name: 'Varanger Rampart' },
      { x: 3880, y: 2320, rx: 410, ry: 300, shape: 'skerry', seed: 56.29, name: 'Kirkenes Outer Floe' },
      { x: 5290, y: 1740, rx: 1080, ry: 1020, shape: 'continent', seed: 56.48, name: 'Kirkenes Continental Ice' },
    ],
  },
  {
    id: 'mode3-volcano-ridge', name: 'Basalt Ridge: Caldera Freight Run', theme: 'Volcanic Ring Archipelago',
    description: 'A jagged logistics road crosses scattered basalt remnants and changes direction unpredictably around open calderas.',
    islandStyle: 'volcano', ambientWeather: 'magma',
    waterColors: { deep: '#1a181e', mid: '#2b232a', surface: '#3d3036', wave: 'rgba(255, 120, 50, 0.1)', boundary: 'rgba(180, 80, 40, 0.35)' },
    bridgeStyles: ['truss', 'concrete-highway', 'suspension'],
    route: [
      { x: -420, y: 1450, rx: 970, ry: 1050, shape: 'continent', seed: 57.12, name: 'Western Basalt Field' },
      { x: 890, y: 760, rx: 300, ry: 390, shape: 'bastion', seed: 57.39, name: 'Cinder Fang' },
      { x: 1550, y: 1680, rx: 440, ry: 290, shape: 'natural', seed: 57.56, name: 'Ashen Saddle' },
      { x: 2390, y: 2480, rx: 310, ry: 390, shape: 'skerry', seed: 57.81, name: 'South Vent Rock' },
      { x: 3100, y: 1320, rx: 390, ry: 520, shape: 'natural', seed: 58.04, name: 'Obsidian Hook' },
      { x: 3900, y: 1960, rx: 320, ry: 310, shape: 'bastion', seed: 58.27, name: 'Caldera Gate' },
      { x: 5260, y: 830, rx: 1030, ry: 900, shape: 'continent', seed: 58.49, name: 'Eastern Lava Plateau' },
    ],
  },
  {
    id: 'mode3-panama-isthmus', name: 'Continental Isthmus: Wild Canal Transit', theme: 'Tropical Jungle Isthmus',
    description: 'A broken jungle road threads irregular lock islands, forested shelves, and offset suspension crossings.',
    islandStyle: 'reef', ambientWeather: 'clear',
    waterColors: { deep: '#0c2e3b', mid: '#154555', surface: '#1f5f73', wave: 'rgba(180, 240, 230, 0.12)', boundary: 'rgba(31, 95, 115, 0.35)' },
    bridgeStyles: ['suspension', 'timber-trestle', 'arch-stone'],
    route: [
      { x: -440, y: 640, rx: 900, ry: 820, shape: 'continent', seed: 59.14, name: 'Pacific Jungle Bank' },
      { x: 850, y: 1120, rx: 360, ry: 300, shape: 'natural', seed: 59.31, name: 'Miraflores Shelf' },
      { x: 1450, y: 2220, rx: 290, ry: 490, shape: 'skerry', seed: 59.58, name: 'Pedro Miguel Spur' },
      { x: 2240, y: 1610, rx: 450, ry: 310, shape: 'natural', seed: 59.76, name: 'Gaillard Cut Island' },
      { x: 2980, y: 2520, rx: 300, ry: 330, shape: 'bastion', seed: 60.01, name: 'Gatun South Lock' },
      { x: 3760, y: 1160, rx: 410, ry: 530, shape: 'natural', seed: 60.24, name: 'Colon Forest Hook' },
      { x: 5240, y: 1900, rx: 1060, ry: 950, shape: 'continent', seed: 60.46, name: 'Atlantic Jungle Bank' },
    ],
  },
  {
    id: 'mode3-baltic-causeway', name: 'Iron Causeway: Broken Redoubt Route', theme: 'Baltic Iron Straits',
    description: 'A storm-battered freight route crosses unrelated fort islands and crooked concrete spans between two off-chart coasts.',
    islandStyle: 'industrial', ambientWeather: 'storm',
    waterColors: { deep: '#0b1f33', mid: '#122d4a', surface: '#1a3c61', wave: 'rgba(190, 220, 240, 0.14)', boundary: 'rgba(80, 110, 140, 0.4)' },
    bridgeStyles: ['concrete-highway', 'truss', 'arch-stone'],
    route: [
      { x: -460, y: 1920, rx: 930, ry: 980, shape: 'continent', seed: 61.09, name: 'Hanko Western Works' },
      { x: 820, y: 2470, rx: 330, ry: 280, shape: 'bastion', seed: 61.34, name: 'Minefield Redoubt' },
      { x: 1450, y: 1390, rx: 390, ry: 510, shape: 'natural', seed: 61.57, name: 'Gulf Signal Island' },
      { x: 2290, y: 760, rx: 310, ry: 330, shape: 'skerry', seed: 61.82, name: 'Iron Watch Rock' },
      { x: 2960, y: 1850, rx: 470, ry: 300, shape: 'bastion', seed: 62.05, name: 'Kotlin Gun Shelf' },
      { x: 3810, y: 2260, rx: 320, ry: 490, shape: 'natural', seed: 62.23, name: 'Neva Approach Spur' },
      { x: 5270, y: 1280, rx: 1070, ry: 1030, shape: 'continent', seed: 62.44, name: 'Eastern Fortress Coast' },
    ],
  },
];

export const MODE_3_MAPS: BattleMapConfig[] = THEMES.map(buildMode3Map);
