export { analyticsPlugin } from './plugin';
export type {
  AdminNavItem,
  AdminPluginLike,
  LocalizedText,
  UiFieldLike,
  ViewLoader,
} from './types';
export { atom, AtomTypeError, Matrix, Vector } from './atomizer/model';
export type { Atom, AtomType } from './atomizer/model';
export { customerVector, orderVector, toAnalyticsData } from './ecw/models';
export type { AnalyticsData, BaseOrderModel, CustomerModel } from './ecw/models';
export { generateDemoData, PAYMENT_METHODS } from './ecw/demoData';
export type { DemoOptions } from './ecw/demoData';
export { computeSeries, METRICS, metricById, totals } from './series/metrics';
export type { MetricDefinition, MetricId, Series, SeriesQuery, Unit } from './series/metrics';
export { bucketKey, bucketKeys, lastDays, previousRange } from './series/buckets';
export type { Granularity } from './series/buckets';
export { createYScale, LOG_FLOOR, niceStep } from './series/scale';
export type { ScaleKind, YScale } from './series/scale';
export { useAnalytics, RANGES } from './useAnalytics';
export type { Analytics, AnalyticsFilters, RangeDays, UseAnalyticsOptions } from './useAnalytics';
export {
  fetchLiveRanking,
  fetchLiveSeries,
  fetchLiveTopShare,
  RANKING_QUERIES,
  SERIES_QUERY,
  SHARE_QUERY,
  toRanking,
  toSeries,
} from './liveSource';
export type { Executor, LiveRankingAnswer, LiveSeriesAnswer, SourceKind } from './liveSource';
export {
  buildRanking,
  DEFAULT_TOP_N,
  rankingSlices,
  RANK_MEASURES,
  roundShares,
  TOP_N_CHOICES,
} from './series/ranking';
export type {
  PopularSubject,
  RankedEntry,
  RankItem,
  RankMeasure,
  RankSlice,
  Ranking,
  TopN,
} from './series/ranking';
export { DEMO_PRODUCTS, demoRankingEntries, demoTopShare } from './ecw/demoRanking';
export { SHARE_CURVE } from './series/shareCurve';
export type { CurveId } from './series/shareCurve';
export { useTopShare } from './useTopShare';
export type { ShareContext, TopShare } from './useTopShare';
export { POPULAR_CHARTS, usePopular } from './usePopular';
export type { Popular, PopularChart, PopularContext, PopularState } from './usePopular';
export { analyticsUiFields } from './uiFields';
