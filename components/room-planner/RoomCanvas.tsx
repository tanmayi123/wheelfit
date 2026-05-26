"use client";

import { useRef, useState } from "react";
import type { RoomConfig } from "./PhaseOne";

export type PlacedItem = {
  id: string;
  type: string;
  col: number;
  row: number;
  w: number;
  h: number;
};

type SidebarItem = {
  type: string;
  label: string;
  w: number;
  h: number;
  fill: string;
  stroke: string;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  { type: "door",     label: "Door",     w: 3, h: 1, fill: "#EDE9FE", stroke: "#7C3AED" },
  { type: "window",   label: "Window",   w: 3, h: 1, fill: "#DBEAFE", stroke: "#2563EB" },
  { type: "closet",   label: "Closet",   w: 3, h: 2, fill: "#D1FAE5", stroke: "#059669" },
  { type: "heater",   label: "Heater",   w: 1, h: 1, fill: "#FEE2E2", stroke: "#DC2626" },
  { type: "radiator", label: "Radiator", w: 2, h: 1, fill: "#FEF3C7", stroke: "#D97706" },
  { type: "column",   label: "Column",   w: 1, h: 1, fill: "#F3F4F6", stroke: "#6B7280" },
];

const ITEM_COLORS: Record<string, { fill: string; stroke: string }> = Object.fromEntries(
  SIDEBAR_ITEMS.map((s) => [s.type, { fill: s.fill, stroke: s.stroke }])
);

// Turning diameter in feet
const TURNING_DIAMETER: Record<string, number> = {
  manual: 5,
  power: 5.583,
  transport: 4.167,
};

const TURNING_LABEL: Record<string, string> = {
  manual: '60" turn',
  power: '67" turn',
  transport: '50" turn',
};

const CELL = 44; // px per foot in SVG viewBox

function bfsFloodFill(
  cols: number,
  rows: number,
  placed: PlacedItem[],
  doors: PlacedItem[]
): Set<string> {
  if (doors.length === 0) return new Set();

  const blocked = new Set<string>();
  for (const item of placed) {
    if (item.type === "door" || item.type === "window") continue;
    for (let c = item.col; c < item.col + item.w; c++) {
      for (let r = item.row; r < item.row + item.h; r++) {
        blocked.add(`${c},${r}`);
      }
    }
  }

  const visited = new Set<string>();
  const queue: [number, number][] = [];
  for (const d of doors) {
    for (let c = d.col; c < d.col + d.w; c++) {
      for (let r = d.row; r < d.row + d.h; r++) {
        const k = `${c},${r}`;
        if (!visited.has(k)) { visited.add(k); queue.push([c, r]); }
      }
    }
  }

  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const k = `${nc},${nr}`;
      if (visited.has(k) || blocked.has(k)) continue;
      visited.add(k); queue.push([nc, nr]);
    }
  }
  return visited;
}

type Props = {
  config: RoomConfig;
  onNext: (items: PlacedItem[]) => void;
};

