import { useState } from "react";
import { GlyphCheck, GlyphChevronDown } from "./glyphs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/staff/ui/kit";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/staff/ui/kit";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Staff multi-select: popover + searchable command list with checkmarks.
 * Empty selection shows `allLabel` (everything in scope); otherwise the
 * trigger reads `${count} ${noun}`.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  noun,
  searchPlaceholder = "Search…",
  emptyLabel = "Nothing matches.",
  disabled,
  size,
  ariaLabel,
  className,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  /** Plural noun used for the count readout, e.g. "branches". */
  noun: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  size?: "sm";
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (options.find(option => option.value === value[0])?.label ?? `1 ${noun}`)
        : `${value.length} ${noun}`;

  function toggle(option: string) {
    onChange(
      value.includes(option)
        ? value.filter(item => item !== option)
        : [...value, option]
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("staff-multiselect-trigger", className)}
          data-size={size}
          data-placeholder={value.length === 0}
          disabled={disabled}
          aria-label={ariaLabel ?? allLabel}
          aria-expanded={open}
        >
          <span className="truncate">{trigger}</span>
          <GlyphChevronDown />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map(option => {
              const selected = value.includes(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                  className="staff-multiselect-option"
                >
                  <span className="staff-multiselect-check" aria-hidden>
                    {selected ? <GlyphCheck /> : null}
                  </span>
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
