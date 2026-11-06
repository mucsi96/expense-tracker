import { useEffect, useRef } from 'react';
import { init, use as registerCharts } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  LegendScrollComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { ECharts, EChartsOption } from 'echarts';
import styles from './Chart.module.css';

registerCharts([
  BarChart,
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  LegendScrollComponent,
  TooltipComponent,
  SVGRenderer,
]);

export function Chart({ option, events }: { option: EChartsOption; events?: (chart: ECharts) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = init(container.current!, undefined, { renderer: 'svg' });
    chart.setOption(option);
    events?.(chart);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current!);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option, events]);
  return <div ref={container} className={styles.chart} />;
}
