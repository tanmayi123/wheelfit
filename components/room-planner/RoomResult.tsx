"use client";

import { useMemo } from "react";
import { placeItemsInRoom } from "@/lib/spatial-engine";

type FixedElement = {
  type: string;
  col: number;
  row: number;
  w: number;
  h: number;
};

type SuggestedFurniture = {
  id: string;
  name: string;
  category: string;
  widthIn: number;
  depthIn: number;
  price: number;
  url: string;
};

type Props = {
  roomW: number;
  roomL: number;
  fixedElements: FixedElement[];
  suggestedFurniture: SuggestedFurniture[];
  wheelchairType: "manual" | "power" | "transport";
};

const WHEELCHAIR_DIAMETER_IN: Record<string, number> = {
  manual: 60,
  power: 67,
  transport: 50,
};

const FIXED_COLORS: Record<string, { fill: string; stroke: string }> = {
  door:     { fill: "#DBEAFE", stroke: "#2563EB" },
  window:   { fill: "#E0F2FE", stroke: "#0284C7" },
  closet:   { fill: "#F3F4F6", stroke: "#6B7280" },
  heater:   { fill: "#FEF3C7", stroke: "#D97706" },
  radiator: { fill: "#FEF3C7", stroke: "#D97706" },
  column:   { fill: "#E5E7EB", stroke: "#9CA3AF" },
};

const CELL = 40; // px per cell in SVG viewBox

function doorArcPath(
  el: FixedElement,
  roomW: number,
  roomL: number
): string | null {
  const atNorth = el.row === 0;
  const atSouth = el.row + el.h >= roomL;
  const atWest  = el.col === 0;
  const atEast  = el.col + el.w >= roomW;

  const x = el.col * CELL;
  const y = el.row * CELL;
  const wPx = el.w * CELL;
  const hPx = el.h * CELL;

  // Draw quarter-circle arc indicating door swing direction
  if (atNorth) {
    // Hinge left corner, swing inward (downward)
    return `M ${x + wPx},${y} A ${wPx},${wPx} 0 0,0 ${x},${y + wPx}`;
  }
  if (atSouth) {
    return `M ${x},${y + hPx} A ${wPx},${wPx} 0 0,0 ${x + wPx},${y + hPx - wPx}`;
  }
  if (atWest) {
    return `M ${x},${y + hPx} A ${hPx},${hPx} 0 0,1 ${x + hPx},${y}`;
  }
  if (atEast) {
    return `M ${x + wPx},${y} A ${hPx},${hPx} 0 0,0 ${x + wPx - hPx},${y + hPx}`;
  }
  return null;
}

function wallLabel(
  col: number,
  row: number,
  roomW: number,
  roomL: number
): string {
  if (row === 0) return "north wall";
  if (row + 1 >= roomL) return "south wall";
  if (col === 0) return "west wall";
  if (col + 1 >= roomW) return "east wall";
  return "center area";
}

