"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { PhaseOne, type RoomConfig } from "./room-planner/PhaseOne";
import { RoomCanvas, type PlacedItem } from "./room-planner/RoomCanvas";
import { PhaseThree } from "./room-planner/PhaseThree";

type Mode = "chat" | "agent";
type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Room Details",
  2: "Map Room",
  3: "Get Furniture",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MessagePart({
  part,
  messageId,
  index,
  role,
}: {
  part: UIMessage["parts"][number];
  messageId: string;
  index: number;
  role: "user" | "assistant";
}) {
  if (part.type === "text") {
    if (role === "user") {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p>;
    }
    return (
      <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-700 prose-strong:text-gray-900 prose-code:text-[#7B2FF7] prose-a:text-[#7B2FF7]">
        <ReactMarkdown>{part.text}</ReactMarkdown>
      </div>
    );
  }
  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.url}
        alt={part.filename ?? "Uploaded image"}
        className="mt-2 max-h-48 rounded-lg border border-[#E8E8E8] object-contain"
      />
    );
  }
  if (part.type.startsWith("tool-")) {
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";
    return (
      <div className="mt-2 rounded-lg border border-[#7B2FF7]/25 bg-[#7B2FF7]/5 px-3 py-2 text-xs">
        <div className="font-semibold text-[#7B2FF7]">Tool: {label}</div>
        <div className="mt-0.5 text-gray-500">
          {state === "input-available" && "Calling…"}
          {state === "output-available" && "Done"}
          {state === "output-error" && "Error"}
        </div>
      </div>
    );
  }
  return null;
}

const QUICK_ASKS = [
  "What is ADA clearance?",
  "Recommend accessible sofas",
  "What turning radius do I need?",
];

