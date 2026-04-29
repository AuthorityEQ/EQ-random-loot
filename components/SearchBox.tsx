"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UniversalSearchResult } from "@/lib/universal-search";

type SearchBoxProps = {
  results: {
    items: UniversalSearchResult[];
    mobs: UniversalSearchResult[];
  };
  value: string;
  onChange: (value: string) => void;
  onSelectResult: (result: UniversalSearchResult) => void;
};

export function SearchBox({ results, value, onChange, onSelectResult }: SearchBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLLabelElement | null>(null);
  const groupedResults = [
    ["Items", results.items],
    ["Mobs", results.mobs],
  ] as const;
  const flatResults = useMemo(
    () => groupedResults.flatMap(([, groupResults]) => groupResults),
    [groupedResults],
  );
  const showResults = isOpen && value.trim().length >= 2 && flatResults.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [value, flatResults.length]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function selectResult(result: UniversalSearchResult) {
    onSelectResult(result);
    setIsOpen(false);
  }

  return (
    <label className="search" ref={searchRef}>
      <span>Search random loot buckets</span>
      <input
        aria-activedescendant={showResults ? `search-result-${activeIndex}` : undefined}
        aria-expanded={showResults}
        aria-controls="search-typeahead-results"
        autoComplete="off"
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            return;
          }

          if (!showResults) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % flatResults.length);
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + flatResults.length) % flatResults.length);
          }

          if (event.key === "Enter") {
            event.preventDefault();
            const result = flatResults[activeIndex];
            if (result) {
              selectResult(result);
            }
          }
        }}
        placeholder="Item or mob"
        role="combobox"
        type="search"
        value={value}
      />
      {showResults ? (
        <div className="search-results" id="search-typeahead-results" role="listbox">
          {(() => {
            let resultIndex = -1;
            return groupedResults.map(([label, groupResults]) => {
              if (groupResults.length === 0) return null;

              return (
                <section className="search-result-group" key={label}>
                  <p>{label}</p>
                  <ul>
                    {groupResults.map((result) => {
                      resultIndex += 1;
                      const currentIndex = resultIndex;
                      return (
                        <li key={`${result.type}-${result.label}-${currentIndex}`}>
                          <button
                            className={currentIndex === activeIndex ? "search-result is-active" : "search-result"}
                            id={`search-result-${currentIndex}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(currentIndex)}
                            onClick={() => selectResult(result)}
                            role="option"
                            aria-selected={currentIndex === activeIndex}
                            type="button"
                          >
                            <strong>{result.label}</strong>
                            {result.type === "item" ? <span>{result.buckets.map((bucket) => bucket.expansion).filter((expansion, index, list) => list.indexOf(expansion) === index).join(", ")}</span> : null}
                            {result.type === "mob" ? <span>{result.mob.zone} - Level {result.mob.level}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            });
          })()}
        </div>
      ) : null}
    </label>
  );
}
