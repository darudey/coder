
'use client';

import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/autocomplete";

interface AutocompleteDropdownProps {
  suggestions: Suggestion[];
  top: number;
  left: number;
  onSelect: (suggestion: Suggestion) => void;
  activeIndex: number;
}

export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  suggestions,
  top,
  left,
  onSelect,
  activeIndex,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <ul
      className="absolute z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg dark:bg-gray-800 dark:border-gray-700"
      style={{ top, left }}
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.value}
          className={cn(
            "px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700",
            index === activeIndex && "bg-gray-100 dark:bg-gray-700"
          )}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea from losing focus
            onSelect(suggestion);
          }}
        >
          <span className="font-mono font-semibold">{suggestion.value}</span>
          <span className="ml-2 text-xs text-gray-500">{suggestion.type}</span>
        </li>
      ))}
    </ul>
  );
};