export function RoomCanvas({ config, onNext }: Props) {
  const cols = config.width;
  const rows = config.length;
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [circlePos, setCirclePos] = useState({ cx: cols / 2, cy: rows / 2 });
  const [draggingCircle, setDraggingCircle] = useState(false);
  const circleDragOffset = useRef({ x: 0, y: 0 });
  const pendingDrop = useRef<{ type: string; w: number; h: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const diameter = TURNING_DIAMETER[config.wheelchairType] ?? 5;
  const doors = placed.filter((p) => p.type === "door");
  const reachable = bfsFloodFill(cols, rows, placed, doors);

  // Set of all cells occupied by non-passable items
  const blockedCells = new Set<string>();
  for (const item of placed) {
    if (item.type === "door" || item.type === "window") continue;
    for (let c = item.col; c < item.col + item.w; c++)
      for (let r = item.row; r < item.row + item.h; r++)
        blockedCells.add(`${c},${r}`);
  }

  function toSVGCoords(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = (cols * CELL) / rect.width;
    const scaleY = (rows * CELL) / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function toCell(svgX: number, svgY: number, w: number, h: number) {
    return {
      col: Math.max(0, Math.min(cols - w, Math.floor(svgX / CELL))),
      row: Math.max(0, Math.min(rows - h, Math.floor(svgY / CELL))),
    };
  }

  // HTML5 drag-from-sidebar
  function onSidebarDragStart(type: string, w: number, h: number) {
    pendingDrop.current = { type, w, h };
  }

  function onSVGDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onSVGDrop(e: React.DragEvent) {
    e.preventDefault();
    const item = pendingDrop.current;
    if (!item) return;
    const { x, y } = toSVGCoords(e.clientX, e.clientY);
    const { col, row } = toCell(x, y, item.w, item.h);
    setPlaced((prev) => [
      ...prev,
      { id: `${item.type}-${Date.now()}`, type: item.type, col, row, w: item.w, h: item.h },
    ]);
    pendingDrop.current = null;
  }

  function removeItem(id: string) {
    setPlaced((prev) => prev.filter((p) => p.id !== id));
  }

  // Turning-circle drag via SVG mouse events
  function onCircleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    const { x, y } = toSVGCoords(e.clientX, e.clientY);
    circleDragOffset.current = { x: x / CELL - circlePos.cx, y: y / CELL - circlePos.cy };
    setDraggingCircle(true);
  }

  function onSVGMouseMove(e: React.MouseEvent) {
    if (!draggingCircle) return;
    const { x, y } = toSVGCoords(e.clientX, e.clientY);
    const r = diameter / 2;
    setCirclePos({
      cx: Math.max(r, Math.min(cols - r, x / CELL - circleDragOffset.current.x)),
      cy: Math.max(r, Math.min(rows - r, y / CELL - circleDragOffset.current.y)),
    });
  }

  function onSVGMouseUp() {
    setDraggingCircle(false);
  }

  const vbW = cols * CELL;
  const vbH = rows * CELL;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Room info bar */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{cols} × {rows} ft</span>
        <span className="text-gray-300">|</span>
        <span>1 cell = 1 ft</span>
        <span className="text-gray-300">|</span>
        <span className="text-[#7B2FF7] font-medium">Drag items from sidebar · Click to remove</span>
      </div>

      <div className="flex flex-1 min-h-0 gap-3 px-4 pb-3">
        {/* Sidebar */}
        <div className="w-[72px] shrink-0 flex flex-col gap-2.5 pt-1">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest text-center">
            Fixed
          </p>
          {SIDEBAR_ITEMS.map((si) => (
            <div
              key={si.type}
              draggable
              onDragStart={() => onSidebarDragStart(si.type, si.w, si.h)}
              className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none"
            >
              <div
                className="rounded flex items-center justify-center text-[10px] font-bold border-2 border-dashed"
                style={{
                  background: si.fill,
                  borderColor: si.stroke,
                  color: si.stroke,
                  width: Math.min(si.w * 16, 56),
                  height: Math.max(si.h * 16, 20),
                }}
              >
                {si.label.slice(0, 2)}
              </div>
              <span className="text-[9px] text-gray-500 leading-none">{si.label}</span>
              <span className="text-[8px] text-gray-400">{si.w}×{si.h}</span>
            </div>
          ))}
        </div>

        {/* SVG canvas */}
        <div className="flex-1 min-w-0 border border-[#E8E8E8] rounded-xl overflow-hidden bg-gray-50 shadow-inner">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${vbW} ${vbH}`}
            className="w-full h-full"
            style={{ cursor: draggingCircle ? "grabbing" : "default" }}
            onDragOver={onSVGDragOver}
            onDrop={onSVGDrop}
            onMouseMove={onSVGMouseMove}
            onMouseUp={onSVGMouseUp}
            onMouseLeave={onSVGMouseUp}
          >
            {/* Flood fill background — only when a door exists */}
            {doors.length > 0 &&
              Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const k = `${c},${r}`;
                  if (blockedCells.has(k)) return null;
                  const isDoor = placed.some(
                    (p) => p.type === "door" && c >= p.col && c < p.col + p.w && r >= p.row && r < p.row + p.h
                  );
                  if (isDoor) return null;
                  return (
                    <rect
                      key={k}
                      x={c * CELL}
                      y={r * CELL}
                      width={CELL}
                      height={CELL}
                      fill={reachable.has(k) ? "#bbf7d0" : "#fecaca"}
                      opacity={0.55}
                    />
                  );
                })
              )}

            {/* Grid lines */}
            {Array.from({ length: cols + 1 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={i * CELL} y1={0} x2={i * CELL} y2={vbH}
                stroke="#E8E8E8" strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: rows + 1 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={0} y1={i * CELL} x2={vbW} y2={i * CELL}
                stroke="#E8E8E8" strokeWidth={0.5}
              />
            ))}

            {/* Room border */}
            <rect
              x={0} y={0} width={vbW} height={vbH}
              fill="none" stroke="#9CA3AF" strokeWidth={2}
            />

            {/* Placed items */}
            {placed.map((item) => {
              const colors = ITEM_COLORS[item.type] ?? { fill: "#F3F4F6", stroke: "#9CA3AF" };
              return (
                <g key={item.id} onClick={() => removeItem(item.id)} style={{ cursor: "pointer" }}>
                  <rect
                    x={item.col * CELL + 1}
                    y={item.row * CELL + 1}
                    width={item.w * CELL - 2}
                    height={item.h * CELL - 2}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    rx={3}
                  />
                  <text
                    x={(item.col + item.w / 2) * CELL}
                    y={(item.row + item.h / 2) * CELL + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight="600"
                    fill={colors.stroke}
                  >
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1, 4)}
                  </text>
                </g>
              );
            })}

            {/* Wheelchair turning radius circle — draggable */}
            <g onMouseDown={onCircleMouseDown} style={{ cursor: "grab" }}>
              <circle
                cx={circlePos.cx * CELL}
                cy={circlePos.cy * CELL}
                r={(diameter / 2) * CELL}
                fill="#7B2FF7"
                fillOpacity={0.07}
                stroke="#7B2FF7"
                strokeWidth={2}
                strokeDasharray="7 4"
              />
              <text
                x={circlePos.cx * CELL}
                y={circlePos.cy * CELL + 4}
                textAnchor="middle"
                fontSize={9}
                fill="#7B2FF7"
                fontWeight="700"
                style={{ pointerEvents: "none" }}
              >
                {TURNING_LABEL[config.wheelchairType]}
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 pb-2 text-[11px] text-gray-500">
        {doors.length > 0 ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-200 inline-block border border-green-400" />
              Reachable
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-200 inline-block border border-red-300" />
              Blocked / unreachable
            </span>
          </>
        ) : (
          <span className="text-amber-500 font-medium">
            Place a Door to activate the accessibility overlay
          </span>
        )}
        <span className="ml-auto text-[#7B2FF7]">Drag the purple circle to check turning space</span>
      </div>

      {/* Next button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => onNext(placed)}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-[#7B2FF7] text-white hover:bg-[#6a1fe0] transition-all shadow-sm"
        >
          Next: Review &amp; Get Recommendations →
        </button>
      </div>
    </div>
  );
}
