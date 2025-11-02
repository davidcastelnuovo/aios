import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pin, PinOff } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ColumnConfig {
  id: string;
  label: string;
  width: number;
  minWidth?: number;
  sticky?: boolean;
  render: (row: any) => ReactNode;
}

interface ResizableTableProps {
  columns: ColumnConfig[];
  data: any[];
  onColumnsChange?: (columns: ColumnConfig[]) => void;
  checkboxColumn?: {
    checked: boolean[];
    onCheckedChange: (index: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
  };
}

export function ResizableTable({ 
  columns: initialColumns, 
  data, 
  onColumnsChange,
  checkboxColumn 
}: ResizableTableProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const updateColumn = useCallback((columnId: string, updates: Partial<ColumnConfig>) => {
    setColumns(prev => {
      const newColumns = prev.map(col => 
        col.id === columnId ? { ...col, ...updates } : col
      );
      onColumnsChange?.(newColumns);
      return newColumns;
    });
  }, [onColumnsChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnId: string, currentWidth: number) => {
    e.preventDefault();
    setResizing({ columnId, startX: e.clientX, startWidth: currentWidth });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(resizing.startWidth + diff, 80);
    
    updateColumn(resizing.columnId, { width: newWidth });
  }, [resizing, updateColumn]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  const toggleSticky = useCallback((columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;
    updateColumn(columnId, { sticky: !column.sticky });
  }, [columns, updateColumn]);

  const stickyColumns = columns.filter(c => c.sticky);
  const regularColumns = columns.filter(c => !c.sticky);

  const getStickyOffset = (columnId: string) => {
    const stickyIndex = stickyColumns.findIndex(c => c.id === columnId);
    if (stickyIndex === -1) return 0;
    
    let offset = checkboxColumn ? 50 : 0;
    for (let i = 0; i < stickyIndex; i++) {
      offset += stickyColumns[i].width;
    }
    return offset;
  };

  return (
    <div className="relative overflow-auto border rounded-md" ref={tableRef}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-20 bg-muted/50">
          <tr className="border-b">
            {checkboxColumn && (
              <th className="sticky right-0 z-30 bg-muted/50 border-l p-3 text-center w-[50px]">
                <Checkbox
                  checked={checkboxColumn.checked.every(Boolean)}
                  onCheckedChange={checkboxColumn.onSelectAll}
                />
              </th>
            )}
            {stickyColumns.map((column, index) => {
              const offset = getStickyOffset(column.id);
              return (
                <th
                  key={column.id}
                  className="sticky z-20 bg-muted/50 border-l p-3 text-right relative group"
                  style={{ 
                    width: column.width,
                    right: offset,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{column.label}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Pin className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSticky(column.id)}
                        >
                          <PinOff className="h-3 w-3 mr-2" />
                          בטל נעיצה
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                    onMouseDown={(e) => handleMouseDown(e, column.id, column.width)}
                  />
                </th>
              );
            })}
            {regularColumns.map((column) => (
              <th
                key={column.id}
                className="bg-muted/50 border-l p-3 text-right relative group"
                style={{ width: column.width }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{column.label}</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100">
                        <PinOff className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSticky(column.id)}
                      >
                        <Pin className="h-3 w-3 mr-2" />
                        נעץ עמודה
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                  onMouseDown={(e) => handleMouseDown(e, column.id, column.width)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b hover:bg-muted/30 ${rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
            >
              {checkboxColumn && (
                <td className={`sticky right-0 z-10 border-l p-3 text-center ${rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                  <Checkbox
                    checked={checkboxColumn.checked[rowIndex]}
                    onCheckedChange={(checked) => checkboxColumn.onCheckedChange(rowIndex, checked as boolean)}
                  />
                </td>
              )}
              {stickyColumns.map((column) => {
                const offset = getStickyOffset(column.id);
                return (
                  <td
                    key={column.id}
                    className={`sticky z-10 border-l p-3 ${rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                    style={{ 
                      width: column.width,
                      right: offset,
                    }}
                  >
                    {column.render(row)}
                  </td>
                );
              })}
              {regularColumns.map((column) => (
                <td
                  key={column.id}
                  className="border-l p-3"
                  style={{ width: column.width }}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
