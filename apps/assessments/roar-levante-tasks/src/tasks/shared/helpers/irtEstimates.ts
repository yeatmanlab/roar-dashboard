import { clampPositive } from './clowderSetup';

export interface IrtEstimate {
  thetaEstimate: number;
  thetaEstimateRaw: number;
  thetaSE: number;
  thetaSERaw: number;
}

interface TrialIrtEstimates {
  thetas: Record<string, number>;
  thetaSEs: Record<string, number>;
}

export function getIrtEstimates(
  thetas: any,
  thetaSEs: any,
  scaleTheta: any,
  catsScaled: string[],
): Record<string, IrtEstimate> {
  const irtEstimates = catsScaled.reduce((acc: Record<string, IrtEstimate>, cat) => {
    const { thetaEstimate, thetaSE } = scaleTheta(thetas[cat], thetaSEs[cat], cat);
    acc[cat] = {
      thetaEstimate,
      thetaEstimateRaw: thetas[cat],
      thetaSE,
      thetaSERaw: clampPositive(thetaSEs[cat]),
    };
    return acc;
  }, {});

  return irtEstimates;
}

export function getTrialIrtEstimates(trialData: Record<string, IrtEstimate>): TrialIrtEstimates {
  const thetas: Record<string, number> = {};
  const thetaSEs: Record<string, number> = {};

  Object.keys(trialData).forEach((key) => {
    thetas[key] = trialData[key].thetaEstimate;
    thetaSEs[key] = trialData[key].thetaSE;
  });

  return { thetas, thetaSEs };
}

export function getItemParameters(stimulus: any): Record<string, Record<string, number>> {
  return stimulus.zetas.reduce((acc: Record<string, Record<string, number>>, item: any) => {
    acc[item.cats[0]] = item.zeta;
    return acc;
  }, {});
}
