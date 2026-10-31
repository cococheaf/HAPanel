import { useEffect, useState } from 'react';
import type { Energy, Snapshot } from '../../shared/model';
import { energyPeriod } from '../../shared/energy-statistics';
import { api } from '../service';
import { useI18n } from '../i18n';
export function EnergyStatistics({
  config,
  snapshot,
  base,
}: {
  config: Energy;
  snapshot: Snapshot;
  base: string;
}) {
  const { t, intlLocale, describeError } = useI18n();
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day'),
    [values, setValues] = useState<Record<string, number>>(),
    [error, setError] = useState('');
  const meters = config.meters;
  const unitSignature = JSON.stringify(
    [
      meters?.importEnergy,
      meters?.exportEnergy,
      meters?.solarEnergy,
      ...(meters?.solarAdditional ?? []),
      meters?.houseEnergy,
    ].map((id) => snapshot.entities[id ?? '']?.attributes.unit_of_measurement),
  );
  useEffect(() => {
    let current = true;
    setValues(undefined);
    setError('');
    if (!meters) return;
    const ids = [
      ...new Set(
        [
          meters.importEnergy,
          meters.exportEnergy,
          meters.solarEnergy,
          ...(meters.solarAdditional ?? []),
          meters.houseEnergy,
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    if (snapshot.status === 'demo') {
      setValues({});
      return;
    }
    Promise.all(
      ids.map(async (id) => {
        const unit = String(snapshot.entities[id]?.attributes.unit_of_measurement);
        if (!['Wh', 'kWh', 'MWh'].includes(unit)) return [id, undefined] as const;
        const points = await api<{ time: string; value: number }[]>(
          base + encodeURIComponent(id) + '?range=' + range,
        );
        const total = points.length
          ? points.reduce((sum, p) => sum + p.value, 0) *
            (unit === 'Wh' ? 0.001 : unit === 'MWh' ? 1000 : 1)
          : undefined;
        return [id, total] as const;
      }),
    )
      .then((entries) => {
        if (current)
          setValues(
            Object.fromEntries(
              entries.filter((e): e is readonly [string, number] => e[1] !== undefined),
            ),
          );
      })
      .catch((e) => {
        if (current) setError(describeError(e));
      });
    return () => {
      current = false;
    };
  }, [range, JSON.stringify(meters), snapshot.status, base, unitSignature]);
  if (!meters) return null;
  const raw = (key: 'importEnergy' | 'exportEnergy' | 'solarEnergy' | 'houseEnergy') => {
    if (key === 'solarEnergy') {
      const ids = [meters.solarEnergy, ...(meters.solarAdditional ?? [])].filter(
        (id): id is string => Boolean(id),
      );
      return ids.length && ids.every((id) => values?.[id] !== undefined)
        ? ids.reduce((sum, id) => sum + values![id], 0)
        : undefined;
    }
    return values?.[meters[key] ?? ''];
  };
  const totals = energyPeriod(
    {
      importEnergy: raw('importEnergy'),
      exportEnergy: raw('exportEnergy'),
      solarEnergy: raw('solarEnergy'),
      houseEnergy: raw('houseEnergy'),
    },
    meters.tariff,
    meters.exportTariff,
  );
  const n = (v: number | undefined, suffix: string) =>
    v === undefined ? '—' : v.toLocaleString(intlLocale, { maximumFractionDigits: 2 }) + suffix;
  return (
    <section className="v2-energy-statistics">
      <h3>{t('v2.energyTotals')}</h3>
      <div className="v2-segmented">
        {(['day', 'week', 'month'] as const).map((v) => (
          <button className={range === v ? 'active' : ''} key={v} onClick={() => setRange(v)}>
            {t(`v2.${v}`)}
          </button>
        ))}
      </div>
      {error ? (
        <p role="status">{error}</p>
      ) : !values ? (
        <p>{t('common.loading')}</p>
      ) : (
        <div className="v2-stat-grid">
          {(['importEnergy', 'exportEnergy', 'solarEnergy', 'houseEnergy'] as const)
            .filter((key) => meters[key])
            .map((key) => (
              <div key={key}>
                <span>{t(`v2.${key}`)}</span>
                <strong>{n(raw(key), ' kWh')}</strong>
                <small>
                  {(snapshot.entities[meters[key]!]?.attributes.friendly_name as string) ??
                    meters[key]}
                </small>
              </div>
            ))}
          <div>
            <span>{t('v2.selfConsumption')}</span>
            <strong>
              {n(
                totals.selfConsumption === undefined ? undefined : totals.selfConsumption * 100,
                '%',
              )}
            </strong>
          </div>
          <div>
            <span>{t('v2.autarky')}</span>
            <strong>
              {n(totals.autarky === undefined ? undefined : totals.autarky * 100, '%')}
            </strong>
          </div>
          <div>
            <span>{t(meters.exportTariff === undefined ? 'v2.importCost' : 'v2.cost')}</span>
            <strong>
              {totals.cost === undefined
                ? '—'
                : totals.cost.toLocaleString(intlLocale, {
                    style: 'currency',
                    currency: meters.currency ?? 'EUR',
                  })}
            </strong>
          </div>
        </div>
      )}
      <p className="insight-muted">
        {t('v2.statisticsHint')} {t('v2.closedHours')}
      </p>
      <p className="insight-muted">{t('v2.costHint')}</p>
    </section>
  );
}
