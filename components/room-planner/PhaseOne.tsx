"use client";

import { useState } from "react";

export type WheelchairType = "manual" | "power" | "transport";

export type RoomConfig = {
  width: number;
  length: number;
  wheelchairType: WheelchairType;
  style: string;
  furniture: string[];
};

const WHEELCHAIR_OPTIONS: { key: WheelchairType; label: string }[] = [
  { key: "manual", label: 'Manual 60"' },
  { key: "power", label: 'Power 67"' },
  { key: "transport", label: 'Transport 50"' },
];

const STYLE_OPTIONS = ["Minimalist", "Modern", "Mid-Century", "Traditional", "Scandinavian"];
const FURNITURE_OPTIONS = ["Beds", "Desks", "Nightstands", "Chairs", "Dressers", "Lamps"];

export function PhaseOne({ onNext }: { onNext: (data: RoomConfig) => void }) {
  const [width, setWidth] = useState(12);
  const [length, setLength] = useState(14);
  const [wheelchairType, setWheelchairType] = useState<WheelchairType>("manual");
  const [style, setStyle] = useState("Modern");
  const [furniture, setFurniture] = useState<string[]>([]);

  const toggleFurniture = (item: string) =>
    setFurniture((prev) =>
      prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
    );

  const canProceed = width > 0 && length > 0 && furniture.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6 bg-white h-full overflow-y-auto">
      {/* Room dimensions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Room Dimensions
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (ft)
            </label>
            <input
              type="number"
              min={6}
              max={50}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#7B2FF7] focus:ring-2 focus:ring-[#7B2FF7]/20"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Length (ft)
            </label>
            <input
              type="number"
              min={6}
              max={50}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#7B2FF7] focus:ring-2 focus:ring-[#7B2FF7]/20"
            />
          </div>
        </div>
      </div>

      {/* Wheelchair type */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Wheelchair Type
        </p>
        <div className="flex gap-2 flex-wrap">
          {WHEELCHAIR_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setWheelchairType(opt.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                wheelchairType === opt.key
                  ? "bg-[#7B2FF7] text-white border-[#7B2FF7] shadow-sm"
                  : "bg-white text-gray-600 border-[#E8E8E8] hover:border-[#7B2FF7]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style preference */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Style Preference
        </p>
        <div className="flex gap-2 flex-wrap">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                style === s
                  ? "bg-[#7B2FF7] text-white border-[#7B2FF7] shadow-sm"
                  : "bg-white text-gray-600 border-[#E8E8E8] hover:border-[#7B2FF7]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Furniture needed */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Furniture Needed
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FURNITURE_OPTIONS.map((item) => (
            <label
              key={item}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                furniture.includes(item)
                  ? "border-[#7B2FF7] bg-[#7B2FF7]/5"
                  : "border-[#E8E8E8] bg-white hover:border-[#7B2FF7]/50"
              }`}
            >
              <input
                type="checkbox"
                checked={furniture.includes(item)}
                onChange={() => toggleFurniture(item)}
                className="w-4 h-4 accent-[#7B2FF7]"
              />
              <span className="text-sm font-medium text-gray-700">{item}</span>
            </label>
          ))}
        </div>
        {furniture.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">Select at least one item to continue</p>
        )}
      </div>

      <button
        type="button"
        onClick={() =>
          canProceed && onNext({ width, length, wheelchairType, style, furniture })
        }
        disabled={!canProceed}
        className="w-full py-3 rounded-xl text-sm font-semibold bg-[#7B2FF7] text-white hover:bg-[#6a1fe0] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm mt-auto"
      >
        Next: Map Your Room →
      </button>
    </div>
  );
}
