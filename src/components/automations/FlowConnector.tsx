import { memo } from "react";

interface FlowConnectorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label?: string;
}

export const FlowConnector = memo(function FlowConnector({
  fromX,
  fromY,
  toX,
  toY,
  label,
}: FlowConnectorProps) {
  const midY = (fromY + toY) / 2;

  const path = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={2}
        strokeDasharray="none"
      />
      {/* Arrow */}
      <polygon
        points={`${toX},${toY} ${toX - 5},${toY - 8} ${toX + 5},${toY - 8}`}
        fill="hsl(var(--border))"
      />
      {/* Label */}
      {label && (
        <text
          x={(fromX + toX) / 2}
          y={midY - 6}
          textAnchor="middle"
          className="text-xs fill-muted-foreground"
          fontSize={11}
        >
          {label}
        </text>
      )}
    </g>
  );
});
