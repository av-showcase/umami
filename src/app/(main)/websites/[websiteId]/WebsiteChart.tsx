import { isSameDay } from 'date-fns';
import { type ReactNode, useCallback, useMemo } from 'react';
import type { ChartAnnotation } from '@/components/charts/ChartAnnotationMarkers';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import {
  useDateParameters,
  useDateRange,
  useMessages,
  useNavigation,
  useTimezone,
  useWebsiteAnnotationsQuery,
} from '@/components/hooks';
import { useWebsitePageviewsQuery } from '@/components/hooks/queries/useWebsitePageviewsQuery';
import { MetricSeriesChart, type MetricSeriesKind } from '@/components/metrics/MetricSeriesChart';
import { PageviewsChart } from '@/components/metrics/PageviewsChart';
import { type AnnotationRange, getAnnotationDateRangeValue } from '@/lib/annotations';
import { DATE_FUNCTIONS } from '@/lib/date';

export type WebsiteChartMetric = 'pageviews' | MetricSeriesKind;

export const DEFAULT_WEBSITE_CHART_METRIC: WebsiteChartMetric = 'pageviews';

export function WebsiteChart({
  websiteId,
  compareMode,
  showAnnotations,
  onAnnotationMoreClick,
  legendActions,
}: {
  websiteId: string;
  compareMode?: boolean;
  showAnnotations?: boolean;
  onAnnotationMoreClick?: (range: AnnotationRange) => void;
  legendActions?: ReactNode;
}) {
  const { timezone, localFromUtc, localToUtc } = useTimezone();
  const { dateRange, dateCompare } = useDateRange({ timezone: timezone });
  const { startDate, endDate, unit, value } = dateRange;
  const { startAt, endAt } = useDateParameters();
  const { router, updateParams, query } = useNavigation();
  const metric = (query.metric as WebsiteChartMetric) ?? DEFAULT_WEBSITE_CHART_METRIC;
  const { t, labels } = useMessages();
  const { data: annotationData } = useWebsiteAnnotationsQuery(
    websiteId,
    { startAt, endAt, pageSize: 1000 },
    { enabled: !!showAnnotations && !!websiteId },
  );
  const { data, isLoading, isFetching, error } = useWebsitePageviewsQuery({
    websiteId,
    compare: compareMode ? dateCompare?.compare : undefined,
    // Only ask the server for the session-series metrics when they are
    // actually selected; otherwise the server skips the third DB query.
    metric: metric === 'pageviews' ? undefined : metric,
  });
  const { pageviews, sessions, bouncerate, visitduration, compare } = (data || {}) as any;
  const canDrillIntoAnnotation =
    unit !== 'hour' && unit !== 'minute' && !isSameDay(startDate, endDate);

  const pageviewsChartData = useMemo(() => {
    if (!data) {
      return { pageviews: [], sessions: [] };
    }

    return {
      pageviews,
      sessions,
      ...(compare && {
        compare: {
          pageviews: pageviews.map(({ x }, i) => ({
            x,
            y: compare.pageviews[i]?.y,
            d: compare.pageviews[i]?.x,
          })),
          sessions: sessions.map(({ x }, i) => ({
            x,
            y: compare.sessions[i]?.y,
            d: compare.sessions[i]?.x,
          })),
        },
      }),
    };
  }, [data, startDate, endDate, unit]);

  const annotations = useMemo<ChartAnnotation[]>(() => {
    const isSubDayUnit = unit === 'hour' || unit === 'minute';

    return (annotationData?.data || [])
      .filter(({ allDay }) => !isSubDayUnit || allDay === false)
      .map(({ id, date, note, allDay }) => {
        const annotationDate = localFromUtc(new Date(date));

        return {
          id,
          date: annotationDate,
          markerDate: DATE_FUNCTIONS[unit].start(annotationDate),
          label: note,
          allDay,
          isClickable: canDrillIntoAnnotation,
          isGroupClickable: unit === 'month',
        };
      });
  }, [annotationData, timezone, unit, canDrillIntoAnnotation]);

  const handleAnnotationClick = useCallback(
    (annotations: ChartAnnotation[]) => {
      const [annotation] = annotations;
      const hasOneDate = annotations.every(item => isSameDay(item.date, annotation.date));

      if (hasOneDate) {
        router.push(
          updateParams({
            date: getAnnotationDateRangeValue(annotation.date, annotation.allDay !== false),
            offset: undefined,
          }),
        );
        return;
      }

      const markerDate = annotation.markerDate || annotation.date;
      const startDate = DATE_FUNCTIONS.month.start(markerDate);
      const endDate = DATE_FUNCTIONS.month.end(markerDate);

      router.push(
        updateParams({
          date: `range:${startDate.getTime()}:${endDate.getTime()}`,
          offset: undefined,
        }),
      );
    },
    [router, updateParams],
  );

  const handleAnnotationMoreClick = useCallback(
    (annotations: ChartAnnotation[]) => {
      const markerDate = annotations[0].markerDate || annotations[0].date;
      const { start, end } = DATE_FUNCTIONS[unit];

      onAnnotationMoreClick?.({
        startAt: +localToUtc(start(markerDate)),
        endAt: +localToUtc(end(markerDate)),
      });
    },
    [localToUtc, onAnnotationMoreClick, unit],
  );

  const metricChartData = useMemo(() => {
    if (!data || metric === 'pageviews') return null;

    const series = metric === 'bouncerate' ? bouncerate : visitduration;
    const compareSeries = compare
      ? metric === 'bouncerate'
        ? compare.bouncerate
        : compare.visitduration
      : null;

    return {
      series: series ?? [],
      ...(compareSeries && {
        compare: series.map(({ x }, i) => ({
          x,
          y: compareSeries[i]?.y ?? 0,
          d: compareSeries[i]?.x,
        })),
      }),
    };
  }, [data, metric, bouncerate, visitduration, compare]);

  return (
    <LoadingPanel data={data} isFetching={isFetching} isLoading={isLoading} error={error}>
      {metric === 'pageviews' ? (
        <PageviewsChart
          key={`${value}-pageviews`}
          data={pageviewsChartData}
          legendActions={legendActions}
          minDate={startDate}
          maxDate={endDate}
          unit={unit}
          annotations={annotations}
          onAnnotationClick={handleAnnotationClick}
          onAnnotationMoreClick={onAnnotationMoreClick ? handleAnnotationMoreClick : undefined}
        />
      ) : (
        <MetricSeriesChart
          key={`${value}-${metric}`}
          data={metricChartData}
          minDate={startDate}
          maxDate={endDate}
          unit={unit}
          kind={metric}
          label={metric === 'bouncerate' ? t(labels.bounceRate) : t(labels.visitDuration)}
          comparePreviousLabel={`${
            metric === 'bouncerate' ? t(labels.bounceRate) : t(labels.visitDuration)
          } (${t(labels.previous)})`}
        />
      )}
    </LoadingPanel>
  );
}
