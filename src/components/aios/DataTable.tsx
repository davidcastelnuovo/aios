import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps {
  columns: string[];
  data: Record<string, any>[];
}

export function DataTable({ columns, data }: DataTableProps) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">אין נתונים להצגה</p>;
  }

  // Auto-detect columns if not provided
  const cols = columns.length > 0 ? columns : Object.keys(data[0] || {});

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((col) => (
              <TableHead key={col} className="text-right font-medium">{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              {cols.map((col) => (
                <TableCell key={col} className="text-right">
                  {row[col] != null ? String(row[col]) : "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
