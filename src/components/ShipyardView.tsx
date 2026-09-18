import React, { useState, useEffect } from 'react';
import { BaseShipModel, CustomShipConfig, GameMode, PlayerMissionRole, SavedShipProfile, TrailerType, hasHelicopterLandingArea } from '../types/ship';
import { BASE_SHIPS, SHIP_MODEL_MAP } from '../data/shipModels';
import { calculateShipStats, getDomainPalettes } from '../utils/shipStats';
import { getSavedShips, saveShipProfile, deleteSavedShipProfile } from '../utils/savedShips';
import { SHIP_COMPONENTS, COMPONENT_MAP } from '../data/components';
import { TRAILERS, TRAILER_MAP } from '../data/trailers';
import { ShipDeckBlueprint } from './ShipDeckBlueprint';
import { ComponentPicker } from './ComponentPicker';
import { MapSelector } from './MapSelector';
import { SavedShipsModal } from './SavedShipsModal';
import { getCombatTheaterForMapId, getMapIdForTheaterAndMode } from '../data/battleMaps';
import {
  Bookmark,
  Compass,
  Crosshair,
  Flag,
  Gauge,
  Play,
  Radio,
  Save,
  Shield,
  Swords,
  Users,
  Volume2,
  VolumeX,
  Zap,
  Check,
  Truck,
  Rocket,
  Bomb,
  Wrench,
  ShieldAlert,
  Plane,
  Anchor,
  Target,
  Navigation
} from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface ShipyardViewProps {
  playerConfig: CustomShipConfig;
  onUpdateConfig: (newConfig: CustomShipConfig) => void;
  shipsPerTeam: number;
  onChangeShipsPerTeam: (count: number) => void;
  selectedMapId: string;
  onSelectMap: (mapId: string) => void;
  gameMode: GameMode;
  onSelectGameMode: (mode: GameMode) => void;
  playerRole?: PlayerMissionRole;
  onSelectPlayerRole?: (role: PlayerMissionRole) => void;
  onLaunchBattle: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const ShipyardView: React.FC<ShipyardViewProps> = ({
  playerConfig,
  onUpdateConfig,
  shipsPerTeam,
  onChangeShipsPerTeam,
  selectedMapId,
  onSelectMap,
  gameMode,
  onSelectGameMode,
  playerRole = 'defender',
  onSelectPlayerRole,
  onLaunchBattle,
  soundEnabled,
  onToggleSound,
}) => {
  const currentModel = SHIP_MODEL_MAP.get(playerConfig.baseModelId) || BASE_SHIPS[0];
  const [selectedHardpointId, setSelectedHardpointId] = useState<string | null>(
    currentModel.hardpoints[0]?.id || null
  );
  const [savedShips, setSavedShips] = useState<SavedShipProfile[]>(() => getSavedShips());
  const [isSavedFleetModalOpen, setIsSavedFleetModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<'all' | 'land' | 'water' | 'air'>('all');

  const stats = calculateShipStats(currentModel, playerConfig);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSelectModel = (model: BaseShipModel) => {
    // Retain or initialize hardpoints
    const newEquipped: Record<string, string> = {};
    model.hardpoints.forEach(hp => {
      const fallbackOldId = hp.id === 'hp-deck-ciws' ? (playerConfig.equippedComponents['hp-deck-ciws-one'] || playerConfig.equippedComponents['hp-deck-ciws']) : undefined;
      const currentVal = playerConfig.equippedComponents[hp.id] || fallbackOldId;
      const compObj = currentVal ? SHIP_COMPONENTS.find(c => c.id === currentVal) : null;
      const isUnrestrictedCategory = compObj && (compObj.category === 'defensive' || compObj.category === 'mobility' || compObj.category === 'support');
      const isDisallowed = !isUnrestrictedCategory && currentVal && hp.disallowedComponentIds?.includes(currentVal);
      const isCategoryDisallowed = !isUnrestrictedCategory && compObj && hp.allowedCategories && hp.allowedCategories.length > 0 && !hp.allowedCategories.includes(compObj.category);
      newEquipped[hp.id] = (currentVal && !isDisallowed && !isCategoryDisallowed) ? currentVal : (hp.defaultComponentId || 'naval-phalanx-ciws');
    });

    const targetPalettes = getDomainPalettes(model.domain);
    const hasCurrentPalette = targetPalettes.some(p => p.primary.toLowerCase() === playerConfig.primaryColor?.toLowerCase());
    const nextPrimary = hasCurrentPalette ? playerConfig.primaryColor : targetPalettes[0].primary;
    const nextAccent = hasCurrentPalette ? playerConfig.accentColor : targetPalettes[0].accent;

    onUpdateConfig({
      ...playerConfig,
      baseModelId: model.id,
      primaryColor: nextPrimary,
      accentColor: nextAccent,
      equippedComponents: newEquipped,
      trailerId: (model.domain === 'land' && model.canTowTrailer !== false) ? (playerConfig.trailerId || model.defaultTrailerId || 'none') : 'none',
    });
    setSelectedHardpointId(model.hardpoints[0]?.id || null);
    sounds.playCannonShot('swivel');
  };

  const isTowingSupported = currentModel.domain === 'land' && currentModel.canTowTrailer !== false;

  const handleSelectTrailer = (trailerId: TrailerType) => {
    if (!isTowingSupported) {
      showToast(currentModel.domain !== 'land'
        ? 'Trailers are exclusively available for Land Vehicles.'
        : 'Tow hitch locked for heavy multi-axle / strategic systems.');
      return;
    }
    onUpdateConfig({
      ...playerConfig,
      trailerId,
    });
    sounds.playCannonShot('swivel');
    const tr = TRAILER_MAP.get(trailerId);
    showToast(tr ? `Equipped: ${tr.name}` : 'Trailer detached (Max Speed)');
  };

  const handleEquipComponent = (componentId: string) => {
    if (!selectedHardpointId) return;
    const hp = currentModel.hardpoints.find(h => h.id === selectedHardpointId);
    if (hp) {
      const comp = SHIP_COMPONENTS.find(c => c.id === componentId);
      const isUnrestrictedCategory = comp && (comp.category === 'defensive' || comp.category === 'mobility' || comp.category === 'support');
      if (!isUnrestrictedCategory) {
        if (hp.disallowedComponentIds?.includes(componentId)) {
          showToast('Heavy offensive warship weapon restricted on carrier flight deck.');
          return;
        }
        if (comp && hp.allowedCategories && hp.allowedCategories.length > 0) {
          if (!hp.allowedCategories.includes(comp.category)) {
            showToast(`Slot role restricted to: ${hp.allowedCategories.map(c => c.replace('-', ' ')).join(', ')}.`);
            return;
          }
        }
      }
    }
    onUpdateConfig({
      ...playerConfig,
      equippedComponents: {
        ...playerConfig.equippedComponents,
        [selectedHardpointId]: componentId,
      },
    });
    sounds.playCannonShot('swivel');
    const comp = COMPONENT_MAP.get(componentId);
    if (comp) showToast(`Equipped: ${comp.name}`);
  };

  const handleUnequipComponent = () => {
    if (!selectedHardpointId) return;
    const updated = { ...playerConfig.equippedComponents };
    delete updated[selectedHardpointId];
    onUpdateConfig({
      ...playerConfig,
      equippedComponents: updated,
    });
  };

  // Save / Load ship configuration handlers
  const handleQuickSaveShip = () => {
    const name = playerConfig.name || 'Custom Armored Vehicle';
    const updated = saveShipProfile(playerConfig, name);
    setSavedShips(updated);
    sounds.playCannonShot('swivel');
    showToast(`Saved "${name}" to your garage!`);
  };

  const handleSaveShipWithName = (customName?: string) => {
    const updated = saveShipProfile(playerConfig, customName);
    setSavedShips(updated);
    showToast(`Saved "${customName || playerConfig.name}" to your garage!`);
  };

  const handleLoadSavedShip = (config: CustomShipConfig) => {
    onUpdateConfig(config);
    const model = SHIP_MODEL_MAP.get(config.baseModelId) || BASE_SHIPS[0];
    setSelectedHardpointId(model.hardpoints[0]?.id || null);
    showToast(`Loaded "${config.name}" into Motor Pool!`);
  };

  const handleDeleteSavedShip = (profileId: string) => {
    const updated = deleteSavedShipProfile(profileId);
    setSavedShips(updated);
    showToast('Removed vehicle profile from garage');
  };

  const selectedHardpoint = currentModel.hardpoints.find(h => h.id === selectedHardpointId) || null;
  const currentlyEquippedId = selectedHardpoint ? playerConfig.equippedComponents[selectedHardpoint.id] || null : null;
  const activeTrailerId: TrailerType = isTowingSupported
    ? (playerConfig.trailerId || currentModel.defaultTrailerId || 'none')
    : 'none';

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-600 selection:text-stone-950">
      {/* Top Navbar */}
      <header className="border-b border-stone-800 bg-stone-950/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 text-stone-950 shadow-md border border-amber-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 fill-stone-950 stroke-stone-950" />
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-100 flex items-center gap-2 tracking-tight">
                <span>Air-Land-Water Battles</span>
                <span className="text-[10px] uppercase font-mono font-bold bg-stone-900 text-amber-400 px-2 py-0.5 rounded border border-stone-700">
                  Command HQ
                </span>
              </h1>
              <p className="text-xs text-stone-400">
                Design, arm, and command land vehicles, naval warships, and combat aircraft in combined arms warfare
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Saved Vehicles Garage Button */}
            <button
              onClick={() => setIsSavedFleetModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
              title="View and load your saved combat vehicles"
            >
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span>Saved Garage</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-amber-300">
                {savedShips.length}
              </span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition flex items-center gap-1.5 text-xs cursor-pointer"
              title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
            </button>

            {/* Launch Battle Primary Action */}
            <button
              onClick={onLaunchBattle}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-zinc-950 font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>Deploy Division</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-amber-500/80 text-amber-200 text-xs font-medium shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <Check className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        
        {/* Step 1: Base Modern Vehicle Models Row */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 lg:p-5 backdrop-blur-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">1</span>
              <span>Select Combat Vehicle Chassis & Role</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Diverse designs: Main battle tanks, HIMARS missile carriers, agile recon buggies, armed technical pickups, patrol cruisers, self-propelled howitzers, IFVs, and heavy prime movers.
            </p>
          </div>

          {/* Domain Filter Pills */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800 overflow-x-auto">
            <span className="text-xs font-mono text-zinc-400">Domain:</span>
            <button
              onClick={() => setDomainFilter('all')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                domainFilter === 'all'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              <span>All Spheres</span>
              <span className="text-[10px] opacity-75 font-mono">({BASE_SHIPS.length})</span>
            </button>
            <button
              onClick={() => setDomainFilter('land')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                domainFilter === 'land'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Land Armor</span>
              <span className="text-[10px] opacity-75 font-mono">({BASE_SHIPS.filter(m => m.domain === 'land').length})</span>
            </button>
            <button
              onClick={() => setDomainFilter('water')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                domainFilter === 'water'
                  ? 'bg-cyan-500 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span>Naval Warships</span>
              <span className="text-[10px] opacity-75 font-mono">({BASE_SHIPS.filter(m => m.domain === 'water').length})</span>
            </button>
            <button
              onClick={() => setDomainFilter('air')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                domainFilter === 'air'
                  ? 'bg-sky-400 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>Combat Aircraft</span>
              <span className="text-[10px] opacity-75 font-mono">({BASE_SHIPS.filter(m => m.domain === 'air').length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-2.5">
            {BASE_SHIPS.filter(m => domainFilter === 'all' || m.domain === domainFilter).map(model => {
              const isSelected = model.id === currentModel.id;
              return (
                <div
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  className={`relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-zinc-800/90 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                      : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/60 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-zinc-100 line-clamp-1">{model.name}</span>
                      <span className="text-[10px] font-mono text-amber-400 px-1.5 py-0.5 bg-zinc-950 rounded border border-zinc-800">
                        {model.hardpoints.length} Slots
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                      <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${
                        model.domain === 'air'
                          ? 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                          : model.domain === 'water'
                          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      }`}>
                        {model.domain === 'air' ? '✈ AIR' : model.domain === 'water' ? '⚓ WATER' : '🪖 LAND'}
                      </span>
                      <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {model.chassisType?.toUpperCase() || (model.domain === 'air' ? 'AIRFRAME' : 'HULL')}
                      </span>
                      {model.canTowTrailer && (
                        <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                          TOW HITCH
                        </span>
                      )}
                      {model.id === 'water-carrier-assault' && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-700/60 flex items-center gap-1">
                          <Plane className="w-2.5 h-2.5" /> 5 Strike Jets
                        </span>
                      )}
                      {hasHelicopterLandingArea(model) && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                          <Plane className="w-2.5 h-2.5" /> 1 Helicopter
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {model.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-300">
                    <span>HP: {model.baseHp}</span>
                    <span>{model.baseSpeed} km/h</span>
                    <span>Arm: {model.baseArmor}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 2: Customization Grid (Blueprint + Armory + Stats) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left / Center: Interactive Modern Vehicle Blueprint (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
              {/* Vehicle Name, Save Button & Camo Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Command Vehicle Callout
                    </label>
                    <button
                      type="button"
                      onClick={handleQuickSaveShip}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Save this customized vehicle"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Build</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={playerConfig.name}
                      onChange={(e) => onUpdateConfig({ ...playerConfig, name: e.target.value })}
                      maxLength={28}
                      placeholder="e.g. M1A2 Vanguard..."
                      className="w-full bg-zinc-800/90 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                      {currentModel.domain === 'land' ? 'Armor Camouflage (Land)' : currentModel.domain === 'water' ? 'Naval Coating (Water)' : 'Tactical Livery (Air)'}
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {getDomainPalettes(currentModel.domain).find(p => p.primary.toLowerCase() === playerConfig.primaryColor?.toLowerCase())?.name || 'Custom Service Paint'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                    {getDomainPalettes(currentModel.domain).map(p => {
                      const isSelected = playerConfig.primaryColor?.toLowerCase() === p.primary.toLowerCase();
                      return (
                        <button
                          key={p.name}
                          onClick={() => onUpdateConfig({ ...playerConfig, primaryColor: p.primary, accentColor: p.accent })}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer relative ${
                            isSelected ? 'scale-115 border-white shadow-md ring-2 ring-amber-500/50' : 'border-zinc-700/60 hover:scale-105'
                          }`}
                          style={{ backgroundColor: p.primary }}
                          title={`${p.name}${p.description ? ` - ${p.description}` : ''}`}
                        >
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/90">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Interactive Modern Vehicle Chassis Blueprint Canvas */}
              <ShipDeckBlueprint
                model={currentModel}
                config={playerConfig}
                selectedHardpointId={selectedHardpointId}
                onSelectHardpoint={setSelectedHardpointId}
              />
            </div>
          </div>

          {/* Right: Armory & Component Picker (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Real-time Vehicle Performance Overview Cards */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-3 flex items-center justify-between">
                <span>Vehicle Combat Capabilities & Ballistics</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-400 lowercase font-mono">{currentModel.name} chassis</span>
                  {currentModel.id === 'water-carrier-assault' && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-600/70 flex items-center gap-1">
                      <Plane className="w-3 h-3" /> 5 Strike Jets
                    </span>
                  )}
                  {hasHelicopterLandingArea(currentModel) && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/70 flex items-center gap-1">
                      <Plane className="w-3 h-3" /> 1 Helicopter
                    </span>
                  )}
                </div>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Armor HP</span>
                  </div>
                  <div className="text-base font-bold font-mono text-emerald-300">{stats.maxHp}</div>
                  <div className="text-[9px] text-slate-500 font-mono">base {currentModel.baseHp}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Gauge className="w-3.5 h-3.5 text-amber-400" />
                    <span>Top Speed</span>
                  </div>
                  <div className="text-base font-bold font-mono text-amber-300">{stats.speed} <span className="text-xs font-normal">km/h</span></div>
                  <div className="text-[9px] text-slate-500 font-mono">base {currentModel.baseSpeed}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Traverse</span>
                  </div>
                  <div className="text-base font-bold font-mono text-cyan-300">{stats.turnRate} <span className="text-xs font-normal">rad/s</span></div>
                  <div className="text-[9px] text-slate-500 font-mono">pivot agility</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    <span>Firepower</span>
                  </div>
                  <div className="text-base font-bold font-mono text-rose-300">{stats.firepowerDps} <span className="text-xs font-normal">DPS</span></div>
                  <div className="text-[9px] text-slate-500 font-mono">all batteries</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                    <span>Max Reach</span>
                  </div>
                  <div className="text-base font-bold font-mono text-purple-300">{stats.effectiveRange} <span className="text-xs font-normal">m</span></div>
                  <div className="text-[9px] text-slate-500 font-mono">artillery radius</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span>ERA Armor</span>
                  </div>
                  <div className="text-base font-bold font-mono text-sky-300">{stats.armorRating}%</div>
                  <div className="text-[9px] text-slate-500 font-mono">ballistic absorb</div>
                </div>
              </div>
            </div>

            {/* Component Picker List */}
            <div className="flex-1">
              <ComponentPicker
                selectedHardpoint={selectedHardpoint}
                currentlyEquippedId={currentlyEquippedId}
                vehicleDomain={currentModel.domain}
                onEquipComponent={handleEquipComponent}
                onUnequipComponent={handleUnequipComponent}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Towed Tactical Trailer Equipment (Exclusive to Land Vehicles) */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600/30 text-amber-400 text-xs flex items-center justify-center font-bold">3</span>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Tactical Towed Trailer Equipment</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isTowingSupported
                      ? 'text-amber-400 bg-amber-950/80 border-amber-800/50'
                      : 'text-stone-400 bg-stone-900 border-stone-800'
                  }`}>
                    {isTowingSupported ? 'Land Vehicle Hitching' : 'Tow Hitch Locked'}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isTowingSupported
                  ? 'Attach an automated support trailer towed behind your land vehicle. Trailers follow via physics hitching and automatically fire heavy weapons or provide support auras.'
                  : (currentModel.domain === 'land'
                    ? 'Tow hitch is locked for heavy multi-axle trucks and strategic mobile launchers. This vehicle operates with dedicated integrated armaments and cannot tow secondary support trailers.'
                    : 'Trailers are exclusively engineered for Land Combat Vehicles. Aircraft and naval vessels operate with specialized internal propulsors and aeronaval weapons without rear tow bars.')}
              </p>
            </div>

            {isTowingSupported ? (
              <div className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                Active Hitch:{' '}
                <strong className="text-amber-400">
                  {activeTrailerId === 'none' ? 'No Trailer (Max Speed)' : TRAILER_MAP.get(activeTrailerId)?.name}
                </strong>
              </div>
            ) : (
              <div className="text-xs font-mono text-stone-400 bg-stone-950/70 px-3 py-1.5 rounded-lg border border-stone-800">
                Tow Hitch: <strong className="text-stone-300">
                  {currentModel.domain !== 'land' ? `Unavailable for ${currentModel.domain.toUpperCase()}` : 'Locked for Heavy System'}
                </strong>
              </div>
            )}
          </div>

          {isTowingSupported ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Option 0: No Trailer */}
            <div
              onClick={() => handleSelectTrailer('none')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                activeTrailerId === 'none'
                  ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">No Trailer</span>
                  </div>
                  {activeTrailerId === 'none' && (
                    <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  No towed payload. Retains 100% engine speed and optimal agility for close-range maneuvering.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] font-mono text-emerald-400">
                +0% Speed Penalty
              </div>
            </div>

            {/* Trailer Options */}
            {TRAILERS.map(trailer => {
              const isSelected = activeTrailerId === trailer.id;
              const renderTrailerIcon = () => {
                switch (trailer.category) {
                  case 'missile': return <Rocket className="w-4 h-4 text-orange-400" />;
                  case 'artillery': return <Bomb className="w-4 h-4 text-amber-400" />;
                  case 'defense': return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
                  case 'support': return trailer.repairRate ? <Wrench className="w-4 h-4 text-teal-400" /> : <Radio className="w-4 h-4 text-indigo-400" />;
                  default: return <Truck className="w-4 h-4 text-cyan-400" />;
                }
              };

              return (
                <div
                  key={trailer.id}
                  onClick={() => handleSelectTrailer(trailer.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                          {renderTrailerIcon()}
                        </div>
                        <span className="text-xs font-bold text-slate-200 line-clamp-1">{trailer.name.split(' ')[0]}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                          TOWING
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 block w-fit mb-1.5">
                      {trailer.category}
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                      {trailer.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-700/50 flex flex-col gap-1 text-[10px] font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>HP: {trailer.hp}</span>
                      {trailer.damage > 0 ? (
                        <span className="text-rose-400">{trailer.damage} Dmg</span>
                      ) : (
                        <span className="text-teal-400">{trailer.repairRate ? `+${trailer.repairRate} HP/s` : 'Radar/ECM'}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Range: {trailer.range}m</span>
                      <span className="text-amber-400">-{Math.round((1 - trailer.speedPenalty) * 100)}% Spd</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-400">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-500">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span>
                {currentModel.domain === 'land'
                  ? 'Tow hitch is locked for heavy multi-axle / strategic systems. Trailer towing is disabled.'
                  : `Tow hitch coupling is disabled for ${currentModel.domain.toUpperCase()} combat units.`}
              </span>
            </div>
            <span className="font-mono text-[10px] text-stone-500 uppercase tracking-wider bg-stone-900 px-2.5 py-1 rounded border border-stone-800/80 w-fit">
              LOCKED: NO COUPLING
            </span>
          </div>
        )}
      </section>

        {/* Section 4: Combat Theater (Map Theme Selector Only) */}
        <MapSelector
          selectedMapId={selectedMapId}
          gameMode={gameMode}
          onSelectMap={onSelectMap}
        />

        {/* Section 5: Mission Rules of Engagement */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">5</span>
                <span>Mission Rules of Engagement</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select your primary operational directive. Subordinate team sizing and tactical roles are configured below.
              </p>
            </div>
            <span className="text-[11px] font-mono text-amber-400 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 w-fit">
              {gameMode === 'fleet-battle' && 'Mode 1: Combined Arms Annihilation'}
              {gameMode === 'command-station' && 'Mode 2: Command Station Warfare'}
              {gameMode === 'transport-protection' && 'Mode 3: Transport Protection'}
              {gameMode === 'amphibious-assault' && 'Mode 4: Amphibious Assault'}
            </span>
          </div>

          {/* 4 Game Mode Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {/* Mode 1: Combined Arms Tactical Annihilation */}
            <div
              onClick={() => {
                onSelectGameMode('fleet-battle');
                const currentTheater = getCombatTheaterForMapId(selectedMapId);
                onSelectMap(getMapIdForTheaterAndMode(currentTheater.themeId, 'fleet-battle'));
                sounds.playCannonShot('swivel');
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                gameMode === 'fleet-battle'
                  ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                  : 'bg-slate-800/40 border-slate-700/70 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Swords className="w-4 h-4" />
                  </div>
                  {gameMode === 'fleet-battle' && (
                    <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                      ACTIVE MODE
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-100 mb-1">
                  1. Combined Arms Tactical Annihilation
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Full-spectrum combined arms warfare across land, air, and naval domains. Destroy all hostile units.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] font-mono text-amber-400">
                Objective: 100% Elimination
              </div>
            </div>

            {/* Mode 2: Command Station Warfare */}
            <div
              onClick={() => {
                onSelectGameMode('command-station');
                const currentTheater = getCombatTheaterForMapId(selectedMapId);
                onSelectMap(getMapIdForTheaterAndMode(currentTheater.themeId, 'command-station'));
                sounds.playCannonShot('swivel');
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                gameMode === 'command-station'
                  ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                  : 'bg-slate-800/40 border-slate-700/70 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  {gameMode === 'command-station' && (
                    <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                      ACTIVE MODE
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-100 mb-1">
                  2. Command Station Warfare
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Heavy mainland citadels with damageable defense turrets and complete bridge connectivity. Demolish the enemy station.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] font-mono text-sky-400">
                Objective: Citadel Siege
              </div>
            </div>

            {/* Mode 3: Transport Protection */}
            <div
              onClick={() => {
                onSelectGameMode('transport-protection');
                const currentTheater = getCombatTheaterForMapId(selectedMapId);
                onSelectMap(getMapIdForTheaterAndMode(currentTheater.themeId, 'transport-protection'));
                sounds.playCannonShot('swivel');
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                gameMode === 'transport-protection'
                  ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                  : 'bg-slate-800/40 border-slate-700/70 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Truck className="w-4 h-4" />
                  </div>
                  {gameMode === 'transport-protection' && (
                    <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                      ACTIVE MODE
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-100 mb-1">
                  3. Transport Protection
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Escort or intercept an armored VIP convoy semi-truck entering from beyond the map across bridges to extraction.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] font-mono text-emerald-400">
                Objective: Convoy Escort / Ambush
              </div>
            </div>

            {/* Mode 4: Amphibious Assault */}
            <div
              onClick={() => {
                onSelectGameMode('amphibious-assault');
                const currentTheater = getCombatTheaterForMapId(selectedMapId);
                onSelectMap(getMapIdForTheaterAndMode(currentTheater.themeId, 'amphibious-assault'));
                if (shipsPerTeam < 4) onChangeShipsPerTeam(4);
                sounds.playCannonShot('swivel');
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                gameMode === 'amphibious-assault'
                  ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                  : 'bg-slate-800/40 border-slate-700/70 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <Anchor className="w-4 h-4" />
                  </div>
                  {gameMode === 'amphibious-assault' && (
                    <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                      ACTIVE MODE
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-100 mb-1">
                  4. Amphibious Assault
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Defend the eastern mainland or launch invasion from the west. Giant carrier ferrying land armor across the sea.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-700/50 text-[10px] font-mono text-rose-400">
                Objective: Beachhead Assault / Defense
              </div>
            </div>
          </div>

          {/* Subordinate Setup Choices Based on Selected Mode */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            {/* Mode 1 & Mode 2: Team Size Selection (1 to 8 per team) */}
            {(gameMode === 'fleet-battle' || gameMode === 'command-station') && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      {gameMode === 'fleet-battle' ? 'Tactical Annihilation Force Sizing' : 'Command Citadel Garrison Sizing'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select symmetric force size from 1 to 8 vehicles per team. Balanced combined-arms distribution across land, air, and naval domains.
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                    {shipsPerTeam} vs {shipsPerTeam} ({shipsPerTeam * 2} Units)
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-mono mr-1">Force size:</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        onChangeShipsPerTeam(num);
                        sounds.playCannonShot('swivel');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                        shipsPerTeam === num
                          ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      {num}v{num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode 3: Fixed Team Size & Player Role Selection */}
            {gameMode === 'transport-protection' && (
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">Convoy Protection Setup & Team Alignment</h4>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      FIXED: 8 ESCORTS + 3-VEHICLE CONVOY VS 5 AMBUSHERS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    The Transporting Team fields 8 heavily equipped combat escorts around a fixed front Hummer, unique armored semi-truck, and rear Hummer. The separate red Attacking Team fields 5 ambushers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Join Transporting Team */}
                  <div
                    onClick={() => {
                      if (onSelectPlayerRole) onSelectPlayerRole('defender');
                      sounds.playCannonShot('swivel');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      playerRole === 'defender'
                        ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Join Transporting Team</span>
                        </span>
                        {playerRole === 'defender' && (
                          <span className="text-[9px] font-mono font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded">
                            YOUR TEAM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Escort and protect the VIP armored semi-truck as it winds across cross-theater bridges and island highways to the extraction boundary.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-emerald-400">
                      Defend Convoy • Reach Extraction = Victory
                    </div>
                  </div>

                  {/* Join Attacking Team */}
                  <div
                    onClick={() => {
                      if (onSelectPlayerRole) onSelectPlayerRole('attacker');
                      sounds.playCannonShot('swivel');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      playerRole === 'attacker'
                        ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-rose-400" />
                          <span>Join Attacking Team</span>
                        </span>
                        {playerRole === 'attacker' && (
                          <span className="text-[9px] font-mono font-bold bg-rose-500 text-slate-950 px-1.5 py-0.5 rounded">
                            YOUR TEAM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Command fast tactical strike units to flank the escort perimeter, breach defenses, and destroy the armored semi-truck before it escapes.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-rose-400">
                      Ambush Convoy • Destroy Rig = Victory
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 4: Team Size Selection (4 to 8) & Player Role Selection */}
            {gameMode === 'amphibious-assault' && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Amphibious Assault Force Sizing & Tactical Alignment</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select force size from 4 to 8 units per team. Choose whether to defend the eastern continental fortress or launch the amphibious naval invasion.
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                    {Math.max(4, shipsPerTeam)} vs {Math.max(4, shipsPerTeam)} ({Math.max(4, shipsPerTeam) * 2} Units)
                  </div>
                </div>

                {/* Team Size Buttons 4 to 8 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-mono mr-1">Force size:</span>
                  {[4, 5, 6, 7, 8].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        onChangeShipsPerTeam(num);
                        sounds.playCannonShot('swivel');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                        shipsPerTeam === num
                          ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      {num}v{num}
                    </button>
                  ))}
                </div>

                {/* Role Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {/* Protecting Team */}
                  <div
                    onClick={() => {
                      if (onSelectPlayerRole) onSelectPlayerRole('defender');
                      sounds.playCannonShot('swivel');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      playerRole === 'defender'
                        ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-sky-400" />
                          <span>Protecting Team (Mainland Fortress)</span>
                        </span>
                        {playerRole === 'defender' && (
                          <span className="text-[9px] font-mono font-bold bg-sky-500 text-slate-950 px-1.5 py-0.5 rounded">
                            YOUR TEAM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Start on the eastern continental mainland. Land vehicles defend the fortress, aircraft fly combat air patrol, and warships guard the shoreline waters.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-sky-400">
                      Protect Coastal Command Station • Repel Invasion
                    </div>
                  </div>

                  {/* Attacking Team */}
                  <div
                    onClick={() => {
                      if (onSelectPlayerRole) onSelectPlayerRole('attacker');
                      sounds.playCannonShot('swivel');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      playerRole === 'attacker'
                        ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-amber-400" />
                          <span>Attacking Team (Amphibious Fleet)</span>
                        </span>
                        {playerRole === 'attacker' && (
                          <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                            YOUR TEAM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Start far left. Land vehicles transit onboard the giant assault carrier until reaching the beachhead. Warships and aircraft provide naval bombardment and escort.
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-amber-400">
                      Beachhead Assault • Destroy Enemy Command Center
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Prominent Launch / Deploy Button Integrated Inside Section 5 */}
            <div className="mt-4 pt-3.5 border-t border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                {gameMode === 'fleet-battle' && (
                  <span>Ready to deploy <strong className="text-slate-200">{shipsPerTeam}v{shipsPerTeam} Combined Arms Battlegroup</strong></span>
                )}
                {gameMode === 'command-station' && (
                  <span>Ready to deploy <strong className="text-slate-200">{shipsPerTeam}v{shipsPerTeam} Command Station Warfare</strong></span>
                )}
                {gameMode === 'transport-protection' && (
                  <span>Ready to deploy as <strong className="text-slate-200">{playerRole === 'defender' ? 'Transport Escort Division' : 'Tactical Ambush Strike'}</strong></span>
                )}
                {gameMode === 'amphibious-assault' && (
                  <span>Ready to deploy as <strong className="text-slate-200">{playerRole === 'defender' ? 'Mainland Defense Forces' : 'Amphibious Invasion Force'} ({Math.max(4, shipsPerTeam)}v{Math.max(4, shipsPerTeam)})</strong></span>
                )}
              </div>

              <button
                onClick={onLaunchBattle}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm shadow-lg transition-all hover:scale-102 active:scale-98 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {gameMode === 'fleet-battle' && `Deploy Tactical Annihilation (${shipsPerTeam}v{shipsPerTeam})`}
                  {gameMode === 'command-station' && `Deploy Command Station Siege (${shipsPerTeam}v{shipsPerTeam})`}
                  {gameMode === 'transport-protection' && `Deploy Convoy Operation (${playerRole === 'defender' ? 'Escort' : 'Ambush'})`}
                  {gameMode === 'amphibious-assault' && `Deploy Amphibious Assault (${playerRole === 'defender' ? 'Defend' : 'Invade'} - ${Math.max(4, shipsPerTeam)}v{Math.max(4, shipsPerTeam)})`}
                </span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Saved Ships Management Drawer / Modal */}
      <SavedShipsModal
        isOpen={isSavedFleetModalOpen}
        onClose={() => setIsSavedFleetModalOpen(false)}
        currentConfig={playerConfig}
        savedShips={savedShips}
        onLoadShip={handleLoadSavedShip}
        onSaveShip={handleSaveShipWithName}
        onDeleteShip={handleDeleteSavedShip}
      />
    </div>
  );
};
