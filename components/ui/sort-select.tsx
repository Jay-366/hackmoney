"use client";

import { Portal } from "@ark-ui/react/portal";
import { Select, createListCollection } from "@ark-ui/react/select";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

export type SortOption = "ens-asc" | "score-desc" | "feedback-desc" | "name-asc";

const collection = createListCollection({
  items: [
    { label: "ENS (A-Z)", value: "ens-asc" },
    { label: "Score (High-Low)", value: "score-desc" },
    { label: "Feedback (Most)", value: "feedback-desc" },
    { label: "Name (A-Z)", value: "name-asc" },
  ],
});

interface SortSelectProps {
  value: SortOption[];
  onValueChange: (e: { value: string[] }) => void;
}

export default function SortSelect({ value, onValueChange }: SortSelectProps) {
  return (
    <Select.Root
      collection={collection}
      value={value}
      onValueChange={onValueChange}
      positioning={{ sameWidth: true }}
    >
      <Select.Control>
        <Select.Trigger className="group flex h-12 w-[180px] items-center justify-between rounded-full border border-white/[0.08] bg-[#121418]/80 backdrop-blur-xl px-4 text-sm text-slate-200 shadow-sm transition-all hover:border-[#FD7C9F]/50 focus:border-[#FD7C9F] focus:outline-none focus:ring-1 focus:ring-[#FD7C9F]">
          <Select.ValueText placeholder="Sort by" />
          <Select.Indicator>
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
          </Select.Indicator>
        </Select.Trigger>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content className="z-50 min-w-[var(--reference-width)] overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1d23] p-1 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <Select.ItemGroup>
              <Select.ItemGroupLabel className="px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Sort By
              </Select.ItemGroupLabel>
              {collection.items.map((item) => (
                <Select.Item
                  key={item.value}
                  item={item}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-2 pr-8 text-sm outline-none transition-colors focus:bg-white/10 focus:text-[#FD7C9F] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center text-[#FD7C9F]">
                    <CheckIcon className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.ItemGroup>
          </Select.Content>
        </Select.Positioner>
      </Portal>
      <Select.HiddenSelect />
    </Select.Root>
  );
}
