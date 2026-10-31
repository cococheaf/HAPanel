/** Ratios are available only when every required, disjoint source exists. */
export function energyPeriod(
  values: {
    importEnergy?: number;
    exportEnergy?: number;
    solarEnergy?: number;
    houseEnergy?: number;
  },
  tariff?: number,
  exportTariff?: number,
) {
  const valid = (v: number | undefined): v is number =>
    v !== undefined && Number.isFinite(v) && v >= 0;
  const solar = values.solarEnergy,
    out = values.exportEnergy,
    house = values.houseEnergy,
    incoming = values.importEnergy;
  const consumed = valid(solar) && valid(out) && out <= solar ? solar - out : undefined;
  return {
    selfConsumption: consumed !== undefined && solar! > 0 ? consumed / solar! : undefined,
    autarky:
      valid(house) && house > 0 && valid(incoming) && incoming <= house
        ? (house - incoming) / house
        : undefined,
    cost:
      valid(incoming) && tariff !== undefined && (exportTariff === undefined || valid(out))
        ? incoming * tariff - (valid(out) && exportTariff !== undefined ? out * exportTariff : 0)
        : undefined,
  };
}
