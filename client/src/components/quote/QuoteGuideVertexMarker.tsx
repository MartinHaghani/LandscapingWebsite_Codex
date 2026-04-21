import type { PolygonKind } from '../../types';

interface QuoteGuideVertexMarkerProps {
  cx: number;
  cy: number;
  filterId: string;
  markerKey: string;
  selected: boolean;
  kind?: PolygonKind;
  opacity?: number;
}

export const QuoteGuideVertexMarker = ({
  cx,
  cy,
  filterId,
  markerKey,
  selected,
  kind = 'service',
  opacity = 1
}: QuoteGuideVertexMarkerProps) => {
  const markerColor = kind === 'obstacle' ? '#DC2626' : '#329F5B';
  const markerBorderColor = kind === 'obstacle' ? '#FFF7F7' : '#D1FAE1';

  if (!selected) {
    return (
      <circle
        key={markerKey}
        cx={cx}
        cy={cy}
        r="5.4"
        fill={markerColor}
        stroke="#FFFFFF"
        strokeWidth="2"
        filter={`url(#${filterId})`}
        opacity={opacity}
      />
    );
  }

  return (
    <g key={markerKey} opacity={opacity} data-guide-selected-vertex="true">
      <circle
        cx={cx}
        cy={cy}
        r="15.6"
        fill={markerColor}
        fillOpacity="0.12"
        stroke={markerColor}
        strokeWidth="2.4"
        strokeOpacity="0.3"
      />
      <circle
        cx={cx}
        cy={cy}
        r="12.8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeOpacity="0.9"
      />
      <circle
        cx={cx}
        cy={cy}
        r="10"
        fill={markerColor}
        stroke={markerBorderColor}
        strokeWidth="3.2"
        filter={`url(#${filterId})`}
      />
    </g>
  );
};
