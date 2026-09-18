import { BattleState } from './battleEngine';
import { BattleBridge, BattleIsland, CommandStationEntity, DefensiveWeaponEntity, MapRoad, Particle, Projectile, ShipEntity } from '../types/ship';
import { COMPONENT_MAP } from '../data/components';

function normalizeAngle(a: number): number {
  let angle = a % (Math.PI * 2);
  if (angle > Math.PI) angle -= Math.PI * 2;
  else if (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function renderBattle(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  viewportWidth: number,
  viewportHeight: number
) {
  // Clear screen
  ctx.save();
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Setup Camera Transform (centered on camera x, y)
  const camX = state.camera.x;
  const camY = state.camera.y;
  const zoom = state.camera.zoom;

  ctx.translate(viewportWidth / 2, viewportHeight / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  // 1. Draw Ocean Background according to current map theme
  drawOcean(ctx, state.arenaWidth, state.arenaHeight, state.time, state.mapConfig);

  // 2. Draw Islands / Map Landmasses
  // Objective-mode coastal landmasses deliberately continue past an arena edge. Keep
  // their rendered coastlines inside the playable chart.
  const clipBoundaryLand = state.gameMode === 'command-station'
    || state.gameMode === 'transport-protection'
    || state.gameMode === 'amphibious-assault';
  if (clipBoundaryLand) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.arenaWidth, state.arenaHeight);
    ctx.clip();
  }
  for (const island of state.islands) {
    drawIsland(ctx, island);
  }
  for (const road of state.mapConfig.roads || []) {
    drawMapRoad(ctx, road);
  }
  if (clipBoundaryLand) ctx.restore();

  // 2.5 Draw Mission Objectives (Waypoints, Extraction Zone, Beachhead)
  if (state.gameMode === 'transport-protection') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.arenaWidth, state.arenaHeight);
    ctx.clip();
  }
  drawMissionObjectives(ctx, state);
  if (state.gameMode === 'transport-protection') ctx.restore();

  // 3. Draw Water Ripples
  for (const ripple of state.ripples) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(186, 230, 253, ${ripple.alpha * 0.7})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Draw Water Warships (Sailing in water channels, passing underneath bridge decks)
  const waterVehicles = state.ships.filter(s => s.domain === 'water');
  for (const vehicle of waterVehicles) {
    drawWaterShip(ctx, vehicle, state.time);
  }

  // 5. Draw Bridges (Connecting landmasses across water channels)
  if (clipBoundaryLand) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.arenaWidth, state.arenaHeight);
    ctx.clip();
  }
  if (state.bridges) {
    for (const bridge of state.bridges) {
      drawBridge(ctx, bridge, state.time);
    }
  }
  if (clipBoundaryLand) ctx.restore();

  // Mode 3 objective overlays sit over every terrain layer, but underneath vehicles.
  drawExtractionZoneIndicator(ctx, state);
  drawConvoyTargetIndicator(ctx, state);
  redrawWaterVehiclesAboveMode3Objectives(ctx, state, waterVehicles);

  // 6. Draw Land Combat Vehicles (Tanks, IFVs, SPAAGs driving over land & bridges)
  const landVehicles = state.ships.filter(s => s.domain === 'land');
  // The Mode 3 route continues beyond the authored map so the lead escort can clear
  // the extraction zone. Clip vehicles at the playable boundary as they drive out.
  if (state.gameMode === 'transport-protection') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.arenaWidth, state.arenaHeight);
    ctx.clip();
  }
  for (const vehicle of landVehicles) {
    drawLandVehicle(ctx, vehicle, state.time);
  }
  if (state.gameMode === 'transport-protection') ctx.restore();

  // 6.5 Draw Command Stations & Fortresses (Modes 2 & 4)
  if (state.commandStations) {
    for (const station of state.commandStations) {
      drawCommandStation(ctx, station, state.time);
    }
  }

  // 6.6 Draw Standalone Defensive Weapons (Mode 2 Bunkers, Missile Silos, Flak Towers)
  if (state.defensiveWeapons) {
    for (const weapon of state.defensiveWeapons) {
      drawDefensiveWeapon(ctx, weapon, state.time);
    }
  }

  // 7. Draw Particles (exhaust, wake, sparks, smoke, plasma)
  drawParticles(ctx, state.particles);

  // 8. Draw High-Altitude Aircraft (Fly above all terrain, bridges, and surface units)
  const airVehicles = state.ships.filter(s => s.domain === 'air');
  for (const aircraft of airVehicles) {
    drawAirVehicle(ctx, aircraft, state.time);
  }

  // 9. Draw Projectiles (missiles, railgun slugs, shells, torpedoes, flak)
  for (const proj of state.projectiles) {
    drawProjectile(ctx, proj);
  }

  // 7. Draw Player Crosshair & Weapon Arc Aids
  const player = state.ships.find(s => s.id === state.playerShipId);
  if (player && !player.isSunk) {
    drawPlayerReticle(ctx, player, state.mouseWorldPos);
  }

  ctx.restore();
}

