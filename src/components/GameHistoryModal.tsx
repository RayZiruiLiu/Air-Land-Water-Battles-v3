import React, { useState, useMemo } from 'react';
import {
  GameHistorySummary,
  GameRecord,
  VehicleDomain,
} from '../types/ship';
import {
  formatDuration,
  formatGameDate,
  computeGameHistorySummary,
  deleteGameRecord,
  clearGameHistory,
  getGameHistory,
  DEFAULT_SAMPLE_HISTORY,
  saveGameRecord,
} from '../utils/gameHistory';
import {
  History,
  Trophy,
  Skull,
  Crosshair,
  Target,
  Award,
  Clock,
  Calendar,
  MapPin,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Truck,
  Anchor,
  Plane,
  Shield,
  Zap,
  RotateCcw,
  Check,
  Flame,
  BarChart3,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployAgain?: () => void;
}

export const GameHistoryModal: React.FC<GameHistoryModalProps> = ({
  isOpen,
  onClose,
  onDeployAgain,
}) => {
  const [history, setHistory] = useState<GameRecord[]>(() => getGameHistory());
  const [resultFilter, setResultFilter] = useState<'all' | 'victory' | 'defeat'>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | VehicleDomain>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'damage' | 'kills' | 'score'>('newest');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Refresh history whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setHistory(getGameHistory());
      setConfirmClear(false);
      setActionNotice(null);
    }
  }, [isOpen]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const summary: GameHistorySummary = useMemo(() => {
    return computeGameHistorySummary(history);
  }, [history]);

  const filteredRecords = useMemo(() => {
    return history
      .filter(record => {
        // Result filter
        if (resultFilter !== 'all' && record.result !== resultFilter) {
          return false;
        }
        // Domain filter
        if (domainFilter !== 'all' && record.vehicle.domain !== domainFilter) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchVehicle =
            record.vehicle.name.toLowerCase().includes(q) ||
            record.vehicle.modelName.toLowerCase().includes(q) ||
            record.vehicle.hullClass.toLowerCase().includes(q);
          const matchMap =
            record.map.name.toLowerCase().includes(q) ||
            record.map.theme.toLowerCase().includes(q);
          const matchComponent = record.vehicle.equippedComponentNames.some(c =>
            c.toLowerCase().includes(q)
          );
          if (!matchVehicle && !matchMap && !matchComponent) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.timestamp - a.timestamp;
        if (sortBy === 'damage') return b.performance.damageDealt - a.performance.damageDealt;
        if (sortBy === 'kills') return b.performance.shipsSunk - a.performance.shipsSunk;
        if (sortBy === 'score') return b.performance.score - a.performance.score;
        return 0;
      });
  }, [history, resultFilter, domainFilter, searchQuery, sortBy]);

  const handleDeleteRecord = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteGameRecord(id);
    setHistory(prev => prev.filter(r => r.id !== id));
    sounds.playCannonShot('swivel');
    showNotice('Battle record removed.');
  };

  const handleClearAll = () => {
    clearGameHistory();
    setHistory([]);
    setConfirmClear(false);
    sounds.playCannonShot('mortar');
    showNotice('Combat history log wiped.');
  };

  const handleRestoreSamples = () => {
    DEFAULT_SAMPLE_HISTORY.forEach(r => saveGameRecord(r));
    setHistory(getGameHistory());
    sounds.playCannonShot('swivel');
    showNotice('Sample operations restored.');
  };

  const toggleExpand = (id: string) => {
    setExpandedRecordId(prev => (prev === id ? null : id));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/60 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                  <span>Combat Service Record & Game History</span>
                </h2>
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-amber-300 font-bold px-2 py-0.5 rounded-md border border-slate-700">
                  {history.length} {history.length === 1 ? 'RECORD' : 'RECORDS'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review previous deployments, vehicle loadouts, maps contested, and tactical performance statistics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && !confirmClear && (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-700/50 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                title="Clear all recorded battles"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear History</span>
              </button>
            )}

            {confirmClear && (
              <div className="flex items-center gap-1.5 bg-rose-950/70 border border-rose-600/70 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-bold text-rose-300">Wipe all?</span>
                <button
                  onClick={handleClearAll}
                  className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  No
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              title="Close history"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION TOAST */}
        {actionNotice && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-300 flex items-center gap-2 animate-fade-in">
            <Check className="w-3.5 h-3.5 text-amber-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* 1. AGGREGATE PERFORMANCE OVERVIEW BANNER */}
          {history.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Career Performance Overview
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-400 font-bold">{summary.victories}W</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-rose-400 font-bold">{summary.defeats}L</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-amber-400 font-bold">{summary.winRate}% WIN RATE</span>
                </div>
              </div>

              {/* Win/Loss Ratio Visual Bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex mb-4">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${summary.winRate}%` }}
                />
                <div
                  className="h-full bg-rose-600 transition-all duration-500"
                  style={{ width: `${100 - summary.winRate}%` }}
                />
              </div>

              {/* Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Total Engagements</span>
                  <span className="text-lg font-black font-mono text-slate-100">{summary.totalGames}</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Total Kills</span>
                  <span className="text-lg font-black font-mono text-amber-400 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{summary.totalKills}</span>
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Total Damage</span>
                  <span className="text-lg font-black font-mono text-emerald-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{summary.totalDamageDealt.toLocaleString()}</span>
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Avg Accuracy</span>
                  <span className="text-lg font-black font-mono text-cyan-400 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>{summary.averageAccuracy}%</span>
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">High Score</span>
                  <span className="text-lg font-black font-mono text-yellow-400 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>{summary.highestScore.toLocaleString()}</span>
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Favorite Chassis</span>
                  <span className="text-xs font-bold text-slate-200 truncate block mt-1" title={summary.favoriteVehicleName}>
                    {summary.favoriteVehicleName || 'Standard Hull'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. FILTERS & SEARCH TOOLBAR */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
            {/* Left: Result and Domain Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Result Filter */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setResultFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    resultFilter === 'all'
                      ? 'bg-slate-800 text-amber-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({history.length})
                </button>
                <button
                  onClick={() => setResultFilter('victory')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    resultFilter === 'victory'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Trophy className="w-3 h-3 text-emerald-400" />
                  <span>Victories ({summary.victories})</span>
                </button>
                <button
                  onClick={() => setResultFilter('defeat')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    resultFilter === 'defeat'
                      ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Skull className="w-3 h-3 text-rose-400" />
                  <span>Defeats ({summary.defeats})</span>
                </button>
              </div>

              {/* Domain Filter */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDomainFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    domainFilter === 'all'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Domains
                </button>
                <button
                  onClick={() => setDomainFilter('land')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    domainFilter === 'land'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Ground & armored vehicles"
                >
                  <Truck className="w-3 h-3" />
                  <span className="hidden sm:inline">Ground</span>
                </button>
                <button
                  onClick={() => setDomainFilter('water')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    domainFilter === 'water'
                      ? 'bg-blue-950/80 text-blue-400 border border-blue-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Naval warships & submarines"
                >
                  <Anchor className="w-3 h-3" />
                  <span className="hidden sm:inline">Naval</span>
                </button>
                <button
                  onClick={() => setDomainFilter('air')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    domainFilter === 'air'
                      ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Combat aircraft & helicopters"
                >
                  <Plane className="w-3 h-3" />
                  <span className="hidden sm:inline">Air</span>
                </button>
              </div>
            </div>

            {/* Right: Search & Sort */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter vehicle or map..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  aria-label="Sort game records"
                  className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-slate-900">Newest First</option>
                  <option value="damage" className="bg-slate-900">Most Damage</option>
                  <option value="kills" className="bg-slate-900">Most Kills</option>
                  <option value="score" className="bg-slate-900">Highest Score</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. GAME RECORDS LIST */}
          {filteredRecords.length > 0 ? (
            <div className="space-y-3.5">
              {filteredRecords.map(record => {
                const isExpanded = expandedRecordId === record.id;
                const isVictory = record.result === 'victory';

                // Tactical grade badge styling
                const gradeColors: Record<string, string> = {
                  S: 'bg-gradient-to-br from-yellow-400 to-amber-600 text-stone-950 shadow-amber-500/30',
                  A: 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-cyan-500/30',
                  B: 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30',
                  C: 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-slate-500/20',
                  D: 'bg-gradient-to-br from-stone-700 to-stone-800 text-slate-300 shadow-stone-600/20',
                };

                return (
                  <div
                    key={record.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isVictory
                        ? 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-rose-500/50'
                    }`}
                  >
                    {/* Primary Card Summary Row */}
                    <div
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none"
                      onClick={() => toggleExpand(record.id)}
                    >
                      {/* Left: Result Badge + Vehicle Profile + Map */}
                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        {/* Grade or Result Icon */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md ${
                              gradeColors[record.performance.grade] || gradeColors.B
                            }`}
                          >
                            {record.performance.grade}
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">
                            GRADE
                          </span>
                        </div>

                        {/* Vehicle & Match Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {/* Victory / Defeat Badge */}
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                                isVictory
                                  ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-600/50'
                                  : 'bg-rose-950/90 text-rose-400 border border-rose-600/50'
                              }`}
                            >
                              {isVictory ? (
                                <>
                                  <Trophy className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                                  <span>VICTORY</span>
                                </>
                              ) : (
                                <>
                                  <Skull className="w-3 h-3 text-rose-400" />
                                  <span>DEFEAT</span>
                                </>
                              )}
                            </span>

                            {/* Domain Badge */}
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono uppercase flex items-center gap-1">
                              {record.vehicle.domain === 'land' && <Truck className="w-3 h-3 text-amber-400" />}
                              {record.vehicle.domain === 'water' && <Anchor className="w-3 h-3 text-blue-400" />}
                              {record.vehicle.domain === 'air' && <Plane className="w-3 h-3 text-cyan-400" />}
                              <span>{record.vehicle.domain}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-amber-300">{record.vehicle.hullClass}</span>
                            </span>

                            {/* Survival Status */}
                            <span
                              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                                record.vehicle.survived
                                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40'
                                  : 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                              }`}
                            >
                              {record.vehicle.survived
                                ? `SURVIVED (${Math.round((record.vehicle.finalHp / record.vehicle.maxHp) * 100)}% HP)`
                                : 'LOST IN ACTION'}
                            </span>
                          </div>

                          {/* Vehicle Name & Model */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                              {record.vehicle.name}
                            </h3>
                            {record.vehicle.name !== record.vehicle.modelName && (
                              <span className="text-xs text-slate-400">
                                ({record.vehicle.modelName})
                              </span>
                            )}
                          </div>

                          {/* Map & Date metadata */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1 text-slate-300 font-medium">
                              <MapPin className="w-3 h-3 text-amber-400" />
                              <span>{record.map.name}</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatDuration(record.durationSeconds)}</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{formatGameDate(record.timestamp)}</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="font-mono text-slate-400">
                              {record.settings.shipsPerTeam}v{record.settings.shipsPerTeam} Division
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Key Performance Stats + Chevron */}
                      <div className="flex items-center justify-between lg:justify-end gap-3 sm:gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                        {/* Damage Dealt */}
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">Damage</span>
                          <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                            {record.performance.damageDealt.toLocaleString()}
                          </span>
                        </div>

                        {/* Kills */}
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">Kills</span>
                          <span className="text-sm sm:text-base font-bold font-mono text-amber-400 flex items-center lg:justify-end gap-0.5">
                            <Crosshair className="w-3 h-3" />
                            <span>{record.performance.shipsSunk}</span>
                          </span>
                        </div>

                        {/* Accuracy */}
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">Accuracy</span>
                          <span className="text-sm sm:text-base font-bold font-mono text-cyan-400">
                            {record.performance.accuracy}%
                          </span>
                        </div>

                        {/* Score */}
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] font-mono text-slate-400 block uppercase">Score</span>
                          <span className="text-sm sm:text-base font-black font-mono text-yellow-400">
                            {record.performance.score.toLocaleString()}
                          </span>
                        </div>

                        {/* Delete Single Record */}
                        <button
                          onClick={e => handleDeleteRecord(e, record.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 transition cursor-pointer"
                          title="Delete this battle record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Expand / Collapse Indicator */}
                        <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-amber-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="bg-slate-900/90 border-t border-slate-800 p-4 sm:p-5 space-y-4 animate-fade-in text-xs">
                        {/* Reason / Narrative */}
                        {record.winReason && (
                          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-slate-400 font-mono">ENGAGEMENT OUTCOME:</span>
                            <span className="font-bold text-slate-200">{record.winReason}</span>
                          </div>
                        )}

                        {/* Detailed 3-Column Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Column 1: Vehicle & Loadout */}
                          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-amber-400" />
                                <span>Equipped Armament & Systems</span>
                              </span>
                              <div
                                className="w-4 h-4 rounded-full border border-white/20"
                                style={{ backgroundColor: record.vehicle.primaryColor }}
                                title="Vehicle Camo Primary"
                              />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {record.vehicle.equippedComponentNames.length > 0 ? (
                                record.vehicle.equippedComponentNames.map((compName, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-200 border border-slate-800 text-[11px] font-medium"
                                  >
                                    {compName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic">Standard Factory Loadout</span>
                              )}
                            </div>

                            {record.vehicle.trailerName && (
                              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-slate-400">
                                <span>Towed Attachment:</span>
                                <span className="font-bold text-amber-300">{record.vehicle.trailerName}</span>
                              </div>
                            )}
                          </div>

                          {/* Column 2: Map & Battlefield Topology */}
                          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Battlefield Environment</span>
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 uppercase">
                                {record.map.theme}
                              </span>
                            </div>

                            <p className="text-slate-400 text-[11px] leading-relaxed">
                              {record.map.description}
                            </p>

                            <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-slate-300">
                              <div>
                                <span className="text-[10px] text-slate-500 block">ISLANDS / LAND</span>
                                <span className="font-bold font-mono">{record.map.islandCount} Zones</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">BRIDGES / CAUSEWAYS</span>
                                <span className="font-bold font-mono">{record.map.bridgeCount} Structures</span>
                              </div>
                            </div>
                          </div>

                          {/* Column 3: Fleet & Ballistics Breakdown */}
                          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Combat Ballistics & Fleet</span>
                              </span>
                              <span className="text-[10px] font-mono text-amber-400 font-bold">
                                {record.performance.shotsHit} / {record.performance.shotsFired} HITS
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Allied Forces Remaining:</span>
                                <span className="font-mono font-bold text-emerald-400">
                                  {record.fleetOutcome.alliedRemaining} of {record.fleetOutcome.alliedTotal} Units
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Enemy Forces Remaining:</span>
                                <span className="font-mono font-bold text-rose-400">
                                  {record.fleetOutcome.enemyRemaining} of {record.fleetOutcome.enemyTotal} Units
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Gun & Missile Accuracy:</span>
                                <span className="font-mono font-bold text-cyan-400">
                                  {record.performance.accuracy}% Hit Ratio
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Operational Combat Log Highlights */}
                        {record.combatHighlights && record.combatHighlights.length > 0 && (
                          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block mb-1.5">
                              Combat Operations Transcripts
                            </span>
                            <div className="space-y-1">
                              {record.combatHighlights.map((hl, hIdx) => (
                                <div key={hIdx} className="flex items-start gap-2 text-[11px] text-slate-300 font-mono">
                                  <span className="text-amber-500">›</span>
                                  <span>{hl}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="bg-slate-950/40 border border-slate-800 border-dashed rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                <History className="w-8 h-8 text-amber-500/60" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-200">
                No Combat Records Found
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-6 leading-relaxed">
                {searchQuery || resultFilter !== 'all' || domainFilter !== 'all'
                  ? 'No recorded operations match your active filters. Clear search or reset domain filters to view records.'
                  : 'Your combat service record is currently clear. Deploy into battle across land, sea, and air to build your combat history, or restore sample operational archives.'}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {searchQuery || resultFilter !== 'all' || domainFilter !== 'all' ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setResultFilter('all');
                      setDomainFilter('all');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRestoreSamples}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Restore Sample Combat Records</span>
                    </button>

                    {onDeployAgain && (
                      <button
                        onClick={() => {
                          onClose();
                          onDeployAgain();
                        }}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-600/20"
                      >
                        <Zap className="w-4 h-4 fill-stone-950" />
                        <span>Deploy Into Battle Now</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Operational records are saved locally and update automatically upon match completion.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
            >
              Close History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
