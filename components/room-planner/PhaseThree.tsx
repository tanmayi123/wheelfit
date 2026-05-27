"use client";

import { useMemo, useState } from "react";
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

const CATEGORY_DIMS: Record<string, { widthIn: number; depthIn: number }> = {
  bed:        { widthIn: 60, depthIn: 80 },
  desk:       { widthIn: 42, depthIn: 20 },
  nightstand: { widthIn: 18, depthIn: 16 },
  stand:      { widthIn: 18, depthIn: 16 },
  chair:      { widthIn: 28, depthIn: 30 },
  lamp:       { widthIn: 18, depthIn: 18 },
  dresser:    { widthIn: 48, depthIn: 18 },
  sofa:       { widthIn: 84, depthIn: 34 },
};

type ComboItem = {
  name: string;
  category: string;
  widthIn: number;
  depthIn: number;
  price: number;
};

type ParsedCombo = {
  id: string;
  name: string;
  description: string;
  items: ComboItem[];
  totalPrice: number;
};

function getLastAssistantText(messages: UIMessage[]): string {
  const assistant = messages.filter((m) => m.role === "assistant");
  if (!assistant.length) return "";
  const last = assistant[assistant.length - 1];
  return last.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

function dimsForCategory(cat: string): { widthIn: number; depthIn: number } {
  const normalized = cat.toLowerCase().replace(/s$/, "");
  return CATEGORY_DIMS[normalized] ?? CATEGORY_DIMS[cat.toLowerCase()] ?? { widthIn: 36, depthIn: 36 };
}

function parseComboResponse(text: string): ParsedCombo[] {
  if (!text.trim()) return [];

  // Strip markdown code fences
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();

  // Try to extract the JSON object containing "combos"
  try {
    const objMatch = jsonStr.match(/\{[\s\S]*"combos"[\s\S]*\}/);
    if (objMatch) {
      const data = JSON.parse(objMatch[0]) as {
        combos: Array<{
          name?: string;
          description?: string;
          items?: Array<{ name?: string; category?: string; price?: number }>;
          totalPrice?: number;
        }>;
      };
      if (Array.isArray(data.combos)) {
        return data.combos.slice(0, 3).map((c, i) => {
          const items: ComboItem[] = (c.items ?? []).map((it) => {
            const cat = (it.category ?? "").toLowerCase();
            const dims = dimsForCategory(cat);
            return {
              name: it.name ?? "Unknown item",
              category: cat || "furniture",
              widthIn: dims.widthIn,
              depthIn: dims.depthIn,
              price: it.price ?? 0,
            };
          });
          const total = c.totalPrice ?? items.reduce((s, it) => s + it.price, 0);
          return {
            id: `combo-${i}`,
            name: c.name ?? `Option ${i + 1}`,
            description: c.description ?? "",
            items,
            totalPrice: total,
          };
        });
      }
    }
  } catch {
    // JSON parse failed — fall through to empty
  }

  return [];
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
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);

  const fixedElements = placedItems.map((p) => ({
    type: p.type,
    col: p.col,
    row: p.row,
    w: p.w,
    h: p.h,
  }));

  const occupiedCells = placedItems.reduce((s, p) => s + p.w * p.h, 0);
  const totalCells = width * length;
  const freeCells = totalCells - occupiedCells;
  const freePercent = Math.round((freeCells / totalCells) * 100);
  const fixedList = placedItems.length
    ? placedItems.map((p) => `${p.type} at (${p.col},${p.row})`).join(", ")
    : "none";

  const message =
    `You are a wheelchair accessibility furniture advisor for WheelFit.\n\n` +
    `Room: ${width}×${length}ft, ${WHEELCHAIR_LABEL[wheelchairType]}, style: ${style}\n` +
    `Fixed elements: ${fixedList}\n` +
    `Wheelchair clearance needed: 36" minimum, ${turningInches}" turning circle\n` +
    `Free space: ${freePercent}% of ${totalCells} sq ft\n\n` +
    `Recommend EXACTLY 2 furniture combos for these categories: ${furniture.join(", ")}\n\n` +
    `Reply with ONLY this JSON (no markdown, no extra text):\n` +
    `{\n  "combos": [\n    {\n      "name": "Setup name",\n      "description": "One sentence about style and accessibility",\n      "items": [\n        {"name": "Exact product name", "category": "bed", "price": 499}\n      ],\n      "totalPrice": 499\n    }\n  ]\n}\n\n` +
    `Use realistic Wayfair-style product names. Max 3 items per combo. ` +
    `Category must be one of: bed, desk, nightstand, chair, lamp, dresser. ` +
    `Choose items that leave 36" clearance pathways and fit the ${turningInches}" turning circle.`;

  const lastAIText = useMemo(() => getLastAssistantText(messages), [messages]);
  const combos = useMemo(() => parseComboResponse(lastAIText), [lastAIText]);
  const hasAIResponse = lastAIText.length > 0;
  const selectedCombo = combos.find((c) => c.id === selectedComboId) ?? null;

  function handleFindFurnitureClick() {
    setSelectedComboId(null);
    onFindFurniture(message);
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white h-full overflow-y-auto">
      {/* Room summary */}
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
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleFindFurnitureClick}
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

      {/* ── STEP 1: Combo cards ── */}
      {hasAIResponse && !isBusy && (
        <div className="space-y-3">
          {combos.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Choose a furniture setup
              </p>
              {combos.map((combo) => {
                const isSelected = selectedComboId === combo.id;
                return (
                  <div
                    key={combo.id}
                    className={`rounded-2xl border-2 overflow-hidden transition-all ${
                      isSelected
                        ? "border-[#7B2FF7] shadow-md shadow-[#7B2FF7]/10"
                        : "border-[#E8E8E8] hover:border-[#7B2FF7]/40"
                    }`}
                  >
                    {/* Combo header */}
                    <div
                      className={`px-4 py-3 flex items-center justify-between ${
                        isSelected ? "bg-[#7B2FF7]/8" : "bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? "text-[#7B2FF7]" : "text-gray-900"}`}>
                          {isSelected && <span className="mr-1.5">✓</span>}
                          {combo.name}
                        </p>
                        {combo.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{combo.description}</p>
                        )}
                      </div>
                      <span className={`text-base font-bold ${isSelected ? "text-[#7B2FF7]" : "text-gray-800"}`}>
                        ${combo.totalPrice.toLocaleString()}
                      </span>
                    </div>

                    {/* Items list */}
                    <div className="px-4 py-3 space-y-2 bg-white">
                      {combo.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: "#7B2FF7" }}
                            />
                            <span className="text-xs font-medium text-gray-800 truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] text-gray-400 font-mono">
                              {item.widthIn}"×{item.depthIn}"
                            </span>
                            <span className="text-xs font-semibold text-gray-700">
                              ${item.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Select button */}
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => setSelectedComboId(isSelected ? null : combo.id)}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          isSelected
                            ? "bg-[#7B2FF7]/10 text-[#7B2FF7] border-2 border-[#7B2FF7]"
                            : "bg-[#7B2FF7] text-white hover:bg-[#6a1fe0]"
                        }`}
                      >
                        {isSelected ? "✓ Selected — view floor plan below" : "Select This Combo"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* AI responded but JSON couldn't be parsed into combos */
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-xs font-semibold text-amber-700 mb-1">Parsing in progress</p>
              <p className="text-xs text-amber-600">
                The AI response is visible in the chat panel on the right. See it for furniture recommendations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Floor plan (only after combo selected) ── */}
      {selectedCombo && (
        <RoomResult
          roomW={width}
          roomL={length}
          fixedElements={fixedElements}
          suggestedFurniture={selectedCombo.items.map((item, i) => ({
            id: `${item.category}-${i}`,
            name: item.name,
            category: item.category,
            widthIn: item.widthIn,
            depthIn: item.depthIn,
            price: item.price,
            url: "https://wayfair.com",
          }))}
          wheelchairType={wheelchairType}
        />
      )}
    </div>
  );
}