export function WheelFitApp() {
  const [mode, setMode] = useState<Mode>("agent");
  const [step, setStep] = useState<Step>(1);
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { mode } }),
    [mode]
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const isBusy = status === "streaming" || status === "submitted";

  async function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text && !imageFile) return;
    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
    > = [];
    if (imageFile) {
      parts.push({
        type: "file",
        mediaType: imageFile.type || "image/png",
        url: await fileToDataUrl(imageFile),
        filename: imageFile.name,
      });
    }
    if (text) parts.push({ type: "text", text });
    sendMessage({ parts });
    setInput("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFindFurniture(message: string) {
    sendMessage({ parts: [{ type: "text", text: message }] });
  }

  function handlePhaseOneNext(config: RoomConfig) {
    setRoomConfig(config);
    setStep(2);
  }

  function handleCanvasNext(items: PlacedItem[]) {
    setPlacedItems(items);
    setStep(3);
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* ── LEFT PANEL: Room Planner (55%) ── */}
      <div className="flex flex-col border-r border-[#E8E8E8]" style={{ width: "55%" }}>
        {/* Left header */}
        <div className="bg-white border-b border-[#E8E8E8] px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold text-[#7B2FF7] uppercase tracking-widest mb-0.5">
                WheelFit
              </p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Accessible Room Planner
              </h1>
            </div>
            <span className="text-[11px] text-gray-400 bg-gray-50 border border-[#E8E8E8] px-3 py-1 rounded-full">
              Powered by Wayfair
            </span>
          </div>

          {/* Step progress bar */}
          <div className="flex items-center">
            {([1, 2, 3] as Step[]).map((s, i) => {
              const isActive = step === s;
              const isDone = step > s;
              return (
                <div key={s} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => isDone && setStep(s)}
                    disabled={!isDone}
                    className={`flex items-center gap-2 text-xs font-medium transition-colors disabled:cursor-default ${
                      isActive
                        ? "text-[#7B2FF7]"
                        : isDone
                        ? "text-gray-500 hover:text-[#7B2FF7] cursor-pointer"
                        : "text-gray-300"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold transition-all ${
                        isActive
                          ? "bg-[#7B2FF7] text-white"
                          : isDone
                          ? "bg-[#7B2FF7]/15 text-[#7B2FF7]"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isDone ? "✓" : s}
                    </span>
                    <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
                  </button>
                  {i < 2 && (
                    <div
                      className={`flex-1 h-[2px] mx-2 rounded-full transition-all ${
                        step > s ? "bg-[#7B2FF7]" : "bg-gray-100"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase content */}
        <div className="flex-1 min-h-0">
          {step === 1 && <PhaseOne onNext={handlePhaseOneNext} />}
          {step === 2 && roomConfig && (
            <RoomCanvas config={roomConfig} onNext={handleCanvasNext} />
          )}
          {step === 3 && roomConfig && (
            <PhaseThree
              config={roomConfig}
              placedItems={placedItems}
              onFindFurniture={handleFindFurniture}
              isBusy={isBusy}
              messages={messages}
            />
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: AI Advisor (45%) ── */}
      <div className="flex flex-col flex-1 bg-white min-w-0">
        {/* Chat header */}
        <div className="border-b border-[#E8E8E8] px-5 py-4 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Advisor</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Ask about accessibility or furniture
            </p>
          </div>
          <div className="flex rounded-full border border-[#E8E8E8] bg-gray-50 p-0.5 gap-0.5">
            {(["chat", "agent"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all capitalize ${
                  mode === m
                    ? "bg-[#7B2FF7] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="w-11 h-11 rounded-2xl bg-[#7B2FF7]/10 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12h6M9 16h6M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z"
                    stroke="#7B2FF7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">WheelFit AI Advisor</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px] leading-relaxed">
                Complete the room setup on the left, then hit &ldquo;Find Accessible
                Furniture&rdquo; — or ask anything below.
              </p>
              <div className="mt-5 w-full space-y-2 max-w-[280px]">
                {QUICK_ASKS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage({ parts: [{ type: "text", text: q }] })}
                    className="block w-full text-left px-3 py-2 rounded-lg border border-[#E8E8E8] text-xs text-gray-600 hover:border-[#7B2FF7] hover:text-[#7B2FF7] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages
            .filter((message) => {
              // Hide the structured JSON room-analysis messages sent by Phase 3
              if (message.role !== "user") return true;
              return !message.parts.some(
                (p) =>
                  p.type === "text" &&
                  (p as { type: "text"; text: string }).text.startsWith(
                    "You are a wheelchair accessibility furniture advisor for WheelFit"
                  )
              );
            })
            .map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-[#7B2FF7] text-white"
                    : "border border-[#E8E8E8] bg-white text-gray-800 shadow-sm"
                }`}
              >
                {message.parts.map((part, i) => (
                  <MessagePart
                    key={`${message.id}-${i}`}
                    part={part}
                    messageId={message.id}
                    index={i}
                    role={message.role as "user" | "assistant"}
                  />
                ))}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="flex items-center gap-2 pl-1">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#7B2FF7] animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </span>
              <span className="text-xs text-gray-400">
                {mode === "agent" ? "Agent searching Wayfair…" : "Thinking…"}
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error.message}
          </p>
        )}

        {/* Input */}
        <div className="border-t border-[#E8E8E8] px-4 py-3 shrink-0">
          {imageFile && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>
                Image: <span className="text-[#7B2FF7] font-medium">{imageFile.name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )}
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setImageFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
              className="rounded-lg border border-[#E8E8E8] px-2.5 py-2 text-gray-400 hover:border-[#7B2FF7] hover:text-[#7B2FF7] transition-all shrink-0"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about accessibility or furniture…"
              disabled={isBusy}
              className="flex-1 min-w-0 rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#7B2FF7] focus:ring-2 focus:ring-[#7B2FF7]/15 disabled:opacity-60"
            />
            {isBusy ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-lg border border-[#E8E8E8] px-3 py-2 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-500 transition-all shrink-0"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !imageFile}
                className="rounded-lg bg-[#7B2FF7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6a1fe0] disabled:opacity-40 transition-all shrink-0"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
