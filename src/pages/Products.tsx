import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AddProductForm from "@/components/forms/AddProductForm";
import EditProductDialog from "@/components/forms/EditProductDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Building2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  agency_id?: string | null;
  agencies?: { name: string } | null;
  is_owned?: boolean;
}

export default function Products() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Get tenant's own products
      const { data: ownProducts, error: ownError } = await supabase
        .from("products")
        .select("*, agencies(name)")
        .eq("tenant_id", tenantId)
        .order("name");
      
      if (ownError) throw ownError;
      
      // Get products from shared agencies
      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", tenantId);
      
      if (sharedError) throw sharedError;
      
      const sharedAgencyIds = sharedAccess?.map(a => a.agency_id) || [];
      
      let sharedProducts = [];
      if (sharedAgencyIds.length > 0) {
        const { data: shared, error: sharedProdError } = await supabase
          .from("products")
          .select("*, agencies(name)")
          .in("agency_id", sharedAgencyIds)
          .order("name");
        
        if (sharedProdError) throw sharedProdError;
        sharedProducts = shared || [];
      }
      
      // Mark products as owned or shared
      const marked = [
        ...(ownProducts || []).map(p => ({ ...p, is_owned: true })),
        ...sharedProducts.map(p => ({ ...p, is_owned: false }))
      ];
      
      return marked as Product[];
    },
    enabled: !!tenantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("המוצר נמחק בהצלחה");
      setDeletingProductId(null);
    },
    onError: (error) => {
      toast.error("שגיאה במחיקת המוצר");
      console.error(error);
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">מוצרים ושירותים</h1>
          <p className="text-muted-foreground mt-1">
            ניהול מוצרים ושירותים עבור הלידים
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 ml-2" />
          מוצר חדש
        </Button>
      </div>

      {showAddForm && (
        <div className="border rounded-lg p-6 bg-card">
          <AddProductForm onSuccess={() => setShowAddForm(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">טוען מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          אין מוצרים. הוסף מוצר חדש כדי להתחיל.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם המוצר</TableHead>
                <TableHead>סוכנות</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>מחיר</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {product.name}
                      {!product.is_owned && (
                        <Badge variant="secondary" className="text-xs">משותף</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.agencies?.name ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {product.agencies.name}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">כללי</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.description || "-"}
                  </TableCell>
                  <TableCell>{formatPrice(product.price)}</TableCell>
                  <TableCell>
                    {product.active ? (
                      <Badge variant="default">פעיל</Badge>
                    ) : (
                      <Badge variant="secondary">לא פעיל</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.is_owned !== false && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProduct(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingProductId(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      <AlertDialog
        open={!!deletingProductId}
        onOpenChange={(open) => !open && setDeletingProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את המוצר?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו לא ניתנת לביטול. המוצר יימחק לצמיתות מהמערכת.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProductId && deleteMutation.mutate(deletingProductId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
