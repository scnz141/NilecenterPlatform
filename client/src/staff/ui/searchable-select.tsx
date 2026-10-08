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

export interface SearchableSelectOption {
  value: string;
  label: string;
}

/** Single-value searchable select: popover + command list. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Search…",
  emptyLabel = "Nothing matches.",
  disabled,
  ariaLabel,
  className,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("staff-multiselect-trigger", className)}
          data-placeholder={!current}
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          aria-expanded={open}
        >
          <span className="truncate">{current?.label ?? placeholder}</span>
          <GlyphChevronDown />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map(option => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="staff-multiselect-option"
              >
                <span className="staff-multiselect-check" aria-hidden>
                  {option.value === value ? <GlyphCheck /> : null}
                </span>
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
