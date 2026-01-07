"use client";

import * as React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  group?: string;
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
  const [openUpward, setOpenUpward] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // 외부 클릭 시 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 드롭다운 열릴 때 검색 input에 포커스
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  // 드롭다운 방향 결정
  const calculateDropdownDirection = React.useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 250; // max-h-[200px] + padding + 여유
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // 아래 공간이 부족하고 위 공간이 더 넓으면 위로 열기
    setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
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

  // 검색어로 필터링된 옵션
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // 그룹별로 옵션 분류
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, MultiSelectOption[]> = {};
    const ungrouped: MultiSelectOption[] = [];

    filteredOptions.forEach((opt) => {
      if (opt.group) {
        if (!groups[opt.group]) {
          groups[opt.group] = [];
        }
        groups[opt.group]!.push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    return { groups, ungrouped };
  }, [filteredOptions]);

  const hasGroups = Object.keys(groupedOptions.groups).length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled || isLoading}
        onClick={() => {
          if (!open) calculateDropdownDirection();
          setOpen(!open);
        }}
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
                <Icon
                  icon="solar:close-circle-linear"
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
        <Icon icon="solar:alt-arrow-down-linear" className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className={cn(
          "absolute z-[9999] w-full rounded-md border border-slate-700 bg-slate-900 shadow-lg",
          openUpward ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {/* 검색 input */}
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-400">
                {searchQuery ? "검색 결과가 없습니다" : "항목이 없습니다"}
              </div>
            ) : hasGroups ? (
              // 그룹화된 렌더링
              <>
                {Object.entries(groupedOptions.groups).map(([groupName, groupOptions]) => (
                  <div key={groupName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 sticky top-0 bg-slate-900">
                      {groupName}
                    </div>
                    {groupOptions.map((option) => {
                      const isSelected = selected.includes(option.value);
                      return (
                        <div
                          key={option.value}
                          onClick={() => handleToggle(option.value)}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-slate-800 ml-1",
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
                            {isSelected && <Icon icon="solar:check-read-linear" className="h-3 w-3 text-white" />}
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
                    })}
                  </div>
                ))}
                {groupedOptions.ungrouped.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 sticky top-0 bg-slate-900">
                      기타
                    </div>
                    {groupedOptions.ungrouped.map((option) => {
                      const isSelected = selected.includes(option.value);
                      return (
                        <div
                          key={option.value}
                          onClick={() => handleToggle(option.value)}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-slate-800 ml-1",
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
                            {isSelected && <Icon icon="solar:check-read-linear" className="h-3 w-3 text-white" />}
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
                    })}
                  </div>
                )}
              </>
            ) : (
              // 기존 플랫 렌더링
              filteredOptions.map((option) => {
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
                      {isSelected && <Icon icon="solar:check-read-linear" className="h-3 w-3 text-white" />}
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
