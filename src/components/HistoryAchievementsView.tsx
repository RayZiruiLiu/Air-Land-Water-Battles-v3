import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  History,
  Lock,
  MapPin,
  Shield,
  Trophy,
} from 'lucide-react';
import { GameRecord } from '../types/ship';
import {
  CareerBreakdownRow,
  computeCareerStatistics,
  deleteGameRecord,
  formatDuration,
  formatGameDate,
  getAchievementProgress,
  getGameHistory,
  getGameModeName,
} from '../utils/gameHistory';

interface HistoryAchievementsViewProps {
  onBack: () => void;
}

type CatalogTab = 'overview' | 'battles' | 'achievements';

const number = new Intl.NumberFormat();

function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-stone-100">{value}</div>
      {detail && <div className="mt-1 text-xs text-stone-400">{detail}</div>}
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: CareerBreakdownRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/60">
      <div className="border-b border-stone-800 px-4 py-3 text-sm font-bold text-stone-200">{title}</div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-stone-500">Complete a battle to populate this report.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-stone-950/70 uppercase tracking-wider text-stone-500">
              <tr><th className="px-4 py-2">Category</th><th>Battles</th><th>W–L</th><th>Kills</th><th>Damage</th><th>Score</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {rows.map(row => (
                <tr key={row.id} className="text-stone-300">
                  <td className="max-w-[280px] px-4 py-3 font-semibold text-stone-100">{row.label}</td>
                  <td>{row.battles}</td><td>{row.wins}–{row.losses}</td><td>{row.kills}</td>
                  <td>{number.format(row.damage)}</td><td className="font-bold text-amber-400">{number.format(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BattleDetail({ record, onDelete }: { record: GameRecord; onDelete: () => void }) {
  const hpPercent = Math.round((record.vehicle.finalHp / Math.max(1, record.vehicle.maxHp)) * 100);
  return (
    <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-xs font-black uppercase tracking-[0.2em] ${record.result === 'victory' ? 'text-emerald-400' : 'text-red-400'}`}>{record.result}</div>
          <h2 className="mt-1 text-xl font-black text-stone-100">{record.vehicle.name}</h2>
          <p className="mt-1 text-xs text-stone-400">{new Date(record.timestamp).toLocaleString()} · {formatDuration(record.durationSeconds)}</p>
        </div>
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-right">
          <div className="text-[10px] uppercase text-amber-300">Existing combat score</div>
          <div className="text-xl font-black text-amber-400">{number.format(record.performance.score)}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ['Mission', record.mission?.summary || record.winReason || 'Battle completed'],
          ['Mode', getGameModeName(record.settings.gameMode)],
          ['Theater', `${record.map.name} · ${record.map.theme}`],
          ['Team / role', `${record.playerTeam === 'enemy' ? 'Red Team' : 'Green Team'} · ${record.playerRole || 'combatant'}`],
          ['Vehicle', `${record.vehicle.modelName} · ${record.vehicle.domain}`],
          ['Survival', record.vehicle.survived ? `Survived · ${hpPercent}% HP` : 'Destroyed in action'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-stone-950/70 p-3">
            <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-stone-200">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Kills" value={record.performance.shipsSunk} />
        <StatCard label="Damage" value={number.format(record.performance.damageDealt)} />
        <StatCard label="Accuracy" value={`${record.performance.accuracy}%`} />
        <StatCard label="Grade" value={record.performance.grade} />
      </div>

      {record.performance.killsByDomain && (
        <p className="mt-4 text-xs text-stone-400">Kill breakdown: {record.performance.killsByDomain.land} land · {record.performance.killsByDomain.air} air · {record.performance.killsByDomain.water} water</p>
      )}
      {record.combatHighlights?.length ? (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Combat highlights</div>
          <ul className="mt-2 space-y-1 text-xs text-stone-300">{record.combatHighlights.map((item, index) => <li key={index}>• {item}</li>)}</ul>
        </div>
      ) : null}
      <button onClick={onDelete} className="mt-5 text-xs font-semibold text-red-400 transition hover:text-red-300">Delete this battle record</button>
    </article>
  );
}

export const HistoryAchievementsView: React.FC<HistoryAchievementsViewProps> = ({ onBack }) => {
  const [tab, setTab] = useState<CatalogTab>('overview');
  const [records, setRecords] = useState<GameRecord[]>(() => getGameHistory());
  const [selectedId, setSelectedId] = useState<string | null>(() => getGameHistory()[0]?.id || null);
  const career = useMemo(() => computeCareerStatistics(records), [records]);
  const achievements = useMemo(() => getAchievementProgress(), [records]);
  const selected = records.find(record => record.id === selectedId) || null;
  const unlockedCount = achievements.filter(item => item.unlocked).length;

  const removeRecord = (id: string) => {
    deleteGameRecord(id);
    const next = records.filter(record => record.id !== id);
    setRecords(next);
    setSelectedId(next[0]?.id || null);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-800 bg-stone-950/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-xl border border-stone-700 bg-stone-900 p-2 text-stone-300 transition hover:bg-stone-800" title="Back to Command HQ"><ArrowLeft className="h-5 w-5" /></button>
            <div className="rounded-xl border border-amber-500/30 bg-amber-600 p-2.5 text-stone-950"><History className="h-5 w-5" /></div>
            <div><h1 className="font-black">History & Achievements</h1><p className="text-xs text-stone-400">Persistent service record and career progression</p></div>
          </div>
          <div className="hidden text-right sm:block"><div className="text-sm font-black text-amber-400">{number.format(career.totalScore)} score</div><div className="text-[10px] uppercase text-stone-500">Lifetime existing-score total</div></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-8">
        <nav className="mb-6 flex gap-2 overflow-x-auto">
          {([
            ['overview', BarChart3, 'Career Overview'],
            ['battles', History, `Battle History (${records.length})`],
            ['achievements', Award, `Achievements (${unlockedCount}/${achievements.length})`],
          ] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${tab === id ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </nav>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <StatCard label="Battles" value={career.summary.totalGames} />
              <StatCard label="Record" value={`${career.summary.victories}–${career.summary.defeats}`} />
              <StatCard label="Win rate" value={`${career.summary.winRate}%`} />
              <StatCard label="Kills" value={career.summary.totalKills} />
              <StatCard label="Damage" value={number.format(career.summary.totalDamageDealt)} />
              <StatCard label="Objectives won" value={career.objectiveVictories} />
            </div>
            <BreakdownTable title="Performance by game mode" rows={career.byMode} />
            <section className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
              <h2 className="text-sm font-bold text-stone-200">Mission-objective performance</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {career.objectiveResults.map(item => <div key={item.id}><StatCard label={item.label} value={item.value} /></div>)}
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-2"><BreakdownTable title="Performance by vehicle category" rows={career.byDomain} /><BreakdownTable title="Performance by specific vehicle" rows={career.byVehicle} /></div>
          </div>
        )}

        {tab === 'battles' && (
          records.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-700 bg-stone-900/40 p-14 text-center"><Shield className="mx-auto h-10 w-10 text-stone-600" /><h2 className="mt-4 font-bold">No completed battles yet</h2><p className="mt-1 text-sm text-stone-500">Completed deployments will be recorded here automatically.</p></div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <div className="space-y-2">
                {records.map(record => (
                  <button key={record.id} onClick={() => setSelectedId(record.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === record.id ? 'border-amber-500/70 bg-amber-500/10' : 'border-stone-800 bg-stone-900/70 hover:border-stone-700'}`}>
                    <div className="flex items-center justify-between"><span className={`text-[10px] font-black uppercase ${record.result === 'victory' ? 'text-emerald-400' : 'text-red-400'}`}>{record.result}</span><span className="text-[10px] text-stone-500">{formatGameDate(record.timestamp)}</span></div>
                    <div className="mt-1 font-bold text-stone-100">{record.vehicle.name}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-stone-400"><MapPin className="h-3 w-3" />{record.map.name}</div>
                    <div className="mt-3 flex justify-between text-xs"><span className="text-stone-500">{record.performance.shipsSunk} kills · {number.format(record.performance.damageDealt)} damage</span><span className="font-bold text-amber-400">{number.format(record.performance.score)}</span></div>
                  </button>
                ))}
              </div>
              {selected && <BattleDetail record={selected} onDelete={() => removeRecord(selected.id)} />}
            </div>
          )
        )}

        {tab === 'achievements' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {achievements.map(achievement => {
              const percent = Math.min(100, Math.round((achievement.progress / achievement.target) * 100));
              return (
                <article key={achievement.id} className={`rounded-2xl border p-5 ${achievement.unlocked ? 'border-amber-500/50 bg-amber-500/10' : 'border-stone-800 bg-stone-900/60'}`}>
                  <div className="flex items-start justify-between gap-3"><div className={`rounded-xl p-2 ${achievement.unlocked ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-500'}`}>{achievement.unlocked ? <Trophy className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</div>{achievement.unlocked && <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-400"><CheckCircle2 className="h-3 w-3" />Unlocked</span>}</div>
                  <h2 className="mt-4 font-black text-stone-100">{achievement.name}</h2><p className="mt-1 min-h-[40px] text-xs leading-relaxed text-stone-400">{achievement.description}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-800"><div className={`h-full rounded-full ${achievement.unlocked ? 'bg-amber-400' : 'bg-stone-600'}`} style={{ width: `${percent}%` }} /></div>
                  <div className="mt-2 flex justify-between text-[10px] text-stone-500"><span>{achievement.progressLabel}</span>{achievement.unlockedAt && <span>{new Date(achievement.unlockedAt).toLocaleDateString()}</span>}</div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
