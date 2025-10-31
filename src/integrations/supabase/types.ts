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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigner_agencies: {
        Row: {
          agency_id: string
          campaigner_id: string
          created_at: string
          id: string
        }
        Insert: {
          agency_id: string
          campaigner_id: string
          created_at?: string
          id?: string
        }
        Update: {
          agency_id?: string
          campaigner_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigner_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigner_agencies_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          agency_id: string
          campaigner_id: string
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["onboarding_status"]
          tenant_id: string | null
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
          status?: Database["public"]["Enums"]["onboarding_status"]
          tenant_id?: string | null
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
          status?: Database["public"]["Enums"]["onboarding_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_suppliers: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          supplier_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          supplier_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          supplier_id?: string
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "finance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      invitation_tokens: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          metadata: Json | null
          tenant_id: string
          token: string
          updated_at: string
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          token: string
          updated_at?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          token?: string
          updated_at?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string | null
          closing_date: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          estimated_deal_value: number | null
          folder_link: string | null
          general_status: string | null
          id: string
          industry: string | null
          lost_reason: string | null
          monthly_budget: number | null
          notes: string | null
          phone: string | null
          products: string | null
          proposal_date: string | null
          proposal_sent_date: string | null
          response_status:
            | Database["public"]["Enums"]["lead_response_status"]
            | null
          sale_date: string | null
          sales_person_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string | null
          three_month_budget: number | null
          updated_at: string
          won_date: string | null
        }
        Insert: {
          agency_id?: string | null
          closing_date?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          estimated_deal_value?: number | null
          folder_link?: string | null
          general_status?: string | null
          id?: string
          industry?: string | null
          lost_reason?: string | null
          monthly_budget?: number | null
          notes?: string | null
          phone?: string | null
          products?: string | null
          proposal_date?: string | null
          proposal_sent_date?: string | null
          response_status?:
            | Database["public"]["Enums"]["lead_response_status"]
            | null
          sale_date?: string | null
          sales_person_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string | null
          three_month_budget?: number | null
          updated_at?: string
          won_date?: string | null
        }
        Update: {
          agency_id?: string | null
          closing_date?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          estimated_deal_value?: number | null
          folder_link?: string | null
          general_status?: string | null
          id?: string
          industry?: string | null
          lost_reason?: string | null
          monthly_budget?: number | null
          notes?: string | null
          phone?: string | null
          products?: string | null
          proposal_date?: string | null
          proposal_sent_date?: string | null
          response_status?:
            | Database["public"]["Enums"]["lead_response_status"]
            | null
          sale_date?: string | null
          sales_person_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string | null
          three_month_budget?: number | null
          updated_at?: string
          won_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_sales_person_id_fkey"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "sales_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          sales_person_id: string | null
          updated_at: string
        }
        Insert: {
          campaigner_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          sales_person_id?: string | null
          updated_at?: string
        }
        Update: {
          campaigner_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          sales_person_id?: string | null
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
          {
            foreignKeyName: "profiles_sales_person_id_fkey"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "sales_people"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_people: {
        Row: {
          active: boolean
          agency_id: string
          created_at: string
          email: string | null
          folder_link: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          created_at?: string
          email?: string | null
          folder_link?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          created_at?: string
          email?: string | null
          folder_link?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_people_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_person_agencies: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          sales_person_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          sales_person_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          sales_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_person_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_person_agencies_sales_person_id_fkey"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "sales_people"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          settings: Json | null
          status: Database["public"]["Enums"]["tenant_status"]
          subdomain: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          campaigner_id: string
          created_at: string
          end_time: string | null
          id: string
          notes: string | null
          start_time: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          campaigner_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          campaigner_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_managed_agencies: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_managed_agencies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      get_client_tenant_id: { Args: { _client_id: string }; Returns: string }
      get_effective_setting: {
        Args: { _setting_key: string; _tenant_id: string }
        Returns: Json
      }
      get_user_agency_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_campaigner_id: { Args: { _user_id: string }; Returns: string }
      get_user_sales_person_agency_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_sales_person_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_finance_permission: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_has_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_manages_agency: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agency_status: "active" | "paused" | "former"
      app_role:
        | "owner"
        | "agency_owner"
        | "team_manager"
        | "campaigner"
        | "sales_person"
        | "super_admin"
      client_status: "active" | "paused" | "ended" | "onboarding"
      finance_type: "income" | "expense"
      lead_response_status:
        | "no_answer_1"
        | "no_answer_2"
        | "no_answer_3"
        | "no_answer_4"
        | "denies_contact"
        | "not_relevant"
      lead_source:
        | "website"
        | "referral"
        | "social_media"
        | "paid_ads"
        | "cold_call"
        | "email_campaign"
        | "event"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "follow_up"
        | "proposal_sent"
        | "closed"
        | "transferred_to_onboarding"
      onboarding_status:
        | "research_meeting"
        | "receiving_access"
        | "setup_and_content"
        | "campaign_live"
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
      tenant_status: "active" | "inactive" | "suspended" | "trial"
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
      app_role: [
        "owner",
        "agency_owner",
        "team_manager",
        "campaigner",
        "sales_person",
        "super_admin",
      ],
      client_status: ["active", "paused", "ended", "onboarding"],
      finance_type: ["income", "expense"],
      lead_response_status: [
        "no_answer_1",
        "no_answer_2",
        "no_answer_3",
        "no_answer_4",
        "denies_contact",
        "not_relevant",
      ],
      lead_source: [
        "website",
        "referral",
        "social_media",
        "paid_ads",
        "cold_call",
        "email_campaign",
        "event",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "follow_up",
        "proposal_sent",
        "closed",
        "transferred_to_onboarding",
      ],
      onboarding_status: [
        "research_meeting",
        "receiving_access",
        "setup_and_content",
        "campaign_live",
      ],
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
      tenant_status: ["active", "inactive", "suspended", "trial"],
    },
  },
} as const
