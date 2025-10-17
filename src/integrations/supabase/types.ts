export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          folder_link: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["agency_status"]
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agency_status"]
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agency_status"]
          updated_at?: string
        }
        Relationships: []
      }
      campaigners: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          folder_link: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          folder_link?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          folder_link?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_suppliers: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          supplier_id: string
          supplier_payment: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          supplier_id: string
          supplier_payment?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          supplier_id?: string
          supplier_payment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_suppliers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_team: {
        Row: {
          allocation_percent: number | null
          campaigner_id: string
          campaigner_payment: number | null
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          role_on_account: string | null
          start_date: string | null
        }
        Insert: {
          allocation_percent?: number | null
          campaigner_id: string
          campaigner_payment?: number | null
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          role_on_account?: string | null
          start_date?: string | null
        }
        Update: {
          allocation_percent?: number | null
          campaigner_id?: string
          campaigner_payment?: number | null
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          role_on_account?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_team_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_team_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          folder_link: string | null
          id: string
          industry: string | null
          monthly_budget: number | null
          name: string
          notes: string | null
          phone: string | null
          retainer: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          industry?: string | null
          monthly_budget?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          retainer?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          industry?: string | null
          monthly_budget?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          retainer?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance: {
        Row: {
          agency_id: string
          amount: number
          category: string | null
          client_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          supplier_id: string | null
          type: Database["public"]["Enums"]["finance_type"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount: number
          category?: string | null
          client_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          supplier_id?: string | null
          type: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          category?: string | null
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          campaigner_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          campaigner_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          campaigner_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          agency_id_1: string | null
          agency_id_2: string | null
          agency_id_3: string | null
          created_at: string
          email: string | null
          folder_link: string | null
          id: string
          name: string
          notes: string | null
          payment_1: number | null
          payment_2: number | null
          payment_3: number | null
          phone: string | null
          related_campaigner_id: string | null
          type: Database["public"]["Enums"]["supplier_type"]
          updated_at: string
        }
        Insert: {
          agency_id_1?: string | null
          agency_id_2?: string | null
          agency_id_3?: string | null
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_1?: number | null
          payment_2?: number | null
          payment_3?: number | null
          phone?: string | null
          related_campaigner_id?: string | null
          type: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
        }
        Update: {
          agency_id_1?: string | null
          agency_id_2?: string | null
          agency_id_3?: string | null
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_1?: number | null
          payment_2?: number | null
          payment_3?: number | null
          phone?: string | null
          related_campaigner_id?: string | null
          type?: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_agency_id_1_fkey"
            columns: ["agency_id_1"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_agency_id_2_fkey"
            columns: ["agency_id_2"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_agency_id_3_fkey"
            columns: ["agency_id_3"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_related_campaigner_id_fkey"
            columns: ["related_campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          campaigner_id: string
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"] | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          campaigner_id: string
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"] | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          campaigner_id?: string
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_role_by_email: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      get_user_campaigner_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agency_status: "active" | "paused" | "former"
      app_role: "admin" | "user" | "owner"
      client_status: "active" | "paused" | "ended"
      finance_type: "income" | "expense"
      payment_method: "cash" | "card" | "wire" | "check"
      priority_level: "high" | "medium" | "low"
      supplier_type:
        | "campaigner"
        | "media"
        | "design"
        | "creative"
        | "dev"
        | "other"
      task_status: "open" | "in_progress" | "done"
      task_type: "campaign" | "collection" | "creative" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agency_status: ["active", "paused", "former"],
      app_role: ["admin", "user", "owner"],
      client_status: ["active", "paused", "ended"],
      finance_type: ["income", "expense"],
      payment_method: ["cash", "card", "wire", "check"],
      priority_level: ["high", "medium", "low"],
      supplier_type: [
        "campaigner",
        "media",
        "design",
        "creative",
        "dev",
        "other",
      ],
      task_status: ["open", "in_progress", "done"],
      task_type: ["campaign", "collection", "creative", "other"],
    },
  },
} as const