export function RoomResult({
  roomW,
  roomL,
  fixedElements,
  suggestedFurniture,
  wheelchairType,
}: Props) {
  const diameterIn = WHEELCHAIR_DIAMETER_IN[wheelchairType];

  const result = useMemo(
    () =>
      placeItemsInRoom(
        roomW,
        roomL,
        fixedElements,
        suggestedFurniture.map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          widthIn: f.widthIn,
          depthIn: f.depthIn,
        })),
        diameterIn
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomW, roomL, JSON.stringify(fixedElements), JSON.stringify(suggestedFurniture), diameterIn]
  );

  const vbW = roomW * CELL;
  const vbH = roomL * CELL;

  // Build reachable set
  const reachableSet = new Set(result.pathways.map((c) => `${c.col},${c.row}`));

  // Build occupied set for flood fill coloring
  const occupiedSet = new Set<string>();
  for (const el of fixedElements) {
    for (let c = el.col; c < el.col + el.w; c++)
      for (let r = el.row; r < el.row + el.h; r++)
        occupiedSet.add(`${c},${r}`);
  }
  for (const p of result.placements) {
    for (let c = p.col; c < p.col + p.w; c++)
      for (let r = p.row; r < p.row + p.h; r++)
        occupiedSet.add(`${c},${r}`);
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#E8E8E8] overflow-hidden bg-white">
      <div className="px-5 py-3 bg-[#7B2FF7]/5 border-b border-[#E8E8E8] flex items-center justify-between">
        <p className="text-xs font-bold text-[#7B2FF7] uppercase tracking-widest">
          2D Floor Plan
        </p>
        <span className="text-xs text-gray-400">{openFloorLabel(result.openFloorPercent)} open floor</span>
      </div>

      {/* SVG floorplan */}
      <div className="p-4 bg-gray-50">
        <div className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-white">
          <svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            className="w-full"
            style={{ maxHeight: 320 }}
          >
            {/* Flood fill overlay */}
            {result.pathways.length > 0 &&
              Array.from({ length: roomL }, (_, r) =>
                Array.from({ length: roomW }, (_, c) => {
                  const key = `${c},${r}`;
                  if (occupiedSet.has(key)) return null;
                  const reachable = reachableSet.has(key);
                  return (
                    <rect
                      key={key}
                      x={c * CELL}
                      y={r * CELL}
                      width={CELL}
                      height={CELL}
                      fill={reachable ? "#16a34a" : "#dc2626"}
                      opacity={0.13}
                    />
                  );
                })
              )}

            {/* Grid lines */}
            {Array.from({ length: roomW + 1 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={i * CELL} y1={0} x2={i * CELL} y2={vbH}
                stroke="#F3F4F6" strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: roomL + 1 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={0} y1={i * CELL} x2={vbW} y2={i * CELL}
                stroke="#F3F4F6" strokeWidth={0.5}
              />
            ))}

            {/* Room border */}
            <rect
              x={0} y={0} width={vbW} height={vbH}
              fill="none" stroke="#9CA3AF" strokeWidth={2}
            />

            {/* Fixed elements */}
            {fixedElements.map((el, i) => {
              const colors = FIXED_COLORS[el.type] ?? { fill: "#F3F4F6", stroke: "#9CA3AF" };
              const arc = el.type === "door" ? doorArcPath(el, roomW, roomL) : null;
              return (
                <g key={i}>
                  <rect
                    x={el.col * CELL + 1}
                    y={el.row * CELL + 1}
                    width={el.w * CELL - 2}
                    height={el.h * CELL - 2}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={2}
                    rx={2}
                  />
                  <text
                    x={(el.col + el.w / 2) * CELL}
                    y={(el.row + el.h / 2) * CELL + 4}
                    textAnchor="middle"
                    fontSize={8}
                    fill={colors.stroke}
                    fontWeight="700"
                  >
                    {el.type.charAt(0).toUpperCase() + el.type.slice(1, 4)}
                  </text>
                  {arc && (
                    <path
                      d={arc}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                      opacity={0.7}
                    />
                  )}
                </g>
              );
            })}

            {/* Placed furniture */}
            {result.placements.map((item) => (
              <g key={item.id}>
                <rect
                  x={item.col * CELL + 1}
                  y={item.row * CELL + 1}
                  width={item.w * CELL - 2}
                  height={item.h * CELL - 2}
                  fill={item.color}
                  fillOpacity={0.18}
                  stroke={item.color}
                  strokeWidth={2}
                  rx={3}
                />
                <text
                  x={(item.col + item.w / 2) * CELL}
                  y={(item.row + item.h / 2) * CELL - 3}
                  textAnchor="middle"
                  fontSize={8}
                  fill={item.color}
                  fontWeight="700"
                >
                  {item.name.slice(0, 12)}
                </text>
                <text
                  x={(item.col + item.w / 2) * CELL}
                  y={(item.row + item.h / 2) * CELL + 8}
                  textAnchor="middle"
                  fontSize={7}
                  fill={item.color}
                  opacity={0.8}
                >
                  {item.w * 12}"×{item.h * 12}"
                </text>
              </g>
            ))}

            {/* Wheelchair turning circle */}
            {result.turningCircle && (
              <g>
                <circle
                  cx={result.turningCircle.col * CELL}
                  cy={result.turningCircle.row * CELL}
                  r={(result.turningCircle.diameter / 2) * CELL}
                  fill="#7B2FF7"
                  fillOpacity={0.06}
                  stroke="#7B2FF7"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
                <text
                  x={result.turningCircle.col * CELL}
                  y={result.turningCircle.row * CELL + 4}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#7B2FF7"
                  fontWeight="700"
                >
                  {diameterIn}" turn
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-500">
          {result.pathways.length > 0 && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-500 inline-block" />
                Accessible
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-400 inline-block" />
                Unreachable
              </span>
            </>
          )}
          <span className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block border-2 border-dashed"
              style={{ borderColor: "#7B2FF7" }}
            />
            Turning zone
          </span>
        </div>
      </div>

      {/* ADA compliance banner */}
      {result.adaCompliant ? (
        <div className="mx-4 mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-2">
          <span className="text-green-600 text-base mt-0.5">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-700">ADA Compliant</p>
            <p className="text-xs text-green-600">Wheelchair can navigate freely with {result.openFloorPercent}% open floor space</p>
          </div>
        </div>
      ) : (
        <div className="mx-4 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-red-500 text-base mt-0.5">✗</span>
            <p className="text-sm font-semibold text-red-700">Accessibility Issues Found</p>
          </div>
          <ul className="space-y-1">
            {result.violations.map((v, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                <span className="mt-px shrink-0">•</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Placed items list */}
      {result.placements.length > 0 && (
        <div className="px-4 pb-4 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Furniture Placement
          </p>
          {result.placements.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-[#E8E8E8]"
            >
              <span
                className="w-2 h-6 rounded-full shrink-0"
                style={{ background: item.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-500">
                  {wallLabel(item.col, item.row, roomW, roomL)}, {item.col}ft from left · {item.w * 12}"×{item.h * 12}"
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function openFloorLabel(pct: number): string {
  if (pct >= 70) return `${pct}%`;
  if (pct >= 50) return `${pct}%`;
  return `${pct}%`;
}
