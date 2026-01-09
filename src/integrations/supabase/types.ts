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
          is_default: boolean | null
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
          is_default?: boolean | null
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
          is_default?: boolean | null
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
      agency_tenant_access: {
        Row: {
          access_level: string | null
          accessing_tenant_id: string
          agency_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          source_tenant_id: string
        }
        Insert: {
          access_level?: string | null
          accessing_tenant_id: string
          agency_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          source_tenant_id: string
        }
        Update: {
          access_level?: string | null
          accessing_tenant_id?: string
          agency_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          source_tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_tenant_access_accessing_tenant_id_fkey"
            columns: ["accessing_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tenant_access_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tenant_access_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          automation_id: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          payload: Json | null
          response: Json | null
          success: boolean
          triggered_at: string | null
        }
        Insert: {
          automation_id: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          payload?: Json | null
          response?: Json | null
          success: boolean
          triggered_at?: string | null
        }
        Update: {
          automation_id?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          payload?: Json | null
          response?: Json | null
          success?: boolean
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_type: Database["public"]["Enums"]["automation_action"]
          active: boolean | null
          conditions: Json | null
          configuration: Json
          created_at: string | null
          description: string | null
          id: string
          name: string
          tenant_id: string | null
          trigger_type: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["automation_action"]
          active?: boolean | null
          conditions?: Json | null
          configuration: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          trigger_type: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["automation_action"]
          active?: boolean | null
          conditions?: Json | null
          configuration?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          trigger_type?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_contacts: {
        Row: {
          blocked_at: string
          blocked_by_user_id: string | null
          client_id: string | null
          connection_user_id: string
          created_at: string
          group_id: string | null
          id: string
          lead_id: string | null
          sender_phone: string | null
          tenant_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by_user_id?: string | null
          client_id?: string | null
          connection_user_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          lead_id?: string | null
          sender_phone?: string | null
          tenant_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by_user_id?: string | null
          client_id?: string | null
          connection_user_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          lead_id?: string | null
          sender_phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_contacts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          google_email: string | null
          id: string
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          google_email?: string | null
          id?: string
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          google_email?: string | null
          id?: string
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          role: string[] | null
          tenant_id: string
          updated_at: string
          whatsapp_group_id: string | null
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
          role?: string[] | null
          tenant_id: string
          updated_at?: string
          whatsapp_group_id?: string | null
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
          role?: string[] | null
          tenant_id?: string
          updated_at?: string
          whatsapp_group_id?: string | null
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
      chat_contact_tags: {
        Row: {
          client_id: string | null
          created_at: string
          group_id: string | null
          id: string
          lead_id: string | null
          sender_phone: string | null
          tag_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lead_id?: string | null
          sender_phone?: string | null
          tag_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lead_id?: string | null
          sender_phone?: string | null
          tag_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_contact_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_contact_tags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_contact_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "chat_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_contact_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          blocked_at: string | null
          blocked_by_user_id: string | null
          channel: string
          client_id: string | null
          connection_user_id: string | null
          created_at: string | null
          direction: string
          group_id: string | null
          id: string
          is_blocked: boolean
          lead_id: string | null
          message_text: string
          provider: Database["public"]["Enums"]["chat_provider"]
          raw_provider_data: Json | null
          read_at: string | null
          sender_name: string | null
          sender_phone: string | null
          sent_by_user_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by_user_id?: string | null
          channel?: string
          client_id?: string | null
          connection_user_id?: string | null
          created_at?: string | null
          direction: string
          group_id?: string | null
          id?: string
          is_blocked?: boolean
          lead_id?: string | null
          message_text: string
          provider?: Database["public"]["Enums"]["chat_provider"]
          raw_provider_data?: Json | null
          read_at?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_by_user_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by_user_id?: string | null
          channel?: string
          client_id?: string | null
          connection_user_id?: string | null
          created_at?: string | null
          direction?: string
          group_id?: string | null
          id?: string
          is_blocked?: boolean
          lead_id?: string | null
          message_text?: string
          provider?: Database["public"]["Enums"]["chat_provider"]
          raw_provider_data?: Json | null
          read_at?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_by_user_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tags_tenant_id_fkey"
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
      client_tenant_financial_data: {
        Row: {
          client_id: string
          created_at: string
          id: string
          monthly_budget: number | null
          notes: string | null
          retainer: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          monthly_budget?: number | null
          notes?: string | null
          retainer?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          monthly_budget?: number | null
          notes?: string | null
          retainer?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tenant_financial_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tenant_financial_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_updates: {
        Row: {
          client_id: string
          content: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_updates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active_chat_provider:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          folder_link: string | null
          id: string
          industry: string | null
          is_seo_client: boolean | null
          manychat_subscriber_id: string | null
          monthly_budget: number | null
          mood_status: Database["public"]["Enums"]["client_mood_status"] | null
          name: string
          notes: string | null
          phone: string | null
          retainer: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["client_status"]
          tenant_id: string | null
          updated_at: string
          website: string | null
          whatsapp_avatar_url: string | null
        }
        Insert: {
          active_chat_provider?:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          industry?: string | null
          is_seo_client?: boolean | null
          manychat_subscriber_id?: string | null
          monthly_budget?: number | null
          mood_status?: Database["public"]["Enums"]["client_mood_status"] | null
          name: string
          notes?: string | null
          phone?: string | null
          retainer?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_avatar_url?: string | null
        }
        Update: {
          active_chat_provider?:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          folder_link?: string | null
          id?: string
          industry?: string | null
          is_seo_client?: boolean | null
          manychat_subscriber_id?: string | null
          monthly_budget?: number | null
          mood_status?: Database["public"]["Enums"]["client_mood_status"] | null
          name?: string
          notes?: string | null
          phone?: string | null
          retainer?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_avatar_url?: string | null
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
      crm_fields: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_required: boolean
          is_visible: boolean
          key: string
          name: string
          position: number
          table_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          key: string
          name: string
          position?: number
          table_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          key?: string
          name?: string
          position?: number
          table_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_fields_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "crm_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_records: {
        Row: {
          agency_id: string | null
          created_at: string
          created_by: string | null
          data: Json
          id: string
          table_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          table_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          table_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_records_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_records_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "crm_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tables: {
        Row: {
          agency_id: string | null
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          integration_settings: Json | null
          integration_type: string | null
          integrations: Json | null
          last_sync_at: string | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          integration_settings?: Json | null
          integration_type?: string | null
          integrations?: Json | null
          last_sync_at?: string | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          integration_settings?: Json | null
          integration_type?: string | null
          integrations?: Json | null
          last_sync_at?: string | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tables_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          is_visible: boolean
          options: Json | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          options?: Json | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          options?: Json | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
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
      hidden_chats: {
        Row: {
          client_id: string | null
          created_at: string
          group_id: string | null
          hidden_at: string
          id: string
          lead_id: string | null
          sender_phone: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          hidden_at?: string
          id?: string
          lead_id?: string | null
          sender_phone?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          hidden_at?: string
          id?: string
          lead_id?: string | null
          sender_phone?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_chats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_chats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_chats_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_chats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created_at: string
          file_content: string
          file_name: string
          id: string
          import_type: string
          imported_at: string
          imported_by: string | null
          records_count: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          file_content: string
          file_name: string
          id?: string
          import_type: string
          imported_at?: string
          imported_by?: string | null
          records_count?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          file_content?: string
          file_name?: string
          id?: string
          import_type?: string
          imported_at?: string
          imported_by?: string | null
          records_count?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_user_permissions: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string
          id: string
          integration_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by: string
          id?: string
          integration_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          integration_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_user_permissions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
        ]
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
      lead_filter_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_filter_presets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          stage_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          stage_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          stage_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          status_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          status_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          status_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_statuses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_updates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          active_chat_provider:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id: string | null
          campaign_name: string | null
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
          itai_meeting_date: string | null
          lost_reason: string | null
          manychat_subscriber_id: string | null
          meeting_date: string | null
          meeting_location: string | null
          meeting_reminder_day_after_sent_at: string | null
          meeting_reminder_same_day_sent_at: string | null
          meeting_set_date: string | null
          meeting_time: string | null
          monthly_budget: number | null
          notes: string | null
          phone: string | null
          products: string | null
          proposal_date: string | null
          proposal_sent_date: string | null
          response_status: string | null
          sale_date: string | null
          sales_person_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string | null
          three_month_budget: number | null
          updated_at: string
          whatsapp_avatar_url: string | null
          won_date: string | null
        }
        Insert: {
          active_chat_provider?:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id?: string | null
          campaign_name?: string | null
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
          itai_meeting_date?: string | null
          lost_reason?: string | null
          manychat_subscriber_id?: string | null
          meeting_date?: string | null
          meeting_location?: string | null
          meeting_reminder_day_after_sent_at?: string | null
          meeting_reminder_same_day_sent_at?: string | null
          meeting_set_date?: string | null
          meeting_time?: string | null
          monthly_budget?: number | null
          notes?: string | null
          phone?: string | null
          products?: string | null
          proposal_date?: string | null
          proposal_sent_date?: string | null
          response_status?: string | null
          sale_date?: string | null
          sales_person_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string | null
          three_month_budget?: number | null
          updated_at?: string
          whatsapp_avatar_url?: string | null
          won_date?: string | null
        }
        Update: {
          active_chat_provider?:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id?: string | null
          campaign_name?: string | null
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
          itai_meeting_date?: string | null
          lost_reason?: string | null
          manychat_subscriber_id?: string | null
          meeting_date?: string | null
          meeting_location?: string | null
          meeting_reminder_day_after_sent_at?: string | null
          meeting_reminder_same_day_sent_at?: string | null
          meeting_set_date?: string | null
          meeting_time?: string | null
          monthly_budget?: number | null
          notes?: string | null
          phone?: string | null
          products?: string | null
          proposal_date?: string | null
          proposal_sent_date?: string | null
          response_status?: string | null
          sale_date?: string | null
          sales_person_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string | null
          three_month_budget?: number | null
          updated_at?: string
          whatsapp_avatar_url?: string | null
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
      manually_read_contacts: {
        Row: {
          client_id: string | null
          created_at: string
          group_id: string | null
          id: string
          lead_id: string | null
          marked_at: string
          sender_phone: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lead_id?: string | null
          marked_at?: string
          sender_phone?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lead_id?: string | null
          marked_at?: string
          sender_phone?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manually_read_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manually_read_contacts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manually_read_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manually_read_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          badge: string | null
          category: string | null
          created_at: string
          custom_label: string | null
          hidden_from_child_tenants: boolean | null
          icon: string | null
          id: string
          is_visible: boolean
          menu_key: string
          original_label: string
          parent_menu_key: string | null
          route: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          category?: string | null
          created_at?: string
          custom_label?: string | null
          hidden_from_child_tenants?: boolean | null
          icon?: string | null
          id?: string
          is_visible?: boolean
          menu_key: string
          original_label: string
          parent_menu_key?: string | null
          route: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          category?: string | null
          created_at?: string
          custom_label?: string | null
          hidden_from_child_tenants?: boolean | null
          icon?: string | null
          id?: string
          is_visible?: boolean
          menu_key?: string
          original_label?: string
          parent_menu_key?: string | null
          route?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          agency_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          calendar_iframe_code: string | null
          campaigner_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          sales_person_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          calendar_iframe_code?: string | null
          campaigner_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          sales_person_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          calendar_iframe_code?: string | null
          campaigner_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          sales_person_id?: string | null
          status?: string
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
      report_alerts: {
        Row: {
          comparison_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_percentage: boolean | null
          metric: string
          name: string
          operator: string
          table_id: string
          tenant_id: string
          threshold: number
          updated_at: string | null
        }
        Insert: {
          comparison_type: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_percentage?: boolean | null
          metric: string
          name: string
          operator: string
          table_id: string
          tenant_id: string
          threshold: number
          updated_at?: string | null
        }
        Update: {
          comparison_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_percentage?: boolean | null
          metric?: string
          name?: string
          operator?: string
          table_id?: string
          tenant_id?: string
          threshold?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_alerts_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "crm_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      task_collaborators: {
        Row: {
          added_at: string
          added_by: string | null
          campaigner_id: string
          id: string
          task_id: string
          tenant_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          campaigner_id: string
          id?: string
          task_id: string
          tenant_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          campaigner_id?: string
          id?: string
          task_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_collaborators_campaigner_id_fkey"
            columns: ["campaigner_id"]
            isOneToOne: false
            referencedRelation: "campaigners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_collaborators_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_collaborators_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
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
          campaigner_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          google_calendar_event_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          overdue_notified_at: string | null
          priority: number
          sales_person_id: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"] | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          campaigner_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          overdue_notified_at?: string | null
          priority?: number
          sales_person_id?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"] | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          campaigner_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          overdue_notified_at?: string | null
          priority?: number
          sales_person_id?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"] | null
          tenant_id?: string
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
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sales_person_id_fkey"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "sales_people"
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
      tenant_integrations: {
        Row: {
          api_key: string | null
          api_token_last_4: string | null
          auto_sync_enabled: boolean
          company_id: string | null
          created_at: string
          id: string
          instance_id: string | null
          integration_type: string
          is_active: boolean
          last_sync_at: string | null
          settings: Json | null
          shared_from_integration_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key?: string | null
          api_token_last_4?: string | null
          auto_sync_enabled?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          integration_type?: string
          is_active?: boolean
          last_sync_at?: string | null
          settings?: Json | null
          shared_from_integration_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key?: string | null
          api_token_last_4?: string | null
          auto_sync_enabled?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          integration_type?: string
          is_active?: boolean
          last_sync_at?: string | null
          settings?: Json | null
          shared_from_integration_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_shared_from_integration_id_fkey"
            columns: ["shared_from_integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
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
      tenant_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          source_tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          source_tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          source_tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_templates_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_terminology: {
        Row: {
          created_at: string
          id: string
          original_plural: string
          original_singular: string
          plural: string
          singular: string
          tenant_id: string
          term_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_plural: string
          original_singular: string
          plural: string
          singular: string
          tenant_id: string
          term_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          original_plural?: string
          original_singular?: string
          plural?: string
          singular?: string
          tenant_id?: string
          term_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_terminology_tenant_id_fkey"
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
          allow_super_admin_access: boolean
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          is_premium: boolean | null
          name: string
          notes: string | null
          org_type: Database["public"]["Enums"]["org_type"]
          parent_tenant_id: string | null
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          subdomain: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          allow_super_admin_access?: boolean
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_premium?: boolean | null
          name: string
          notes?: string | null
          org_type?: Database["public"]["Enums"]["org_type"]
          parent_tenant_id?: string | null
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_super_admin_access?: boolean
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_premium?: boolean | null
          name?: string
          notes?: string | null
          org_type?: Database["public"]["Enums"]["org_type"]
          parent_tenant_id?: string | null
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      time_entry_breaks: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          start_time: string
          tenant_id: string
          time_entry_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string
          tenant_id: string
          time_entry_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string
          tenant_id?: string
          time_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_breaks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_breaks_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_tenant: {
        Row: {
          created_at: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          agency_id: string | null
          created_at: string
          description: string | null
          group_chat_id: string
          group_name: string
          id: string
          is_blocked: boolean
          tenant_id: string
          updated_at: string
          whatsapp_avatar_url: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          description?: string | null
          group_chat_id: string
          group_name: string
          id?: string
          is_blocked?: boolean
          tenant_id: string
          updated_at?: string
          whatsapp_avatar_url?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          description?: string | null
          group_chat_id?: string
          group_name?: string
          id?: string
          is_blocked?: boolean
          tenant_id?: string
          updated_at?: string
          whatsapp_avatar_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      can_access_agency: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_user_permissions: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      copy_custom_fields_to_tenant: {
        Args: { _source_tenant_id: string; _target_tenant_id: string }
        Returns: undefined
      }
      copy_tenant_template: {
        Args: { _source_tenant_id: string; _target_tenant_id: string }
        Returns: undefined
      }
      get_chat_contacts: {
        Args: { p_tenant_id?: string }
        Returns: {
          active_chat_provider: Database["public"]["Enums"]["chat_provider"]
          agency_id: string
          agency_name: string
          contact_id: string
          contact_name: string
          contact_type: string
          email: string
          is_blocked: boolean
          last_message_at: string
          manychat_subscriber_id: string
          name: string
          phone: string
          unread_count: number
          whatsapp_avatar_url: string
        }[]
      }
      get_client_tenant_id: { Args: { _client_id: string }; Returns: string }
      get_cross_tenant_campaigner_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_effective_setting: {
        Args: { _setting_key: string; _tenant_id: string }
        Returns: Json
      }
      get_effective_tenant_id: { Args: never; Returns: string }
      get_unknown_chat_contacts:
        | {
            Args: never
            Returns: {
              agency_id: string
              agency_name: string
              contact_type: string
              id: string
              is_blocked: boolean
              last_message_at: string
              name: string
              sender_phone: string
              unread_count: number
              whatsapp_avatar_url: string
              wid: string
            }[]
          }
        | {
            Args: { p_tenant_id: string }
            Returns: {
              agency_id: string
              agency_name: string
              contact_type: string
              id: string
              is_blocked: boolean
              last_message_at: string
              name: string
              sender_phone: string
              unread_count: number
              whatsapp_avatar_url: string
              wid: string
            }[]
          }
      get_user_agency_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_campaigner_id: { Args: { _user_id: string }; Returns: string }
      get_user_client_ids: { Args: { _user_id: string }; Returns: string[] }
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
      initialize_all_tenants_menu_items: { Args: never; Returns: undefined }
      initialize_default_custom_fields: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      initialize_default_pipeline_stages: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      initialize_tenant_lead_statuses: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      initialize_tenant_menu_items: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      is_root_tenant: { Args: { tenant_id: string }; Returns: boolean }
      is_seo_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      search_contacts_for_chat:
        | {
            Args: { p_search_term: string }
            Returns: {
              active_chat_provider: Database["public"]["Enums"]["chat_provider"]
              agency_id: string
              agency_name: string
              contact_id: string
              contact_name: string
              contact_type: string
              email: string
              has_messages: boolean
              is_blocked: boolean
              last_message_at: string
              manychat_subscriber_id: string
              name: string
              phone: string
              unread_count: number
            }[]
          }
        | {
            Args: { p_search_term: string; p_tenant_id?: string }
            Returns: {
              active_chat_provider: Database["public"]["Enums"]["chat_provider"]
              agency_id: string
              agency_name: string
              contact_id: string
              contact_name: string
              contact_type: string
              email: string
              has_messages: boolean
              is_blocked: boolean
              last_message_at: string
              manychat_subscriber_id: string
              name: string
              phone: string
              sender_phone: string
              unread_count: number
              whatsapp_avatar_url: string
            }[]
          }
      user_can_view_campaigner: {
        Args: { _campaigner_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_cross_tenant_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_integration_access: {
        Args: { p_integration_id: string }
        Returns: boolean
      }
      user_has_integration_permission: {
        Args: { p_integration_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_tenant_member: {
        Args: { check_tenant_id: string }
        Returns: boolean
      }
      user_manages_agency: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_agency: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_integration: {
        Args: { p_integration_id: string }
        Returns: boolean
      }
      validate_crm_record: {
        Args: { p_data: Json; p_table_id: string }
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
        | "seo"
      automation_action:
        | "webhook"
        | "email"
        | "notification"
        | "update_status"
        | "send_whatsapp"
        | "create_manychat_subscriber"
        | "send_greenapi_message"
        | "add_lead_update"
        | "add_client_update"
        | "send_greenapi_to_campaigner"
      automation_trigger:
        | "task_assigned"
        | "task_status_changed"
        | "lead_status_changed"
        | "lead_created"
        | "client_created"
        | "client_status_changed"
        | "onboarding_status_changed"
        | "meeting_created"
        | "task_calendar_created"
        | "task_overdue"
        | "meeting_day_after"
        | "meeting_same_day"
      chat_provider: "manychat" | "green_api" | "internal"
      client_mood_status:
        | "happy"
        | "wavering"
        | "churn_risk"
        | "not_progressing"
      client_status: "active" | "paused" | "ended" | "onboarding"
      finance_type: "income" | "expense"
      lead_response_status:
        | "no_answer_1"
        | "no_answer_2"
        | "no_answer_3"
        | "no_answer_4"
        | "denies_contact"
        | "not_relevant"
        | "in_progress"
      lead_source:
        | "website"
        | "referral"
        | "social_media"
        | "paid_ads"
        | "cold_call"
        | "email_campaign"
        | "event"
        | "other"
        | "whatsapp"
      lead_status:
        | "new"
        | "contacted"
        | "follow_up"
        | "proposal_sent"
        | "closed"
        | "transferred_to_onboarding"
        | "meeting_scheduled"
        | "negotiation"
      onboarding_status:
        | "research_meeting"
        | "receiving_access"
        | "setup_and_content"
        | "campaign_live"
      org_type: "root" | "organization" | "sub_organization"
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
        "seo",
      ],
      automation_action: [
        "webhook",
        "email",
        "notification",
        "update_status",
        "send_whatsapp",
        "create_manychat_subscriber",
        "send_greenapi_message",
        "add_lead_update",
        "add_client_update",
        "send_greenapi_to_campaigner",
      ],
      automation_trigger: [
        "task_assigned",
        "task_status_changed",
        "lead_status_changed",
        "lead_created",
        "client_created",
        "client_status_changed",
        "onboarding_status_changed",
        "meeting_created",
        "task_calendar_created",
        "task_overdue",
        "meeting_day_after",
        "meeting_same_day",
      ],
      chat_provider: ["manychat", "green_api", "internal"],
      client_mood_status: [
        "happy",
        "wavering",
        "churn_risk",
        "not_progressing",
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
        "in_progress",
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
        "whatsapp",
      ],
      lead_status: [
        "new",
        "contacted",
        "follow_up",
        "proposal_sent",
        "closed",
        "transferred_to_onboarding",
        "meeting_scheduled",
        "negotiation",
      ],
      onboarding_status: [
        "research_meeting",
        "receiving_access",
        "setup_and_content",
        "campaign_live",
      ],
      org_type: ["root", "organization", "sub_organization"],
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
