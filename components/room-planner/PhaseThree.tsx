"use client";

import { useMemo } from "react";
import type { UIMessage } from "ai";
import type { RoomConfig } from "./PhaseOne";
import type { PlacedItem as CanvasItem } from "./RoomCanvas";
import { RoomResult } from "./RoomResult";

const TURNING_INCHES: Record<string, number> = {
  manual: 60,
  power: 67,
  transport: 50,
};

const WHEELCHAIR_LABEL: Record<string, string> = {
  manual: "Manual wheelchair",
  power: "Power wheelchair",
  transport: "Transport chair",
};

// Dimension defaults per furniture category (inches)
const CATEGORY_DIMS: Record<string, { widthIn: number; depthIn: number }> = {
  bed:        { widthIn: 60, depthIn: 80 },
  beds:       { widthIn: 60, depthIn: 80 },
  desk:       { widthIn: 42, depthIn: 20 },
  desks:      { widthIn: 42, depthIn: 20 },
  nightstand: { widthIn: 18, depthIn: 16 },
  nightstands:{ widthIn: 18, depthIn: 16 },
  stand:      { widthIn: 18, depthIn: 16 },
  chair:      { widthIn: 28, depthIn: 30 },
  chairs:     { widthIn: 28, depthIn: 30 },
  lamp:       { widthIn: 18, depthIn: 18 },
  lamps:      { widthIn: 18, depthIn: 18 },
  dresser:    { widthIn: 48, depthIn: 18 },
  dressers:   { widthIn: 48, depthIn: 18 },
  sofa:       { widthIn: 84, depthIn: 34 },
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

function getLastAssistantText(messages: UIMessage[]): string {
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length === 0) return "";
  const last = assistantMessages[assistantMessages.length - 1];
  return last.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

function extractFurnitureFromText(text: string): SuggestedFurniture[] {
  if (!text) return [];
  const results: SuggestedFurniture[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    // Look for lines with a price
    const priceMatch = line.match(/\$[\d,]+/);
    if (!priceMatch) continue;

    const lower = line.toLowerCase();
    let category = "";
    let dims = { widthIn: 36, depthIn: 36 };

    // Match furniture category keywords in priority order
    const categoryKeys = Object.keys(CATEGORY_DIMS);
    for (const key of categoryKeys) {
      if (lower.includes(key)) {
        category = key.replace(/s$/, ""); // normalize plural
        dims = CATEGORY_DIMS[key];
        break;
      }
    }
    if (!category) continue;

    const price = parseFloat(priceMatch[0].replace(/[$,]/g, ""));
    // Clean up name: strip markdown bold, bullet, price tail
    const name = line
      .replace(/\*\*/g, "")
      .replace(/\$[\d,]+.*$/, "")
      .replace(/^[-*•#\d.)\s]+/, "")
      .trim()
      .slice(0, 60);

    if (!name) continue;

    results.push({
      id: `${category}-${results.length}`,
      name,
      category,
      ...dims,
      price,
      url: "https://wayfair.com",
    });

    if (results.length >= 3) break;
  }

  return results;
}

type Props = {
  config: RoomConfig;
  placedItems: CanvasItem[];
  onFindFurniture: (message: string) => void;
  isBusy: boolean;
  messages: UIMessage[];
};

export function PhaseThree({ config, placedItems, onFindFurniture, isBusy, messages }: Props) {
  const { width, length, wheelchairType, style, furniture } = config;
  const turningInches = TURNING_INCHES[wheelchairType];

  const fixedElements = placedItems.map((p) => ({
    type: p.type,
    col: p.col,
    row: p.row,
    w: p.w,
    h: p.h,
  }));

  // Compute available space stats for AI message
  const occupiedCells = placedItems.reduce((s, p) => s + p.w * p.h, 0);
  const totalCells = width * length;
  const freeCells = totalCells - occupiedCells;
  const freePercent = Math.round((freeCells / totalCells) * 100);

  const gridData = {
    room: { widthFt: width, lengthFt: length, widthCells: width, lengthCells: length },
    wheelchair: { type: wheelchairType, turningDiameterIn: turningInches },
    fixedElements,
    availableSpace: { totalCells, occupiedCells, freeCells, freePercent },
    furnitureNeeded: furniture,
    style,
  };

  const message =
    `Based on this exact room grid, recommend furniture that will fit in the free space. ` +
    `For each item include the category so I can place it on the grid. ` +
    `Keep recommendations to maximum 3 items total so they fit.\n\n` +
    `Room data:\n${JSON.stringify(gridData, null, 2)}\n\n` +
    `Check ADA compliance with 36" clearance pathways and recommend Wayfair furniture for each category in the furnitureNeeded list.`;

  // Parse AI response for furniture suggestions
  const lastAIText = useMemo(() => getLastAssistantText(messages), [messages]);
  const suggestedFurniture = useMemo(
    () => extractFurnitureFromText(lastAIText),
    [lastAIText]
  );

  const hasAIResponse = lastAIText.length > 0;

  return (
    <div className="flex flex-col gap-4 p-6 bg-white h-full overflow-y-auto">
      {/* Summary card */}
      <div className="rounded-2xl border border-[#E8E8E8] overflow-hidden">
        <div className="px-5 py-3 bg-[#7B2FF7]/5 border-b border-[#E8E8E8]">
          <p className="text-xs font-bold text-[#7B2FF7] uppercase tracking-widest">Room Summary</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Room Size</p>
              <p className="text-sm font-semibold text-gray-900">{width} × {length} ft</p>
              <p className="text-[10px] text-gray-400">{totalCells} sq ft · {freePercent}% free</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Wheelchair</p>
              <p className="text-sm font-semibold text-gray-900">{WHEELCHAIR_LABEL[wheelchairType]}</p>
              <p className="text-[10px] text-gray-400">{turningInches}" turning circle</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Style</p>
              <p className="text-sm font-semibold text-gray-900">{style}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Fixed Elements</p>
              <p className="text-sm font-semibold text-gray-900">
                {placedItems.length} item{placedItems.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-gray-400 mb-1.5">Furniture Needed</p>
            <div className="flex flex-wrap gap-1.5">
              {furniture.map((f) => (
                <span key={f} className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#7B2FF7]/10 text-[#7B2FF7]">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {placedItems.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">Placed Room Elements</p>
              <div className="flex flex-wrap gap-1.5">
                {placedItems.map((p) => (
                  <span key={p.id} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600 capitalize">
                    {p.type}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADA checklist */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">
          ADA Compliance Check Includes
        </p>
        <ul className="space-y-1 text-xs text-amber-700">
          <li>• 36" minimum clearance beside every piece of furniture</li>
          <li>• 60×60" clear turning zone obstacle-free</li>
          <li>• Seat height 17–19" for chairs and sofas</li>
          <li>• Storage max 48" tall for seated reach</li>
          <li>• Open/panel base preferred (footrest clearance)</li>
        </ul>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => onFindFurniture(message)}
        disabled={isBusy}
        className="w-full py-4 rounded-2xl text-base font-bold bg-[#7B2FF7] text-white hover:bg-[#6a1fe0] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Finding accessible furniture…
          </span>
        ) : hasAIResponse ? (
          "Refresh Recommendations →"
        ) : (
          "Find Accessible Furniture →"
        )}
      </button>

      {/* 2D result visualization — shown once AI has responded */}
      {hasAIResponse && (
        <RoomResult
          roomW={width}
          roomL={length}
          fixedElements={fixedElements}
          suggestedFurniture={
            suggestedFurniture.length > 0
              ? suggestedFurniture
              : furniture.map((cat, i) => {
                  const dims = CATEGORY_DIMS[cat.toLowerCase()] ?? { widthIn: 36, depthIn: 36 };
                  return {
                    id: `fallback-${i}`,
                    name: cat,
                    category: cat.toLowerCase(),
                    ...dims,
                    price: 0,
                    url: "https://wayfair.com",
                  };
                })
          }
          wheelchairType={wheelchairType}
        />
      )}
    </div>
  );
}
