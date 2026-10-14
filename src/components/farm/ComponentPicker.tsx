"use client";

import { useEffect, useRef, useState } from "react";
import { useKeyboardFrame } from "@/components/use-keyboard-frame";
import {
  componentMatchLabel,
  componentPickCount,
  filterComponentPicks,
  highlightParts,
  type ComponentPickerOption,
} from "@/lib/component-picker";

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-[#f5e6b8] font-semibold text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** The closed Component field: the full chosen name, wrapping, or the placeholder. */
export function ComponentPickerField({
  options,
  value,
  onOpen,
}: {
  options: ComponentPickerOption[];
  value: string;
  onOpen: () => void;
}) {
  const chosen = options.find((option) => option.id === value);
  return (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-label={chosen ? chosen.name : "Choose a component"}
      onClick={onOpen}
      className={`mt-1.5 flex min-h-12 w-full items-center gap-2 rounded-xl border border-[#d9cfb8] bg-[#fffdf8] px-3.5 py-2.5 text-left text-base ${
        chosen ? "text-stone-900" : "text-stone-400"
      }`}
    >
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {chosen ? chosen.name : "Choose a component"}
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-stone-500"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/** Searchable component list. The sheet header supplies back and close. */
export function ComponentPicker({
  options,
  value,
  onChange,
}: {
  options: ComponentPickerOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const frame = useKeyboardFrame();
  const groups = filterComponentPicks(options, query);
  const count = componentPickCount(groups);
  const searching = query.trim().length > 0;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div className="mt-3.5 flex flex-col">
      <label className="flex h-12 items-center gap-2.5 rounded-[14px] border-[1.5px] border-stone-600 bg-[#fffdf8] px-3.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-stone-400"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={searchRef}
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              event.preventDefault();
              setQuery("");
            }
          }}
          placeholder="Search components"
          aria-label="Search components"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-stone-900 outline-none placeholder:text-stone-400 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
      </label>
      {searching ? (
        <p aria-live="polite" className="mt-1 text-[13px] text-stone-400">
          {count === 0 ? "No components match" : componentMatchLabel(count)}
        </p>
      ) : null}
      <div
        role="listbox"
        aria-label="Components"
        className="mt-1 min-h-0 overflow-y-auto pb-6"
        style={
          frame.open
            ? { maxHeight: Math.max(160, frame.height - 196) }
            : { maxHeight: "calc(90dvh - 12rem)" }
        }
      >
        {searching && count === 0 ? null : (
          groups.map((group, index) => (
            <div key={group.system}>
              <p
                className={`mb-2 text-xs tracking-[0.06em] text-stone-400 uppercase [overflow-wrap:anywhere] ${
                  index === 0 ? "mt-2" : "mt-5"
                }`}
              >
                <Highlight text={group.system} query={query} />
              </p>
              <div className="flex flex-col gap-2">
                {group.items.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    aria-label={`${option.system}, ${option.name}`}
                    onClick={() => onChange(option.id)}
                    className="min-h-12 w-full rounded-[14px] border border-[#e7dfd0] bg-[#fffdf8] px-4 py-[13px] text-left text-base leading-snug text-stone-900 [overflow-wrap:anywhere]"
                  >
                    <Highlight text={option.name} query={query} />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
