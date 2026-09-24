'use client';
import { Column, Heading, Row } from '@umami/react-zen';
import { useState } from 'react';
import { ExpandedViewModal } from '@/app/(main)/websites/[websiteId]/ExpandedViewModal';
import { Panel } from '@/components/common/Panel';
import { useMessages } from '@/components/hooks';
import { DialogButton } from '@/components/input/DialogButton';
import { UnitFilter } from '@/components/input/UnitFilter';
import { WeeklyTraffic } from '@/components/metrics/WeeklyTraffic';
import type { AnnotationRange } from '@/lib/annotations';
import { AnnotationsButton } from './annotations/AnnotationsButton';
import { AnnotationsModal } from './annotations/AnnotationsModal';
import { WebsiteChart } from './WebsiteChart';
import { WebsiteControls } from './WebsiteControls';
import { WebsiteMetricsBar } from './WebsiteMetricsBar';
import { WebsitePanels } from './WebsitePanels';

export function WebsitePage({ websiteId }: { websiteId: string }) {
  const [annotationRange, setAnnotationRange] = useState<AnnotationRange | null>(null);
  const { t, labels } = useMessages();

  return (
    <Column gap>
      <WebsiteControls websiteId={websiteId} allowBounceFilter={true} />
      <WebsiteMetricsBar websiteId={websiteId} showChange={true} />
      <Panel minHeight="520px">
        <Row justifyContent="end">
          <UnitFilter />
        </Row>
        <WebsiteChart
          websiteId={websiteId}
          showAnnotations
          onAnnotationMoreClick={setAnnotationRange}
          legendActions={<AnnotationsButton websiteId={websiteId} />}
        />
      </Panel>
      <Panel data-test="traffic-heatmap">
        <Heading size="2xl">{t(labels.traffic)}</Heading>
        <WeeklyTraffic websiteId={websiteId} />
      </Panel>
      <WebsitePanels websiteId={websiteId} />
      <ExpandedViewModal websiteId={websiteId} />
      <DialogButton
        isOpen={!!annotationRange}
        onOpenChange={isOpen => !isOpen && setAnnotationRange(null)}
        title={null}
        width="800px"
      >
        {({ close }) =>
          annotationRange && (
            <AnnotationsModal
              websiteId={websiteId}
              range={annotationRange}
              onClose={() => {
                close();
                setAnnotationRange(null);
              }}
            />
          )
        }
      </DialogButton>
    </Column>
  );
}