function drawOcean(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  mapConfig: BattleState['mapConfig']
) {
  const colors = mapConfig?.waterColors || {
    deep: '#102231',
    mid: '#173347',
    surface: '#20455e',
    wave: 'rgba(215, 230, 245, 0.09)',
    boundary: 'rgba(125, 145, 165, 0.28)',
  };
  const weather = mapConfig?.ambientWeather || 'clear';

  // Grounded deep ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, width, height);
  oceanGrad.addColorStop(0, colors.deep);
  oceanGrad.addColorStop(0.5, colors.mid);
  oceanGrad.addColorStop(1, colors.surface);
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Environmental Layering & Subtle Surface Dynamics based on Map Theme
  if (weather === 'magma') {
    // 1. Volcanic basalt seafloor with subtle dark mineral vents
    ctx.save();
    ctx.lineWidth = 2.5;
    const ventCount = 6;
    for (let f = 0; f < ventCount; f++) {
      const startX = (f * 420 + 150) % width;
      const startY = (f * 280 + 120) % height;
      ctx.strokeStyle = 'rgba(78, 68, 60, 0.35)';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        startX + 140,
        startY + 60,
        startX + 240,
        startY - 30,
        startX + 360,
        startY + 80
      );
      ctx.stroke();
    }
    ctx.restore();
  } else if (weather === 'storm') {
    // 2. Realistic Storm with slanted rain cascades and natural whitecaps
    ctx.save();
    // Atmospheric overcast ambient flash (subtle, occasional)
    const lightning = Math.sin(time * 0.65) > 0.988 && Math.sin(time * 4) > 0.6;
    if (lightning) {
      ctx.fillStyle = 'rgba(224, 235, 245, 0.08)';
      ctx.fillRect(0, 0, width, height);
    }
    // Realistic slanted rain streaks
    ctx.strokeStyle = 'rgba(195, 215, 230, 0.16)';
    ctx.lineWidth = 1.0;
    const rainColumns = 36;
    for (let r = 0; r < rainColumns; r++) {
      const rx = (r * 80 + time * 320) % width;
      for (let ry = 0; ry < height; ry += 130) {
        const yOff = (ry + (time * 900 + r * 28)) % height;
        ctx.beginPath();
        ctx.moveTo(rx, yOff);
        ctx.lineTo(rx + 16, yOff + 32);
        ctx.stroke();
      }
    }
    // Natural breaking foam wave crests
    ctx.strokeStyle = 'rgba(235, 245, 255, 0.14)';
    ctx.lineWidth = 1.8;
    for (let sw = 0; sw < width; sw += 160) {
      const waveY = (sw * 0.7 + time * 50) % height;
      ctx.beginPath();
      ctx.arc(sw, waveY, 18, 0, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  } else if (weather === 'snow') {
    // 3. Realistic Arctic Skerries with natural ice floes & soft snow flurries
    ctx.save();
    // Drifting pack ice floes on water surface
    ctx.fillStyle = 'rgba(225, 235, 245, 0.20)';
    ctx.strokeStyle = 'rgba(175, 195, 210, 0.35)';
    ctx.lineWidth = 1.2;
    for (let f = 0; f < 20; f++) {
      const floeX = (f * 140 + Math.sin(time * 0.08 + f) * 35) % width;
      const floeY = (f * 105 + Math.cos(time * 0.08 + f) * 25) % height;
      ctx.beginPath();
      ctx.moveTo(floeX, floeY);
      ctx.lineTo(floeX + 32, floeY - 10);
      ctx.lineTo(floeX + 46, floeY + 14);
      ctx.lineTo(floeX + 16, floeY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Natural soft snow flurries
    ctx.fillStyle = 'rgba(245, 250, 255, 0.55)';
    for (let s = 0; s < 50; s++) {
      const sx = (Math.sin(s * 13.7) * 9000 + time * 35) % width;
      const sy = (Math.cos(s * 27.1) * 9000 + time * 60) % height;
      ctx.beginPath();
      ctx.arc(sx < 0 ? sx + width : sx, sy < 0 ? sy + height : sy, 1.2 + (s % 2) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (weather === 'harbor') {
    // 4. Grounded Maritime Fairway with soft depth contour soundings
    ctx.save();
    // Dredged navigation channel centerline
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([18, 18]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    // Hydrographic depth contour lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    for (let d = 160; d < height; d += 240) {
      ctx.beginPath();
      ctx.moveTo(0, d);
      ctx.lineTo(width, d);
      ctx.stroke();
    }
    ctx.restore();
  } else if (weather === 'dusk') {
    // 5. Natural Coastal Twilight with gentle water surface shimmer
    ctx.save();
    ctx.strokeStyle = 'rgba(215, 225, 240, 0.06)';
    ctx.lineWidth = 1.4;
    for (let w = 0; w < width; w += 150) {
      const wy = (w * 0.5 + time * 25) % height;
      ctx.beginPath();
      ctx.arc(w, wy, 24, 0, Math.PI * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // 6. Natural Daylight Open Sea with gentle wave ripples
    ctx.save();
    ctx.strokeStyle = 'rgba(235, 245, 255, 0.07)';
    ctx.lineWidth = 1.4;
    for (let c = 0; c < width; c += 140) {
      ctx.beginPath();
      for (let cy = 0; cy < height; cy += 45) {
        const offset = Math.sin(c * 0.015 + cy * 0.02 + time * 0.9) * 10;
        if (cy === 0) ctx.moveTo(c + offset, cy);
        else ctx.lineTo(c + offset, cy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Grounded Nautical Chart Perimeter Frame
  ctx.strokeStyle = colors.boundary || 'rgba(125, 145, 165, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Secondary fine inner chart border line
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // Subtle Navigational Chart Grid (soft, non-distracting)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
  ctx.lineWidth = 1;
  const gridSpacing = 200;

  for (let x = gridSpacing; x < width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x, height - 40);
    ctx.stroke();
  }
  for (let y = gridSpacing; y < height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width - 40, y);
    ctx.stroke();
  }

  // Refined nautical chart coordinate tick marks along the borders
  ctx.strokeStyle = 'rgba(175, 190, 205, 0.18)';
  ctx.lineWidth = 1.2;
  for (let x = gridSpacing; x < width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 26);
    ctx.lineTo(x, 34);
    ctx.moveTo(x, height - 34);
    ctx.lineTo(x, height - 26);
    ctx.stroke();
  }
  for (let y = gridSpacing; y < height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(26, y);
    ctx.lineTo(34, y);
    ctx.moveTo(width - 34, y);
    ctx.lineTo(width - 26, y);
    ctx.stroke();
  }
}

function drawIsland(ctx: CanvasRenderingContext2D, island: BattleIsland) {
  ctx.save();
  const style = island.style || 'sand';

  if (style === 'harbor') {
    // Fortified Military Concrete Bunker & Blast Wall Barrier
    // Foundation berm
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Reinforced concrete slab
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // Hazard yellow/black warning perimeter stripes
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central bunker blast door & observation slits
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(island.x, island.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (style === 'ice') {
    // Arctic Frozen Permafrost Ridge & Ice Berm
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.25)';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Weathered arctic ice shelf
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#dbe4ee';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Frost crack lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < island.points.length; i += 2) {
      const pt = island.points[i];
      ctx.beginPath();
      ctx.moveTo(island.x, island.y);
      ctx.lineTo(island.x + (pt.x - island.x) * 0.85, island.y + (pt.y - island.y) * 0.85);
      ctx.stroke();
    }
  } else if (style === 'rock' || style === 'volcano') {
    // Desert Sandstone Escarpment / Dark Basalt Ridge
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.lineWidth = 16;
    ctx.strokeStyle = style === 'volcano' ? 'rgba(38, 35, 32, 0.6)' : 'rgba(87, 83, 78, 0.35)';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Escarpment body
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = style === 'volcano' ? '#262320' : '#332e29';
    ctx.strokeStyle = style === 'volcano' ? '#44403c' : '#57534e';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    if (style === 'volcano') {
      // Dark cooled basalt fissures
      ctx.strokeStyle = '#38332e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      island.points.forEach((pt, idx) => {
        const vx = island.x + (pt.x - island.x) * 0.55;
        const vy = island.y + (pt.y - island.y) * 0.55;
        if (idx === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      });
      ctx.closePath();
      ctx.stroke();
    }
  } else if (style === 'industrial') {
    // Heavy Industrial Naval Shipyard & Fortified Drydock Pier
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // Reinforced industrial asphalt & concrete slab
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#222831';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Industrial tarmac loading bay markings
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      const px = island.x + (pt.x - island.x) * 0.72;
      const py = island.y + (pt.y - island.y) * 0.72;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (style === 'reef') {
    // Grounded Coastal Shoal & Sandbar Lagoon
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.lineWidth = 20;
    ctx.strokeStyle = 'rgba(135, 165, 175, 0.25)';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Natural coastal sand dune body
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#c9beaa';
    ctx.strokeStyle = '#9c8f78';
    ctx.lineWidth = 2.0;
    ctx.fill();
    ctx.stroke();

    // Tropical coastal scrub inner crown
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      const innerX = island.x + (pt.x - island.x) * 0.65;
      const innerY = island.y + (pt.y - island.y) * 0.65;
      if (idx === 0) ctx.moveTo(innerX, innerY);
      else ctx.lineTo(innerX, innerY);
    });
    ctx.closePath();
    ctx.fillStyle = '#3a4e32';
    ctx.fill();
  } else {
    // Woodland Earth Rampart & Boulder Redoubt
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(40, 52, 33, 0.35)';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Earthen rim
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#4a4034';
    ctx.strokeStyle = '#5a4f40';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Natural woodland vegetation interior
    ctx.beginPath();
    island.points.forEach((pt, idx) => {
      const innerX = island.x + (pt.x - island.x) * 0.75;
      const innerY = island.y + (pt.y - island.y) * 0.75;
      if (idx === 0) ctx.moveTo(innerX, innerY);
      else ctx.lineTo(innerX, innerY);
    });
    ctx.closePath();
    ctx.fillStyle = '#2f3e28';
    ctx.fill();
  }

  // Foliage / tactical obstacles (sandbags, bunkers, antennas, radar dishes, cranes, buildings)
  for (const f of island.foliage) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();

    if (f.type === 'buoy' || f.type === 'tower') {
      // Beacon tower warning light
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    } else if (f.type === 'crane') {
      // Shipyard gantry crane boom
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x - f.radius, f.y);
      ctx.lineTo(f.x + f.radius * 1.8, f.y - f.radius * 0.8);
      ctx.stroke();
      ctx.fillStyle = '#b45309';
      ctx.fillRect(f.x - 4, f.y - 4, 8, 8);
      ctx.restore();
    } else if (f.type === 'radar') {
      // Radar antenna disc
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 1.1, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === 'building' || f.type === 'bunker') {
      // Fortified bunker embrasures
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(f.x - f.radius * 0.4, f.y - f.radius * 0.4, f.radius * 0.8, f.radius * 0.8);
    }
  }

  // Internal Canals & Waterways (if island features engineered canals or rivers)
  if (island.canals && island.canals.length > 0) {
    for (const canal of island.canals) {
      ctx.save();
      if (canal.points && canal.points.length > 2) {
        // Concrete canal banks
        ctx.beginPath();
        canal.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        // Canal water channel
        ctx.beginPath();
        canal.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fillStyle = canal.waterColor || '#122e40';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Linear canal line
        ctx.beginPath();
        ctx.moveTo(canal.x1, canal.y1);
        ctx.lineTo(canal.x2, canal.y2);
        ctx.lineWidth = canal.width + 12;
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(canal.x1, canal.y1);
        ctx.lineTo(canal.x2, canal.y2);
        ctx.lineWidth = canal.width;
        ctx.strokeStyle = canal.waterColor || '#0c4a6e';
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Scenic Inland Lakes / Lagoons (if island features one or more embedded lake basins)
  const allLakes = [
    ...(island.lake ? [island.lake] : []),
    ...(island.lakes || []),
  ];

  for (const lk of allLakes) {
    ctx.save();
    // Sandy / rocky lake shoreline ring
    ctx.save();
    ctx.beginPath();
    if (lk.points && lk.points.length > 2) {
      lk.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
    } else {
      ctx.ellipse(lk.x, lk.y, lk.radiusX + 12, lk.radiusY + 12, 0, 0, Math.PI * 2);
    }
    ctx.lineWidth = 14;
    ctx.strokeStyle = style === 'ice' ? '#bae6fd' : style === 'volcano' ? '#44403c' : style === 'industrial' ? '#475569' : '#d4b483';
    ctx.stroke();
    ctx.restore();

    // Lake water body
    ctx.beginPath();
    if (lk.points && lk.points.length > 2) {
      lk.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
    } else {
      ctx.ellipse(lk.x, lk.y, lk.radiusX, lk.radiusY, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = lk.waterColor || (style === 'ice' ? '#14344d' : style === 'volcano' ? '#18181b' : '#143852');
    ctx.fill();
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Concentric calm ripples in the lake center
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(lk.x, lk.y, lk.radiusX * 0.45, lk.radiusY * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawMapRoad(ctx: CanvasRenderingContext2D, road: MapRoad) {
  if (road.points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(road.points[0].x, road.points[0].y);
    for (let i = 1; i < road.points.length; i++) ctx.lineTo(road.points[i].x, road.points[i].y);
  };

  trace();
  ctx.strokeStyle = 'rgba(12, 16, 18, 0.88)';
  ctx.lineWidth = road.width + 10;
  ctx.stroke();

  trace();
  ctx.strokeStyle = road.style === 'dirt' ? '#655642' : road.style === 'highway' ? '#3f4650' : '#4a4b43';
  ctx.lineWidth = road.width;
  ctx.stroke();

  trace();
  ctx.strokeStyle = road.style === 'dirt' ? 'rgba(214, 190, 138, 0.55)' : 'rgba(250, 204, 21, 0.72)';
  ctx.lineWidth = 2;
  ctx.setLineDash(road.style === 'dirt' ? [5, 12] : [18, 14]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBridge(ctx: CanvasRenderingContext2D, bridge: BattleBridge, time: number) {
  if (!bridge || !bridge.points || bridge.points.length < 4) return;
  ctx.save();

  const style = bridge.style || 'suspension';
  const spanDx = bridge.x2 - bridge.x1;
  const spanDy = bridge.y2 - bridge.y1;
  const len = Math.max(1, Math.hypot(spanDx, spanDy));
  const nx = -spanDy / len;
  const ny = spanDx / len;
  const hw = bridge.width * 0.5;

  // 1. Cast realistic shadow of elevated bridge deck onto the water surface
  ctx.save();
  ctx.beginPath();
  bridge.points.forEach((pt, idx) => {
    if (idx === 0) ctx.moveTo(pt.x + 16, pt.y + 16);
    else ctx.lineTo(pt.x + 16, pt.y + 16);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
  ctx.fill();
  ctx.restore();

  // 2. Piers / Pylons in the water channel beneath
  if (style === 'arch-stone') {
    // Massive cut-stone masonry piers with triangular cutwaters
    const pierSteps = [0.25, 0.5, 0.75];
    for (const t of pierSteps) {
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.save();
      ctx.fillStyle = '#292524';
      ctx.strokeStyle = '#57534e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Elliptical cutwater pier aligned with water flow
      ctx.ellipse(px, py, bridge.width * 0.52, bridge.width * 0.32, Math.atan2(spanDy, spanDx) + Math.PI * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (style === 'timber-trestle') {
    // Wooden pile bents (groups of wooden pilings with cross-bracing)
    const bents = 5;
    for (let i = 1; i < bents; i++) {
      const t = i / bents;
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.save();
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px + nx * (hw * 0.9), py + ny * (hw * 0.9));
      ctx.lineTo(px - nx * (hw * 0.9), py - ny * (hw * 0.9));
      ctx.stroke();

      ctx.fillStyle = '#4e342e';
      for (const side of [-0.7, 0, 0.7]) {
        ctx.beginPath();
        ctx.arc(px + nx * (hw * side), py + ny * (hw * side), 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (style === 'military-pontoon') {
    // Floating pontoon barges along both sides of the roadway
    const pontoons = Math.max(4, Math.floor(len / 70));
    for (let i = 0; i <= pontoons; i++) {
      const t = i / pontoons;
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.save();
      ctx.fillStyle = '#14281d';
      ctx.strokeStyle = '#36533c';
      ctx.lineWidth = 2.5;

      for (const side of [1, -1]) {
        const cx = px + nx * (hw * 0.95 * side);
        const cy = py + ny * (hw * 0.95 * side);
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Water wake ring around pontoon
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, 18 + Math.sin(time * 3 + i) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else {
    // Standard concrete support piers
    const pierPositions = [0.3, 0.5, 0.7];
    for (const t of pierPositions) {
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, bridge.width * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, bridge.width * 0.54 + Math.sin(time * 2 + t * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Roadway Deck Base Fill (Style-specific materials)
  ctx.save();
  ctx.beginPath();
  bridge.points.forEach((pt, idx) => {
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();

  if (style === 'arch-stone') {
    ctx.fillStyle = '#44403c'; // Weathered Roman / Nordic cut stone
  } else if (style === 'timber-trestle') {
    ctx.fillStyle = '#5c3d2e'; // Warm dark wood timber
  } else if (style === 'military-pontoon') {
    ctx.fillStyle = '#1e382b'; // Tactical olive drab anti-skid steel grating
  } else if (style === 'cable-stayed') {
    ctx.fillStyle = '#334155'; // Modern sleek concrete deck
  } else if (style === 'truss') {
    ctx.fillStyle = '#0f172a'; // Heavy industrial steel plate
  } else if (style === 'drawbridge') {
    ctx.fillStyle = '#1e293b'; // Steel roadway
  } else {
    ctx.fillStyle = '#1e293b'; // Standard asphalt
  }
  ctx.fill();

  // Edge structural borders
  ctx.strokeStyle =
    style === 'arch-stone'
      ? '#78716c'
      : style === 'timber-trestle'
      ? '#3e2723'
      : style === 'military-pontoon'
      ? '#4d7c58'
      : style === 'cable-stayed'
      ? '#0284c7'
      : '#475569';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 4. Deck Surface Textures & Markings
  if (style === 'timber-trestle') {
    // Horizontal wooden plank seams
    ctx.save();
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.5;
    const planks = Math.floor(len / 18);
    for (let i = 0; i <= planks; i++) {
      const t = i / planks;
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.beginPath();
      ctx.moveTo(px + nx * (hw * 0.88), py + ny * (hw * 0.88));
      ctx.lineTo(px - nx * (hw * 0.88), py - ny * (hw * 0.88));
      ctx.stroke();
    }
    // Wooden guard logs
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bridge.x1 + nx * (hw * 0.85), bridge.y1 + ny * (hw * 0.85));
    ctx.lineTo(bridge.x2 + nx * (hw * 0.85), bridge.y2 + ny * (hw * 0.85));
    ctx.moveTo(bridge.x1 - nx * (hw * 0.85), bridge.y1 - ny * (hw * 0.85));
    ctx.lineTo(bridge.x2 - nx * (hw * 0.85), bridge.y2 - ny * (hw * 0.85));
    ctx.stroke();
    ctx.restore();
  } else if (style === 'arch-stone') {
    // Stone masonry pavers
    ctx.save();
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.2;
    const stones = Math.floor(len / 26);
    for (let i = 0; i <= stones; i++) {
      const t = i / stones;
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.beginPath();
      ctx.moveTo(px + nx * (hw * 0.82), py + ny * (hw * 0.82));
      ctx.lineTo(px - nx * (hw * 0.82), py - ny * (hw * 0.82));
      ctx.stroke();
    }
    // Heavy stone parapet walls
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bridge.x1 + nx * (hw * 0.88), bridge.y1 + ny * (hw * 0.88));
    ctx.lineTo(bridge.x2 + nx * (hw * 0.88), bridge.y2 + ny * (hw * 0.88));
    ctx.moveTo(bridge.x1 - nx * (hw * 0.88), bridge.y1 - ny * (hw * 0.88));
    ctx.lineTo(bridge.x2 - nx * (hw * 0.88), bridge.y2 - ny * (hw * 0.88));
    ctx.stroke();
    ctx.restore();
  } else if (style === 'military-pontoon') {
    // Tactical tire guide curbs and chevron lane striping
    ctx.save();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(bridge.x1, bridge.y1);
    ctx.lineTo(bridge.x2, bridge.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Rubber expansion couplers
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 4;
    const couplers = Math.floor(len / 70);
    for (let i = 1; i < couplers; i++) {
      const t = i / couplers;
      const px = bridge.x1 + spanDx * t;
      const py = bridge.y1 + spanDy * t;
      ctx.beginPath();
      ctx.moveTo(px + nx * (hw * 0.9), py + ny * (hw * 0.9));
      ctx.lineTo(px - nx * (hw * 0.9), py - ny * (hw * 0.9));
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // Highway road lanes: white boundary lanes and double yellow center lines
    ctx.save();
    const edgeOffset = hw * 0.82;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bridge.x1 + nx * edgeOffset, bridge.y1 + ny * edgeOffset);
    ctx.lineTo(bridge.x2 + nx * edgeOffset, bridge.y2 + ny * edgeOffset);
    ctx.moveTo(bridge.x1 - nx * edgeOffset, bridge.y1 - ny * edgeOffset);
    ctx.lineTo(bridge.x2 - nx * edgeOffset, bridge.y2 - ny * edgeOffset);
    ctx.stroke();

    // Double yellow center lines
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    const centerOffset = 3;
    ctx.beginPath();
    ctx.moveTo(bridge.x1 + nx * centerOffset, bridge.y1 + ny * centerOffset);
    ctx.lineTo(bridge.x2 + nx * centerOffset, bridge.y2 + ny * centerOffset);
    ctx.moveTo(bridge.x1 - nx * centerOffset, bridge.y1 - ny * centerOffset);
    ctx.lineTo(bridge.x2 - nx * centerOffset, bridge.y2 - ny * centerOffset);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 5. Distinct Superstructures (Suspension, Cable-Stayed, Truss, Drawbridge, Highway)
  if (style === 'suspension') {
    // Twin Suspension Towers
    for (const t of [0.28, 0.72]) {
      const tx = bridge.x1 + spanDx * t;
      const ty = bridge.y1 + spanDy * t;
      const towerWidth = hw * 1.25;

      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3.5;

      // Cross portal beam
      ctx.beginPath();
      ctx.moveTo(tx + nx * towerWidth, ty + ny * towerWidth);
      ctx.lineTo(tx - nx * towerWidth, ty - ny * towerWidth);
      ctx.stroke();

      // Pylon caps
      ctx.beginPath();
      ctx.arc(tx + nx * towerWidth, ty + ny * towerWidth, 8, 0, Math.PI * 2);
      ctx.arc(tx - nx * towerWidth, ty - ny * towerWidth, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Red flashing aviation warning beacon
      const flash = Math.sin(time * 4) > 0.3 ? 1 : 0.2;
      ctx.fillStyle = `rgba(239, 68, 68, ${flash})`;
      ctx.beginPath();
      ctx.arc(tx + nx * towerWidth, ty + ny * towerWidth, 4.5, 0, Math.PI * 2);
      ctx.arc(tx - nx * towerWidth, ty - ny * towerWidth, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Parabolic main suspension cables with vertical dropper suspenders
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.lineWidth = 2.5;
    for (const side of [1, -1]) {
      const sideOffset = hw * 1.05 * side;
      ctx.beginPath();
      ctx.moveTo(bridge.x1 + nx * sideOffset, bridge.y1 + ny * sideOffset);
      const midX = (bridge.x1 + bridge.x2) * 0.5;
      const midY = (bridge.y1 + bridge.y2) * 0.5;
      ctx.quadraticCurveTo(
        midX + nx * (hw * 0.45 * side),
        midY + ny * (hw * 0.45 * side),
        bridge.x2 + nx * sideOffset,
        bridge.y2 + ny * sideOffset
      );
      ctx.stroke();

      // Vertical hanger suspenders
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      for (let s = 1; s < 16; s++) {
        const st = s / 16;
        const px = bridge.x1 + spanDx * st;
        const py = bridge.y1 + spanDy * st;
        const cableOffset = hw * (0.45 + 0.6 * Math.pow((st - 0.5) * 2, 2)) * side;
        ctx.beginPath();
        ctx.moveTo(px + nx * cableOffset, py + ny * cableOffset);
        ctx.lineTo(px + nx * (hw * 0.9 * side), py + ny * (hw * 0.9 * side));
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (style === 'cable-stayed') {
    // Modern Sleek Cable-Stayed Bridge: Tall Central Diamond Pylon with Fan Cables
    const midX = (bridge.x1 + bridge.x2) * 0.5;
    const midY = (bridge.y1 + bridge.y2) * 0.5;
    const pylonW = hw * 1.35;

    ctx.save();
    // Central Concrete Pylon Tower
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(midX + nx * pylonW, midY + ny * pylonW);
    ctx.lineTo(midX - nx * pylonW, midY - ny * pylonW);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX + nx * pylonW, midY + ny * pylonW, 7, 0, Math.PI * 2);
    ctx.arc(midX - nx * pylonW, midY - ny * pylonW, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Red Navigational Beacon
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(midX + nx * pylonW, midY + ny * pylonW, 3.5, 0, Math.PI * 2);
    ctx.arc(midX - nx * pylonW, midY - ny * pylonW, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Radiant fan stay cables (galvanized steel)
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.lineWidth = 1.6;
    for (const side of [1, -1]) {
      const pylonPtX = midX + nx * (pylonW * side);
      const pylonPtY = midY + ny * (pylonW * side);

      for (let s = 1; s <= 7; s++) {
        const offsetRatio = (s / 8) * 0.45;
        // Left fan cables
        const lx = bridge.x1 + spanDx * (0.5 - offsetRatio);
        const ly = bridge.y1 + spanDy * (0.5 - offsetRatio);
        ctx.beginPath();
        ctx.moveTo(pylonPtX, pylonPtY);
        ctx.lineTo(lx + nx * (hw * 0.9 * side), ly + ny * (hw * 0.9 * side));
        ctx.stroke();

        // Right fan cables
        const rx = bridge.x1 + spanDx * (0.5 + offsetRatio);
        const ry = bridge.y1 + spanDy * (0.5 + offsetRatio);
        ctx.beginPath();
        ctx.moveTo(pylonPtX, pylonPtY);
        ctx.lineTo(rx + nx * (hw * 0.9 * side), ry + ny * (hw * 0.9 * side));
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (style === 'truss') {
    // Steel Pratt/Warren Through-Truss Lattice Framework
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    const steps = Math.max(10, Math.floor(len / 60));
    for (let i = 0; i < steps; i++) {
      const t1 = i / steps;
      const t2 = (i + 1) / steps;
      const px1 = bridge.x1 + spanDx * t1;
      const py1 = bridge.y1 + spanDy * t1;
      const px2 = bridge.x1 + spanDx * t2;
      const py2 = bridge.y1 + spanDy * t2;

      // Outer chord girders
      ctx.beginPath();
      ctx.moveTo(px1 + nx * hw, py1 + ny * hw);
      ctx.lineTo(px2 + nx * hw, py2 + ny * hw);
      ctx.moveTo(px1 - nx * hw, py1 - ny * hw);
      ctx.lineTo(px2 - nx * hw, py2 - ny * hw);

      // Diagonal cross-lattice struts
      ctx.moveTo(px1 + nx * hw, py1 + ny * hw);
      ctx.lineTo(px2 + nx * (hw - 12), py2 + ny * (hw - 12));
      ctx.moveTo(px1 - nx * hw, py1 - ny * hw);
      ctx.lineTo(px2 - nx * (hw - 12), py2 - ny * (hw - 12));
      ctx.stroke();

      // Overhead cross portal beam every 2 steps
      if (i % 2 === 0) {
        ctx.save();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px1 + nx * hw, py1 + ny * hw);
        ctx.lineTo(px1 - nx * hw, py1 - ny * hw);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  } else if (style === 'drawbridge') {
    // Bascule Drawbridge: Counterweight Machinery Towers & Center Break Line
    const midX = (bridge.x1 + bridge.x2) * 0.5;
    const midY = (bridge.y1 + bridge.y2) * 0.5;

    ctx.save();
    // Center openable seam
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(midX + nx * hw, midY + ny * hw);
    ctx.lineTo(midX - nx * hw, midY - ny * hw);
    ctx.stroke();
    ctx.setLineDash([]);

    // Twin Machinery Control Cabins on both sides of center
    for (const side of [1, -1]) {
      const cx = midX + nx * (hw * 1.15 * side);
      const cy = midY + ny * (hw * 1.15 * side);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.fillRect(cx - 10, cy - 10, 20, 20);
      ctx.strokeRect(cx - 10, cy - 10, 20, 20);

      // Flashing maritime red warning lamp
      const flash = Math.sin(time * 5) > 0 ? 1 : 0.25;
      ctx.fillStyle = `rgba(239, 68, 68, ${flash})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (style === 'concrete-highway') {
    // Modern Highway Viaduct: Center Jersey Barrier & Streetlight Luminaires
    ctx.save();
    // Central concrete median barrier
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(bridge.x1, bridge.y1);
    ctx.lineTo(bridge.x2, bridge.y2);
    ctx.stroke();

    // Streetlamp poles with warm illumination
    const lamps = Math.max(3, Math.floor(len / 140));
    for (let i = 1; i < lamps; i++) {
      const t = i / lamps;
      const lx = bridge.x1 + spanDx * t;
      const ly = bridge.y1 + spanDy * t;
      for (const side of [1, -1]) {
        const px = lx + nx * (hw * 0.95 * side);
        const py = ly + ny * (hw * 0.95 * side);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Warm white streetlight cone
        ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 6. High-Visibility Bridgehead Ramp Striping (Ensures clearly visible entry ramp boundaries)
  ctx.save();
  ctx.strokeStyle = style === 'arch-stone' ? '#a8a29e' : '#eab308';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(bridge.points[0].x, bridge.points[0].y);
  ctx.lineTo(bridge.points[bridge.points.length - 1].x, bridge.points[bridge.points.length - 1].y);
  const midIdx = Math.floor(bridge.points.length / 2);
  ctx.moveTo(bridge.points[midIdx - 1].x, bridge.points[midIdx - 1].y);
  ctx.lineTo(bridge.points[midIdx].x, bridge.points[midIdx].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.restore();
}

function drawLandVehicle(
  ctx: CanvasRenderingContext2D,
  vehicle: ShipEntity,
  time: number
) {
  // Render towed trailer first (under vehicle tow hitch)
  if (vehicle.towedTrailer) {
    drawTrailer(ctx, vehicle, time);
  }

  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle);

  const length = vehicle.model.hullLength;
  const width = vehicle.model.hullWidth;
  const halfL = length * 0.5;
  const halfW = width * 0.5;
  const chassis = vehicle.model.chassisType || 'tracked';
  const bodyStyle = vehicle.model.spriteStyle.bodyStyle || 'tank';
  const isArticulatedSemi = bodyStyle === 'semi-sam' || bodyStyle === 'convoy-semi';
  const articulationPivotX = bodyStyle === 'convoy-semi' ? halfL * 0.30 : halfL * 0.18;

  // Wrecked / Destroyed vehicle visual
  if (vehicle.isSunk) {
    ctx.globalAlpha = Math.max(0.2, 1 - vehicle.sinkProgress * 0.7);
    ctx.rotate(vehicle.sinkProgress * 0.15);
  }

  // 1. Vehicle ground contact shadow (tightly follows each vehicle's actual silhouette)
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  if (bodyStyle === 'convoy-semi') {
    const pivotX = articulationPivotX;
    const relAngle = vehicle.articulatedAngle !== undefined ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle) : 0;
    // Unique long-nose tractor shadow.
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.32);
    ctx.lineTo(halfL * 0.88, -halfW * 0.62);
    ctx.lineTo(halfL * 0.38, -halfW * 0.72);
    ctx.lineTo(halfL * 0.28, -halfW * 0.38);
    ctx.lineTo(halfL * 0.28, halfW * 0.38);
    ctx.lineTo(halfL * 0.38, halfW * 0.72);
    ctx.lineTo(halfL * 0.88, halfW * 0.62);
    ctx.lineTo(halfL, halfW * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Extra-long beveled cargo trailer shadow around the fifth wheel.
    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);
    ctx.beginPath();
    ctx.moveTo(halfL * 0.305, -halfW * 0.22);
    ctx.lineTo(halfL * 0.20, -halfW * 0.84);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.84);
    ctx.lineTo(-halfL, -halfW * 0.58);
    ctx.lineTo(-halfL, halfW * 0.58);
    ctx.lineTo(-halfL * 0.96, halfW * 0.84);
    ctx.lineTo(halfL * 0.20, halfW * 0.84);
    ctx.lineTo(halfL * 0.305, halfW * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (isArticulatedSemi) {
    const pivotX = articulationPivotX;
    const relAngle = vehicle.articulatedAngle !== undefined
      ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
      : 0;

    // Tractor shadow
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.45);
    ctx.lineTo(halfL * 0.96, -halfW * 0.75);
    ctx.lineTo(halfL * 0.35, -halfW * 0.75);
    ctx.lineTo(halfL * 0.22, -halfW * 0.42);
    ctx.lineTo(halfL * 0.12, -halfW * 0.42);
    ctx.lineTo(halfL * 0.12, halfW * 0.42);
    ctx.lineTo(halfL * 0.22, halfW * 0.42);
    ctx.lineTo(halfL * 0.35, halfW * 0.75);
    ctx.lineTo(halfL * 0.96, halfW * 0.75);
    ctx.lineTo(halfL, halfW * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Trailer shadow pivoted around fifth-wheel hitch
    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);
    ctx.beginPath();
    ctx.moveTo(halfL * 0.22, -halfW * 0.25);
    ctx.lineTo(halfL * 0.12, -halfW * 0.45);
    ctx.lineTo(halfL * 0.10, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.98, halfW * 0.6);
    ctx.lineTo(-halfL * 0.95, halfW * 0.92);
    ctx.lineTo(halfL * 0.10, halfW * 0.92);
    ctx.lineTo(halfL * 0.12, halfW * 0.45);
    ctx.lineTo(halfL * 0.22, halfW * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.beginPath();
    drawLandVehicleSilhouettePath(ctx, bodyStyle, halfL, halfW);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 2. Chassis: Tracks, Wheeled Running Gear, Dune-Buggy, Half-Track, or Multi-Axle Trucks
  if (bodyStyle !== 'convoy-semi') {
    drawRunningGear(ctx, chassis, length, width, vehicle, time);
  }

  // 3. Primary Armored Vehicle Hull & Bodywork
  const hullColor = vehicle.config.primaryColor || vehicle.model.spriteStyle.hullColor;
  const accentColor = vehicle.config.accentColor || vehicle.model.spriteStyle.accentColor;
  const deckColor = vehicle.model.spriteStyle.deckColor || '#27272a';

  drawVehicleBody(ctx, bodyStyle, halfL, halfW, length, width, hullColor, accentColor, deckColor, vehicle);

  // Rear Tow Hitch Bracket (only for vehicles configured with trailer towing capability)
  if (vehicle.model.canTowTrailer) {
    ctx.fillStyle = '#52525b';
    ctx.fillRect(-halfL * 0.96, -3, 5, 6);
    ctx.fillStyle = '#d4d4d8';
    ctx.beginPath();
    ctx.arc(-halfL * 0.96 + 2, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Rotating Superstructure (Turret, Pintle Ring, Roll Cage, or Launch Turntable)
  drawVehicleSuperstructure(ctx, bodyStyle, halfL, halfW, width, deckColor, accentColor, vehicle);

  // 5. Hardpoint Weapons mounted on vehicle
  for (const hp of vehicle.model.hardpoints) {
    const compId = vehicle.config.equippedComponents[hp.id];
    const isTrailerMount = (isArticulatedSemi && hp.x <= 0.18);
    ctx.save();
    if (isTrailerMount) {
      const pivotX = articulationPivotX;
      const relAngle = vehicle.articulatedAngle !== undefined
        ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
        : 0;
      ctx.translate(pivotX, 0);
      ctx.rotate(relAngle);
      ctx.translate(-pivotX, 0);
    }
    const hpX = hp.x * halfL;
    const hpY = hp.y * halfW;
    drawModernWeapon(ctx, hpX, hpY, hp.allowedArc, compId || null, vehicle.team);
    ctx.restore();
  }

  // 6. IFF Tactical Identification Panel at Rear (Grounded Blue vs Red)
  ctx.save();
  if (isArticulatedSemi) {
    const pivotX = articulationPivotX;
    const relAngle = vehicle.articulatedAngle !== undefined
      ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
      : 0;
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);
  }
  ctx.fillStyle = bodyStyle === 'vehicle-ferry'
    ? (vehicle.team === 'player' ? '#526862' : '#745750')
    : (vehicle.team === 'player' ? '#2563eb' : '#dc2626');
  ctx.fillRect(-halfL * 0.88, -halfW * 0.22, 4, halfW * 0.44);
  ctx.restore();

  ctx.restore();

  // 7. Overhead Tactical Vehicle HUD (Name, Role, Health, Trailer status)
  if (!vehicle.isSunk) {
    drawVehicleOverheadHUD(ctx, vehicle);
  }
}

function drawWaterShip(
  ctx: CanvasRenderingContext2D,
  vehicle: ShipEntity,
  time: number
) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle);

  const length = vehicle.model.hullLength;
  const width = vehicle.model.hullWidth;
  const halfL = length * 0.5;
  const halfW = width * 0.5;
  const bodyStyle = vehicle.model.spriteStyle.bodyStyle || 'destroyer';

  if (vehicle.isSunk) {
    ctx.globalAlpha = Math.max(0.18, 1 - vehicle.sinkProgress * 0.82);
    ctx.rotate(vehicle.sinkProgress * 0.25);
  }

  // 1. Dynamic Propeller Wash / Stern Wake & Bow Spray (when moving in water)
  if (Math.abs(vehicle.speed) > 4 && !vehicle.isSunk) {
    const wakeLen = Math.min(130, Math.abs(vehicle.speed) * 2.0);
    const waveSin = Math.sin(time * 7) * 2.5;

    // Stern expanding foaming wake
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.42)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-halfL, -halfW * 0.4);
    ctx.quadraticCurveTo(-halfL - wakeLen * 0.5, -halfW * 0.8 + waveSin, -halfL - wakeLen, -halfW * 1.5);
    ctx.moveTo(-halfL, halfW * 0.4);
    ctx.quadraticCurveTo(-halfL - wakeLen * 0.5, halfW * 0.8 - waveSin, -halfL - wakeLen, halfW * 1.5);
    ctx.stroke();

    // Propeller froth zone
    ctx.fillStyle = 'rgba(240, 249, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-halfL - 12, 0, 16, halfW * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bow wave slicing outward
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.65, -halfW * 1.35);
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.65, halfW * 1.35);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Hull water shadow following accurate naval silhouette
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.42)';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  drawNavalHullPath(ctx, bodyStyle, halfL, halfW);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. Primary Naval Hull
  const hullColor = vehicle.config.primaryColor || vehicle.model.spriteStyle.hullColor;
  const accentColor = vehicle.config.accentColor || vehicle.model.spriteStyle.accentColor;
  const deckColor = vehicle.model.spriteStyle.deckColor || '#1e293b';

  drawNavalHull(ctx, bodyStyle, halfL, halfW, length, width, hullColor, accentColor, deckColor);

  // 4. Naval Superstructure (Bridge, Mast, Radars, Flight Deck, Turrets)
  drawNavalSuperstructure(ctx, bodyStyle, halfL, halfW, width, deckColor, accentColor, time);

  // 5. Hardpoint Weapons
  for (const hp of vehicle.model.hardpoints) {
    const compId = vehicle.config.equippedComponents[hp.id];
    const hpX = hp.x * halfL;
    const hpY = hp.y * halfW;
    drawModernWeapon(ctx, hpX, hpY, hp.allowedArc, compId || null, vehicle.team);
  }

  // 6. Parked Aircraft on Deck (Helicopter on helipad or Carrier fighter jets on flight deck)
  if (vehicle.hasHelipad && vehicle.helicopterState === 'landed') {
    const heloX = bodyStyle === 'frigate' ? -halfL * 0.72 : (bodyStyle === 'cruiser' ? -halfL * 0.82 : -halfL * 0.65);
    drawParkedHelicopter(ctx, heloX, 0, halfW * 0.42);
  }

  if (vehicle.isCarrier && (vehicle.carrierFighterJetsRemaining ?? 0) > 0) {
    drawParkedCarrierJets(ctx, halfL, halfW, vehicle.carrierFighterJetsRemaining ?? 0);
  }

  // 7. IFF Identification panel at Stern
  ctx.fillStyle = vehicle.team === 'player' ? '#2563eb' : '#dc2626';
  ctx.fillRect(-halfL * 0.88, -halfW * 0.3, 4, halfW * 0.6);

  ctx.restore();

  // Overhead HUD
  if (!vehicle.isSunk) {
    drawVehicleOverheadHUD(ctx, vehicle);
  }
}

function drawParkedHelicopter(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);

  // Helicopter fuselage
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.2;

  // Tail boom
  ctx.beginPath();
  ctx.moveTo(-scale * 0.15, -scale * 0.08);
  ctx.lineTo(-scale * 0.72, -scale * 0.04);
  ctx.lineTo(-scale * 0.72, scale * 0.04);
  ctx.lineTo(-scale * 0.15, scale * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail rotor blade
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-scale * 0.75, -scale * 0.22, 2, scale * 0.44);

  // Main fuselage body
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(-scale * 0.28, -scale * 0.22, scale * 0.65, scale * 0.44, 3);
  ctx.fill();
  ctx.stroke();

  // Glass canopy cockpit
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(scale * 0.12, -scale * 0.15, scale * 0.22, scale * 0.3, 2);
  ctx.fill();

  // Stub wings
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-scale * 0.05, -scale * 0.4, scale * 0.18, scale * 0.8);

  // Rotor hub
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Parked rotor blades (X shape)
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-scale * 0.55, -scale * 0.55);
  ctx.lineTo(scale * 0.55, scale * 0.55);
  ctx.moveTo(-scale * 0.55, scale * 0.55);
  ctx.lineTo(scale * 0.55, -scale * 0.55);
  ctx.stroke();

  ctx.restore();
}

function drawParkedCarrierJets(
  ctx: CanvasRenderingContext2D,
  halfL: number,
  halfW: number,
  remainingCount: number
) {
  const countToDraw = Math.min(3, remainingCount);
  const parkingSpots = [
    { x: -halfL * 0.50, y: halfW * 0.25, angle: -0.25 },
    { x: -halfL * 0.28, y: halfW * 0.26, angle: -0.25 },
    { x: -halfL * 0.06, y: halfW * 0.26, angle: -0.25 },
  ];

  for (let i = 0; i < countToDraw; i++) {
    const spot = parkingSpots[i];
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.angle);

    const s = halfW * 0.3;
    // Stealth delta wing
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s * 0.9, 0);
    ctx.lineTo(-s * 0.7, -s * 0.7);
    ctx.lineTo(-s * 0.45, 0);
    ctx.lineTo(-s * 0.7, s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Jet cockpit glass
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(s * 0.18, 0, s * 0.22, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin vertical stabilizers
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-s * 0.62, -s * 0.28, s * 0.22, 2);
    ctx.fillRect(-s * 0.62, s * 0.28, s * 0.22, 2);

    ctx.restore();
  }
}

function drawNavalHullPath(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number
) {
  ctx.beginPath();
  if (bodyStyle === 'cutter') {
    // Sharp deep-V bow with flared spray rails and narrow stepped transom
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.82, -halfW * 0.45);
    ctx.lineTo(halfL * 0.35, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.98, halfW * 0.65);
    ctx.lineTo(-halfL * 0.85, halfW * 0.85);
    ctx.lineTo(halfL * 0.35, halfW * 0.85);
    ctx.lineTo(halfL * 0.82, halfW * 0.45);
  } else if (bodyStyle === 'corvette') {
    // Visby Faceted Tumblehome Stealth Hull (angular facets, zero 90-degree angles)
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.72, -halfW * 0.68);
    ctx.lineTo(halfL * 0.1, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.75, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.98, halfW * 0.55);
    ctx.lineTo(-halfL * 0.75, halfW * 0.88);
    ctx.lineTo(halfL * 0.1, halfW * 0.88);
    ctx.lineTo(halfL * 0.72, halfW * 0.68);
  } else if (bodyStyle === 'frigate') {
    // Constellation Guided Frigate: Raked clipper bow, angled chine, wide midship deck
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.42);
    ctx.lineTo(halfL * 0.45, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.2, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.68);
    ctx.lineTo(-halfL * 0.98, halfW * 0.68);
    ctx.lineTo(-halfL * 0.85, halfW * 0.88);
    ctx.lineTo(-halfL * 0.2, halfW * 0.88);
    ctx.lineTo(halfL * 0.45, halfW * 0.82);
    ctx.lineTo(halfL * 0.85, halfW * 0.42);
  } else if (bodyStyle === 'cruiser') {
    // Ticonderoga Heavy Cruiser: Long, slender capital hull with dual steps and raised forecastle
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.88, -halfW * 0.45);
    ctx.lineTo(halfL * 0.55, -halfW * 0.78);
    ctx.lineTo(halfL * 0.25, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.65, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.90, -halfW * 0.80);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.58);
    ctx.lineTo(-halfL * 0.98, halfW * 0.58);
    ctx.lineTo(-halfL * 0.90, halfW * 0.80);
    ctx.lineTo(-halfL * 0.65, halfW * 0.88);
    ctx.lineTo(halfL * 0.25, halfW * 0.88);
    ctx.lineTo(halfL * 0.55, halfW * 0.78);
    ctx.lineTo(halfL * 0.88, halfW * 0.45);
  } else if (bodyStyle === 'vehicle-ferry') {
    // Purpose-built Ro-Ro silhouette: high-volume parallel sides, broad stern,
    // and a blunt reinforced bow sized around a full-width vehicle ramp.
    ctx.moveTo(halfL, -halfW * 0.46);
    ctx.lineTo(halfL * 0.86, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.92);
    ctx.lineTo(-halfL, -halfW * 0.68);
    ctx.lineTo(-halfL, halfW * 0.68);
    ctx.lineTo(-halfL * 0.88, halfW * 0.92);
    ctx.lineTo(halfL * 0.86, halfW * 0.88);
    ctx.lineTo(halfL, halfW * 0.46);
  } else if (bodyStyle === 'carrier') {
    // Wasp LHD Amphibious Assault Carrier: Broad rectangular flight deck with port sponson
    ctx.moveTo(halfL * 0.98, -halfW * 0.75);
    ctx.lineTo(halfL * 0.98, halfW * 0.95);
    ctx.lineTo(-halfL * 0.15, halfW * 0.95);
    ctx.lineTo(-halfL * 0.2, halfW * 0.78);
    ctx.lineTo(-halfL * 0.5, halfW * 0.78);
    ctx.lineTo(-halfL * 0.55, halfW * 0.95);
    ctx.lineTo(-halfL * 0.98, halfW * 0.95);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.75);
    ctx.lineTo(-halfL * 0.6, -halfW * 0.75);
    ctx.lineTo(-halfL * 0.55, -halfW * 0.95);
    ctx.lineTo(-halfL * 0.2, -halfW * 0.95);
    ctx.lineTo(-halfL * 0.15, -halfW * 0.75);
    ctx.lineTo(halfL * 0.65, -halfW * 0.75);
    ctx.lineTo(halfL * 0.85, -halfW * 0.4);
  } else if (bodyStyle === 'submarine') {
    // Seawolf Submarine: Teardrop cylindrical hull with rounded sonar nose and tapered tail
    ctx.moveTo(halfL, 0);
    ctx.bezierCurveTo(halfL * 0.95, -halfW * 0.55, halfL * 0.7, -halfW * 0.85, halfL * 0.3, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.65, -halfW * 0.85);
    ctx.bezierCurveTo(-halfL * 0.85, -halfW * 0.85, -halfL * 0.95, -halfW * 0.5, -halfL, 0);
    ctx.bezierCurveTo(-halfL * 0.95, halfW * 0.5, -halfL * 0.85, halfW * 0.85, -halfL * 0.65, halfW * 0.85);
    ctx.lineTo(halfL * 0.3, halfW * 0.85);
    ctx.bezierCurveTo(halfL * 0.7, halfW * 0.85, halfL * 0.95, halfW * 0.55, halfL, 0);
  } else if (bodyStyle === 'battleship') {
    // Iowa Dreadnought: Massive armored clipper bow with torpedo bulges and rounded stern
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.5);
    ctx.lineTo(halfL * 0.5, -halfW * 0.85);
    ctx.lineTo(halfL * 0.2, -halfW * 0.96);
    ctx.lineTo(-halfL * 0.65, -halfW * 0.96);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.45);
    ctx.lineTo(-halfL * 0.98, halfW * 0.45);
    ctx.lineTo(-halfL * 0.88, halfW * 0.82);
    ctx.lineTo(-halfL * 0.65, halfW * 0.96);
    ctx.lineTo(halfL * 0.2, halfW * 0.96);
    ctx.lineTo(halfL * 0.5, halfW * 0.85);
    ctx.lineTo(halfL * 0.85, halfW * 0.5);
  } else if (bodyStyle === 'trimaran') {
    // Independence-Class Trimaran: Slender central hull, outriggers, structural bridging cross-deck
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.16);
    ctx.lineTo(halfL * 0.45, -halfW * 0.28);
    // Port outrigger forward bridge sponson
    ctx.lineTo(halfL * 0.22, -halfW * 0.32);
    ctx.lineTo(halfL * 0.18, -halfW * 0.82);
    ctx.lineTo(halfL * 0.12, -halfW * 0.98);
    // Port outrigger outer hull
    ctx.lineTo(-halfL * 0.85, -halfW * 0.98);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.82);
    // Port outrigger inner sheer
    ctx.lineTo(-halfL * 0.98, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.82, -halfW * 0.65);
    // Stern cross-deck to center hull
    ctx.lineTo(-halfL * 0.85, -halfW * 0.24);
    // Center hull stern transom
    ctx.lineTo(-halfL * 0.98, -halfW * 0.22);
    ctx.lineTo(-halfL * 0.98, halfW * 0.22);
    ctx.lineTo(-halfL * 0.85, halfW * 0.24);
    // Starboard inner sheer & outrigger
    ctx.lineTo(-halfL * 0.82, halfW * 0.65);
    ctx.lineTo(-halfL * 0.98, halfW * 0.65);
    ctx.lineTo(-halfL * 0.98, halfW * 0.82);
    ctx.lineTo(-halfL * 0.85, halfW * 0.98);
    // Starboard outrigger forward point
    ctx.lineTo(halfL * 0.12, halfW * 0.98);
    ctx.lineTo(halfL * 0.18, halfW * 0.82);
    ctx.lineTo(halfL * 0.22, halfW * 0.32);
    ctx.lineTo(halfL * 0.45, halfW * 0.28);
    ctx.lineTo(halfL * 0.85, halfW * 0.16);
  } else if (bodyStyle === 'tumblehome-destroyer') {
    // Zumwalt-Class Stealth Tumblehome Guided Missile Destroyer
    // Inverted Tumblehome Knife Bow (sloping backward from the water, razor-thin wave-piercing stem)
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.24);
    ctx.lineTo(halfL * 0.40, -halfW * 0.86);
    ctx.lineTo(-halfL * 0.80, -halfW * 0.86);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.62);
    ctx.lineTo(-halfL * 0.98, halfW * 0.62);
    ctx.lineTo(-halfL * 0.80, halfW * 0.86);
    ctx.lineTo(halfL * 0.40, halfW * 0.86);
    ctx.lineTo(halfL * 0.85, halfW * 0.24);
  } else {
    // Arleigh Burke Aegis Destroyer: Knuckle flared bow with wave breaker, wide beam, transom stern
    ctx.moveTo(halfL, 0);
    ctx.bezierCurveTo(halfL * 0.82, -halfW * 0.58, halfL * 0.45, -halfW * 0.88, 0, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.98, halfW * 0.65);
    ctx.lineTo(-halfL * 0.85, halfW * 0.92);
    ctx.lineTo(0, halfW * 0.92);
    ctx.bezierCurveTo(halfL * 0.45, halfW * 0.88, halfL * 0.82, halfW * 0.58, halfL, 0);
  }
  ctx.closePath();
}

function drawNavalHull(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number,
  length: number,
  width: number,
  hullColor: string,
  accentColor: string,
  deckColor: string
) {
  ctx.fillStyle = hullColor;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2.5;

  drawNavalHullPath(ctx, bodyStyle, halfL, halfW);
  ctx.fill();
  ctx.stroke();

  // Deck Inlay & Details tailored to each naval hull configuration
  if (bodyStyle === 'vehicle-ferry') {
    // Enclosed Ro-Ro deck sized for exactly two adjacent vehicle lanes.
    ctx.fillStyle = deckColor;
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.88, -halfW * 0.82, halfL * 1.62, halfW * 1.64, 8);
    ctx.fill();
    ctx.strokeStyle = '#303633';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Heavy side casings and regularly spaced ventilation / access bays.
    ctx.fillStyle = '#3f4747';
    ctx.fillRect(-halfL * 0.84, -halfW * 0.88, halfL * 1.48, halfW * 0.11);
    ctx.fillRect(-halfL * 0.84, halfW * 0.77, halfL * 1.48, halfW * 0.11);
    ctx.strokeStyle = '#262b2b';
    ctx.lineWidth = 1;
    for (let x = -halfL * 0.72; x <= halfL * 0.55; x += Math.max(24, halfL * 0.18)) {
      ctx.beginPath();
      ctx.moveTo(x, -halfW * 0.88);
      ctx.lineTo(x, -halfW * 0.77);
      ctx.moveTo(x, halfW * 0.77);
      ctx.lineTo(x, halfW * 0.88);
      ctx.stroke();
    }

    // A single center divider creates two parking lanes without an empty middle lane.
    ctx.strokeStyle = 'rgba(229, 220, 190, 0.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.78, 0);
    ctx.lineTo(halfL * 0.80, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hinged bow and stern ramp seams.
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.72, -halfW * 0.58);
    ctx.lineTo(halfL * 0.92, -halfW * 0.42);
    ctx.lineTo(halfL * 0.92, halfW * 0.42);
    ctx.lineTo(halfL * 0.72, halfW * 0.58);
    ctx.moveTo(-halfL * 0.88, -halfW * 0.54);
    ctx.lineTo(-halfL * 0.88, halfW * 0.54);
    ctx.stroke();
  } else if (bodyStyle === 'trimaran') {
    // Shaded water channels separating the central hull from the side outriggers
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-halfL * 0.78, -halfW * 0.64, halfL * 0.95, halfW * 0.38);
    ctx.fillRect(-halfL * 0.78, halfW * 0.26, halfL * 0.95, halfW * 0.38);

    // Centerline narrow deck
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.85, -halfW * 0.22, halfL * 1.55, halfW * 0.44);

    // Aft broad helicopter flight deck spanning across hulls
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.92, -halfW * 0.88, halfL * 0.45, halfW * 1.76);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfL * 0.92, -halfW * 0.88, halfL * 0.45, halfW * 1.76);
  } else if (bodyStyle === 'tumblehome-destroyer') {
    // Inverted knife bow centerline crest ridge
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.98, 0);
    ctx.lineTo(halfL * 0.35, 0);
    ctx.stroke();

    // Monolithic composite flush deck inlay
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.75, -halfW * 0.76, halfL * 1.15, halfW * 1.52);

    // Peripheral VLS Missile cell launch boundaries (PVLS) along port & stbd gunwales
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfL * 0.75, -halfW * 0.82, halfL * 1.05, halfW * 0.12);
    ctx.strokeRect(-halfL * 0.75, halfW * 0.70, halfL * 1.05, halfW * 0.12);
  } else {
    // Standard deck inlay
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.8, -halfW * 0.72, halfL * 1.5, halfW * 1.44);

    // Accent sheer stripe
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.85, -halfW * 0.86);
    ctx.lineTo(halfL * 0.6, -halfW * 0.86);
    ctx.moveTo(-halfL * 0.85, halfW * 0.86);
    ctx.lineTo(halfL * 0.6, halfW * 0.86);
    ctx.stroke();
  }
}

function drawRotatingRadar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number,
  speed = 4.0,
  type: 'bar' | 'curved' | 'lattice' = 'bar'
) {
  ctx.save();
  ctx.translate(x, y);

  // Mast pedestal platform base
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2.5, radius * 0.32), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Spinning radar scanner antenna
  ctx.rotate(time * speed);

  if (type === 'curved') {
    // Parabolic curved surveillance radar reflector
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -0.6, 0.6);
    ctx.stroke();

    // Counterweight / feed horn
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-radius * 0.6, 0);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(-radius * 0.6, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'lattice') {
    // Heavy dual-sided 3D air-search lattice truss scanner
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();

    // Vertical cross elements for lattice appearance
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.65, -radius * 0.35);
    ctx.lineTo(-radius * 0.65, radius * 0.35);
    ctx.moveTo(0, -radius * 0.42);
    ctx.lineTo(0, radius * 0.42);
    ctx.moveTo(radius * 0.65, -radius * 0.35);
    ctx.lineTo(radius * 0.65, radius * 0.35);
    ctx.stroke();
  } else {
    // Slender high-speed maritime navigation bar scanner
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();

    // Antenna end caps
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-radius - 1, -1.5, 2, 3);
    ctx.fillRect(radius - 1, -1.5, 2, 3);
  }
  ctx.restore();
}

function drawNavalSuperstructure(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number,
  width: number,
  deckColor: string,
  accentColor: string,
  time: number
) {
  if (bodyStyle === 'vehicle-ferry') {
    ctx.save();

    // Forward wheelhouse spans the beam like a working Ro-Ro ferry rather than
    // the offset island and open flight deck of an aircraft carrier.
    ctx.fillStyle = '#d0d0c7';
    ctx.strokeStyle = '#3f4544';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(halfL * 0.40, -halfW * 0.62, halfL * 0.22, halfW * 1.24, 5);
    ctx.fill();
    ctx.stroke();

    // Continuous dark bridge windows across the bow-facing wheelhouse.
    ctx.fillStyle = '#263235';
    ctx.fillRect(halfL * 0.57, -halfW * 0.51, 5, halfW * 1.02);
    for (let y = -halfW * 0.42; y <= halfW * 0.42; y += Math.max(10, halfW * 0.22)) {
      ctx.fillStyle = '#809095';
      ctx.fillRect(halfL * 0.58, y, 3, Math.max(5, halfW * 0.12));
    }

    // Twin exhaust stacks and a ferry-specific fixed navigation mast.
    ctx.fillStyle = '#343937';
    ctx.strokeStyle = '#252927';
    ctx.fillRect(halfL * 0.20, -halfW * 0.56, halfL * 0.12, halfW * 0.20);
    ctx.fillRect(halfL * 0.20, halfW * 0.36, halfL * 0.12, halfW * 0.20);
    ctx.strokeRect(halfL * 0.20, -halfW * 0.56, halfL * 0.12, halfW * 0.20);
    ctx.strokeRect(halfL * 0.20, halfW * 0.36, halfL * 0.12, halfW * 0.20);
    ctx.strokeStyle = '#444944';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.48, -halfW * 0.18);
    ctx.lineTo(halfL * 0.48, halfW * 0.18);
    ctx.moveTo(halfL * 0.44, 0);
    ctx.lineTo(halfL * 0.52, 0);
    ctx.stroke();
    ctx.fillStyle = '#b3aa8f';
    ctx.beginPath();
    ctx.arc(halfL * 0.48, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Hydraulic ramp hinges, winch drums, and high-visibility loading arrows.
    ctx.fillStyle = '#2f3432';
    for (const y of [-halfW * 0.46, halfW * 0.46]) {
      ctx.beginPath();
      ctx.arc(halfL * 0.78, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-halfL * 0.80, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.82, 0);
    ctx.lineTo(halfL * 0.68, -9);
    ctx.lineTo(halfL * 0.68, -3);
    ctx.lineTo(halfL * 0.50, -3);
    ctx.lineTo(halfL * 0.50, 3);
    ctx.lineTo(halfL * 0.68, 3);
    ctx.lineTo(halfL * 0.68, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (bodyStyle === 'carrier') {
    // Flight Deck Runway Lines & Island Superstructure
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.92, -halfW * 0.52);
    ctx.lineTo(halfL * 0.92, -halfW * 0.52);
    ctx.moveTo(-halfL * 0.92, halfW * 0.52);
    ctx.lineTo(halfL * 0.92, halfW * 0.52);
    ctx.stroke();

    // Runway yellow centerline
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.9, 0);
    ctx.lineTo(halfL * 0.9, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Starboard Island Superstructure
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-halfL * 0.15, -halfW * 0.92, halfL * 0.45, halfW * 0.24);
    ctx.strokeRect(-halfL * 0.15, -halfW * 0.92, halfL * 0.45, halfW * 0.24);

    // Primary Island Rotating Air-Surveillance Radar
    drawRotatingRadar(ctx, halfL * 0.08, -halfW * 0.80, 8.5, time, 3.4, 'curved');
    ctx.restore();
  } else if (bodyStyle === 'battleship') {
    // Iowa Dreadnought: Teakwood deck planking, forward superfiring turrets, armored conning tower
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let dx = -halfL * 0.75; dx < halfL * 0.7; dx += 10) {
      ctx.beginPath();
      ctx.moveTo(dx, -halfW * 0.65);
      ctx.lineTo(dx, halfW * 0.65);
      ctx.stroke();
    }

    // Heavy Armored Citadel Conning Tower
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.1, -halfW * 0.3, halfL * 0.24, halfW * 0.6, 4);
    ctx.fill();
    ctx.stroke();

    // Dual funnel smokestacks
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-halfL * 0.25, -halfW * 0.18, 12, halfW * 0.36);
    ctx.fillRect(-halfL * 0.05, -halfW * 0.18, 12, halfW * 0.36);

    // Elevated Armored Fire Control Director Tower with Rotating Radar Rangefinder
    drawRotatingRadar(ctx, -halfL * 0.16, 0, 9.5, time, 2.8, 'lattice');

    // Triple 16-inch Armored Turrets (Forward 1 & 2, Aft 1)
    drawNavalTurret(ctx, halfL * 0.5, 0, halfW * 0.38, 3);
    drawNavalTurret(ctx, halfL * 0.22, 0, halfW * 0.38, 3);
    drawNavalTurret(ctx, -halfL * 0.45, 0, halfW * 0.38, 3, Math.PI);
    ctx.restore();
  } else if (bodyStyle === 'submarine') {
    // Seawolf Submarine: Sail conning tower, horizontal dive planes, vertical missile hatches
    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(halfL * 0.05, -halfW * 0.22, halfL * 0.28, halfW * 0.44, 4);
    ctx.fill();
    ctx.stroke();

    // Horizontal dive planes
    ctx.fillStyle = '#334155';
    ctx.fillRect(halfL * 0.18, -halfW * 0.65, 8, halfW * 1.3);

    // Vertical launch missile hatch circles
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    [-halfL * 0.08, -halfL * 0.22, -halfL * 0.36].forEach(hx => {
      ctx.beginPath();
      ctx.arc(hx, 0, halfW * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  } else if (bodyStyle === 'cutter') {
    // Cyclone Patrol Cutter: Stepped pilothouse, open radar mast, aft launch deck with orange Zodiac RIB
    ctx.save();
    // Stepped forward deckhouse
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(halfL * 0.15, -halfW * 0.52, halfL * 0.35, halfW * 1.04, 3);
    ctx.fill();
    ctx.stroke();

    // Blue tinted anti-glare bridge glass
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(halfL * 0.42, -halfW * 0.42, 4, halfW * 0.84);

    // Spinning surface radar scanner mast
    drawRotatingRadar(ctx, halfL * 0.25, 0, 7.5, time, 5.0, 'bar');

    // Aft stern launch cradle with high-visibility orange Zodiac RIB boat
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.68, -halfW * 0.32, halfL * 0.3, halfW * 0.64, 4);
    ctx.fill();
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  } else if (bodyStyle === 'corvette') {
    // Visby Stealth Corvette: Faceted composite pyramid mast, flush missile doors
    ctx.save();
    // Faceted stealth central superstructure
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.32, 0);
    ctx.lineTo(halfL * 0.15, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.35, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.5, 0);
    ctx.lineTo(-halfL * 0.35, halfW * 0.55);
    ctx.lineTo(halfL * 0.15, halfW * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stealth pyramid radar mast
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(halfL * 0.05, 0);
    ctx.lineTo(-halfL * 0.12, -halfW * 0.28);
    ctx.lineTo(-halfL * 0.12, halfW * 0.28);
    ctx.closePath();
    ctx.fill();

    // Flush deck hatch outlines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfL * 0.3, -halfW * 0.35, halfL * 0.15, halfW * 0.7);
    ctx.restore();
  } else if (bodyStyle === 'frigate') {
    // Constellation Guided Frigate: Forward bridge tower, midship angled Harpoon racks, enclosed hangar & helipad
    ctx.save();
    // Forward bridge house
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(halfL * 0.15, -halfW * 0.48, halfL * 0.28, halfW * 0.96, 3);
    ctx.fill();
    ctx.stroke();

    // Bridge front windows
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(halfL * 0.38, -halfW * 0.38, 3, halfW * 0.76);

    // Main Foremast Tower with Rotating Air Search Radar
    drawRotatingRadar(ctx, halfL * 0.14, 0, 8.5, time, 4.2, 'curved');

    // Midship angled Harpoon strike racks (pointing port and starboard)
    ctx.fillStyle = '#334155';
    ctx.fillRect(-halfL * 0.05, -halfW * 0.65, 8, halfW * 0.35);
    ctx.fillRect(-halfL * 0.05, halfW * 0.30, 8, halfW * 0.35);

    // Enclosed Helicopter Hangar bay
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-halfL * 0.42, -halfW * 0.45, halfL * 0.25, halfW * 0.9);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(-halfL * 0.42, -halfW * 0.45, halfL * 0.25, halfW * 0.9);

    // Stern marked helipad with landing circle and 'H'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-halfL * 0.72, 0, halfW * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', -halfL * 0.72, 1);
    ctx.restore();
  } else if (bodyStyle === 'cruiser') {
    // Ticonderoga Cruiser: Dual towering superstructures (Forward & Aft), dual VLS missile farms, midship Harpoon quad canisters
    ctx.save();
    // Forward VLS honeycomb (61 cells)
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.fillRect(halfL * 0.35, -halfW * 0.32, halfL * 0.16, halfW * 0.64);
    ctx.strokeRect(halfL * 0.35, -halfW * 0.32, halfL * 0.16, halfW * 0.64);

    // Massive Forward Bridge (Towering Aegis SPY-1 deckhouse)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.3, -halfW * 0.5);
    ctx.lineTo(halfL * 0.3, halfW * 0.5);
    ctx.lineTo(halfL * 0.05, halfW * 0.55);
    ctx.lineTo(halfL * 0.05, -halfW * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forward Mainmast Tower with Heavy Rotating Lattice Radar
    drawRotatingRadar(ctx, halfL * 0.15, 0, 10.5, time, 3.8, 'lattice');

    // Midship Quad Harpoon Canisters (45-degree angle outward)
    ctx.fillStyle = '#475569';
    ctx.fillRect(-halfL * 0.08, -halfW * 0.72, 12, halfW * 0.38);
    ctx.fillRect(-halfL * 0.08, halfW * 0.34, 12, halfW * 0.38);

    // Aft Secondary Superstructure & Exhaust Mast
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.8;
    ctx.fillRect(-halfL * 0.38, -halfW * 0.48, halfL * 0.22, halfW * 0.96);
    ctx.strokeRect(-halfL * 0.38, -halfW * 0.48, halfL * 0.22, halfW * 0.96);

    // Aft Secondary Rotating Air-Search Radar
    drawRotatingRadar(ctx, -halfL * 0.28, 0, 8.5, time, -4.5, 'bar');

    // Aft VLS honeycomb (61 cells)
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-halfL * 0.62, -halfW * 0.32, halfL * 0.16, halfW * 0.64);
    ctx.strokeRect(-halfL * 0.62, -halfW * 0.32, halfL * 0.16, halfW * 0.64);

    // Stern Helipad
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-halfL * 0.82, 0, halfW * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', -halfL * 0.82, 1);
    ctx.restore();
  } else if (bodyStyle === 'trimaran') {
    // Independence-Class Littoral Trimaran Warship Superstructure
    ctx.save();
    // Huge Aft Flight Deck with Helipad circle and 'H'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-halfL * 0.70, 0, halfW * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', -halfL * 0.70, 1);

    // Forward Faceted Stealth Bridge Deckhouse
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.35, 0);
    ctx.lineTo(halfL * 0.15, -halfW * 0.28);
    ctx.lineTo(-halfL * 0.18, -halfW * 0.30);
    ctx.lineTo(-halfL * 0.18, halfW * 0.30);
    ctx.lineTo(halfL * 0.15, halfW * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tinted bridge windows facing forward
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(halfL * 0.18, -halfW * 0.2, 4, halfW * 0.4);

    // SeaRAM / CIWS missile turret on hangar roof
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-halfL * 0.28, -halfW * 0.18, halfL * 0.12, halfW * 0.36);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(-halfL * 0.22, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Twin Dual Harpoon Launch Canisters on outer sponsons
    ctx.fillStyle = '#334155';
    ctx.fillRect(-halfL * 0.05, -halfW * 0.88, 12, 6);
    ctx.fillRect(-halfL * 0.05, halfW * 0.88 - 6, 12, 6);

    // Low-profile 3D volume air surveillance radar on bridge mast
    drawRotatingRadar(ctx, halfL * 0.05, 0, 8.5, time, 5.0, 'bar');

    // Dual Aft Waterjet Propulsion exhausts at transom
    ctx.fillStyle = '#334155';
    ctx.fillRect(-halfL * 0.98, -halfW * 0.15, 3, 5);
    ctx.fillRect(-halfL * 0.98, halfW * 0.15 - 5, 3, 5);
    ctx.restore();
  } else if (bodyStyle === 'tumblehome-destroyer') {
    // Zumwalt-Class Stealth Tumblehome Destroyer Superstructure
    ctx.save();
    // Aft Flush Flight Deck marked landing circle and 'H'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-halfL * 0.72, 0, halfW * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', -halfL * 0.72, 1);

    // Monolithic Faceted Composite Deckhouse (Zumwalt Pyramid Structure)
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.24, 0);
    ctx.lineTo(halfL * 0.08, -halfW * 0.44);
    ctx.lineTo(-halfL * 0.35, -halfW * 0.44);
    ctx.lineTo(-halfL * 0.42, 0);
    ctx.lineTo(-halfL * 0.35, halfW * 0.44);
    ctx.lineTo(halfL * 0.08, halfW * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // SPY-3 Active Phased Array Radar Panels (flush integrated flat arrays on deckhouse facets)
    ctx.fillStyle = '#475569';
    // Forward array
    ctx.fillRect(halfL * 0.14, -halfW * 0.18, 3.5, halfW * 0.36);
    // Port array
    ctx.fillRect(-halfL * 0.15, -halfW * 0.43, halfL * 0.18, 3);
    // Starboard array
    ctx.fillRect(-halfL * 0.15, halfW * 0.43 - 3, halfL * 0.18, 3);

    // Twin Advanced Gun System (AGS) 155mm low-profile faceted stealth turrets on forward deck
    [halfL * 0.52, halfL * 0.35].forEach(gx => {
      // Angular stealth cupola
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx + 9, 0);
      ctx.lineTo(gx + 2, -7);
      ctx.lineTo(gx - 8, -6);
      ctx.lineTo(gx - 8, 6);
      ctx.lineTo(gx + 2, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Forward concealed barrel shroud
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(gx + 8, -1.5, 8, 3);
    });

    // Dual enclosed helicopter hangar doors at aft end of deckhouse
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfL * 0.44, -halfW * 0.32, 4, halfW * 0.28);
    ctx.strokeRect(-halfL * 0.44, halfW * 0.04, 4, halfW * 0.28);
    ctx.restore();
  } else {
    // Destroyer (Arleigh Burke): Forward VLS, Aegis phased-array bridge, twin canted exhaust funnels, spinning radar, aft VLS, stern helipad
    ctx.save();
    // Stern marked helipad with landing circle and bold 'H'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-halfL * 0.65, 0, halfW * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', -halfL * 0.65, 1);

    // Forward VLS honeycomb cells (32 cells)
    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.fillRect(halfL * 0.3, -halfW * 0.3, halfL * 0.18, halfW * 0.6);
    ctx.strokeRect(halfL * 0.3, -halfW * 0.3, halfL * 0.18, halfW * 0.6);

    // Angular forward bridge superstructure (Aegis SPY-1 array faces)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.2, -halfW * 0.45);
    ctx.lineTo(halfL * 0.2, halfW * 0.45);
    ctx.lineTo(-halfL * 0.1, halfW * 0.52);
    ctx.lineTo(-halfL * 0.1, -halfW * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Mainmast Tower with Rotating Surveillance Radar Scanner
    drawRotatingRadar(ctx, halfL * 0.05, 0, 10.0, time, 4.5, 'lattice');

    // Dual angled exhaust smokestacks
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-halfL * 0.25, -halfW * 0.25, 10, halfW * 0.5);
    ctx.fillRect(-halfL * 0.42, -halfW * 0.25, 10, halfW * 0.5);
    ctx.restore();
  }
}

function drawNavalTurret(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  barrels: number,
  angleOffset = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleOffset);

  // Armored Gun Barbette / Turret Base
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Gun Barrels
  ctx.fillStyle = '#09090b';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;

  if (barrels === 3) {
    [-radius * 0.4, 0, radius * 0.4].forEach(by => {
      ctx.fillRect(radius * 0.4, by - 1.5, radius * 1.4, 3);
      ctx.strokeRect(radius * 0.4, by - 1.5, radius * 1.4, 3);
    });
  } else {
    ctx.fillRect(radius * 0.4, -2, radius * 1.5, 4);
    ctx.strokeRect(radius * 0.4, -2, radius * 1.5, 4);
  }
  ctx.restore();
}

function drawAirVehicle(
  ctx: CanvasRenderingContext2D,
  vehicle: ShipEntity,
  time: number
) {
  const length = vehicle.model.hullLength;
  const width = vehicle.model.hullWidth;
  const halfL = length * 0.5;
  const halfW = width * 0.5;
  const bodyStyle = vehicle.model.spriteStyle.bodyStyle || 'fighter-raptor';
  const altitude = vehicle.altitude || 70;
  const altScale = 1 + (altitude / 550);

  // 1. High-altitude ground shadow projected below onto terrain/water
  ctx.save();
  ctx.translate(vehicle.x + 18, vehicle.y + 24);
  ctx.rotate(vehicle.angle);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.32)';
  drawAirframePath(ctx, bodyStyle, halfL, halfW);
  ctx.fill();
  ctx.restore();

  // 2. High-Altitude Airborne Airframe
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle + (vehicle.rudderAngle || 0) * 0.22);
  ctx.scale(altScale, altScale);

  if (vehicle.isSunk) {
    ctx.globalAlpha = Math.max(0.18, 1 - vehicle.sinkProgress * 0.82);
    ctx.rotate(vehicle.sinkProgress * 0.5);
  }

  const hullColor = vehicle.config.primaryColor || vehicle.model.spriteStyle.hullColor;
  const accentColor = vehicle.config.accentColor || vehicle.model.spriteStyle.accentColor;
  const deckColor = vehicle.model.spriteStyle.deckColor || '#1e293b';

  drawAirframeBody(ctx, bodyStyle, halfL, halfW, length, width, hullColor, accentColor, deckColor, time, vehicle.speed);

  // Hardpoints / Ordnance
  for (const hp of vehicle.model.hardpoints) {
    const compId = vehicle.config.equippedComponents[hp.id];
    const hpX = hp.x * halfL;
    const hpY = hp.y * halfW;
    drawModernWeapon(ctx, hpX, hpY, hp.allowedArc, compId || null, vehicle.team);
  }

  // IFF identification on wing/tail
  ctx.fillStyle = vehicle.team === 'player' ? '#2563eb' : '#dc2626';
  ctx.fillRect(-halfL * 0.8, -2, 5, 4);

  ctx.restore();

  if (!vehicle.isSunk) {
    drawVehicleOverheadHUD(ctx, vehicle);
  }
}

function drawAirframePath(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number
) {
  ctx.beginPath();
  if (bodyStyle === 'chopper-apache' || bodyStyle === 'chopper') {
    ctx.moveTo(halfL * 0.85, 0);
    ctx.lineTo(halfL * 0.65, -halfW * 0.35);
    ctx.lineTo(halfL * 0.25, -halfW * 0.45);
    ctx.lineTo(halfL * 0.15, -halfW * 0.95);
    ctx.lineTo(-halfL * 0.05, -halfW * 0.95);
    ctx.lineTo(-halfL * 0.1, -halfW * 0.4);
    ctx.lineTo(-halfL * 0.75, -halfW * 0.12);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.45);
    ctx.lineTo(-halfL, 0);
    ctx.lineTo(-halfL * 0.92, halfW * 0.45);
    ctx.lineTo(-halfL * 0.75, halfW * 0.12);
    ctx.lineTo(-halfL * 0.1, halfW * 0.4);
    ctx.lineTo(-halfL * 0.05, halfW * 0.95);
    ctx.lineTo(halfL * 0.15, halfW * 0.95);
    ctx.lineTo(halfL * 0.25, halfW * 0.45);
    ctx.lineTo(halfL * 0.65, halfW * 0.35);
  } else if (bodyStyle === 'fighter-raptor') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.7, -halfW * 0.22);
    ctx.lineTo(halfL * 0.18, -halfW);
    ctx.lineTo(-halfL * 0.25, -halfW);
    ctx.lineTo(-halfL * 0.5, -halfW * 0.45);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.25);
    ctx.lineTo(-halfL * 0.82, 0);
    ctx.lineTo(-halfL * 0.98, halfW * 0.25);
    ctx.lineTo(-halfL * 0.88, halfW * 0.55);
    ctx.lineTo(-halfL * 0.5, halfW * 0.45);
    ctx.lineTo(-halfL * 0.25, halfW);
    ctx.lineTo(halfL * 0.18, halfW);
    ctx.lineTo(halfL * 0.7, halfW * 0.22);
  } else if (bodyStyle === 'bomber-spirit') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.2, -halfW);
    ctx.lineTo(-halfL * 0.15, -halfW);
    ctx.lineTo(-halfL * 0.05, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.45, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.35, -halfW * 0.28);
    ctx.lineTo(-halfL * 0.85, 0);
    ctx.lineTo(-halfL * 0.35, halfW * 0.28);
    ctx.lineTo(-halfL * 0.45, halfW * 0.55);
    ctx.lineTo(-halfL * 0.05, halfW * 0.55);
    ctx.lineTo(-halfL * 0.15, halfW);
    ctx.lineTo(halfL * 0.2, halfW);
  } else if (bodyStyle === 'attacker-warthog') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.75, -halfW * 0.22);
    ctx.lineTo(halfL * 0.2, -halfW * 0.25);
    ctx.lineTo(halfL * 0.2, -halfW);
    ctx.lineTo(-halfL * 0.15, -halfW);
    ctx.lineTo(-halfL * 0.15, -halfW * 0.3);
    ctx.lineTo(-halfL * 0.7, -halfW * 0.3);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.15);
    ctx.lineTo(-halfL, 0);
    ctx.lineTo(-halfL * 0.98, halfW * 0.15);
    ctx.lineTo(-halfL * 0.98, halfW * 0.6);
    ctx.lineTo(-halfL * 0.88, halfW * 0.6);
    ctx.lineTo(-halfL * 0.7, halfW * 0.3);
    ctx.lineTo(-halfL * 0.15, halfW * 0.3);
    ctx.lineTo(-halfL * 0.15, halfW);
    ctx.lineTo(halfL * 0.2, halfW);
    ctx.lineTo(halfL * 0.2, halfW * 0.25);
    ctx.lineTo(halfL * 0.75, halfW * 0.22);
  } else if (bodyStyle === 'recon-blackbird') {
    // SR-71 Blackbird: Needle nose probe, razor lateral chines, mid-wing J58 nacelles with spike shock cones, cropped delta wings
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.90, -halfW * 0.08);
    ctx.lineTo(halfL * 0.65, -halfW * 0.20);
    ctx.lineTo(halfL * 0.35, -halfW * 0.35);
    ctx.lineTo(halfL * 0.12, -halfW * 0.44);
    // Port J58 nacelle shock spike tip & inlet
    ctx.lineTo(halfL * 0.22, -halfW * 0.60);
    ctx.lineTo(halfL * 0.06, -halfW * 0.68);
    // Cropped outer delta wing sweep
    ctx.lineTo(-halfL * 0.45, -halfW);
    ctx.lineTo(-halfL * 0.65, -halfW * 0.95);
    // Nacelle outer flank
    ctx.lineTo(-halfL * 0.70, -halfW * 0.72);
    // J58 exhaust nozzle
    ctx.lineTo(-halfL * 0.96, -halfW * 0.68);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.52);
    // Trailing edge beaver tail
    ctx.lineTo(-halfL * 0.78, -halfW * 0.32);
    ctx.lineTo(-halfL, 0);
    // Starboard trailing edge beaver tail
    ctx.lineTo(-halfL * 0.78, halfW * 0.32);
    // Starboard J58 exhaust nozzle
    ctx.lineTo(-halfL * 0.96, halfW * 0.52);
    ctx.lineTo(-halfL * 0.96, halfW * 0.68);
    // Starboard nacelle outer flank
    ctx.lineTo(-halfL * 0.70, halfW * 0.72);
    // Starboard outer delta wing sweep
    ctx.lineTo(-halfL * 0.65, halfW * 0.95);
    ctx.lineTo(-halfL * 0.45, halfW);
    // Starboard J58 inlet & shock spike
    ctx.lineTo(halfL * 0.06, halfW * 0.68);
    ctx.lineTo(halfL * 0.22, halfW * 0.60);
    ctx.lineTo(halfL * 0.12, halfW * 0.44);
    ctx.lineTo(halfL * 0.35, halfW * 0.35);
    ctx.lineTo(halfL * 0.65, halfW * 0.20);
    ctx.lineTo(halfL * 0.90, halfW * 0.08);
  } else if (bodyStyle === 'bomber-valkyrie') {
    // XB-70 Valkyrie: Supersonic needle prow, prominent forward canards, massive 65.5° triangular waverider delta wing
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.12);
    ctx.lineTo(halfL * 0.62, -halfW * 0.16);
    // Forward triangular canard foreplane (port)
    ctx.lineTo(halfL * 0.45, -halfW * 0.48);
    ctx.lineTo(halfL * 0.32, -halfW * 0.48);
    ctx.lineTo(halfL * 0.32, -halfW * 0.18);
    // Colossal delta wing leading edge sweep
    ctx.lineTo(-halfL * 0.68, -halfW);
    // Downturned waverider wingtip trailing edge
    ctx.lineTo(-halfL * 0.85, -halfW * 0.98);
    ctx.lineTo(-halfL * 0.90, -halfW * 0.52);
    // 6-Engine exhaust box
    ctx.lineTo(-halfL * 0.98, -halfW * 0.48);
    ctx.lineTo(-halfL, 0);
    // Starboard 6-engine exhaust box
    ctx.lineTo(-halfL * 0.98, halfW * 0.48);
    ctx.lineTo(-halfL * 0.90, halfW * 0.52);
    // Starboard downturned waverider wingtip
    ctx.lineTo(-halfL * 0.85, halfW * 0.98);
    ctx.lineTo(-halfL * 0.68, halfW);
    // Starboard delta wing leading edge sweep up to canard
    ctx.lineTo(halfL * 0.32, halfW * 0.18);
    // Starboard forward canard
    ctx.lineTo(halfL * 0.32, halfW * 0.48);
    ctx.lineTo(halfL * 0.45, halfW * 0.48);
    ctx.lineTo(halfL * 0.62, halfW * 0.16);
    ctx.lineTo(halfL * 0.85, halfW * 0.12);
  } else {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.65, -halfW * 0.25);
    ctx.lineTo(halfL * 0.15, -halfW);
    ctx.lineTo(-halfL * 0.25, -halfW);
    ctx.lineTo(-halfL * 0.45, -halfW * 0.35);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.45);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.2);
    ctx.lineTo(-halfL, 0);
    ctx.lineTo(-halfL * 0.96, halfW * 0.2);
    ctx.lineTo(-halfL * 0.85, halfW * 0.45);
    ctx.lineTo(-halfL * 0.45, halfW * 0.35);
    ctx.lineTo(-halfL * 0.25, halfW);
    ctx.lineTo(halfL * 0.15, halfW);
    ctx.lineTo(halfL * 0.65, halfW * 0.25);
  }
  ctx.closePath();
}

function drawAirframeBody(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number,
  length: number,
  width: number,
  hullColor: string,
  accentColor: string,
  deckColor: string,
  time: number,
  speed: number
) {
  ctx.fillStyle = hullColor;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2.5;

  drawAirframePath(ctx, bodyStyle, halfL, halfW);
  ctx.fill();
  ctx.stroke();

  // Specialized details per air vehicle model
  if (bodyStyle === 'chopper-apache' || bodyStyle === 'chopper') {
    // Apache Attack Helicopter: Chin-mounted 30mm chain gun, stepped tandem cockpit, spinning 4-blade rotor
    // Chin gun protruding from front
    ctx.fillStyle = '#09090b';
    ctx.fillRect(halfL * 0.75, -2, halfL * 0.32, 4);

    // Tandem Cockpit canopies (gunner in front, pilot behind) - tinted flight canopy
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(halfL * 0.45, -halfW * 0.14, halfL * 0.22, halfW * 0.28);
    ctx.fillRect(halfL * 0.15, -halfW * 0.16, halfL * 0.24, halfW * 0.32);

    // Stub weapon wings launch rails
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.05, -halfW * 0.95, 12, 4);
    ctx.fillRect(halfL * 0.05, halfW * 0.95 - 4, 12, 4);

    // Spinning Main Rotor disc & blades
    const rotorAngle = time * 32;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, halfL * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.rotate(rotorAngle);
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.88, 0);
    ctx.lineTo(halfL * 0.88, 0);
    ctx.moveTo(0, -halfL * 0.88);
    ctx.lineTo(0, halfL * 0.88);
    ctx.stroke();

    // Mast Longbow Fire Control Radar dome
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Tail Rotor spinning at stern
    const tailRotorAngle = time * 48;
    ctx.save();
    ctx.translate(-halfL * 0.95, 0);
    ctx.rotate(tailRotorAngle);
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 14);
    ctx.stroke();
    ctx.restore();
  } else if (bodyStyle === 'attacker-warthog') {
    // A-10 Thunderbolt II Warthog: 30mm GAU-8 Avenger cannon, twin high rear turbofans, twin H-tail
    // Protruding 7-barrel 30mm GAU-8 Avenger rotary cannon
    ctx.fillStyle = '#09090b';
    ctx.fillRect(halfL * 0.8, -halfW * 0.06, halfL * 0.32, 5);
    ctx.fillStyle = '#71717a';
    ctx.fillRect(halfL * 1.08, -halfW * 0.06 - 1, 3, 7);

    // Bubble Canopy (tinted military glass)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(halfL * 0.25, -halfW * 0.16, halfL * 0.3, halfW * 0.32);

    // Twin High-Mounted TF34 Turbofan Engine Pods
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.65, -halfW * 0.42, halfL * 0.38, halfW * 0.3, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.65, halfW * 0.12, halfL * 0.38, halfW * 0.3, 3);
    ctx.fill();
    ctx.stroke();
  } else if (bodyStyle === 'bomber-spirit') {
    // B-2 Spirit Stealth Flying Wing: Smooth radar-absorbent bodywork, internal weapon bays
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-halfL * 0.05, -halfW * 0.22, halfL * 0.35, halfW * 0.18);
    ctx.fillRect(-halfL * 0.05, halfW * 0.04, halfL * 0.35, halfW * 0.18);
    // Stealth cockpit glass slit
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(halfL * 0.45, -halfW * 0.12, halfL * 0.16, halfW * 0.24);
  } else if (bodyStyle === 'gunship-spectre') {
    // AC-130 Ghostrider: 4 turboprop engine nacelles with spinning propellers, port 105mm artillery cannon
    // Port 105mm artillery cannon barrel protruding sideways
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-halfL * 0.12, halfW * 0.28, 4, halfW * 0.32);

    // 4 Turboprop engine pods with spinning propeller discs
    const propAngle = time * 36;
    [-halfW * 0.72, -halfW * 0.42, halfW * 0.42, halfW * 0.72].forEach((ey, ei) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(halfL * 0.08, ey - 3.5, halfL * 0.2, 7);

      ctx.save();
      ctx.translate(halfL * 0.28, ey);
      ctx.rotate(propAngle + ei);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.stroke();
      ctx.restore();
    });

    // Cockpit
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(halfL * 0.6, -halfW * 0.18, halfL * 0.2, halfW * 0.36);
  } else if (bodyStyle === 'recon-blackbird') {
    // SR-71 Blackbird: Tandem stepped cockpits, stealth chines, twin J58 nacelles with spike shock cones & canted rudders
    // Stealth chine highlight lines
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.92, 0);
    ctx.lineTo(halfL * 0.15, -halfW * 0.42);
    ctx.moveTo(halfL * 0.92, 0);
    ctx.lineTo(halfL * 0.15, halfW * 0.42);
    ctx.stroke();

    // Stepped Tandem Cockpits: Pilot (front) and Reconnaissance Systems Officer (rear)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1.2;
    // Pilot canopy
    ctx.beginPath();
    ctx.ellipse(halfL * 0.55, 0, halfL * 0.10, halfW * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // RSO canopy
    ctx.beginPath();
    ctx.ellipse(halfL * 0.38, 0, halfL * 0.08, halfW * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Twin Mid-Wing J58 Nacelles
    [-halfW * 0.60, halfW * 0.60].forEach(ny => {
      // Nacelle body
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-halfL * 0.55, ny - halfW * 0.14, halfL * 0.65, halfW * 0.28, 3);
      ctx.fill();
      ctx.stroke();

      // Forward Shock Spike Cones (heat-treated black cone)
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(halfL * 0.20, ny);
      ctx.lineTo(halfL * 0.08, ny - halfW * 0.12);
      ctx.lineTo(halfL * 0.08, ny + halfW * 0.12);
      ctx.closePath();
      ctx.fill();

      // Canted Inward Vertical Stabilizers / Rudders on top of engine nacelles
      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-halfL * 0.45, ny);
      ctx.lineTo(-halfL * 0.82, ny);
      ctx.stroke();
    });

    // Mach 3+ Shock Diamond Afterburner Plumes when moving
    if (speed > 10) {
      const burnPulse = Math.sin(time * 30) * 0.25 + 0.75;
      [-halfW * 0.60, halfW * 0.60].forEach(ny => {
        ctx.save();
        // Outer cyan/violet Mach shock core
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.beginPath();
        ctx.ellipse(-halfL * 1.05, ny, 14 * burnPulse, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner intense white/blue supersonic flame
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.ellipse(-halfL * 1.00, ny, 7 * burnPulse, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shock diamonds
        ctx.fillStyle = 'rgba(249, 115, 22, 0.9)';
        ctx.fillRect(-halfL * 1.12, ny - 1.5, 4, 3);
        ctx.fillRect(-halfL * 1.20, ny - 1.5, 3, 3);
        ctx.restore();
      });
    }
  } else if (bodyStyle === 'bomber-valkyrie') {
    // XB-70 Valkyrie: Supersonic cockpit ridge, canards, underslung engine box, 6-engine exhaust pack
    // Forward triangular canards trim & elevator line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.35, -halfW * 0.45);
    ctx.lineTo(halfL * 0.35, -halfW * 0.20);
    ctx.moveTo(halfL * 0.35, halfW * 0.45);
    ctx.lineTo(halfL * 0.35, halfW * 0.20);
    ctx.stroke();

    // Raised Supersonic Cockpit Canopy Ramp
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.78, 0);
    ctx.lineTo(halfL * 0.58, -halfW * 0.08);
    ctx.lineTo(halfL * 0.42, -halfW * 0.08);
    ctx.lineTo(halfL * 0.42, halfW * 0.08);
    ctx.lineTo(halfL * 0.58, halfW * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Canted Vertical Stabilizers near the aft wing center
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.45, -halfW * 0.30);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.30);
    ctx.moveTo(-halfL * 0.45, halfW * 0.30);
    ctx.lineTo(-halfL * 0.88, halfW * 0.30);
    ctx.stroke();

    // Bank of SIX (6) General Electric YJ93 Afterburning Turbojet Engines side-by-side
    const engineYPositions = [
      -halfW * 0.35,
      -halfW * 0.21,
      -halfW * 0.07,
      halfW * 0.07,
      halfW * 0.21,
      halfW * 0.35,
    ];
    // Exhaust nozzle bezels
    engineYPositions.forEach(ey => {
      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-halfL * 0.95, ey, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // 6-Engine Afterburner Exhaust Plumes when moving
    if (speed > 15) {
      const burnPulse = Math.sin(time * 28) * 0.25 + 0.75;
      engineYPositions.forEach(ey => {
        ctx.save();
        ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
        ctx.beginPath();
        ctx.ellipse(-halfL * 1.05, ey, 10 * burnPulse, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.95)';
        ctx.beginPath();
        ctx.ellipse(-halfL * 1.00, ey, 5 * burnPulse, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
  } else {
    // Fighter jets (F-22 Raptor, F-35 Lightning, B-1B Lancer, MQ-9 Reaper)
    // Tinted Stealth Cockpit Bubble Canopy
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(halfL * 0.35, 0, halfL * 0.22, halfW * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Afterburner engine exhaust combustion plume (incandescent amber)
    if (speed > 20) {
      const burnPulse = Math.sin(time * 24) * 0.3 + 0.7;
      ctx.save();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.beginPath();
      ctx.ellipse(-halfL * 0.95, -halfW * 0.14, 8 * burnPulse, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(-halfL * 0.95, halfW * 0.14, 8 * burnPulse, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Incandescent orange afterburner core
      ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
      ctx.beginPath();
      ctx.ellipse(-halfL * 1.06, -halfW * 0.14, 12 * burnPulse, 2.5, 0, 0, Math.PI * 2);
      ctx.ellipse(-halfL * 1.06, halfW * 0.14, 12 * burnPulse, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawLandVehicleSilhouettePath(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number
) {
  if (bodyStyle === 'convoy-hummer') {
    ctx.moveTo(halfL, -halfW * 0.42);
    ctx.lineTo(halfL * 0.72, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.72, -halfW * 0.9);
    ctx.lineTo(-halfL, -halfW * 0.58);
    ctx.lineTo(-halfL, halfW * 0.58);
    ctx.lineTo(-halfL * 0.72, halfW * 0.9);
    ctx.lineTo(halfL * 0.72, halfW * 0.82);
    ctx.lineTo(halfL, halfW * 0.42);
  } else if (bodyStyle === 'pickup') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.95, -halfW * 0.68);
    ctx.lineTo(halfL * 0.35, -halfW * 0.75);
    ctx.lineTo(halfL * 0.3, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.9, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.72);
    ctx.lineTo(-halfL * 0.95, halfW * 0.72);
    ctx.lineTo(-halfL * 0.9, halfW * 0.9);
    ctx.lineTo(halfL * 0.3, halfW * 0.9);
    ctx.lineTo(halfL * 0.35, halfW * 0.75);
    ctx.lineTo(halfL * 0.95, halfW * 0.68);
  } else if (bodyStyle === 'car') {
    ctx.moveTo(halfL, 0);
    ctx.bezierCurveTo(halfL * 0.9, -halfW * 0.7, halfL * 0.5, -halfW * 0.85, halfL * 0.2, -halfW * 0.88);
    ctx.bezierCurveTo(-halfL * 0.2, -halfW * 0.88, -halfL * 0.6, -halfW * 0.82, -halfL * 0.9, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.95, 0);
    ctx.lineTo(-halfL * 0.9, halfW * 0.6);
    ctx.bezierCurveTo(-halfL * 0.6, halfW * 0.82, -halfL * 0.2, halfW * 0.88, halfL * 0.2, halfW * 0.88);
    ctx.bezierCurveTo(halfL * 0.5, halfW * 0.85, halfL * 0.9, halfW * 0.7, halfL, 0);
  } else if (bodyStyle === 'buggy') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.45);
    ctx.lineTo(halfL * 0.4, -halfW * 0.65);
    ctx.lineTo(0, -halfW * 0.75);
    ctx.lineTo(-halfL * 0.5, -halfW * 0.8);
    ctx.lineTo(-halfL * 0.9, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.95, 0);
    ctx.lineTo(-halfL * 0.9, halfW * 0.55);
    ctx.lineTo(-halfL * 0.5, halfW * 0.8);
    ctx.lineTo(0, halfW * 0.75);
    ctx.lineTo(halfL * 0.4, halfW * 0.65);
    ctx.lineTo(halfL * 0.85, halfW * 0.45);
  } else if (bodyStyle === 'flatbed') {
    ctx.moveTo(halfL, -halfW * 0.6);
    ctx.lineTo(halfL * 0.95, -halfW * 0.9);
    ctx.lineTo(halfL * 0.35, -halfW * 0.9);
    ctx.lineTo(halfL * 0.3, -halfW * 0.78);
    ctx.lineTo(halfL * 0.15, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, halfW * 0.92);
    ctx.lineTo(halfL * 0.15, halfW * 0.92);
    ctx.lineTo(halfL * 0.3, halfW * 0.78);
    ctx.lineTo(halfL * 0.35, halfW * 0.9);
    ctx.lineTo(halfL * 0.95, halfW * 0.9);
    ctx.lineTo(halfL, halfW * 0.6);
  } else if (bodyStyle === 'halftrack') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.9, -halfW * 0.55);
    ctx.lineTo(halfL * 0.35, -halfW * 0.65);
    ctx.lineTo(halfL * 0.28, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.92, halfW * 0.85);
    ctx.lineTo(halfL * 0.28, halfW * 0.85);
    ctx.lineTo(halfL * 0.35, halfW * 0.65);
    ctx.lineTo(halfL * 0.9, halfW * 0.55);
  } else if (bodyStyle === 'apc') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.88, -halfW * 0.8);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.8);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.96, halfW * 0.6);
    ctx.lineTo(-halfL * 0.88, halfW * 0.8);
    ctx.lineTo(halfL * 0.88, halfW * 0.8);
  } else if (bodyStyle === 'mlrs') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.82);
    ctx.lineTo(halfL * 0.3, -halfW * 0.82);
    ctx.lineTo(halfL * 0.22, -halfW * 0.7);
    ctx.lineTo(-halfL * 0.05, -halfW * 0.7);
    ctx.lineTo(-halfL * 0.12, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.92, halfW * 0.88);
    ctx.lineTo(-halfL * 0.12, halfW * 0.88);
    ctx.lineTo(-halfL * 0.05, halfW * 0.7);
    ctx.lineTo(halfL * 0.22, halfW * 0.7);
    ctx.lineTo(halfL * 0.3, halfW * 0.82);
    ctx.lineTo(halfL * 0.85, halfW * 0.82);
  } else if (bodyStyle === 'sph') {
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.8, -halfW * 0.78);
    ctx.lineTo(-halfL * 0.2, -halfW * 0.78);
    ctx.lineTo(-halfL * 0.25, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.95, halfW * 0.9);
    ctx.lineTo(-halfL * 0.25, halfW * 0.9);
    ctx.lineTo(-halfL * 0.2, halfW * 0.78);
    ctx.lineTo(halfL * 0.8, halfW * 0.78);
  } else if (bodyStyle === 'convoy-semi') {
    ctx.moveTo(halfL, -halfW * 0.32);
    ctx.lineTo(halfL * 0.88, -halfW * 0.62);
    ctx.lineTo(halfL * 0.38, -halfW * 0.72);
    ctx.lineTo(halfL * 0.28, -halfW * 0.38);
    ctx.lineTo(halfL * 0.20, -halfW * 0.84);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.84);
    ctx.lineTo(-halfL, -halfW * 0.58);
    ctx.lineTo(-halfL, halfW * 0.58);
    ctx.lineTo(-halfL * 0.96, halfW * 0.84);
    ctx.lineTo(halfL * 0.20, halfW * 0.84);
    ctx.lineTo(halfL * 0.28, halfW * 0.38);
    ctx.lineTo(halfL * 0.38, halfW * 0.72);
    ctx.lineTo(halfL * 0.88, halfW * 0.62);
    ctx.lineTo(halfL, halfW * 0.32);
  } else if (bodyStyle === 'semi-sam') {
    // Semi-truck SAM launcher: blunt square front bumper, cab step, fifth-wheel waist, wide launcher trailer bed
    ctx.moveTo(halfL, -halfW * 0.45);
    ctx.lineTo(halfL * 0.96, -halfW * 0.75);
    ctx.lineTo(halfL * 0.4, -halfW * 0.75);
    ctx.lineTo(halfL * 0.35, -halfW * 0.4);
    ctx.lineTo(halfL * 0.15, -halfW * 0.4);
    ctx.lineTo(halfL * 0.1, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.98, halfW * 0.6);
    ctx.lineTo(-halfL * 0.95, halfW * 0.92);
    ctx.lineTo(halfL * 0.1, halfW * 0.92);
    ctx.lineTo(halfL * 0.15, halfW * 0.4);
    ctx.lineTo(halfL * 0.35, halfW * 0.4);
    ctx.lineTo(halfL * 0.4, halfW * 0.75);
    ctx.lineTo(halfL * 0.96, halfW * 0.75);
    ctx.lineTo(halfL, halfW * 0.45);
  } else if (bodyStyle === 'heavy-tel') {
    // 10x10 Strategic TEL: Brutalist flat front with split cabs, heavy 10x10 flank armor and launch cradle
    ctx.moveTo(halfL, -halfW * 0.55);
    ctx.lineTo(halfL * 0.92, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.72);
    ctx.lineTo(-halfL * 0.98, halfW * 0.72);
    ctx.lineTo(-halfL * 0.88, halfW * 0.92);
    ctx.lineTo(halfL * 0.92, halfW * 0.92);
    ctx.lineTo(halfL, halfW * 0.55);
  } else {
    // Tank default
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.78, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.92, halfW * 0.65);
    ctx.lineTo(-halfL * 0.85, halfW * 0.82);
    ctx.lineTo(halfL * 0.78, halfW * 0.82);
  }
  ctx.closePath();
}

function drawRunningGear(
  ctx: CanvasRenderingContext2D,
  chassis: string,
  length: number,
  width: number,
  vehicle: ShipEntity,
  time: number
) {
  const halfL = length * 0.5;
  const halfW = width * 0.5;

  if (chassis === 'tracked') {
    // Left & Right Heavy Continuous Caterpillar Tracks
    const trackWidth = Math.max(8, width * 0.24);
    const trackColor = vehicle.model.spriteStyle.treadColor || '#18181b';
    const trackLength = length * 0.96;

    drawCaterpillarTrack(ctx, -halfL * 0.96, -halfW, trackLength, trackWidth, trackColor, vehicle.speed, time);
    drawCaterpillarTrack(ctx, -halfL * 0.96, halfW - trackWidth, trackLength, trackWidth, trackColor, vehicle.speed, time);
  } else if (chassis === 'half-track') {
    // Front Steer Wheels + Rear Caterpillar Tracks
    const trackWidth = Math.max(7, width * 0.22);
    const trackColor = '#18181b';
    const rearTrackLen = length * 0.58;

    // Rear tracks
    drawCaterpillarTrack(ctx, -halfL * 0.92, -halfW, rearTrackLen, trackWidth, trackColor, vehicle.speed, time);
    drawCaterpillarTrack(ctx, -halfL * 0.92, halfW - trackWidth, rearTrackLen, trackWidth, trackColor, vehicle.speed, time);

    // Front Steer Wheels
    const fwRadius = Math.min(10, width * 0.22);
    const fwX = halfL * 0.55;
    drawWheelTire(ctx, fwX, -halfW - 2, fwRadius, 6);
    drawWheelTire(ctx, fwX, halfW - 4, fwRadius, 6);
  } else if (chassis === 'dune-buggy') {
    // Protruding A-arms and Oversized Knobby Balloon Off-Road Tires
    const tireRadius = Math.min(13, width * 0.28);
    const tireWidth = 8;
    const frontX = halfL * 0.45;
    const rearX = -halfL * 0.55;

    // Suspension A-Arms
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Front left
    ctx.moveTo(frontX, -halfW * 0.4);
    ctx.lineTo(frontX, -halfW - 6);
    // Front right
    ctx.moveTo(frontX, halfW * 0.4);
    ctx.lineTo(frontX, halfW + 6);
    // Rear left
    ctx.moveTo(rearX, -halfW * 0.4);
    ctx.lineTo(rearX, -halfW - 6);
    // Rear right
    ctx.moveTo(rearX, halfW * 0.4);
    ctx.lineTo(rearX, halfW + 6);
    ctx.stroke();

    // 4 Wide Balloon Tires
    drawWheelTire(ctx, frontX, -halfW - 10, tireRadius, tireWidth, true);
    drawWheelTire(ctx, frontX, halfW + 2, tireRadius, tireWidth, true);
    drawWheelTire(ctx, rearX, -halfW - 11, tireRadius * 1.1, tireWidth + 1, true);
    drawWheelTire(ctx, rearX, halfW + 2, tireRadius * 1.1, tireWidth + 1, true);
  } else if (chassis === 'semi-truck') {
    // Semi-Truck Heavy Running Gear: Steer axle under cab, tandem drive axles under tractor, dual heavy tandem axles under trailer bed
    const tireRadius = Math.min(11, width * 0.22);
    const tireWidth = 6;
    const steerX = halfL * 0.72;
    const driveX = halfL * 0.38;
    const trailerAxle1 = -halfL * 0.35;
    const trailerAxle2 = -halfL * 0.72;

    // Steer wheels
    drawWheelTire(ctx, steerX, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, steerX, halfW - 4, tireRadius, tireWidth);

    // Tractor drive wheels
    drawWheelTire(ctx, driveX, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, driveX, halfW - 4, tireRadius, tireWidth);

    // Rear trailer tandem axles (articulated with trailer)
    const pivotX = halfL * 0.18;
    const relAngle = vehicle.articulatedAngle !== undefined
      ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
      : 0;

    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);

    drawWheelTire(ctx, trailerAxle1, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, trailerAxle1, halfW - 4, tireRadius, tireWidth);
    drawWheelTire(ctx, trailerAxle2, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, trailerAxle2, halfW - 4, tireRadius, tireWidth);
    ctx.restore();
  } else if (chassis === 'wheeled-10x10') {
    // 10x10 Giant Multi-Axle: 5 pairs of heavy all-terrain knobby tires evenly spaced along chassis
    const tireRadius = Math.min(12, width * 0.22);
    const tireWidth = 7;
    for (let i = 0; i < 5; i++) {
      const wx = halfL * 0.74 - (i / 4) * (halfL * 1.48);
      drawWheelTire(ctx, wx, -halfW - 3, tireRadius, tireWidth, true);
      drawWheelTire(ctx, wx, halfW - 4, tireRadius, tireWidth, true);
    }
  } else if (chassis === 'truck-flatbed' || chassis === 'wheeled-6x6') {
    // 6-Wheel Heavy Platform: 1 Front Steer Axle, 2 Rear Tandem Drive Axles
    const tireRadius = Math.min(11, width * 0.24);
    const tireWidth = 6;
    const frontX = halfL * 0.6;
    const rear1X = -halfL * 0.25;
    const rear2X = -halfL * 0.68;

    drawWheelTire(ctx, frontX, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, frontX, halfW - 4, tireRadius, tireWidth);
    drawWheelTire(ctx, rear1X, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, rear1X, halfW - 4, tireRadius, tireWidth);
    drawWheelTire(ctx, rear2X, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, rear2X, halfW - 4, tireRadius, tireWidth);
  } else if (chassis === 'wheeled-8x8') {
    // 8x8 Heavy Armored Wheeled Chassis
    const tireRadius = Math.min(10, width * 0.22);
    const tireWidth = 6;
    for (let i = 0; i < 4; i++) {
      const wx = -halfL * 0.72 + (i / 3) * (length * 0.72);
      drawWheelTire(ctx, wx, -halfW - 2, tireRadius, tireWidth);
      drawWheelTire(ctx, wx, halfW - 4, tireRadius, tireWidth);
    }
  } else {
    // Standard 4-Wheeled Vehicle (Pickups, Patrol Sedans, Light Armored Vans)
    const tireRadius = Math.min(10, width * 0.23);
    const tireWidth = 6;
    const frontX = halfL * 0.52;
    const rearX = -halfL * 0.58;

    drawWheelTire(ctx, frontX, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, frontX, halfW - 4, tireRadius, tireWidth);
    drawWheelTire(ctx, rearX, -halfW - 2, tireRadius, tireWidth);
    drawWheelTire(ctx, rearX, halfW - 4, tireRadius, tireWidth);
  }
}

function drawWheelTire(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  radius: number,
  width: number,
  isKnobby = false
) {
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(cx - radius, y, radius * 2, width, 2);
  ctx.fill();

  // Steel rim & lug nuts
  ctx.fillStyle = '#52525b';
  ctx.fillRect(cx - 2.5, y + 1, 5, width - 2);

  // Knobby tread cleats for off-road buggies
  if (isKnobby) {
    ctx.fillStyle = '#27272a';
    ctx.fillRect(cx - radius + 2, y, 3, 2);
    ctx.fillRect(cx, y, 3, 2);
    ctx.fillRect(cx + radius - 4, y, 3, 2);
  }
}

function drawVehicleBody(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number,
  length: number,
  width: number,
  hullColor: string,
  accentColor: string,
  deckColor: string,
  vehicle?: ShipEntity
) {
  ctx.fillStyle = hullColor;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2.5;

  if (bodyStyle === 'convoy-hummer') {
    // Purpose-built compact armored convoy Hummer: squared body, sloped hood,
    // four doors, ballistic glazing, and a central roof weapon ring.
    ctx.beginPath();
    drawLandVehicleSilhouettePath(ctx, bodyStyle, halfL, halfW);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(halfL * 0.28, -halfW * 0.66, 5, halfW * 1.32);
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.48, -halfW * 0.66, halfL * 0.7, halfW * 1.32);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfL * 0.48, -halfW * 0.66, halfL * 0.7, halfW * 1.32);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(halfL * 0.86, -halfW * 0.55, 3, 4);
    ctx.fillRect(halfL * 0.86, halfW * 0.55 - 4, 3, 4);
    ctx.fillStyle = '#111827';
    ctx.fillRect(-halfL * 0.93, -halfW * 0.55, 4, halfW * 1.1);
  } else if (bodyStyle === 'pickup') {
    // === PICKUP TRUCK (Technical / Armed Light Utility) ===
    // Hood & Bumper
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.95, -halfW * 0.68);
    ctx.lineTo(halfL * 0.35, -halfW * 0.75);
    ctx.lineTo(halfL * 0.3, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.9, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.72);
    ctx.lineTo(-halfL * 0.95, halfW * 0.72);
    ctx.lineTo(-halfL * 0.9, halfW * 0.9);
    ctx.lineTo(halfL * 0.3, halfW * 0.9);
    ctx.lineTo(halfL * 0.35, halfW * 0.75);
    ctx.lineTo(halfL * 0.95, halfW * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front Grille & Bullbar
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.92, -halfW * 0.5, 3, halfW);
    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(halfL * 0.9, -halfW * 0.65, 3, 4);
    ctx.fillRect(halfL * 0.9, halfW * 0.65 - 4, 3, 4);

    // Cab Windshield (Tinted Ballistic Glass)
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(halfL * 0.28, -halfW * 0.68);
    ctx.lineTo(halfL * 0.12, -halfW * 0.72);
    ctx.lineTo(halfL * 0.12, halfW * 0.72);
    ctx.lineTo(halfL * 0.28, halfW * 0.68);
    ctx.closePath();
    ctx.fill();

    // Cab Roof
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.2, -halfW * 0.72, halfL * 0.32, halfW * 1.44);

    // Rear Cab Window
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.24, -halfW * 0.55, 3, halfW * 1.1);

    // Open Truck Cargo Bed (Ribbed Slats)
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.88, -halfW * 0.72, halfL * 0.62, halfW * 1.44);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    for (let bx = -halfL * 0.82; bx < -halfL * 0.3; bx += 7) {
      ctx.beginPath();
      ctx.moveTo(bx, -halfW * 0.65);
      ctx.lineTo(bx, halfW * 0.65);
      ctx.stroke();
    }
  } else if (bodyStyle === 'car') {
    // === PATROL CAR / FAST ARMORED SEDAN ===
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.bezierCurveTo(halfL * 0.9, -halfW * 0.7, halfL * 0.5, -halfW * 0.85, halfL * 0.2, -halfW * 0.88);
    ctx.bezierCurveTo(-halfL * 0.2, -halfW * 0.88, -halfL * 0.6, -halfW * 0.82, -halfL * 0.9, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.95, 0);
    ctx.lineTo(-halfL * 0.9, halfW * 0.6);
    ctx.bezierCurveTo(-halfL * 0.6, halfW * 0.82, -halfL * 0.2, halfW * 0.88, halfL * 0.2, halfW * 0.88);
    ctx.bezierCurveTo(halfL * 0.5, halfW * 0.85, halfL * 0.9, halfW * 0.7, halfL, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front Bumper & Headlamps
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.88, -halfW * 0.4, 3, halfW * 0.8);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(halfL * 0.85, -halfW * 0.62, 3, 4);
    ctx.fillRect(halfL * 0.85, halfW * 0.62 - 4, 3, 4);

    // Front Windshield
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(halfL * 0.35, -halfW * 0.6);
    ctx.lineTo(halfL * 0.12, -halfW * 0.7);
    ctx.lineTo(halfL * 0.12, halfW * 0.7);
    ctx.lineTo(halfL * 0.35, halfW * 0.6);
    ctx.closePath();
    ctx.fill();

    // Sedan Roof
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.3, -halfW * 0.7, halfL * 0.42, halfW * 1.4);

    // Rear Window Glass
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.32, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.52, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.52, halfW * 0.55);
    ctx.lineTo(-halfL * 0.32, halfW * 0.65);
    ctx.closePath();
    ctx.fill();

    // Trunk lid
    ctx.fillStyle = hullColor;
    ctx.fillRect(-halfL * 0.85, -halfW * 0.55, halfL * 0.3, halfW * 1.1);
  } else if (bodyStyle === 'buggy') {
    // === DUNE BUGGY / FAST ATTACK VEHICLE ===
    // Minimalist tubular chassis tub
    ctx.beginPath();
    ctx.moveTo(halfL * 0.95, 0);
    ctx.lineTo(halfL * 0.8, -halfW * 0.45);
    ctx.lineTo(halfL * 0.3, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.1, -halfW * 0.75);
    ctx.lineTo(-halfL * 0.6, -halfW * 0.7);
    ctx.lineTo(-halfL * 0.9, -halfW * 0.5);
    ctx.lineTo(-halfL * 0.95, 0);
    ctx.lineTo(-halfL * 0.9, halfW * 0.5);
    ctx.lineTo(-halfL * 0.6, halfW * 0.7);
    ctx.lineTo(-halfL * 0.1, halfW * 0.75);
    ctx.lineTo(halfL * 0.3, halfW * 0.65);
    ctx.lineTo(halfL * 0.8, halfW * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Rally Lamps
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(halfL * 0.82, -halfW * 0.25, 2.5, 0, Math.PI * 2);
    ctx.arc(halfL * 0.82, halfW * 0.25, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Exposed Twin Racing Bucket Seats
    ctx.fillStyle = '#27272a';
    ctx.fillRect(-halfL * 0.15, -halfW * 0.55, halfL * 0.35, halfW * 0.45);
    ctx.fillRect(-halfL * 0.15, halfW * 0.1, halfL * 0.35, halfW * 0.45);

    // Exposed Rear V8 Engine Block & Twin Exhausts
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.85, -halfW * 0.45, halfL * 0.45, halfW * 0.9);
    ctx.fillStyle = '#71717a';
    ctx.fillRect(-halfL * 0.88, -halfW * 0.4, 4, 3);
    ctx.fillRect(-halfL * 0.88, halfW * 0.4 - 3, 4, 3);
  } else if (bodyStyle === 'flatbed') {
    // === HEAVY FLATBED TRUCK (Oshkosh HEMTT) ===
    // Heavy Box Cab-Over-Engine (COE)
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.6);
    ctx.lineTo(halfL * 0.96, -halfW * 0.92);
    ctx.lineTo(halfL * 0.3, -halfW * 0.92);
    ctx.lineTo(halfL * 0.25, -halfW * 0.8);
    ctx.lineTo(halfL * 0.1, -halfW * 0.95);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.95);
    ctx.lineTo(-halfL * 0.95, halfW * 0.95);
    ctx.lineTo(halfL * 0.1, halfW * 0.95);
    ctx.lineTo(halfL * 0.25, halfW * 0.8);
    ctx.lineTo(halfL * 0.3, halfW * 0.92);
    ctx.lineTo(halfL * 0.96, halfW * 0.92);
    ctx.lineTo(halfL, halfW * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front Armored Split Windshield
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.75, -halfW * 0.78, 6, halfW * 0.7);
    ctx.fillRect(halfL * 0.75, halfW * 0.08, 6, halfW * 0.7);

    // Headache Safety Rack behind Cab
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.2, -halfW * 0.85, 4, halfW * 1.7);

    // Industrial Flatbed Timber / Steel Deck with Cross Slats
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.9, -halfW * 0.85, halfL * 1.05, halfW * 1.7);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    for (let lx = -halfL * 0.85; lx < halfL * 0.15; lx += 9) {
      ctx.beginPath();
      ctx.moveTo(lx, -halfW * 0.82);
      ctx.lineTo(lx, halfW * 0.82);
      ctx.stroke();
    }
  } else if (bodyStyle === 'halftrack') {
    // === HALF-TRACK ARMORED COMBAT CARRIER ===
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.92, -halfW * 0.55);
    ctx.lineTo(halfL * 0.38, -halfW * 0.65);
    ctx.lineTo(halfL * 0.3, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.88);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.7);
    ctx.lineTo(-halfL * 0.95, halfW * 0.7);
    ctx.lineTo(-halfL * 0.92, halfW * 0.88);
    ctx.lineTo(halfL * 0.3, halfW * 0.88);
    ctx.lineTo(halfL * 0.38, halfW * 0.65);
    ctx.lineTo(halfL * 0.92, halfW * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Armored Hood Radiator Louvers
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.5, -halfW * 0.35, halfL * 0.35, halfW * 0.7);

    // Armored Driver Visor Slits
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(halfL * 0.28, -halfW * 0.6, 4, halfW * 0.5);
    ctx.fillRect(halfL * 0.28, halfW * 0.1, 4, halfW * 0.5);

    // Open Troop Tub with Interior Bench
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.88, -halfW * 0.72, halfL * 1.1, halfW * 1.44);
    // Left & right passenger benches
    ctx.fillStyle = '#27272a';
    ctx.fillRect(-halfL * 0.82, -halfW * 0.68, halfL * 0.95, 5);
    ctx.fillRect(-halfL * 0.82, halfW * 0.68 - 5, halfL * 0.95, 5);
  } else if (bodyStyle === 'ifv') {
    // === 8x8 STRYKER IFV (Angled Boat Glacis, Slat Cage Standoff Armor, Rear Troop Ramp) ===
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.92, -halfW * 0.45);
    ctx.lineTo(halfL * 0.65, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.85);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.68);
    ctx.lineTo(-halfL * 0.96, halfW * 0.68);
    ctx.lineTo(-halfL * 0.85, halfW * 0.85);
    ctx.lineTo(halfL * 0.65, halfW * 0.85);
    ctx.lineTo(halfL * 0.92, halfW * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side Slat / Cage Standoff Armor Bars (RPG Defense)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    for (let sx = -halfL * 0.8; sx <= halfL * 0.55; sx += 8) {
      ctx.beginPath();
      ctx.moveTo(sx, -halfW * 0.98);
      ctx.lineTo(sx, -halfW * 0.86);
      ctx.moveTo(sx, halfW * 0.86);
      ctx.lineTo(sx, halfW * 0.98);
      ctx.stroke();
    }
    // Lateral cage boundary wires
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.8, -halfW * 0.98);
    ctx.lineTo(halfL * 0.55, -halfW * 0.98);
    ctx.moveTo(-halfL * 0.8, halfW * 0.98);
    ctx.lineTo(halfL * 0.55, halfW * 0.98);
    ctx.stroke();

    // Driver 3-Prism Vision Blocks
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(halfL * 0.48, -halfW * 0.45, 3, 6);
    ctx.fillRect(halfL * 0.52, -halfW * 0.35, 3, 6);
    ctx.fillRect(halfL * 0.48, -halfW * 0.25, 3, 6);

    // Engine Grill on Front Right Deck
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.3, halfW * 0.15, halfL * 0.3, halfW * 0.55);

    // Rear Double Troop Access Doors
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.96, 0);
    ctx.lineTo(-halfL * 0.75, 0);
    ctx.stroke();
  } else if (bodyStyle === 'apc') {
    // === HEAVY ARMORED VAN / MONOLITHIC BEARCAT APC ===
    ctx.beginPath();
    ctx.moveTo(halfL * 0.98, -halfW * 0.6);
    ctx.lineTo(halfL * 0.98, halfW * 0.6);
    ctx.lineTo(halfL * 0.82, halfW * 0.9);
    ctx.lineTo(-halfL * 0.9, halfW * 0.9);
    ctx.lineTo(-halfL * 0.96, halfW * 0.65);
    ctx.lineTo(-halfL * 0.96, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.9, -halfW * 0.9);
    ctx.lineTo(halfL * 0.82, -halfW * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy Reinforced Steel Breaching Bumper / Ram
    ctx.fillStyle = '#09090b';
    ctx.fillRect(halfL * 0.92, -halfW * 0.75, 5, halfW * 1.5);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(halfL * 0.93, -halfW * 0.6, 2, 4);
    ctx.fillRect(halfL * 0.93, halfW * 0.6 - 4, 2, 4);

    // Split Armored Ballistic Glass Windshield
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.45, -halfW * 0.72, 6, halfW * 0.62);
    ctx.fillRect(halfL * 0.45, halfW * 0.1, 6, halfW * 0.62);

    // Side Firing Port Slits
    ctx.fillStyle = '#09090b';
    [-halfL * 0.1, -halfL * 0.35, -halfL * 0.6].forEach(px => {
      ctx.fillRect(px, -halfW * 0.86, 4, 2);
      ctx.fillRect(px, halfW * 0.86 - 2, 4, 2);
    });

    // Monocoque Roof Panel
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.75, -halfW * 0.65, halfL * 1.15, halfW * 1.3);
  } else if (bodyStyle === 'mlrs') {
    // === MLRS TACTICAL MISSILE CARRIER ===
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.85, -halfW * 0.85);
    ctx.lineTo(halfL * 0.3, -halfW * 0.85);
    ctx.lineTo(halfL * 0.22, -halfW * 0.72);
    ctx.lineTo(-halfL * 0.05, -halfW * 0.72);
    ctx.lineTo(-halfL * 0.12, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.9);
    ctx.lineTo(-halfL * 0.92, halfW * 0.9);
    ctx.lineTo(-halfL * 0.12, halfW * 0.9);
    ctx.lineTo(-halfL * 0.05, halfW * 0.72);
    ctx.lineTo(halfL * 0.22, halfW * 0.72);
    ctx.lineTo(halfL * 0.3, halfW * 0.85);
    ctx.lineTo(halfL * 0.85, halfW * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Armored Box Cabin with Window Shutters
    ctx.fillStyle = deckColor;
    ctx.fillRect(halfL * 0.3, -halfW * 0.75, halfL * 0.5, halfW * 1.5);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.68, -halfW * 0.55, 4, halfW * 1.1);
  } else if (bodyStyle === 'sph') {
    // === SELF-PROPELLED ARTILLERY HULL ===
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.8, -halfW * 0.8);
    ctx.lineTo(-halfL * 0.2, -halfW * 0.8);
    ctx.lineTo(-halfL * 0.25, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, halfW * 0.92);
    ctx.lineTo(-halfL * 0.25, halfW * 0.92);
    ctx.lineTo(-halfL * 0.2, halfW * 0.8);
    ctx.lineTo(halfL * 0.8, halfW * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forward Right Engine Deck Grill
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.25, -halfW * 0.65, halfL * 0.45, halfW * 0.6);
  } else if (bodyStyle === 'convoy-semi') {
    // === PURPOSE-BUILT MODE 3 CONVOY SEMI ===
    // Independent long-nose armored tractor; no geometry is shared with the
    // selectable flatbed or SAM tractor designs.
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.3);
    ctx.lineTo(halfL * 0.9, -halfW * 0.56);
    ctx.lineTo(halfL * 0.68, -halfW * 0.62);
    ctx.lineTo(halfL * 0.58, -halfW * 0.76);
    ctx.lineTo(halfL * 0.34, -halfW * 0.76);
    ctx.lineTo(halfL * 0.28, -halfW * 0.4);
    ctx.lineTo(halfL * 0.28, halfW * 0.4);
    ctx.lineTo(halfL * 0.34, halfW * 0.76);
    ctx.lineTo(halfL * 0.58, halfW * 0.76);
    ctx.lineTo(halfL * 0.68, halfW * 0.62);
    ctx.lineTo(halfL * 0.9, halfW * 0.56);
    ctx.lineTo(halfL, halfW * 0.3);
    ctx.closePath();
    ctx.fillStyle = hullColor;
    ctx.fill();
    ctx.stroke();

    // Low armored engine bonnet and inset grille.
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(halfL * 0.68, -halfW * 0.46, halfL * 0.25, halfW * 0.92, 5);
    ctx.fill();
    ctx.fillStyle = '#101418';
    ctx.fillRect(halfL * 0.92, -halfW * 0.34, 4, halfW * 0.68);
    ctx.strokeStyle = '#77808a';
    ctx.lineWidth = 1;
    for (let gy = -halfW * 0.28; gy <= halfW * 0.28; gy += 4) {
      ctx.beginPath();
      ctx.moveTo(halfL * 0.92, gy);
      ctx.lineTo(halfL * 0.96, gy);
      ctx.stroke();
    }

    // Faceted cab with one wraparound ballistic windshield.
    ctx.fillStyle = deckColor;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.64, -halfW * 0.65);
    ctx.lineTo(halfL * 0.58, -halfW * 0.72);
    ctx.lineTo(halfL * 0.35, -halfW * 0.68);
    ctx.lineTo(halfL * 0.29, -halfW * 0.4);
    ctx.lineTo(halfL * 0.29, halfW * 0.4);
    ctx.lineTo(halfL * 0.35, halfW * 0.68);
    ctx.lineTo(halfL * 0.58, halfW * 0.72);
    ctx.lineTo(halfL * 0.64, halfW * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.stroke();
    ctx.fillStyle = '#0b2230';
    ctx.beginPath();
    ctx.moveTo(halfL * 0.63, -halfW * 0.55);
    ctx.lineTo(halfL * 0.57, -halfW * 0.62);
    ctx.lineTo(halfL * 0.48, -halfW * 0.6);
    ctx.lineTo(halfL * 0.48, halfW * 0.6);
    ctx.lineTo(halfL * 0.57, halfW * 0.62);
    ctx.lineTo(halfL * 0.63, halfW * 0.55);
    ctx.closePath();
    ctx.fill();

    // Tractor running gear unique to the objective rig.
    ctx.fillStyle = '#090b0d';
    [halfL * 0.78, halfL * 0.36].forEach(wx => {
      ctx.fillRect(wx - 7, -halfW * 0.88, 14, 7);
      ctx.fillRect(wx - 7, halfW * 0.88 - 7, 14, 7);
    });

    const pivotX = halfL * 0.30;
    const relAngle = vehicle && vehicle.articulatedAngle !== undefined
      ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
      : 0;

    // Exposed fifth-wheel plate, kingpin and flexible armored draw connection.
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(pivotX, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(halfL * 0.34, 0);
    ctx.lineTo(halfL * 0.20, 0);
    ctx.stroke();

    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);

    // Significantly extended armored trailer with a tapered gooseneck and
    // beveled tail, designed specifically around mission cargo.
    ctx.beginPath();
    ctx.moveTo(halfL * 0.305, -halfW * 0.2);
    ctx.lineTo(halfL * 0.20, -halfW * 0.78);
    ctx.lineTo(-halfL * 0.9, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.99, -halfW * 0.55);
    ctx.lineTo(-halfL * 0.99, halfW * 0.55);
    ctx.lineTo(-halfL * 0.9, halfW * 0.82);
    ctx.lineTo(halfL * 0.20, halfW * 0.78);
    ctx.lineTo(halfL * 0.305, halfW * 0.2);
    ctx.closePath();
    ctx.fillStyle = hullColor;
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Raised sealed cargo spine and asymmetric service panels.
    ctx.fillStyle = deckColor;
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.88, -halfW * 0.62, halfL * 1.12, halfW * 1.24, 5);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let tx = -halfL * 0.78; tx < 0; tx += 15) {
      ctx.beginPath();
      ctx.moveTo(tx, -halfW * 0.58);
      ctx.lineTo(tx + 5, halfW * 0.58);
      ctx.stroke();
    }
    ctx.fillStyle = '#151a1f';
    ctx.fillRect(-halfL * 0.82, -halfW * 0.2, halfL * 0.7, halfW * 0.4);

    // Independent tandem trailer bogies rotate with the trailer.
    ctx.fillStyle = '#07090b';
    [-halfL * 0.72, -halfL * 0.86].forEach(wx => {
      ctx.fillRect(wx - 7, -halfW * 0.98, 14, 8);
      ctx.fillRect(wx - 7, halfW * 0.98 - 8, 14, 8);
    });
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-halfL * 0.985, -halfW * 0.48, 3, halfW * 0.96);
    ctx.restore();
  } else if (bodyStyle === 'semi-sam') {
    // === PATRIOT MOBILE SAM ARTICULATED SEMI-TRUCK ===
    // 1. Tractor Unit (Cab-over military tractor with authentic truck front)
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.45);
    ctx.lineTo(halfL * 0.96, -halfW * 0.75);
    ctx.lineTo(halfL * 0.35, -halfW * 0.75);
    ctx.lineTo(halfL * 0.22, -halfW * 0.42);
    ctx.lineTo(halfL * 0.12, -halfW * 0.42);
    ctx.lineTo(halfL * 0.12, halfW * 0.42);
    ctx.lineTo(halfL * 0.22, halfW * 0.42);
    ctx.lineTo(halfL * 0.35, halfW * 0.75);
    ctx.lineTo(halfL * 0.96, halfW * 0.75);
    ctx.lineTo(halfL, halfW * 0.45);
    ctx.closePath();
    ctx.fillStyle = hullColor;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Heavy Flat Steel Bumper & Tow Shackles
    ctx.fillStyle = '#09090b';
    ctx.fillRect(halfL * 0.96, -halfW * 0.72, 4, halfW * 1.44);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(halfL * 0.97, -halfW * 0.62, 2, 4);
    ctx.fillRect(halfL * 0.97, halfW * 0.62 - 4, 2, 4);

    // Radiator Grille & Chrome/Steel Vertical Slats
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.91, -halfW * 0.42, 4, halfW * 0.84);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1;
    for (let gy = -halfW * 0.35; gy < halfW * 0.35; gy += 4) {
      ctx.beginPath();
      ctx.moveTo(halfL * 0.91, gy);
      ctx.lineTo(halfL * 0.95, gy);
      ctx.stroke();
    }

    // Cab Hood & Split Ballistic Glass Windshield
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(halfL * 0.62, -halfW * 0.65, 6, halfW * 0.58);
    ctx.fillRect(halfL * 0.62, halfW * 0.07, 6, halfW * 0.58);

    // Cab Roof and Air Deflector
    ctx.fillStyle = deckColor;
    ctx.fillRect(halfL * 0.38, -halfW * 0.68, halfL * 0.22, halfW * 1.36);

    // Vertical Dual Chrome Exhaust Stacks behind cab
    ctx.fillStyle = '#71717a';
    ctx.fillRect(halfL * 0.35, -halfW * 0.72, 4, 4);
    ctx.fillRect(halfL * 0.35, halfW * 0.72 - 4, 4, 4);

    // Articulated Fifth-Wheel Coupling Plate & Kingpin Joint
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(halfL * 0.18, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(halfL * 0.18, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // 2. Articulated Launcher Trailer Bed (pivoting around fifth-wheel hitch at halfL * 0.18)
    const pivotX = halfL * 0.18;
    const relAngle = vehicle && vehicle.articulatedAngle !== undefined
      ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
      : 0;

    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);

    // Gooseneck arm and trailer perimeter
    ctx.beginPath();
    ctx.moveTo(halfL * 0.22, -halfW * 0.25);
    ctx.lineTo(halfL * 0.12, -halfW * 0.45);
    ctx.lineTo(halfL * 0.10, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.95, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.6);
    ctx.lineTo(-halfL * 0.98, halfW * 0.6);
    ctx.lineTo(-halfL * 0.95, halfW * 0.92);
    ctx.lineTo(halfL * 0.10, halfW * 0.92);
    ctx.lineTo(halfL * 0.12, halfW * 0.45);
    ctx.lineTo(halfL * 0.22, halfW * 0.25);
    ctx.closePath();
    ctx.fillStyle = hullColor;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Launcher Trailer Deck Diamond-Plate Tread
    ctx.fillStyle = deckColor;
    ctx.fillRect(-halfL * 0.92, -halfW * 0.85, halfL * 1.0, halfW * 1.7);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    for (let tx = -halfL * 0.85; tx < halfL * 0.05; tx += 12) {
      ctx.beginPath();
      ctx.moveTo(tx, -halfW * 0.8);
      ctx.lineTo(tx, halfW * 0.8);
      ctx.stroke();
    }

    // Rear Hazard Striping & Mudflaps
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-halfL * 0.96, -halfW * 0.85, 3, halfW * 1.7);

    ctx.restore();
  } else if (bodyStyle === 'heavy-tel') {
    // === GOLIATH 10x10 STRATEGIC TEL MISSILE CARRIER ===
    // Giant Brutalist Heavy Multi-Axle Monolithic Chassis
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.55);
    ctx.lineTo(halfL * 0.92, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.88, -halfW * 0.92);
    ctx.lineTo(-halfL * 0.98, -halfW * 0.72);
    ctx.lineTo(-halfL * 0.98, halfW * 0.72);
    ctx.lineTo(-halfL * 0.88, halfW * 0.92);
    ctx.lineTo(halfL * 0.92, halfW * 0.92);
    ctx.lineTo(halfL, halfW * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Massive Reinforced Front Push Bumper with Dual Tow Shackles
    ctx.fillStyle = '#09090b';
    ctx.fillRect(halfL * 0.92, -halfW * 0.88, 7, halfW * 1.76);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(halfL * 0.94, -halfW * 0.4, 3, halfW * 0.8);

    // Front Headlights & Fog Lights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(halfL * 0.93, -halfW * 0.78, 3, 5);
    ctx.fillRect(halfL * 0.93, halfW * 0.78 - 5, 3, 5);

    // Distinctive Split Command Cabs (Left Driver Cab & Right Systems Officer Cab)
    // Left Cab
    ctx.fillStyle = deckColor;
    ctx.fillRect(halfL * 0.62, -halfW * 0.88, halfL * 0.28, halfW * 0.72);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(halfL * 0.84, -halfW * 0.84, 5, halfW * 0.64);
    // Right Cab
    ctx.fillStyle = deckColor;
    ctx.fillRect(halfL * 0.62, halfW * 0.16, halfL * 0.28, halfW * 0.72);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(halfL * 0.84, halfW * 0.20, 5, halfW * 0.64);

    // Central Engine Radiator Bay between split cabs
    ctx.fillStyle = '#18181b';
    ctx.fillRect(halfL * 0.64, -halfW * 0.12, halfL * 0.24, halfW * 0.24);

    // Heavy Hydraulic Stabilizer Outrigger Pads (4 deployment jacks)
    ctx.fillStyle = '#09090b';
    [halfL * 0.35, halfL * 0.05, -halfL * 0.45, -halfL * 0.75].forEach(ox => {
      ctx.fillRect(ox, -halfW * 0.98, 8, 4);
      ctx.fillRect(ox, halfW * 0.98 - 4, 8, 4);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ox + 2, -halfW * 0.96, 4, 2);
      ctx.fillRect(ox + 2, halfW * 0.96 - 2, 4, 2);
      ctx.fillStyle = '#09090b';
    });

    // Central Long Missile Cradle & Blast Shroud Base
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.82, -halfW * 0.55, halfL * 1.4, halfW * 1.1);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfL * 0.82, -halfW * 0.55, halfL * 1.4, halfW * 1.1);
  } else {
    // === TANK (Main Battle Tank / Heavy Tank) ===
    ctx.beginPath();
    ctx.moveTo(halfL, 0);
    ctx.lineTo(halfL * 0.78, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.85, -halfW * 0.82);
    ctx.lineTo(-halfL * 0.92, -halfW * 0.65);
    ctx.lineTo(-halfL * 0.92, halfW * 0.65);
    ctx.lineTo(-halfL * 0.85, halfW * 0.82);
    ctx.lineTo(halfL * 0.78, halfW * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side ERA Armor Skirts
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.7, -halfW * 0.8);
    ctx.lineTo(halfL * 0.65, -halfW * 0.8);
    ctx.moveTo(-halfL * 0.7, halfW * 0.8);
    ctx.lineTo(halfL * 0.65, halfW * 0.8);
    ctx.stroke();

    // Rear Engine Louvers
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.8, -halfW * 0.45, halfL * 0.45, halfW * 0.9);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    for (let lx = -halfL * 0.76; lx < -halfL * 0.4; lx += 5) {
      ctx.beginPath();
      ctx.moveTo(lx, -halfW * 0.38);
      ctx.lineTo(lx, halfW * 0.38);
      ctx.stroke();
    }
  }
}

function drawVehicleSuperstructure(
  ctx: CanvasRenderingContext2D,
  bodyStyle: string,
  halfL: number,
  halfW: number,
  width: number,
  deckColor: string,
  accentColor: string,
  vehicle?: ShipEntity
) {
  if (bodyStyle === 'convoy-hummer') {
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-halfL * 0.05, 0, Math.min(9, halfW * 0.55), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (bodyStyle === 'pickup') {
    // Tubular Bed Rollbar & Pedestal Mount
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.28, -halfW * 0.68);
    ctx.lineTo(-halfL * 0.28, halfW * 0.68);
    ctx.stroke();

    // Weapon Pintle Pedestal Mount in bed
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(-halfL * 0.55, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (bodyStyle === 'car') {
    // Low-profile Roof Tactical Beacon / Light Bar
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-halfL * 0.1, -halfW * 0.45, 6, halfW * 0.9);
    // Beacon lenses (grounded blue & amber)
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-halfL * 0.1 + 1, -halfW * 0.4, 4, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-halfL * 0.1 + 1, halfW * 0.4 - 4, 4, 4);
  } else if (bodyStyle === 'buggy') {
    // Tubular Roll Cage Cross Members
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfL * 0.2, -halfW * 0.5);
    ctx.lineTo(-halfL * 0.4, halfW * 0.5);
    ctx.moveTo(halfL * 0.2, halfW * 0.5);
    ctx.lineTo(-halfL * 0.4, -halfW * 0.5);
    ctx.stroke();
  } else if (bodyStyle === 'flatbed') {
    // Heavy Cargo Crane / Central Hitch Ring
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(-halfL * 0.35, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (bodyStyle === 'halftrack') {
    // Perimeter Weapon Skate Ring
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-halfL * 0.2, 0, halfW * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (bodyStyle === 'ifv') {
    // Stryker MCT-30 Kongsberg Remote Turret & Electro-Optical Ball Sight
    const turretX = halfL * 0.08;
    const turretRadius = Math.min(14, width * 0.32);

    // Low-profile unmanned turret base
    ctx.fillStyle = deckColor;
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(turretX - turretRadius, -turretRadius * 0.8, turretRadius * 2, turretRadius * 1.6, 4);
    ctx.fill();
    ctx.stroke();

    // Electro-optical ball sensor / thermal sight
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(turretX + turretRadius * 0.5, -turretRadius * 0.45, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Quad Smoke Discharger Clusters on Turret Flanks
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(turretX - turretRadius * 0.4, -turretRadius * 0.95, 6, 2.5);
    ctx.fillRect(turretX - turretRadius * 0.4, turretRadius * 0.95 - 2.5, 6, 2.5);
  } else if (bodyStyle === 'apc') {
    // BearCat Octagonal Armored Gunner Cupola & Shield
    const cupolaX = halfL * 0.12;
    const cupolaRadius = Math.min(13, width * 0.28);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cupolaX, 0, cupolaRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Forward Gunner Shield Notch & Vision Blocks
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cupolaX + cupolaRadius * 0.6, -3, 3, 6);
  } else if (bodyStyle === 'sph') {
    // SPH Massive Rear Box Turret
    const turretRadius = Math.min(22, width * 0.45);
    const turretX = -halfL * 0.3;

    ctx.fillStyle = deckColor;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(turretX - turretRadius * 0.85, -turretRadius * 0.8, turretRadius * 1.9, turretRadius * 1.6, 3);
    ctx.fill();
    ctx.stroke();

    // Commander Cupola
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(turretX - 3, -turretRadius * 0.35, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (bodyStyle === 'convoy-semi') {
    // The cargo rig carries no SAM launcher; its hardpoints render as compact
    // defensive mounts over the articulated armored trailer.
  } else if (bodyStyle === 'semi-sam') {
    // Mobile SAM Turntable & Dual Missile Canister Launch Pack
    const pivotX = halfL * 0.18;
    const relAngle = vehicle && vehicle.articulatedAngle !== undefined
      ? normalizeAngle(vehicle.articulatedAngle - vehicle.angle)
      : 0;

    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(relAngle);
    ctx.translate(-pivotX, 0);

    const samTurntableX = -halfL * 0.42;

    // Heavy Azimuth Turntable Ring on trailer
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(samTurntableX, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Twin High-Elevation SAM Canister Launch Pods
    ctx.fillStyle = '#27272a';
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.8;

    // Left Canister Pod (Pair of square missile tubes)
    ctx.beginPath();
    ctx.roundRect(samTurntableX - 18, -halfW * 0.65, 36, halfW * 0.5, 2);
    ctx.fill();
    ctx.stroke();
    // Red Missile Cap indicators
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(samTurntableX + 16, -halfW * 0.62, 3, halfW * 0.2);
    ctx.fillRect(samTurntableX + 16, -halfW * 0.35, 3, halfW * 0.2);

    // Right Canister Pod (Pair of square missile tubes)
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(samTurntableX - 18, halfW * 0.15, 36, halfW * 0.5, 2);
    ctx.fill();
    ctx.stroke();
    // Red Missile Cap indicators
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(samTurntableX + 16, halfW * 0.18, 3, halfW * 0.2);
    ctx.fillRect(samTurntableX + 16, halfW * 0.45, 3, halfW * 0.2);

    // Central Hydraulic Elevation Ram & Tracking Radar Gimbal
    ctx.fillStyle = '#09090b';
    ctx.fillRect(samTurntableX - 12, -3, 24, 6);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(samTurntableX + 8, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  } else if (bodyStyle === 'heavy-tel') {
    // 10x10 Strategic TEL: Massive Cylindrical Strategic Missile Canister Tube
    const tubeStartX = -halfL * 0.82;
    const tubeLength = halfL * 1.35;
    const tubeRadius = halfW * 0.42;

    // Heavy Hydraulic Elevation Hinges at Aft
    ctx.fillStyle = '#09090b';
    ctx.fillRect(tubeStartX - 4, -tubeRadius - 2, 8, (tubeRadius + 2) * 2);

    // Giant Cylindrical Transporter-Erector Missile Tube
    ctx.fillStyle = deckColor;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(tubeStartX, -tubeRadius, tubeLength, tubeRadius * 2, 4);
    ctx.fill();
    ctx.stroke();

    // Heavy Metal Structural Bands & Reinforcement Hoops
    ctx.fillStyle = '#09090b';
    for (let hx = tubeStartX + 12; hx < tubeStartX + tubeLength - 10; hx += 16) {
      ctx.fillRect(hx, -tubeRadius, 3.5, tubeRadius * 2);
    }

    // Forward Missile Aerodynamic Nose Cap Latches
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(tubeStartX + tubeLength, 0, tubeRadius * 0.75, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Twin Forward Hydraulic Lift Cylinders
    ctx.fillStyle = '#71717a';
    ctx.fillRect(tubeStartX + tubeLength * 0.35, -tubeRadius - 4, 18, 3);
    ctx.fillRect(tubeStartX + tubeLength * 0.35, tubeRadius + 1, 18, 3);
  } else {
    // Standard / Heavy Tank Turret
    const turretX = halfL > 42 ? 4 : -2;
    const turretRadius = Math.min(18, width * 0.38);

    // Turret Ring
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(turretX, 0, turretRadius + 2, 0, Math.PI * 2);
    ctx.fill();

    // Main Angular Turret Housing
    ctx.fillStyle = deckColor;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(turretX + turretRadius * 1.1, 0);
    ctx.lineTo(turretX + turretRadius * 0.65, -turretRadius * 0.9);
    ctx.lineTo(turretX - turretRadius * 0.9, -turretRadius * 0.75);
    ctx.lineTo(turretX - turretRadius * 0.9, turretRadius * 0.75);
    ctx.lineTo(turretX + turretRadius * 0.65, turretRadius * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Commander Hatch & Sight
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(turretX - 3, -turretRadius * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();

    // Smoke Dischargers
    ctx.fillStyle = '#52525b';
    ctx.fillRect(turretX + 2, -turretRadius * 0.85, 4, 3);
    ctx.fillRect(turretX + 2, turretRadius * 0.85 - 3, 4, 3);
  }
}

function drawCaterpillarTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  color: string,
  speed: number,
  time: number
) {
  // Track rubber belt
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(x, y, len, w, 4);
  ctx.fill();

  // Track link segments
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  const linkSpacing = 5;
  const offset = ((speed * time * 0.5) % linkSpacing + linkSpacing) % linkSpacing;
  for (let lx = x + offset; lx < x + len; lx += linkSpacing) {
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + w);
    ctx.stroke();
  }

  // Steel Road Wheels (Drive sprocket, Idler, Road wheels)
  const wheelRadius = w * 0.42;
  const wheelY = y + w * 0.5;
  const wheelCount = Math.max(4, Math.floor(len / 14));
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;

  for (let i = 0; i < wheelCount; i++) {
    const wx = x + (i + 0.5) * (len / wheelCount);
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Hub nut
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(wx - 1, wheelY - 1, 2, 2);
    ctx.fillStyle = '#475569';
  }
}

function drawTrailer(
  ctx: CanvasRenderingContext2D,
  vehicle: ShipEntity,
  time: number
) {
  const trailer = vehicle.towedTrailer;
  if (!trailer) return;

  const def = trailer.def;
  const hitchDist = vehicle.model.hullLength * 0.48 + 5;
  const hitchX = vehicle.x - Math.cos(vehicle.angle) * hitchDist;
  const hitchY = vehicle.y - Math.sin(vehicle.angle) * hitchDist;

  // 1. Tow Hitch Drawbar connecting vehicle to trailer
  ctx.save();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(hitchX, hitchY);
  ctx.lineTo(trailer.x, trailer.y);
  ctx.stroke();

  // Hitch Coupler Ball Pin
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(hitchX, hitchY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Trailer Body
  ctx.save();
  ctx.translate(trailer.x, trailer.y);
  ctx.rotate(trailer.angle);

  const halfL = def.length * 0.5;
  const halfW = def.width * 0.5;

  // Trailer Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(-halfL - 2, -halfW - 2, def.length + 4, def.width + 4, 4);
  ctx.fill();

  // Trailer Dual Wheels (Left & Right)
  const wheelL = 12;
  const wheelW = 4.5;
  ctx.fillStyle = '#0f172a';
  // Left wheels
  ctx.fillRect(-wheelL * 0.5, -halfW - wheelW + 1, wheelL, wheelW);
  // Right wheels
  ctx.fillRect(-wheelL * 0.5, halfW - 1, wheelL, wheelW);

  // Trailer Steel Frame
  ctx.fillStyle = def.color || '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-halfL, -halfW, def.length, def.width, 3);
  ctx.fill();
  ctx.stroke();

  // Hazard Safety Chevrons on Trailer Bumper
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-halfL, -halfW * 0.6, 2.5, halfW * 1.2);

  // 3. Trailer Payload by Category
  if (def.category === 'artillery') {
    // M777 Howitzer: Long 155mm barrel with dual-baffle muzzle brake + hydraulic stabilizers
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-4, -6, 10, 12);
    // Recoil cylinder
    ctx.fillStyle = '#64748b';
    ctx.fillRect(4, -3, 8, 6);
    // 155mm Long Barrel
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(8, -1.8, 26, 3.6);
    // Muzzle Brake
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(32, -3, 4, 6);
  } else if (def.category === 'missile') {
    // MLRS Rocket Pod: 6-tube rocket canister box with elevation rams
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfL * 0.6, -halfW * 0.75, def.length * 0.8, def.width * 0.75);
    ctx.fillRect(-halfL * 0.6, -halfW * 0.75, def.length * 0.8, def.width * 0.75);

    // 6 Rocket Tubes (grid)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const tx = -halfL * 0.4 + c * 7;
        const ty = -halfW * 0.45 + r * 6;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(tx, ty, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (def.category === 'defense') {
    // C-RAM Anti-Air Gatling Turret + Tracking Radome
    ctx.fillStyle = '#475569';
    ctx.fillRect(-6, -6, 12, 12);
    // White radar dome
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-2, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 6-barrel Gatling gun forward
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(4, -1.5, 14, 3);
  } else if (def.category === 'support') {
    if (def.repairRate) {
      // Nanite Repair Tender: Generator turbine + robotic welding arm
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Articulated welding arm
      const armAngle = Math.sin(time * 3) * 0.6;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(armAngle) * 12, Math.sin(armAngle) * 12);
      ctx.stroke();

      // Repair emitter glow
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(Math.cos(armAngle) * 12, Math.sin(armAngle) * 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.electronicWarfare) {
      // EW Jammer Sentinel: Rotating parabolic dish and radar pulses
      ctx.fillStyle = '#312e81';
      ctx.fillRect(-6, -6, 12, 12);

      // Rotating radar dish
      const dishAngle = time * 4;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 7, dishAngle - 0.7, dishAngle + 0.7);
      ctx.stroke();

      // Antenna mast
      ctx.fillStyle = '#c7d2fe';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // Trailer Status HUD
  ctx.save();
  const trHudY = trailer.y - 18;
  const trBarW = 36;
  const trHpRatio = Math.max(0, Math.min(1, trailer.currentHp / trailer.maxHp));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(trailer.x - trBarW / 2 - 1, trHudY, trBarW + 2, 4);
  ctx.fillStyle = trHpRatio > 0.5 ? '#10b981' : '#f59e0b';
  ctx.fillRect(trailer.x - trBarW / 2, trHudY + 0.5, trBarW * trHpRatio, 3);
  ctx.restore();
}

function drawModernWeapon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  arc: string,
  compId: string | null,
  team: string
) {
  ctx.save();
  ctx.translate(x, y);

  if (!compId) {
    // Empty mount socket
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Determine facing rotation based on hardpoint arc
  let angle = 0;
  if (arc === 'broadside-left') angle = -Math.PI / 2;
  else if (arc === 'broadside-right') angle = Math.PI / 2;
  else if (arc === 'stern') angle = Math.PI;
  ctx.rotate(angle);

  if (compId === 'm256-120mm-cannon' || compId === 'mk45-naval-gun' || compId === 'heavy-cannon') {
    // 120mm Smoothbore Tank Gun Turret
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(3, -4.5);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.lineTo(3, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gun barrel with bore evacuator
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(5, -1.3, 14, 2.6);
    // Bore evacuator collar
    ctx.fillStyle = '#475569';
    ctx.fillRect(11, -2, 4, 4);
    // Muzzle brake
    ctx.fillStyle = '#64748b';
    ctx.fillRect(19, -1.8, 2, 3.6);
  } else if (compId === '155mm-howitzer-turret' || compId === 'long-mortar') {
    // 155mm Heavy Artillery Gun Turret
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, -2, 18, 4);
    // Large dual-baffle muzzle brake
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(23, -3.2, 3, 6.4);
  } else if (compId === 'bushmaster-30mm' || compId === 'phalanx-ciws' || compId === 'rapid-swivel') {
    // 30mm Bushmaster Autocannon / CIWS
    ctx.fillStyle = '#475569';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, -1, 11, 2);
    // Flash suppressor
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(13, -1.5, 2, 3);
  } else if (compId === 'himars-rocket-pack' || compId === 'vls-tomahawk') {
    // 6-pack Rocket Pod Launcher
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.strokeRect(-5, -4, 10, 8);
    ctx.fillRect(-5, -4, 10, 8);
    // 6 rocket tube nozzles
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-3.5, -2.5, 3, 2);
    ctx.fillRect(0.5, -2.5, 3, 2);
    ctx.fillRect(-3.5, 0.5, 3, 2);
    ctx.fillRect(0.5, 0.5, 3, 2);
  } else if (compId === 'atgm-tow-missile' || compId === 'harpoon-missile') {
    // Twin ATGM Missile Tube Launcher (olive drab canister with black launch caps)
    ctx.fillStyle = '#3f4f3e';
    ctx.fillRect(-4, -3.5, 8, 7);
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(3, -3, 5, 2.5);
    ctx.fillRect(3, 0.5, 5, 2.5);
  } else if (compId === 'em-railgun') {
    // Electromagnetic Railgun (tactical gunmetal shroud with titanium rails)
    ctx.fillStyle = '#27272a';
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2, -5);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-6, 4);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin acceleration rails
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(5, -2.5, 13, 1.5);
    ctx.fillRect(5, 1.0, 13, 1.5);
  } else if (compId === 'stinger-manpads' || compId === 'searam-launcher') {
    // Dual Stinger / SAM Launcher Box (tactical olive/slate ordnance housing)
    ctx.fillStyle = '#334155';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(3, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (compId === 'reactive-armor' || compId === 'chobham-armor' || compId === 'composite-armor') {
    // ERA Explosive Reactive Armor Block
    ctx.fillStyle = '#475569';
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4.5, -4.5, 9, 9);
  } else if (compId === 'diesel-turbo-pack' || compId === 'hybrid-electric' || compId === 'gas-turbine') {
    // Power Pack Engine Grill
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Tactical support equipment / antenna module
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawVehicleOverheadHUD(ctx: CanvasRenderingContext2D, ship: ShipEntity) {
  const hudY = ship.y - ship.model.hullWidth - 28;
  const barWidth = 72;
  const barHeight = 6;

  ctx.save();

  // Vehicle Callout & Team Color
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = ship.team === 'player' ? '#f1f5f9' : '#fee2e2';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 4;
  ctx.fillText(
    `${ship.isPlayer ? '⭐ ' : ''}${ship.name}`,
    ship.x,
    hudY - 14
  );

  // Combat role & Towed trailer status badge
  const role = ship.model.combatRole || 'Combat Vehicle';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = ship.team === 'player' ? '#93c5fd' : '#fca5a5';
  ctx.fillText(
    `${ship.isPlayer && ship.team === 'enemy' ? '[RED TEAM] ' : ''}[${role.toUpperCase()}]${ship.towedTrailer ? ` + ${ship.towedTrailer.def.name.toUpperCase()}` : ''}`,
    ship.x,
    hudY - 3
  );
  ctx.shadowBlur = 0;

  // Health Bar Background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(ship.x - barWidth / 2 - 1, hudY + 8, barWidth + 2, barHeight + 2);

  // Health Fill
  const hpRatio = Math.max(0, Math.min(1, ship.currentHp / ship.maxHp));
  let hpColor = '#22c55e';
  if (hpRatio < 0.3) hpColor = '#ef4444';
  else if (hpRatio < 0.6) hpColor = '#eab308';

  ctx.fillStyle = hpColor;
  ctx.fillRect(ship.x - barWidth / 2, hudY + 9, barWidth * hpRatio, barHeight);

  // Armor border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(ship.x - barWidth / 2 - 1, hudY + 8, barWidth + 2, barHeight + 2);

  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile) {
  ctx.save();

  if (proj.type === 'railgun') {
    // Electromagnetic Railgun Slug: Hypervelocity kinetic sabot round with amber vapor trail
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);

    // High-temperature aerodynamic plasma friction trail
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();

    // Solid core tungsten penetrator
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, -1.5, 20, 3);
  } else if (proj.type === 'missile') {
    // Guided cruise missile
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);

    // Missile body
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-8, -2, 14, 4);

    // Warhead tip
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(10, 0);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fill();

    // Stabilizing fins
    ctx.fillStyle = '#475569';
    ctx.fillRect(-7, -3.5, 3, 7);

    // Rocket exhaust flame
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-8, -1.5);
    ctx.lineTo(-14 - Math.random() * 5, 0);
    ctx.lineTo(-8, 1.5);
    ctx.closePath();
    ctx.fill();
  } else if (proj.type === 'torpedo') {
    // Heavyweight Acoustic Homing Torpedo
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#334155';
    ctx.fillRect(-7, -2.5, 14, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(5, -2.5, 3, 5);
  } else if (proj.type === 'flak' || proj.type === 'swivel') {
    // CIWS Rotary Tracer round
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
  } else {
    // Grounded naval & artillery kinetic projectile with amber tracer
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-6, -2, 12, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, -1.5, 5, 3);
  }

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    if (p.type === 'plasma') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - alpha) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPlayerReticle(
  ctx: CanvasRenderingContext2D,
  player: ShipEntity,
  targetPos: { x: number; y: number }
) {
  ctx.save();

  // Tactical FLIR Crosshair (amber/gold tactical fire control reticle)
  ctx.translate(targetPos.x, targetPos.y);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.moveTo(-22, 0);
  ctx.lineTo(-7, 0);
  ctx.moveTo(7, 0);
  ctx.lineTo(22, 0);
  ctx.moveTo(0, -22);
  ctx.lineTo(0, -7);
  ctx.moveTo(0, 7);
  ctx.lineTo(0, 22);
  ctx.stroke();

  ctx.restore();

  // Effective fire range radius
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.stats.effectiveRange || 780, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawCommandStation(ctx: CanvasRenderingContext2D, station: CommandStationEntity, time: number) {
  ctx.save();
  ctx.translate(station.x, station.y);

  if (station.style === 'coastal-headquarters') {
    drawCoastalHeadquarters(ctx, station, time);
    ctx.restore();
    return;
  }

  const isAllied = station.team === 'player';
  const mainColor = isAllied ? '#10b981' : '#f43f5e';
  const baseFill = station.isDestroyed ? '#262626' : '#1e293b';
  const wallStroke = station.isDestroyed ? '#404040' : (isAllied ? '#059669' : '#e11d48');

  // Ground fortification apron
  ctx.beginPath();
  ctx.arc(0, 0, station.radius + 14, 0, Math.PI * 2);
  ctx.fillStyle = station.isDestroyed ? 'rgba(30, 30, 30, 0.6)' : 'rgba(15, 23, 42, 0.75)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
  ctx.stroke();

  // Fortified blast walls (octagonal citadel)
  const sides = 8;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * station.radius;
    const py = Math.sin(a) * station.radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = baseFill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = wallStroke;
  ctx.stroke();

  // Inner bunker structure
  ctx.beginPath();
  ctx.arc(0, 0, station.radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = station.isDestroyed ? '#171717' : '#0f172a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isAllied ? '#34d399' : '#fb7185';
  ctx.stroke();

  if (!station.isDestroyed) {
    // Rotating radar dish / comm antenna
    const dishAngle = time * 1.5;
    ctx.save();
    ctx.rotate(dishAngle);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.quadraticCurveTo(0, -12, 16, -4);
    ctx.stroke();
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Corner beacon lights
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + (time * 2) % (Math.PI * 2);
      const bx = Math.cos(a) * (station.radius * 0.85);
      const by = Math.sin(a) * (station.radius * 0.85);
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Ruined station marker
    ctx.fillStyle = '#737373';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DESTROYED', 0, 4);
  }

  // Draw Station Defense Turrets
  if (!station.isDestroyed && station.turrets) {
    for (const turret of station.turrets) {
      ctx.save();
      ctx.translate(turret.offsetX, turret.offsetY);
      ctx.rotate(turret.angle);

      // Turret base
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isAllied ? '#10b981' : '#f43f5e';
      ctx.stroke();

      // Gun barrels
      ctx.fillStyle = '#64748b';
      if (turret.type === 'ciws') {
        ctx.fillRect(0, -3, 14, 2);
        ctx.fillRect(0, 1, 14, 2);
      } else if (turret.type === 'missile') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-4, -6, 16, 12);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(12, -4, 4, 3);
        ctx.fillRect(12, 1, 4, 3);
      } else {
        ctx.fillRect(0, -2.5, 18, 5);
      }
      ctx.restore();
    }
  }

  // Floating Health Bar overhead
  const barW = 100;
  const barH = 7;
  const barY = -station.radius - 22;
  const hpRatio = Math.max(0, station.hp / station.maxHp);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(-barW / 2 - 2, barY - 2, barW + 4, barH + 4);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(-barW / 2 - 2, barY - 2, barW + 4, barH + 4);

  ctx.fillStyle = station.isDestroyed
    ? '#52525b'
    : hpRatio < 0.25
    ? '#ef4444'
    : hpRatio < 0.5
    ? '#f59e0b'
    : isAllied
    ? '#10b981'
    : '#f43f5e';
  ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

  // Station Label
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(station.name, 0, barY - 6);

  ctx.restore();
}

function drawCoastalHeadquarters(
  ctx: CanvasRenderingContext2D,
  station: CommandStationEntity,
  time: number
) {
  const r = station.radius;
  const teamMark = station.team === 'player' ? '#58766a' : '#765b55';
  const concrete = station.isDestroyed ? '#393735' : '#77766d';
  const concreteDark = station.isDestroyed ? '#272624' : '#555850';
  const roof = station.isDestroyed ? '#242321' : '#3f4744';

  // Irregular poured-concrete perimeter with projecting bastions and access yard.
  ctx.beginPath();
  ctx.moveTo(-r * 1.04, -r * 0.50);
  ctx.lineTo(-r * 0.70, -r * 0.92);
  ctx.lineTo(-r * 0.18, -r * 0.98);
  ctx.lineTo(r * 0.04, -r * 0.80);
  ctx.lineTo(r * 0.62, -r * 0.82);
  ctx.lineTo(r * 0.98, -r * 0.46);
  ctx.lineTo(r * 1.02, r * 0.22);
  ctx.lineTo(r * 0.72, r * 0.76);
  ctx.lineTo(r * 0.18, r * 0.92);
  ctx.lineTo(-r * 0.30, r * 0.82);
  ctx.lineTo(-r * 0.80, r * 0.94);
  ctx.lineTo(-r * 1.06, r * 0.46);
  ctx.closePath();
  ctx.fillStyle = station.isDestroyed ? 'rgba(54, 51, 47, 0.72)' : '#858379';
  ctx.fill();
  ctx.strokeStyle = '#343633';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Layered headquarters blocks, command wing, service wing, and hardened core.
  ctx.fillStyle = concrete;
  ctx.strokeStyle = '#3b3d39';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-r * 0.72, -r * 0.55, r * 1.18, r * 1.08, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = concreteDark;
  ctx.beginPath();
  ctx.roundRect(-r * 0.18, -r * 0.70, r * 0.72, r * 0.58, 7);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-r * 0.08, r * 0.16, r * 0.82, r * 0.44, 6);
  ctx.fill();
  ctx.stroke();

  // Hardened central operations block with realistic narrow blast windows.
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, -r * 0.34);
  ctx.lineTo(r * 0.27, -r * 0.38);
  ctx.lineTo(r * 0.42, -r * 0.08);
  ctx.lineTo(r * 0.28, r * 0.28);
  ctx.lineTo(-r * 0.38, r * 0.30);
  ctx.lineTo(-r * 0.52, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2f322f';
  ctx.stroke();
  ctx.fillStyle = '#242c2d';
  for (let y = -r * 0.20; y <= r * 0.18; y += r * 0.19) {
    ctx.fillRect(-r * 0.40, y, r * 0.58, 5);
  }

  // Vehicle gates, rooftop ventilation, and restrained team-identification panels.
  ctx.fillStyle = '#30332f';
  ctx.fillRect(-r * 0.67, r * 0.15, r * 0.26, r * 0.30);
  ctx.fillRect(r * 0.41, r * 0.28, r * 0.22, r * 0.22);
  ctx.fillStyle = teamMark;
  ctx.fillRect(-r * 0.70, -r * 0.54, r * 0.34, 7);
  ctx.fillRect(r * 0.16, r * 0.52, r * 0.36, 7);
  ctx.fillStyle = '#454842';
  for (const [x, y] of [[-0.50, -0.38], [0.02, -0.56], [0.37, 0.36]] as const) {
    ctx.beginPath();
    ctx.arc(r * x, r * y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!station.isDestroyed) {
    // Central communications mast and rotating conventional radar array.
    ctx.strokeStyle = '#4b4d47';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.02, -r * 0.12);
    ctx.lineTo(-r * 0.02, -r * 0.55);
    ctx.stroke();
    drawRotatingRadar(ctx, -r * 0.02, -r * 0.57, 13, time, 1.7, 'lattice');

    for (const turret of station.turrets || []) {
      ctx.save();
      ctx.translate(turret.offsetX, turret.offsetY);
      ctx.rotate(turret.angle);
      ctx.fillStyle = '#4b514d';
      ctx.strokeStyle = '#292d2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#292e2c';
      if (turret.type === 'missile') {
        ctx.fillRect(-5, -8, 22, 16);
        ctx.fillStyle = '#9b8b69';
        ctx.fillRect(17, -6, 5, 4);
        ctx.fillRect(17, 2, 5, 4);
      } else if (turret.type === 'ciws') {
        ctx.fillRect(0, -4, 21, 3);
        ctx.fillRect(0, 2, 21, 3);
      } else {
        ctx.fillRect(0, -5, 27, 4);
        ctx.fillRect(0, 2, 27, 4);
      }
      ctx.restore();
    }
  } else {
    ctx.strokeStyle = '#242321';
    ctx.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      const a = i * 1.7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      ctx.stroke();
    }
  }

  const barW = 150;
  const barY = -r - 28;
  const hpRatio = Math.max(0, station.hp / station.maxHp);
  ctx.fillStyle = 'rgba(30, 31, 29, 0.9)';
  ctx.fillRect(-barW / 2 - 2, barY - 2, barW + 4, 10);
  ctx.fillStyle = station.isDestroyed ? '#55534f' : hpRatio < 0.3 ? '#b4493f' : hpRatio < 0.6 ? '#b58b42' : teamMark;
  ctx.fillRect(-barW / 2, barY, barW * hpRatio, 6);
  ctx.strokeStyle = '#393b38';
  ctx.strokeRect(-barW / 2 - 2, barY - 2, barW + 4, 10);
  ctx.fillStyle = '#e7e5df';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(station.name, 0, barY - 7);
}

export function drawDefensiveWeapon(ctx: CanvasRenderingContext2D, weapon: DefensiveWeaponEntity, time: number) {
  const isAllied = weapon.team === 'player';
  const teamColor = isAllied ? '#10b981' : '#f43f5e';
  const teamDark = isAllied ? '#065f46' : '#881337';

  ctx.save();
  ctx.translate(weapon.x, weapon.y);

  if (weapon.isDestroyed) {
    // Ruined, shattered concrete bunker crater
    ctx.beginPath();
    ctx.arc(0, 0, weapon.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Blast cracks & scorched rubble
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * weapon.radius * 0.9, Math.sin(a) * weapon.radius * 0.9);
      ctx.stroke();
    }

    // Small persistent smoldering embers
    const emberPulse = Math.sin(time * 3 + weapon.x * 0.05) * 0.2 + 0.5;
    ctx.fillStyle = `rgba(239, 68, 68, ${emberPulse})`;
    ctx.beginPath();
    ctx.arc(-4, 3, 3.5, 0, Math.PI * 2);
    ctx.arc(5, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Destroyed label
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESTROYED', 0, 3);
    ctx.restore();
    return;
  }

  const r = weapon.radius;
  if (weapon.style === 'defense-tower') {
    // Tall, grounded island watchtower with a concrete base, armored upper
    // platform, tracking radar, and independently rotating autocannon crown.
    ctx.fillStyle = '#6f7068';
    ctx.strokeStyle = '#343632';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4f544f';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#30332f';
    ctx.stroke();

    // Buttresses give the tower a substantial, non-decorative footprint.
    ctx.fillStyle = '#62645d';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.fillRect(r * 0.48, -5, r * 0.42, 10);
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(weapon.angle);
    ctx.fillStyle = '#353a37';
    ctx.strokeStyle = '#202421';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-13, -12, 28, 24, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#242926';
    ctx.fillRect(4, -7, 30, 4);
    ctx.fillRect(4, 3, 30, 4);
    ctx.fillStyle = '#92866d';
    ctx.fillRect(31, -8, 5, 6);
    ctx.fillRect(31, 2, 5, 6);
    ctx.restore();

    // Independent search radar visually tracks even when guns face elsewhere.
    drawRotatingRadar(ctx, -9, 0, 9, time, 2.8, 'curved');
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, -0.55, 0.55);
    ctx.stroke();
  } else {
    // 1. Reinforced Concrete Octagonal Foundation
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

  // 2. Team Color Accent Trim
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = teamColor;
  ctx.stroke();

  // 3. Rotating Turret Mantlet & Armament
  ctx.save();
  ctx.rotate(weapon.angle);

  // Turret Barbette Center Dome
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#475569';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#64748b';
  ctx.stroke();

  if (weapon.type === 'cannon') {
    // Twin Heavy Coastal Artillery Barrels
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, -6, 26, 4); // Left barrel
    ctx.fillRect(0, 2, 26, 4);  // Right barrel

    // Muzzle Brakes
    ctx.fillStyle = '#64748b';
    ctx.fillRect(24, -7, 3, 6);
    ctx.fillRect(24, 1, 3, 6);

    // Armored Mantlet housing
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, 0, 10, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-6, 7);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
  } else if (weapon.type === 'missile') {
    // Multi-Cell Armored Surface Missile Pod
    ctx.fillStyle = '#334155';
    ctx.fillRect(-6, -10, 22, 20);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = teamDark;
    ctx.strokeRect(-6, -10, 22, 20);

    // Launch Canister cells with warhead tips
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(16, -8, 4, 4);
    ctx.fillRect(16, -2, 4, 4);
    ctx.fillRect(16, 4, 4, 4);
  } else {
    // CIWS / Flak Quad Autocannon
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, -5, 18, 2);
    ctx.fillRect(0, -2, 20, 2);
    ctx.fillRect(0, 1, 20, 2);
    ctx.fillRect(0, 4, 18, 2);

    // Radar Tracking Dish
    ctx.beginPath();
    ctx.arc(-5, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
  }

    ctx.restore();
  }

  // 4. Overhead Floating Health Bar & Title
  const barW = 46;
  const barH = 5;
  const barY = -r - 12;
  const hpRatio = Math.max(0, weapon.hp / weapon.maxHp);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);

  ctx.fillStyle = hpRatio < 0.3 ? '#ef4444' : hpRatio < 0.6 ? '#f59e0b' : teamColor;
  ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

  // Defense Battery Label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(weapon.name, 0, barY - 4);

  ctx.restore();
}

export function drawMissionObjectives(ctx: CanvasRenderingContext2D, state: BattleState) {
  const time = state.time;

  // MODE 3: Transport Route Waypoints & Destination
  if (state.transportMission) {
    const tm = state.transportMission;
    const wps = tm.waypoints;

    // Draw dashed path between waypoints
    if (wps && wps.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i++) {
        ctx.lineTo(wps[i].x, wps[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw Waypoint Beacon markers
    if (wps) {
      wps.forEach((wp, idx) => {
        const isCurrent = idx === tm.currentWaypointIndex;
        const isCleared = idx < tm.currentWaypointIndex;
        ctx.save();
        ctx.translate(wp.x, wp.y);

        ctx.beginPath();
        ctx.arc(0, 0, isCurrent ? 22 : 14, 0, Math.PI * 2);
        ctx.fillStyle = isCleared
          ? 'rgba(16, 185, 129, 0.25)'
          : isCurrent
          ? 'rgba(245, 158, 11, 0.35)'
          : 'rgba(100, 116, 139, 0.2)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isCleared ? '#10b981' : isCurrent ? '#f59e0b' : '#64748b';
        ctx.stroke();

        ctx.fillStyle = isCleared ? '#10b981' : isCurrent ? '#f59e0b' : '#94a3b8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`WP${idx + 1}`, 0, 0);
        ctx.restore();
      });
    }

  }

  // MODE 4: Amphibious Beachhead Landing Zone
  if (state.amphibiousMission) {
    const am = state.amphibiousMission;
    const lz = am.landingZone;
    ctx.save();
    ctx.translate(lz.x, lz.y);

    const pulse = Math.sin(time * 3) * 6;
    ctx.beginPath();
    ctx.arc(0, 0, lz.radius + pulse, 0, Math.PI * 2);
    ctx.fillStyle = am.isCarrierBeached ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.12)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = am.isCarrierBeached ? '#10b981' : '#38bdf8';
    ctx.setLineDash([12, 6]);
    ctx.stroke();

    ctx.fillStyle = am.isCarrierBeached ? '#34d399' : '#38bdf8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(am.isCarrierBeached ? 'BEACHHEAD SECURED (DEPLOYING)' : 'LANDING ZONE BEACHHEAD', 0, -lz.radius - 12);
    ctx.restore();
  }
}

function drawExtractionZoneIndicator(ctx: CanvasRenderingContext2D, state: BattleState) {
  const destination = state.transportMission?.destination;
  if (!destination) return;

  ctx.save();
  ctx.translate(destination.x, destination.y);
  const pulse = Math.sin(state.time * 3) * 6;
  ctx.beginPath();
  ctx.arc(0, 0, destination.radius + pulse, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
  ctx.setLineDash([12, 6]);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, destination.radius * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.setLineDash([]);
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXTRACTION ZONE', 0, -destination.radius - 12);
  ctx.restore();
}

function redrawWaterVehiclesAboveMode3Objectives(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  waterVehicles: ShipEntity[]
) {
  const mission = state.transportMission;
  if (!mission || waterVehicles.length === 0) return;

  const truck = state.ships.find(ship => ship.id === mission.truckShipId && !ship.isSunk);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mission.destination.x + mission.destination.radius + 14, mission.destination.y);
  ctx.arc(mission.destination.x, mission.destination.y, mission.destination.radius + 14, 0, Math.PI * 2);
  ctx.rect(
    mission.destination.x - 90,
    mission.destination.y - mission.destination.radius - 34,
    180,
    30
  );
  if (truck) {
    const targetRadius = Math.max(72, truck.model.hullLength * 0.48) + 14;
    ctx.moveTo(truck.x + targetRadius, truck.y);
    ctx.arc(truck.x, truck.y, targetRadius, 0, Math.PI * 2);
    ctx.rect(truck.x - 80, truck.y - targetRadius - 28, 160, 24);
  }
  ctx.clip();
  for (const vehicle of waterVehicles) {
    drawWaterShip(ctx, vehicle, state.time);
  }
  ctx.restore();
}

function drawConvoyTargetIndicator(ctx: CanvasRenderingContext2D, state: BattleState) {
  const mission = state.transportMission;
  if (!mission) return;

  const truck = state.ships.find(ship => ship.id === mission.truckShipId && !ship.isSunk);
  if (!truck) return;

  ctx.save();
  ctx.translate(truck.x, truck.y);
  const ringRadius = Math.max(72, truck.model.hullLength * 0.48) + Math.sin(state.time * 3.6) * 7;
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.62)';
  ctx.lineWidth = 3;
  ctx.setLineDash([11, 8]);
  ctx.lineDashOffset = -state.time * 18;
  ctx.stroke();

  ctx.fillStyle = 'rgba(253, 224, 71, 0.88)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VIP CARGO RIG', 0, -ringRadius - 6);
  ctx.restore();
}

