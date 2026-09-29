import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  Download,
  CheckSquare,
  Square,
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  title?: string;
  searchPlaceholder?: string;
  enableSelection?: boolean;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  onBulkAction,
  title,
  searchPlaceholder = 'Search domains, keywords, categories...',
  enableSelection = true,
  className,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (val) => val && String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(paginatedData.map(keyExtractor));
      setSelectedIds(allIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = columns.map((c) => c.header).join(',');
    const rows = sortedData.map((item) =>
      columns
        .map((c) => {
          const val = item[c.key];
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `citation_targets_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={clsx(
        'relative bg-app-surface border border-app-border radius-card overflow-hidden flex flex-col',
        className
      )}
    >
      {/* Table Header Bar */}
      <div className="p-4 border-b border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {title && <h3 className="font-h3 text-app-text">{title}</h3>}
          <span className="text-xs px-2 py-0.5 radius-pill bg-app-surface-2 border border-app-border text-app-text-3 tabular-nums">
            {sortedData.length} records
          </span>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="h-9 pl-8 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text placeholder:text-app-text-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand w-56 sm:w-64 transition-all"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={exportCSV}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            CSV
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-app-surface-2/60 sticky top-0 z-10 border-b border-app-border">
            <tr className="h-10 text-xs font-semibold text-app-text-3 uppercase tracking-wider">
              {enableSelection && (
                <th className="w-10 px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-app-text-3 hover:text-brand transition-colors p-1"
                  >
                    {selectedIds.size > 0 && selectedIds.size === paginatedData.length ? (
                      <CheckSquare className="w-4 h-4 text-brand" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
              )}

              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={clsx(
                    'px-4 py-2 select-none',
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left',
                    col.sortable && 'cursor-pointer hover:text-app-text transition-colors'
                  )}
                >
                  <div
                    className={clsx(
                      'inline-flex items-center gap-1.5',
                      col.align === 'right' && 'flex-row-reverse'
                    )}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="shrink-0 text-app-text-3">
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-3 h-3 text-brand" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-brand" />
                          )
                        ) : (
                          <ChevronDown className="w-3 h-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-app-border/40">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, idx) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.has(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className={clsx(
                      'h-11 transition-colors duration-100 cursor-pointer text-[13px]',
                      isSelected ? 'bg-brand/8' : 'hover:bg-app-surface-2'
                    )}
                  >
                    {enableSelection && (
                      <td
                        className="w-10 px-3 py-2 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectRow(id);
                        }}
                      >
                        <button
                          type="button"
                          className="text-app-text-3 hover:text-brand transition-colors p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-brand" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={clsx(
                          'px-4 py-2',
                          col.align === 'right'
                            ? 'text-right tabular-nums font-mono'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        )}
                      >
                        {col.render ? col.render(item, idx) : item[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (enableSelection ? 1 : 0)}
                  className="py-12 text-center text-app-text-3 text-sm"
                >
                  No matching citation records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-app-border bg-app-surface flex items-center justify-between text-xs text-app-text-3">
        <span>
          Showing {(currentPage - 1) * pageSize + 1} to{' '}
          {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            Prev
          </Button>

          <span className="px-2 py-1 text-app-text font-medium tabular-nums">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            icon={<ChevronRight className="w-3.5 h-3.5" />}
            iconPosition="right"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Sliding Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-app-surface-3 border border-app-border-strong radius-panel px-4 py-2.5 elevation-sheet z-20 flex items-center gap-3 animate-fadeIn">
          <span className="text-xs font-semibold text-app-text">
            {selectedIds.size} domain{selectedIds.size > 1 ? 's' : ''} selected
          </span>

          <div className="h-4 w-[1px] bg-app-border" />

          <Button
            variant="primary"
            size="sm"
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={() =>
              onBulkAction?.('write-pitches', Array.from(selectedIds))
            }
          >
            Write {selectedIds.size} Pitches
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onBulkAction?.('mark-status', Array.from(selectedIds))
            }
          >
            Mark Pitched
          </Button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-app-text-3 hover:text-app-text ml-1 px-1.5 py-1"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
