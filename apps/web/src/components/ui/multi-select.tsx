"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  maxDisplay?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "선택하세요",
  disabled = false,
  isLoading = false,
  maxDisplay = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const selectedOptions = options.filter((opt) => selected.includes(opt.value));

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled || isLoading}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full justify-between border-slate-700 bg-slate-900 hover:bg-slate-800 min-h-[40px] h-auto",
          selected.length > 0 && "py-1.5"
        )}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {isLoading ? (
            <span className="text-slate-400">로딩 중...</span>
          ) : selected.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : selectedOptions.length <= maxDisplay ? (
            selectedOptions.map((opt) => (
              <Badge
                key={opt.value}
                variant="secondary"
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600"
              >
                {opt.icon}
                <span className="max-w-[100px] truncate">{opt.label}</span>
                <X
                  className="h-3 w-3 cursor-pointer hover:text-red-400"
                  onClick={(e) => handleRemove(opt.value, e)}
                />
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="bg-slate-700">
              {selected.length}개 선택됨
            </Badge>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          <div className="max-h-[200px] overflow-auto p-1">
            {options.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-400">
                항목이 없습니다
              </div>
            ) : (
              options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => handleToggle(option.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-slate-800",
                      isSelected && "bg-slate-800"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        isSelected
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-slate-600"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {option.icon}
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.color && (
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-700 p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-slate-400 hover:text-white"
                onClick={() => onChange([])}
              >
                선택 해제
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
