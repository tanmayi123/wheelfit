"use client";

import type { RoomConfig } from "./PhaseOne";
import type { PlacedItem } from "./RoomCanvas";

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

type Props = {
  config: RoomConfig;
  placedItems: PlacedItem[];
  onFindFurniture: (message: string) => void;
  isBusy: boolean;
};

export function PhaseThree({ config, placedItems, onFindFurniture, isBusy }: Props) {
  const { width, length, wheelchairType, style, furniture } = config;
  const turningInches = TURNING_INCHES[wheelchairType];

  const fixedList =
    placedItems.length > 0
      ? placedItems
          .map((p) => `${p.type} (${p.w}×${p.h}ft at position ${p.col},${p.row})`)
          .join(", ")
      : "none";

  const message =
    `Analyze this room: ${width}x${length}ft, ${WHEELCHAIR_LABEL[wheelchairType]} needs ${turningInches}" turning circle. ` +
    `Fixed elements: ${fixedList}. ` +
    `Furniture needed: ${furniture.join(", ")}. ` +
    `Style preference: ${style}. ` +
    `Check ADA compliance and recommend Wayfair furniture that fits with 36" clearance pathways.`;

  return (
    <div className="flex flex-col gap-4 p-6 bg-white h-full overflow-y-auto">
      {/* Summary card */}
      <div className="rounded-2xl border border-[#E8E8E8] overflow-hidden">
        <div className="px-5 py-4 bg-[#7B2FF7]/5 border-b border-[#E8E8E8]">
          <p className="text-xs font-semibold text-[#7B2FF7] uppercase tracking-widest">Room Summary</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-xs text-gray-400 mb-0.5">Room Size</p>
              <p className="text-sm font-semibold text-gray-900">{width} × {length} ft</p>
              <p className="text-xs text-gray-400">{width * length} sq ft total</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-xs text-gray-400 mb-0.5">Wheelchair</p>
              <p className="text-sm font-semibold text-gray-900">{WHEELCHAIR_LABEL[wheelchairType]}</p>
              <p className="text-xs text-gray-400">{turningInches}" turning circle</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-xs text-gray-400 mb-0.5">Style</p>
              <p className="text-sm font-semibold text-gray-900">{style}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-[#E8E8E8] p-3">
              <p className="text-xs text-gray-400 mb-0.5">Fixed Elements</p>
              <p className="text-sm font-semibold text-gray-900">{placedItems.length} item{placedItems.length !== 1 ? "s" : ""} placed</p>
            </div>
          </div>

          {/* Furniture tags */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Furniture Needed</p>
            <div className="flex flex-wrap gap-1.5">
              {furniture.map((f) => (
                <span
                  key={f}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#7B2FF7]/10 text-[#7B2FF7]"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Placed items */}
          {placedItems.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Placed Room Elements</p>
              <div className="flex flex-wrap gap-1.5">
                {placedItems.map((p) => (
                  <span
                    key={p.id}
                    className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600 capitalize"
                  >
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
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
          ADA Compliance Check Includes
        </p>
        <ul className="space-y-1 text-xs text-amber-700">
          <li className="flex items-start gap-1.5">
            <span className="mt-px">•</span>
            <span>36" minimum clearance pathway beside every piece of furniture</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-px">•</span>
            <span>60×60" clear turning zone that must remain obstacle-free</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-px">•</span>
            <span>Seat height 17–19" for chairs and sofas</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-px">•</span>
            <span>Storage max 48" tall for reach from seated position</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-px">•</span>
            <span>Open/panel base preferred over 4-leg designs (footrest clearance)</span>
          </li>
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
        ) : (
          "Find Accessible Furniture →"
        )}
      </button>
    </div>
  );
}
