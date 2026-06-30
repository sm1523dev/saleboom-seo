export type AeoScoreInput = {
  mentionsFound: number;
  queriesRun: number;
  aiReferrals: number;
  totalReferrals: number;
  citationsFound: number;
  ragQueriesRun: number;
};

export function computeAeoScore(input: AeoScoreInput): number {
  const signal1Rate = input.queriesRun > 0 ? input.mentionsFound / input.queriesRun : 0;
  const signal2Index = Math.min(
    input.totalReferrals > 0 ? input.aiReferrals / input.totalReferrals : 0,
    1.0
  );
  const signal3Rate = input.ragQueriesRun > 0 ? input.citationsFound / input.ragQueriesRun : 0;
  return Math.round((signal1Rate * 0.7 + signal2Index * 0.2 + signal3Rate * 0.1) * 100);
}
