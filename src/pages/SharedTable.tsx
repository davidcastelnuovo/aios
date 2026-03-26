import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, FileSpreadsheet } from "lucide-react";

const DATE_FILTERS = [
  { value: 'today', label: 'היום' },
  { value: 'yesterday', label: 'אתמול' },
  { value: 'last_7_days', label: '7 ימים אחרונים' },
  { value: 'last_30_days', label: '30 יום אחרונים' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'חודש קודם' },
];

export default function SharedTable() {
  const { shareToken } = useParams();
  const [dateFilter, setDateFilter] = useState('last_30_days');
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-table', shareToken, dateFilter, submittedEmail],
    queryFn: async () => {
      const params = new URLSearchParams({ token: shareToken!, date_filter: dateFilter });
      if (submittedEmail) params.set('email', submittedEmail);
      const response = await supabase.functions.invoke(`public-table?${params.toString()}`, { method: 'GET' });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: !!shareToken,
    retry: false,
  });

  const needsEmail = data?.error === 'email_required';
  const emailNotAllowed = data?.error === 'email_not_allowed';

  const handleEmailSubmit = () => {
    if (!email.trim() || !email.includes('@')) {
      setEmailError('נא להזין אימייל תקין');
      return;
    }
    setEmailError('');
    setSubmittedEmail(email.trim().toLowerCase());
  };

  // Build display columns from fields or data keys
  const columns = useMemo(() => {
    if (!data?.records?.length) return data?.fields?.map((f: any) => ({ key: f.field_key, label: f.field_label })) || [];
    if (data?.fields?.length) {
      return data.fields.map((f: any) => ({ key: f.field_key, label: f.field_label }));
    }
    // Fallback: extract from first record's data
    const keys = Object.keys(data.records[0]?.data || {}).filter(k => !k.startsWith('_') && k !== 'report_type');
    return keys.map(k => ({ key: k, label: k }));
  }, [data]);

  const records = useMemo(() => {
    return (data?.records || []).filter((r: any) => r.data?.report_type === 'daily' || !r.data?.report_type);
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="w-full max-w-6xl mx-auto p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (needsEmail || emailNotAllowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>טבלה מוגנת</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailNotAllowed && (
              <p className="text-sm text-destructive text-center">
                האימייל שהזנת אינו מורשה לצפות בטבלה זו.
              </p>
            )}
            <p className="text-sm text-muted-foreground text-center">
              נא להזין את כתובת האימייל שלך כדי לצפות בטבלה
            </p>
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
              dir="ltr"
            />
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            <Button className="w-full" onClick={handleEmailSubmit}>
              כניסה
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold mb-2">הקישור אינו תקין</p>
            <p className="text-sm text-muted-foreground">קישור השיתוף לא נמצא או שאינו פעיל יותר.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.table) return null;

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(value);
    }
    return String(value);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold">{data.table.name}</h1>
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-[100]">
              {DATE_FILTERS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col: any) => (
                      <TableHead key={col.key} className="text-right whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length || 1} className="text-center py-12 text-muted-foreground">
                        אין נתונים לתקופה זו
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record: any, i: number) => (
                      <TableRow key={record.id || i}>
                        {columns.map((col: any) => (
                          <TableCell key={col.key} className="whitespace-nowrap">
                            {formatCellValue(record.data?.[col.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          {records.length} שורות • {data.table.name}
        </p>
      </div>
    </div>
  );
}
