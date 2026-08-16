import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregateOrdersByAttribution } from "@/lib/wooAttribution";

type Props = {
  orders: any[];
  formatCurrency: (n: number) => string;
  formatNumber: (n: number) => string;
};

export function WooAttributionSection({ orders, formatCurrency, formatNumber }: Props) {
  const bySource = useMemo(() => aggregateOrdersByAttribution(orders), [orders]);
  const hasAttribution = bySource.some((row) => row.label !== 'לא ידוע');

  if (!hasAttribution) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>רכישות לפי מקור הגעה</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מקור</TableHead>
              <TableHead className="text-left">הזמנות</TableHead>
              <TableHead className="text-left">הכנסות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bySource.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-left">{formatNumber(row.orders)}</TableCell>
                <TableCell className="text-left">{formatCurrency(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-3">
          * מקור הגעה מבוסס על WooCommerce Order Attribution (UTM / referrer בשעת הרכישה). הזמנות ללא נתוני attribution מסווגות כ&quot;לא ידוע&quot;.
        </p>
      </CardContent>
    </Card>
  );
}

export function wooAttributionLabel(order: any): string {
  return order?.attribution?.label || 'לא ידוע';
}
