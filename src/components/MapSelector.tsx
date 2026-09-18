import React from 'react';
import { GameMode } from '../types/ship';
import { COMBAT_THEATERS, getCombatTheaterForMapId, getMapIdForTheaterAndMode } from '../data/battleMaps';
import { Globe, Mountain, Shield, Waves, Wind, Check } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface MapSelectorProps {
  selectedMapId: string;
  gameMode?: GameMode;
  onSelectMap: (mapId: string) => void;
}

export const MapSelector: React.FC<MapSelectorProps> = ({
  selectedMapId,
  gameMode = 'fleet-battle',
  onSelectMap,
}) => {
  const currentTheater = getCombatTheaterForMapId(selectedMapId);
  const effectiveMode = (gameMode || 'fleet-battle') as GameMode;

  const handleSelectTheater = (themeId: string) => {
    const nextMapId = getMapIdForTheaterAndMode(themeId, effectiveMode);
    onSelectMap(nextMapId);
    sounds.playCannonShot('swivel');
  };

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 lg:p-5 backdrop-blur-sm shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">4</span>
            <span>Combat Theater</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select the environmental theater for combat operations. Terrains feature distinctive water depths, weather patterns, and tactical island topographies.
          </p>
        </div>
        <div className="text-[11px] font-mono text-amber-400 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/80 w-fit">
          Active: <strong className="text-slate-200">{currentTheater.name}</strong>
        </div>
      </div>

      {/* 6 Visual Map-Theme Windows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {COMBAT_THEATERS.map((theater) => {
          const isSelected = theater.themeId === currentTheater.themeId;

          const renderThemeIcon = () => {
            switch (theater.islandStyle) {
              case 'ice': return <Wind className="w-3.5 h-3.5 text-sky-300" />;
              case 'volcano': return <Globe className="w-3.5 h-3.5 text-rose-400" />;
              case 'industrial': return <Shield className="w-3.5 h-3.5 text-amber-400" />;
              case 'rock': return <Mountain className="w-3.5 h-3.5 text-indigo-300" />;
              case 'sand': default: return <Waves className="w-3.5 h-3.5 text-emerald-300" />;
            }
          };

          return (
            <div
              key={theater.themeId}
              onClick={() => handleSelectTheater(theater.themeId)}
              className={`relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden group ${
                isSelected
                  ? 'bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              {/* Water Color Preview Window Banner */}
              <div
                className="h-16 -mx-3 -mt-3 mb-2.5 relative flex items-center justify-center overflow-hidden border-b border-slate-700/50"
                style={{
                  background: `linear-gradient(135deg, ${theater.waterColors.deep} 0%, ${theater.waterColors.surface} 100%)`,
                }}
              >
                {/* Environmental styling pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 text-[10px] text-slate-200 font-mono">
                  {renderThemeIcon()}
                  <span>{theater.subtitle.split('•')[0].trim()}</span>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Theater Details */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {theater.name}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed mb-2">
                    {theater.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="uppercase text-slate-300">{theater.islandStyle}</span>
                  <span className="text-amber-400 uppercase font-semibold">
                    {theater.ambientWeather || 'Clear'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
