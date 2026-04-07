// lib/model.js — Modelo económico de viabilidad promotora

export const USE_MULT = {
  residencial_libre:      { efficiency: 1,    sales: 1,    rent: 1,    yield: 1 },
  residencial_alquiler:   { efficiency: 1,    sales: 1,    rent: 1,    yield: 1 },
  coliving:               { efficiency: 0.9,  sales: 1.02, rent: 1.35, yield: 1.12 },
  residencia_estudiantes: { efficiency: 0.88, sales: 1.03, rent: 1.28, yield: 1.08 },
  apartahotel:            { efficiency: 0.84, sales: 1.08, rent: 1.25, yield: 1.15 },
  hotel:                  { efficiency: 0.8,  sales: 1.2,  rent: 1.35, yield: 1.22 },
  oficinas:               { efficiency: 0.9,  sales: 0.95, rent: 1.05, yield: 1.08 },
};

export const QUALITY_FACTORS = {
  basica: 0.92, media: 1.0, media_alta: 1.08, alta: 1.18, premium: 1.32,
};

export function computeModel(p) {
  const m = USE_MULT[p.useKey] || USE_MULT.residencial_libre;
  const qf = QUALITY_FACTORS[p.quality] || 1.08;
  const plotArea = p.plotArea || 0;
  const frontage = p.frontage || Math.sqrt(plotArea) * 0.6;
  const depth = p.depth || Math.sqrt(plotArea) * 1.4;

  const geomLoss = Math.min(
    frontage * ((p.setbackFront || 0) + (p.setbackRear || 3)) + depth * ((p.setbackSide || 0) * 2),
    plotArea * 0.45
  );
  const footprint = Math.max(plotArea * ((p.occupation || 70) / 100) - geomLoss, 0);
  const builtByFloors = footprint * (p.floors || 4);
  const builtByFAR = plotArea * (p.buildability || 2.2);
  const gross = Math.min(builtByFloors, builtByFAR);
  const adjusted = Math.max(gross * (1 - (p.patioLoss || 5) / 100), 0);
  const eff = Math.max(0.6, Math.min(0.93,
    ((p.efficiencyByUse || 84) / 100) * m.efficiency * (1 - (p.commonAreaRatio || 16) / 100 + 0.16)
  ));
  const net = adjusted * eff;
  const resSh = Math.max(0, 1 - (p.groundFloorCommercial || 0) / 100);
  const saleRes = net * resSh;
  const saleCom = adjusted * ((p.groundFloorCommercial || 0) / 100) * 0.9;
  const units = Math.max(Math.floor(saleRes / Math.max(p.avgUnitSize || 85, 25)), 1);
  const parking = Math.ceil(units * (p.parkingRatio || 1));
  const basement = Math.max(0, Math.min(plotArea * 0.85 * (p.basements || 1), parking * 28));

  const pem = (p.constructionPEM || 1180) * qf * (1 + ((p.basements || 1) > 0 ? 0.04 : 0));
  const hardCost = adjusted * pem
    + basement * pem * 0.72
    + parking * (p.parkingCostPerSpace || 18000)
    + plotArea * (p.urbanizationCost || 70);

  const buyFees = (p.plotCost || 0) * (p.purchaseCostsPct || 0.035);
  const soft = hardCost * (p.projectSoftPct || 0.12);
  const lic = hardCost * (p.licenseTaxPct || 0.055);
  const devOH = hardCost * (p.developerOverheadsPct || 0.03);
  const cont = hardCost * (p.contingencyPct || 0.05);

  const salesRev = saleRes * (p.salePriceM2 || 2900) * m.sales + saleCom * (p.salePriceCommercialM2 || 2100);
  const mktCost = salesRev * (p.commercialPct || 0.03);
  const finBase = (p.plotCost || 0) + buyFees + hardCost + soft + lic + cont + devOH;
  const finMonths = ((p.monthsBuild || 18) + (p.monthsSales || 8) * 0.4) / 24;
  const finCost = finBase * (p.financePct || 0.05) * finMonths;
  const finHoldMonths = ((p.monthsBuild || 18) + 12) / 24;
  const finHoldCost = finBase * ((p.financePct || 0.05) + 0.005) * finHoldMonths;

  const totalSale = (p.plotCost || 0) + buyFees + hardCost + soft + lic + cont + devOH + mktCost + finCost;
  const totalHold = (p.plotCost || 0) + buyFees + hardCost + soft + lic + cont + devOH + finHoldCost;

  const profit = salesRev - totalSale;
  const margin = salesRev > 0 ? profit / salesRev : 0;
  const roi = totalSale > 0 ? profit / totalSale : 0;

  const rent = (saleRes * (p.rentPriceM2Month || 13.5) * m.rent
    + saleCom * (p.rentCommercialM2Month || 12)) * 12 * ((p.stabilizedOccupancy || 93) / 100);
  const noi = rent * (1 - (p.opexPctOnRent || 24) / 100);
  const capRate = ((p.exitYield || 5) / 100) * (1 / m.yield);
  const stabVal = capRate > 0 ? noi / capRate : 0;
  const profitHold = stabVal - totalHold;
  const roiHold = totalHold > 0 ? profitHold / totalHold : 0;

  const maxLandSale = salesRev
    - (buyFees + hardCost + soft + lic + cont + devOH + mktCost + finCost)
    - salesRev * (p.targetMargin || 0.18);
  const maxLandHold = stabVal
    - (buyFees + hardCost + soft + lic + cont + devOH + finHoldCost)
    - stabVal * (p.targetMargin || 0.18);

  const eq = totalSale * (p.equityPct || 0.30);
  const debt = totalSale * (1 - (p.equityPct || 0.30));
  const finLev = debt * (p.interestRate || 0.055) * (((p.monthsBuild || 18) + (p.monthsSales || 8)) / 24);
  const profLev = salesRev - totalSale - finLev;
  const roiEq = eq > 0 ? profLev / eq : 0;
  const irr = roiEq > 0 ? Math.pow(1 + roiEq, 12 / ((p.monthsBuild || 18) + (p.monthsSales || 8))) - 1 : -1;

  const stress = [-0.1, -0.05, 0, 0.05, 0.1].map(d => ({
    name: `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`,
    profit: salesRev * (1 + d) - totalSale,
  }));

  return {
    adjusted, saleRes, saleCom, units, parking,
    hardCost, soft, lic, buyFees, cont, mktCost, finCost,
    totalSale, totalHold, salesRev, rent, noi, stabVal,
    profit, margin, roi, profitHold, roiHold,
    maxLandSale, maxLandHold,
    eq, debt, finLev, profLev, roiEq, irr,
    stress, capRate,
  };
}
