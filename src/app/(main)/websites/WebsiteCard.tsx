import { Column, Icon, Row, Text } from '@umami/react-zen';
import { Sparkline } from '@/components/charts/Sparkline';
import { Favicon } from '@/components/common/Favicon';
import Link from '@/components/common/Link';
import { LinkButton } from '@/components/common/LinkButton';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useMessages, useNavigation } from '@/components/hooks';
import { useWebsiteStatsQuery } from '@/components/hooks/queries/useWebsiteStatsQuery';
import { SquarePen } from '@/components/icons';
import { ActiveUsers } from '@/components/metrics/ActiveUsers';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsBar } from '@/components/metrics/MetricsBar';
import { formatLongNumber } from '@/lib/format';
import type { WebsiteListChartData } from '@/queries/sql/getWebsiteListCharts';
import styles from './WebsiteCard.module.css';

export function WebsiteCard({
  website,
  chart,
  showActions,
}: {
  website: any;
  chart?: WebsiteListChartData;
  showActions?: boolean;
}) {
  const { id: websiteId, name, domain } = website;
  const { t, labels } = useMessages();
  const { renderUrl } = useNavigation();
  const { data: stats, isLoading, error } = useWebsiteStatsQuery({ websiteId });

  return (
    <Column
      className={styles.card}
      border
      borderRadius
      backgroundColor="surface"
      padding="5"
      gap="4"
      data-test="website-card"
    >
      <Row justifyContent="space-between" alignItems="center" gap>
        <Row alignItems="center" gap="3" minWidth="0">
          <Icon size="lg" color="muted">
            <Favicon domain={domain} />
          </Icon>
          <Column minWidth="0">
            <Link href={renderUrl(`/websites/${websiteId}`, false)}>
              <Text size="lg" weight="bold" truncate>
                {name}
              </Text>
            </Link>
            <Text size="sm" color="muted" truncate>
              {domain}
            </Text>
          </Column>
        </Row>
        <Row alignItems="center" gap="2">
          <ActiveUsers websiteId={websiteId} />
          {showActions && (
            <LinkButton href={renderUrl(`/websites/${websiteId}/settings`)} variant="quiet">
              <Icon>
                <SquarePen />
              </Icon>
            </LinkButton>
          )}
        </Row>
      </Row>
      <LoadingPanel data={stats} isLoading={isLoading} error={error} minHeight="140px">
        {stats && (
          <MetricsBar columns="repeat(2, minmax(0, 1fr))">
            <MetricCard
              label={t(labels.visitors)}
              value={stats.visitors}
              change={stats.visitors - stats.comparison.visitors}
              formatValue={formatLongNumber}
              showChange={true}
            />
            <MetricCard
              label={t(labels.views)}
              value={stats.pageviews}
              change={stats.pageviews - stats.comparison.pageviews}
              formatValue={formatLongNumber}
              showChange={true}
            />
          </MetricsBar>
        )}
      </LoadingPanel>
      <Sparkline values={chart?.values} />
    </Column>
  );
}

export function WebsiteCardGrid({
  data,
  charts,
  showActions,
}: {
  data: any[];
  charts?: Record<string, WebsiteListChartData>;
  showActions?: boolean;
}) {
  return (
    <div className={styles.grid}>
      {data?.map(website => (
        <WebsiteCard
          key={website.id}
          website={website}
          chart={charts?.[website.id]}
          showActions={showActions}
        />
      ))}
    </div>
  );
}
