import { memo, useEffect, useRef, useState } from 'react';
import type { HistoryPoint } from '../audio/types';
export const HistoryGraph = memo(function HistoryGraph({
  history,
  calibrated,
}: {
  history: HistoryPoint[];
  calibrated: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 173 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const low = calibrated ? 40 : -100,
    high = calibrated ? 130 : 0;
  const end = Math.max(900, history.at(-1)?.timestamp ?? 0),
    start = end - 900;
  const left = 32,
    right = size.width - 8,
    top = 12,
    bottom = size.height - 26;
  const x = (time: number) => left + ((time - start) / 900) * (right - left);
  const y = (level: number) =>
    top + (1 - Math.max(0, Math.min(1, (level - low) / (high - low)))) * (bottom - top);
  const points = history
    .map((p) => `${x(p.timestamp)},${y(calibrated ? (p.dba ?? low) : p.dbfs)}`)
    .join(' ');
  const ticks = size.width < 500 ? 3 : 6;
  const timeLabel = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0')}`;
  return (
    <div className="graph-wrap" ref={ref}>
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`Historial real de nivel de los últimos 15 minutos en ${calibrated ? 'dBA estimado' : 'dBFS'}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1={left}
              y1={top + (i * (bottom - top)) / 3}
              x2={right}
              y2={top + (i * (bottom - top)) / 3}
              className="grid-line"
            />
            <text x={0} y={top + 3 + (i * (bottom - top)) / 3}>
              {Math.round(high - (i * (high - low)) / 3)}
            </text>
          </g>
        ))}
        {Array.from({ length: ticks + 1 }, (_, i) => (
          <g key={i}>
            <line
              x1={left + (i * (right - left)) / ticks}
              y1={top}
              x2={left + (i * (right - left)) / ticks}
              y2={bottom}
              className="grid-line vertical"
            />
            <text
              x={left + (i * (right - left)) / ticks}
              y={size.height - 5}
              textAnchor={i === ticks ? 'end' : 'start'}
            >
              {timeLabel(start + (i * 900) / ticks)}
            </text>
          </g>
        ))}
        {history.length > 1 && (
          <>
            <polygon
              points={`${x(history[0].timestamp)},${bottom} ${points} ${x(history.at(-1)!.timestamp)},${bottom}`}
              fill="var(--green)"
              opacity="0.035"
            />
            <polyline points={points} fill="none" stroke="var(--green)" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {!history.length && <span className="graph-empty">[ ESPERANDO SEÑAL DE ENTRADA ]</span>}
    </div>
  );
});
