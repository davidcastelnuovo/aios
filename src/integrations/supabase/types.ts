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
      agent_action_log: {
        Row: {
          action_details: Json
          action_type: string
          agent_id: string | null
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          model: string | null
          observation: Json | null
          run_id: string | null
          status: string
          step_index: number | null
          step_kind: string | null
          tenant_id: string
          thought: string | null
          tokens_in: number | null
          tokens_out: number | null
          tool_calls: number | null
          user_id: string | null
        }
        Insert: {
          action_details?: Json
          action_type: string
          agent_id?: string | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          model?: string | null
          observation?: Json | null
          run_id?: string | null
          status?: string
          step_index?: number | null
          step_kind?: string | null
          tenant_id: string
          thought?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: number | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json
          action_type?: string
          agent_id?: string | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          model?: string | null
          observation?: Json | null
          run_id?: string | null
          status?: string
          step_index?: number | null
          step_kind?: string | null
          tenant_id?: string
          thought?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_approval_queue: {
        Row: {
          action_type: string
          agent_id: string | null
          approved_at: string | null
          approved_by: string | null
          context: Json | null
          created_at: string
          description: string | null
          executed_at: string | null
          execution_result: Json | null
          expires_at: string | null
          id: string
          proposed_changes: Json | null
          requested_by: string | null
          run_id: string | null
          status: string
          tenant_id: string
          title: string
          tool_input: Json | null
          tool_name: string | null
        }
        Insert: {
          action_type: string
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          expires_at?: string | null
          id?: string
          proposed_changes?: Json | null
          requested_by?: string | null
          run_id?: string | null
          status?: string
          tenant_id: string
          title: string
          tool_input?: Json | null
          tool_name?: string | null
        }
        Update: {
          action_type?: string
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          expires_at?: string | null
          id?: string
          proposed_changes?: Json | null
          requested_by?: string | null
          run_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          tool_input?: Json | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_approval_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_eval_runs: {
        Row: {
          agent_id: string
          avg_score: number | null
          completed_at: string | null
          eval_id: string
          id: string
          passed_cases: number
          results: Json | null
          started_at: string
          status: string
          tenant_id: string
          total_cases: number
        }
        Insert: {
          agent_id: string
          avg_score?: number | null
          completed_at?: string | null
          eval_id: string
          id?: string
          passed_cases?: number
          results?: Json | null
          started_at?: string
          status?: string
          tenant_id: string
          total_cases?: number
        }
        Update: {
          agent_id?: string
          avg_score?: number | null
          completed_at?: string | null
          eval_id?: string
          id?: string
          passed_cases?: number
          results?: Json | null
          started_at?: string
          status?: string
          tenant_id?: string
          total_cases?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_eval_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_eval_runs_eval_id_fkey"
            columns: ["eval_id"]
            isOneToOne: false
            referencedRelation: "agent_evals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_evals: {
        Row: {
          agent_id: string
          created_at: string
          dataset: Json
          description: string | null
          id: string
          name: string
          pass_threshold: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          dataset?: Json
          description?: string | null
          id?: string
          name: string
          pass_threshold?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          dataset?: Json
          description?: string | null
          id?: string
          name?: string
          pass_threshold?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_evals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_goals: {
        Row: {
          agent_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          priority: string
          status: string
          target_date: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          target_date?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          target_date?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_goals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_folders: {
        Row: {
          agent_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_folder_id: string | null
          position: number
          tenant_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          position?: number
          tenant_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_folders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "agent_knowledge_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_items: {
        Row: {
          agent_id: string
          content: string | null
          created_at: string
          embedding: string | null
          folder_id: string | null
          id: string
          kind: string
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          agent_id: string
          content?: string | null
          created_at?: string
          embedding?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          tags?: string[]
          tenant_id: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          agent_id?: string
          content?: string | null
          created_at?: string
          embedding?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_items_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "agent_knowledge_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_mcp_connections: {
        Row: {
          agent_id: string | null
          auth_url: string | null
          available_tools: Json | null
          client_metadata: Json | null
          created_at: string
          id: string
          last_error: string | null
          name: string
          oauth_tokens: Json | null
          state: string
          tenant_id: string
          transport: string
          updated_at: string
          url: string
        }
        Insert: {
          agent_id?: string | null
          auth_url?: string | null
          available_tools?: Json | null
          client_metadata?: Json | null
          created_at?: string
          id?: string
          last_error?: string | null
          name: string
          oauth_tokens?: Json | null
          state?: string
          tenant_id: string
          transport?: string
          updated_at?: string
          url: string
        }
        Update: {
          agent_id?: string | null
          auth_url?: string | null
          available_tools?: Json | null
          client_metadata?: Json | null
          created_at?: string
          id?: string
          last_error?: string | null
          name?: string
          oauth_tokens?: Json | null
          state?: string
          tenant_id?: string
          transport?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_mcp_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          agent_id: string
          category: string
          contact_phone: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          fts: unknown
          id: string
          importance: number
          memory_type: Database["public"]["Enums"]["agent_memory_layer"]
          metadata: Json
          path: string | null
          ref_date: string | null
          subcategory: string | null
          summary: string | null
          summary_embedding: string | null
          tenant_id: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          agent_id: string
          category?: string
          contact_phone?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          fts?: unknown
          id?: string
          importance?: number
          memory_type?: Database["public"]["Enums"]["agent_memory_layer"]
          metadata?: Json
          path?: string | null
          ref_date?: string | null
          subcategory?: string | null
          summary?: string | null
          summary_embedding?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          agent_id?: string
          category?: string
          contact_phone?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          fts?: unknown
          id?: string
          importance?: number
          memory_type?: Database["public"]["Enums"]["agent_memory_layer"]
          metadata?: Json
          path?: string | null
          ref_date?: string | null
          subcategory?: string | null
          summary?: string | null
          summary_embedding?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          context: Json
          conversation_id: string | null
          created_at: string
          current_step: number
          delegated_to_agent_id: string | null
          duration_ms: number | null
          error_message: string | null
          final_answer: string | null
          goal: string
          id: string
          max_steps: number
          model: string | null
          parent_run_id: string | null
          pending_approval_id: string | null
          replay_of_run_id: string | null
          started_at: string
          status: string
          tenant_id: string
          total_cost_usd: number
          total_tokens_in: number
          total_tokens_out: number
          trigger_source: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          context?: Json
          conversation_id?: string | null
          created_at?: string
          current_step?: number
          delegated_to_agent_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          final_answer?: string | null
          goal: string
          id?: string
          max_steps?: number
          model?: string | null
          parent_run_id?: string | null
          pending_approval_id?: string | null
          replay_of_run_id?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          total_cost_usd?: number
          total_tokens_in?: number
          total_tokens_out?: number
          trigger_source?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          context?: Json
          conversation_id?: string | null
          created_at?: string
          current_step?: number
          delegated_to_agent_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          final_answer?: string | null
          goal?: string
          id?: string
          max_steps?: number
          model?: string | null
          parent_run_id?: string | null
          pending_approval_id?: string | null
          replay_of_run_id?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          total_cost_usd?: number
          total_tokens_in?: number
          total_tokens_out?: number
          trigger_source?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_delegated_to_agent_id_fkey"
            columns: ["delegated_to_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_replay_of_run_id_fkey"
            columns: ["replay_of_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_supervisors: {
        Row: {
          child_agent_id: string
          created_at: string
          enabled: boolean
          id: string
          priority: number
          routing_hint: string | null
          supervisor_agent_id: string
          tenant_id: string
        }
        Insert: {
          child_agent_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          priority?: number
          routing_hint?: string | null
          supervisor_agent_id: string
          tenant_id: string
        }
        Update: {
          child_agent_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          priority?: number
          routing_hint?: string | null
          supervisor_agent_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_supervisors_child_agent_id_fkey"
            columns: ["child_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_supervisors_supervisor_agent_id_fkey"
            columns: ["supervisor_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          cron_expression: string | null
          description: string | null
          enabled: boolean | null
          id: string
          last_run: string | null
          parallel_execution: boolean | null
          parallel_subtasks: Json | null
          priority: number
          result: Json | null
          run_count: number | null
          schedule_type: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          task_mode: string | null
          task_skills: Json | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_run?: string | null
          parallel_execution?: boolean | null
          parallel_subtasks?: Json | null
          priority?: number
          result?: Json | null
          run_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          task_mode?: string | null
          task_skills?: Json | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_run?: string | null
          parallel_execution?: boolean | null
          parallel_subtasks?: Json | null
          priority?: number
          result?: Json | null
          run_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          task_mode?: string | null
          task_skills?: Json | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          handler_kind: string
          handler_ref: string | null
          id: string
          input_schema: Json
          metadata: Json
          name: string
          requires_approval: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          handler_kind?: string
          handler_ref?: string | null
          id?: string
          input_schema?: Json
          metadata?: Json
          name: string
          requires_approval?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          handler_kind?: string
          handler_ref?: string | null
          id?: string
          input_schema?: Json
          metadata?: Json
          name?: string
          requires_approval?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_user_profiles: {
        Row: {
          agent_id: string | null
          contact_phone: string
          created_at: string
          display_name: string | null
          id: string
          last_interaction_at: string | null
          profile: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          contact_phone: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_interaction_at?: string | null
          profile?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          contact_phone?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_interaction_at?: string | null
          profile?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_user_profiles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ahrefs_reports: {
        Row: {
          agency_id: string | null
          client_id: string | null
          comparison_data: Json | null
          created_at: string
          domain: string
          id: string
          metadata: Json | null
          received_at: string
          report_data: Json
          report_date: string | null
          report_type: string
          tenant_id: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          comparison_data?: Json | null
          created_at?: string
          domain: string
          id?: string
          metadata?: Json | null
          received_at?: string
          report_data?: Json
          report_date?: string | null
          report_type: string
          tenant_id?: string | null
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          comparison_data?: Json | null
          created_at?: string
          domain?: string
          id?: string
          metadata?: Json | null
          received_at?: string
          report_data?: Json
          report_date?: string | null
          report_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ahrefs_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ahrefs_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ahrefs_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          active: boolean | null
          allowed_tools: string[]
          created_at: string | null
          engine: string
          id: string
          language: string
          max_tool_rounds: number
          name: string
          personality: string | null
          response_length: string | null
          soul: string | null
          system_prompt: string | null
          talent: string | null
          tenant_id: string
          updated_at: string | null
          writing_style: string | null
        }
        Insert: {
          active?: boolean | null
          allowed_tools?: string[]
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          max_tool_rounds?: number
          name: string
          personality?: string | null
          response_length?: string | null
          soul?: string | null
          system_prompt?: string | null
          talent?: string | null
          tenant_id: string
          updated_at?: string | null
          writing_style?: string | null
        }
        Update: {
          active?: boolean | null
          allowed_tools?: string[]
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          max_tool_rounds?: number
          name?: string
          personality?: string | null
          response_length?: string | null
          soul?: string | null
          system_prompt?: string | null
          talent?: string | null
          tenant_id?: string
          updated_at?: string | null
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_tenant_id_fkey"
            columns: ["tenant_id"]
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
      ai_detection_brands: {
        Row: {
          brand_name: string
          competitor_names: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          keywords: string[] | null
          tenant_id: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          brand_name: string
          competitor_names?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          tenant_id: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          brand_name?: string
          competitor_names?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_detection_brands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_detection_competitor_results: {
        Row: {
          brand_id: string | null
          competitor_name: string
          id: string
          is_mentioned: boolean | null
          platform: string
          position: number | null
          prompt_id: string | null
          scan_id: string | null
          scanned_at: string | null
          tenant_id: string | null
        }
        Insert: {
          brand_id?: string | null
          competitor_name: string
          id?: string
          is_mentioned?: boolean | null
          platform: string
          position?: number | null
          prompt_id?: string | null
          scan_id?: string | null
          scanned_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          brand_id?: string | null
          competitor_name?: string
          id?: string
          is_mentioned?: boolean | null
          platform?: string
          position?: number | null
          prompt_id?: string | null
          scan_id?: string | null
          scanned_at?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_detection_competitor_results_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ai_detection_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_detection_competitor_results_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_detection_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_detection_competitor_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_detection_prompts: {
        Row: {
          brand_id: string
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          prompt: string
          tenant_id: string
        }
        Insert: {
          brand_id: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          prompt: string
          tenant_id: string
        }
        Update: {
          brand_id?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          prompt?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_detection_prompts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ai_detection_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_detection_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_detection_results: {
        Row: {
          brand_id: string | null
          citations: string[] | null
          id: string
          is_mentioned: boolean | null
          platform: string
          position: number | null
          prompt_id: string
          response_snippet: string | null
          scan_id: string | null
          scanned_at: string | null
          sentiment: string | null
          tenant_id: string | null
        }
        Insert: {
          brand_id?: string | null
          citations?: string[] | null
          id?: string
          is_mentioned?: boolean | null
          platform: string
          position?: number | null
          prompt_id: string
          response_snippet?: string | null
          scan_id?: string | null
          scanned_at?: string | null
          sentiment?: string | null
          tenant_id?: string | null
        }
        Update: {
          brand_id?: string | null
          citations?: string[] | null
          id?: string
          is_mentioned?: boolean | null
          platform?: string
          position?: number | null
          prompt_id?: string
          response_snippet?: string | null
          scan_id?: string | null
          scanned_at?: string | null
          sentiment?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_detection_results_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ai_detection_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_detection_results_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_detection_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_detection_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_detection_scores: {
        Row: {
          brand_id: string
          chatgpt_score: number | null
          created_at: string | null
          gemini_score: number | null
          id: string
          mentioned_prompts: number | null
          perplexity_score: number | null
          score: number | null
          tenant_id: string | null
          total_prompts: number | null
          week_start: string
        }
        Insert: {
          brand_id: string
          chatgpt_score?: number | null
          created_at?: string | null
          gemini_score?: number | null
          id?: string
          mentioned_prompts?: number | null
          perplexity_score?: number | null
          score?: number | null
          tenant_id?: string | null
          total_prompts?: number | null
          week_start: string
        }
        Update: {
          brand_id?: string
          chatgpt_score?: number | null
          created_at?: string | null
          gemini_score?: number | null
          id?: string
          mentioned_prompts?: number | null
          perplexity_score?: number | null
          score?: number | null
          tenant_id?: string | null
          total_prompts?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_detection_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ai_detection_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_detection_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          key: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          key: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_skills: {
        Row: {
          allowed_tools: string[] | null
          created_at: string
          created_by_agent: boolean
          description: string
          id: string
          is_active: boolean
          last_used_at: string | null
          model: string | null
          name: string
          output_template: string | null
          scope: string
          search_vector: unknown
          slug: string | null
          steps: string
          success_rate: number | null
          system_prompt: string | null
          tenant_id: string | null
          trigger_phrases: string[] | null
          triggers: string[] | null
          updated_at: string
          usage_count: number
          user_id: string | null
          version: number
        }
        Insert: {
          allowed_tools?: string[] | null
          created_at?: string
          created_by_agent?: boolean
          description: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          model?: string | null
          name: string
          output_template?: string | null
          scope?: string
          search_vector?: unknown
          slug?: string | null
          steps: string
          success_rate?: number | null
          system_prompt?: string | null
          tenant_id?: string | null
          trigger_phrases?: string[] | null
          triggers?: string[] | null
          updated_at?: string
          usage_count?: number
          user_id?: string | null
          version?: number
        }
        Update: {
          allowed_tools?: string[] | null
          created_at?: string
          created_by_agent?: boolean
          description?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          model?: string | null
          name?: string
          output_template?: string | null
          scope?: string
          search_vector?: unknown
          slug?: string | null
          steps?: string
          success_rate?: number | null
          system_prompt?: string | null
          tenant_id?: string | null
          trigger_phrases?: string[] | null
          triggers?: string[] | null
          updated_at?: string
          usage_count?: number
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          actions_count: number
          automation_id: string
          depth: number
          entity_id: string | null
          error: string | null
          execution_id: string
          finished_at: string | null
          id: string
          started_at: string
          status: string
          tenant_id: string
          trigger_type: string | null
        }
        Insert: {
          actions_count?: number
          automation_id: string
          depth?: number
          entity_id?: string | null
          error?: string | null
          execution_id: string
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tenant_id: string
          trigger_type?: string | null
        }
        Update: {
          actions_count?: number
          automation_id?: string
          depth?: number
          entity_id?: string | null
          error?: string | null
          execution_id?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tenant_id?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flow_steps: {
        Row: {
          action_type: string | null
          automation_id: string
          condition_branch: string | null
          configuration: Json
          created_at: string
          id: string
          label: string | null
          parent_step_id: string | null
          position_x: number
          position_y: number
          sort_order: number
          step_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_type?: string | null
          automation_id: string
          condition_branch?: string | null
          configuration?: Json
          created_at?: string
          id?: string
          label?: string | null
          parent_step_id?: string | null
          position_x?: number
          position_y?: number
          sort_order?: number
          step_type?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_type?: string | null
          automation_id?: string
          condition_branch?: string | null
          configuration?: Json
          created_at?: string
          id?: string
          label?: string | null
          parent_step_id?: string | null
          position_x?: number
          position_y?: number
          sort_order?: number
          step_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flow_steps_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flow_steps_parent_step_id_fkey"
            columns: ["parent_step_id"]
            isOneToOne: false
            referencedRelation: "automation_flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flow_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      automation_shared_tenants: {
        Row: {
          automation_id: string
          shared_at: string
          shared_by: string | null
          tenant_id: string
        }
        Insert: {
          automation_id: string
          shared_at?: string
          shared_by?: string | null
          tenant_id: string
        }
        Update: {
          automation_id?: string
          shared_at?: string
          shared_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_shared_tenants_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_shared_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          is_flow: boolean
          name: string
          source_automation_id: string | null
          source_tenant_id: string | null
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
          is_flow?: boolean
          name: string
          source_automation_id?: string | null
          source_tenant_id?: string | null
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
          is_flow?: boolean
          name?: string
          source_automation_id?: string | null
          source_tenant_id?: string | null
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
      calendar_shares: {
        Row: {
          created_at: string | null
          id: string
          owner_user_id: string
          permission_level: string
          shared_with_user_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_user_id: string
          permission_level?: string
          shared_with_user_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_user_id?: string
          permission_level?: string
          shared_with_user_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_shares_tenant_id_fkey"
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
          last_sync_at: string | null
          needs_reconnect: boolean
          next_sync_token: string | null
          refresh_token: string
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
          user_id: string
          watch_channel_id: string | null
          watch_expires_at: string | null
          watch_resource_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          needs_reconnect?: boolean
          next_sync_token?: string | null
          refresh_token: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          needs_reconnect?: boolean
          next_sync_token?: string | null
          refresh_token?: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          caller_user_id: string
          client_id: string | null
          created_at: string
          duration: number | null
          from_number: string | null
          id: string
          lead_id: string | null
          notes: string | null
          provider: string | null
          provider_call_id: string | null
          recording_duration: number | null
          recording_url: string | null
          status: string
          tenant_id: string
          to_number: string
          updated_at: string
        }
        Insert: {
          caller_user_id: string
          client_id?: string | null
          created_at?: string
          duration?: number | null
          from_number?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recording_duration?: number | null
          recording_url?: string | null
          status?: string
          tenant_id: string
          to_number: string
          updated_at?: string
        }
        Update: {
          caller_user_id?: string
          client_id?: string | null
          created_at?: string
          duration?: number | null
          from_number?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recording_duration?: number | null
          recording_url?: string | null
          status?: string
          tenant_id?: string
          to_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          ad_account_id: string | null
          alert_type: string
          campaign_id: string
          campaign_name: string | null
          client_id: string | null
          created_at: string
          details: Json | null
          id: string
          notified_at: string | null
          resolved_at: string | null
          severity: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ad_account_id?: string | null
          alert_type: string
          campaign_id: string
          campaign_name?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          notified_at?: string | null
          resolved_at?: string | null
          severity?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ad_account_id?: string | null
          alert_type?: string
          campaign_id?: string
          campaign_name?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          notified_at?: string | null
          resolved_at?: string | null
          severity?: string
          tenant_id?: string
          updated_at?: string
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
      carmen_memory_episodes: {
        Row: {
          access_count: number
          created_at: string
          id: string
          importance: number
          last_accessed_at: string
          participants: Json | null
          ref_date: string
          retention_score: number
          session_ref: string | null
          source_ids: string[] | null
          source_table: string | null
          summary: string
          summary_embedding: string | null
          tenant_id: string
          topic: string | null
          topic_tags: string[] | null
          updated_at: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          id?: string
          importance?: number
          last_accessed_at?: string
          participants?: Json | null
          ref_date?: string
          retention_score?: number
          session_ref?: string | null
          source_ids?: string[] | null
          source_table?: string | null
          summary: string
          summary_embedding?: string | null
          tenant_id: string
          topic?: string | null
          topic_tags?: string[] | null
          updated_at?: string
        }
        Update: {
          access_count?: number
          created_at?: string
          id?: string
          importance?: number
          last_accessed_at?: string
          participants?: Json | null
          ref_date?: string
          retention_score?: number
          session_ref?: string | null
          source_ids?: string[] | null
          source_table?: string | null
          summary?: string
          summary_embedding?: string | null
          tenant_id?: string
          topic?: string | null
          topic_tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      carmen_memory_outbox: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          id: number
          op: string
          payload: Json
          processed_at: string | null
          retry_count: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error?: string | null
          id?: number
          op: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          id?: number
          op?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          tenant_id?: string | null
        }
        Relationships: []
      }
      carmen_memory_pointers: {
        Row: {
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          importance: number
          metadata: Json
          path: string
          ref_date: string | null
          subcategory: string | null
          summary: string | null
          summary_embedding: string | null
          tenant_id: string
          title: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          category: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          importance?: number
          metadata?: Json
          path: string
          ref_date?: string | null
          subcategory?: string | null
          summary?: string | null
          summary_embedding?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          importance?: number
          metadata?: Json
          path?: string
          ref_date?: string | null
          subcategory?: string | null
          summary?: string | null
          summary_embedding?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      carmen_whatsapp_sessions: {
        Row: {
          agent_id: string | null
          ai_conversation_id: string | null
          automation_id: string | null
          chat_id: string
          connection_user_id: string | null
          conversation_history: Json | null
          created_at: string | null
          end_keyword: string | null
          ended_at: string | null
          id: string
          last_message_at: string | null
          phone: string | null
          sender_name: string | null
          started_by_keyword: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          agent_id?: string | null
          ai_conversation_id?: string | null
          automation_id?: string | null
          chat_id: string
          connection_user_id?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          end_keyword?: string | null
          ended_at?: string | null
          id?: string
          last_message_at?: string | null
          phone?: string | null
          sender_name?: string | null
          started_by_keyword?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          agent_id?: string | null
          ai_conversation_id?: string | null
          automation_id?: string | null
          chat_id?: string
          connection_user_id?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          end_keyword?: string | null
          ended_at?: string | null
          id?: string
          last_message_at?: string | null
          phone?: string | null
          sender_name?: string | null
          started_by_keyword?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carmen_whatsapp_sessions_ai_conversation_id_fkey"
            columns: ["ai_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carmen_whatsapp_sessions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
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
      client_contacts: {
        Row: {
          client_id: string
          contact_name: string
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          phone: string | null
          role: string | null
          tenant_id: string
        }
        Insert: {
          client_id: string
          contact_name: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          phone?: string | null
          role?: string | null
          tenant_id: string
        }
        Update: {
          client_id?: string
          contact_name?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          phone?: string | null
          role?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credentials: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          password: string | null
          service_name: string
          tenant_id: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          password?: string | null
          service_name: string
          tenant_id: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          password?: string | null
          service_name?: string
          tenant_id?: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credentials_tenant_id_fkey"
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
          update_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          id?: string
          tenant_id: string
          update_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          tenant_id?: string
          update_type?: string | null
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
          active_flags: Json | null
          agency_id: string
          attachments: Json
          contact_name: string | null
          created_at: string
          email: string | null
          end_date: string | null
          folder_link: string | null
          folder_links: Json
          google_ads_account_id: string | null
          health_score: number | null
          id: string
          industry: string | null
          is_ecommerce: boolean
          is_seo_client: boolean | null
          manychat_subscriber_id: string | null
          meta_ads_account_id: string | null
          monthly_budget: number | null
          monthly_fixed_expense: number
          mood_status: Database["public"]["Enums"]["client_mood_status"] | null
          name: string
          notes: string | null
          overall_status: string | null
          phone: string | null
          retainer: number | null
          services: string[] | null
          start_date: string | null
          status: Database["public"]["Enums"]["client_status"]
          tenant_id: string | null
          tier: Database["public"]["Enums"]["client_tier"] | null
          updated_at: string
          website: string | null
          whatsapp_avatar_url: string | null
          whatsapp_group_id: string | null
        }
        Insert: {
          active_chat_provider?:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          active_flags?: Json | null
          agency_id: string
          attachments?: Json
          contact_name?: string | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          folder_link?: string | null
          folder_links?: Json
          google_ads_account_id?: string | null
          health_score?: number | null
          id?: string
          industry?: string | null
          is_ecommerce?: boolean
          is_seo_client?: boolean | null
          manychat_subscriber_id?: string | null
          meta_ads_account_id?: string | null
          monthly_budget?: number | null
          monthly_fixed_expense?: number
          mood_status?: Database["public"]["Enums"]["client_mood_status"] | null
          name: string
          notes?: string | null
          overall_status?: string | null
          phone?: string | null
          retainer?: number | null
          services?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string | null
          tier?: Database["public"]["Enums"]["client_tier"] | null
          updated_at?: string
          website?: string | null
          whatsapp_avatar_url?: string | null
          whatsapp_group_id?: string | null
        }
        Update: {
          active_chat_provider?:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          active_flags?: Json | null
          agency_id?: string
          attachments?: Json
          contact_name?: string | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          folder_link?: string | null
          folder_links?: Json
          google_ads_account_id?: string | null
          health_score?: number | null
          id?: string
          industry?: string | null
          is_ecommerce?: boolean
          is_seo_client?: boolean | null
          manychat_subscriber_id?: string | null
          meta_ads_account_id?: string | null
          monthly_budget?: number | null
          monthly_fixed_expense?: number
          mood_status?: Database["public"]["Enums"]["client_mood_status"] | null
          name?: string
          notes?: string | null
          overall_status?: string | null
          phone?: string | null
          retainer?: number | null
          services?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string | null
          tier?: Database["public"]["Enums"]["client_tier"] | null
          updated_at?: string
          website?: string | null
          whatsapp_avatar_url?: string | null
          whatsapp_group_id?: string | null
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
          {
            foreignKeyName: "clients_whatsapp_group_id_fkey"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          interaction_type: string | null
          note: string | null
          status: string
          tenant_id: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          note?: string | null
          status?: string
          tenant_id: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          interaction_type?: string | null
          note?: string | null
          status?: string
          tenant_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_dashboards: {
        Row: {
          agency_id: string | null
          client_id: string | null
          created_at: string | null
          dashboard_type: string | null
          id: string
          name: string
          settings: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          dashboard_type?: string | null
          id?: string
          name: string
          settings?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string | null
          dashboard_type?: string | null
          id?: string
          name?: string
          settings?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_dashboards_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_dashboards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      dashboard_shares: {
        Row: {
          allowed_emails: string[] | null
          created_at: string
          created_by: string
          dashboard_id: string
          id: string
          is_active: boolean
          share_token: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allowed_emails?: string[] | null
          created_at?: string
          created_by: string
          dashboard_id: string
          id?: string
          is_active?: boolean
          share_token?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allowed_emails?: string[] | null
          created_at?: string
          created_by?: string
          dashboard_id?: string
          id?: string
          is_active?: boolean
          share_token?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_shares_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "crm_dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_shares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_facebook_leads: {
        Row: {
          deleted_at: string
          id: string
          leadgen_id: string
          tenant_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          leadgen_id: string
          tenant_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          leadgen_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_facebook_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          colno: number | null
          created_at: string | null
          error_message: string | null
          error_stack: string | null
          error_type: string | null
          filename: string | null
          has_blank_screen: boolean | null
          id: string
          lineno: number | null
          source: string | null
          stack: string | null
          timestamp: number | null
          url: string | null
        }
        Insert: {
          colno?: number | null
          created_at?: string | null
          error_message?: string | null
          error_stack?: string | null
          error_type?: string | null
          filename?: string | null
          has_blank_screen?: boolean | null
          id?: string
          lineno?: number | null
          source?: string | null
          stack?: string | null
          timestamp?: number | null
          url?: string | null
        }
        Update: {
          colno?: number | null
          created_at?: string | null
          error_message?: string | null
          error_stack?: string | null
          error_type?: string | null
          filename?: string | null
          has_blank_screen?: boolean | null
          id?: string
          lineno?: number | null
          source?: string | null
          stack?: string | null
          timestamp?: number | null
          url?: string | null
        }
        Relationships: []
      }
      expense_payments: {
        Row: {
          amount: number
          created_at: string | null
          expense_id: string
          expense_name: string
          expense_type: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_month: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          expense_id: string
          expense_name: string
          expense_type: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_month: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          expense_id?: string
          expense_name?: string
          expense_type?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_month?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_tenant_id_fkey"
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
      flow_processed_leads: {
        Row: {
          automation_id: string
          facebook_form_id: string | null
          id: string
          leadgen_id: string
          processed_at: string | null
          tenant_id: string
        }
        Insert: {
          automation_id: string
          facebook_form_id?: string | null
          id?: string
          leadgen_id: string
          processed_at?: string | null
          tenant_id: string
        }
        Update: {
          automation_id?: string
          facebook_form_id?: string | null
          id?: string
          leadgen_id?: string
          processed_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_processed_leads_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_processed_leads_tenant_id_fkey"
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
      gmail_allowed_labels: {
        Row: {
          created_at: string | null
          id: string
          label_id: string
          label_name: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label_id: string
          label_name: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label_id?: string
          label_name?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_allowed_labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_blocked_senders: {
        Row: {
          blocked_at: string
          created_at: string
          email_address: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          created_at?: string
          email_address: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          created_at?: string
          email_address?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_blocked_senders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_categories: {
        Row: {
          color: string
          created_at: string
          gmail_label_id: string | null
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          gmail_label_id?: string | null
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          gmail_label_id?: string | null
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          subject_pattern: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          subject_pattern: string
          tenant_id: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          subject_pattern?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gmail_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_category_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_message_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          message_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          message_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          message_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_message_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gmail_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_message_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          id: string
          refresh_token: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          id?: string
          refresh_token: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          id?: string
          refresh_token?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          owner_type: string
          parent_goal_id: string | null
          progress_percent: number | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string
          parent_goal_id?: string | null
          progress_percent?: number | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string
          parent_goal_id?: string | null
          progress_percent?: number | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeat_logs: {
        Row: {
          actions_taken: Json | null
          agent_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          summary: string | null
          tasks_reviewed: number | null
          tenant_id: string
          triggered_at: string
        }
        Insert: {
          actions_taken?: Json | null
          agent_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          summary?: string | null
          tasks_reviewed?: number | null
          tenant_id: string
          triggered_at?: string
        }
        Update: {
          actions_taken?: Json | null
          agent_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          summary?: string | null
          tasks_reviewed?: number | null
          tenant_id?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "heartbeat_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heartbeat_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      income_payments: {
        Row: {
          amount: number
          client_id: string
          client_name: string
          created_at: string | null
          id: string
          notes: string | null
          payment_month: string
          received_at: string | null
          received_by: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          client_id: string
          client_name: string
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_month: string
          received_at?: string | null
          received_by?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          client_name?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_month?: string
          received_at?: string | null
          received_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_alerts_log: {
        Row: {
          account_id: string | null
          alert_type: string
          fired_at: string
          id: string
          payload: Json
          provider: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          alert_type: string
          fired_at?: string
          id?: string
          payload?: Json
          provider: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          alert_type?: string
          fired_at?: string
          id?: string
          payload?: Json
          provider?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      integration_health: {
        Row: {
          consecutive_failures: number
          cooldown_until: string | null
          id: string
          is_circuit_open: boolean
          last_failure_at: string | null
          last_success_at: string | null
          provider: string
          tenant_id: string
          total_calls: number
          total_failures: number
        }
        Insert: {
          consecutive_failures?: number
          cooldown_until?: string | null
          id?: string
          is_circuit_open?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          provider: string
          tenant_id: string
          total_calls?: number
          total_failures?: number
        }
        Update: {
          consecutive_failures?: number
          cooldown_until?: string | null
          id?: string
          is_circuit_open?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          provider?: string
          tenant_id?: string
          total_calls?: number
          total_failures?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tenant_access: {
        Row: {
          accessing_tenant_id: string
          granted_at: string
          granted_by: string | null
          id: string
          integration_id: string
        }
        Insert: {
          accessing_tenant_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          integration_id: string
        }
        Update: {
          accessing_tenant_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          integration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_tenant_access_accessing_tenant_id_fkey"
            columns: ["accessing_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_tenant_access_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
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
      invoice_uploads: {
        Row: {
          agency_id: string | null
          client_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          error_message: string | null
          file_path: string
          finance_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          mime_type: string | null
          raw_extraction: Json | null
          status: string
          supplier_id: string | null
          tenant_id: string
          total_amount: number | null
          updated_at: string
          uploaded_by: string | null
          vat_amount: number | null
          vendor_name: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          error_message?: string | null
          file_path: string
          finance_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          mime_type?: string | null
          raw_extraction?: Json | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vat_amount?: number | null
          vendor_name?: string | null
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          error_message?: string | null
          file_path?: string
          finance_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          mime_type?: string | null
          raw_extraction?: Json | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vat_amount?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_uploads_finance_id_fkey"
            columns: ["finance_id"]
            isOneToOne: false
            referencedRelation: "finance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_uploads_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_uploads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          locked_until: string | null
          max_attempts: number
          payload: Json
          priority: Database["public"]["Enums"]["job_priority"]
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          locked_until?: string | null
          max_attempts?: number
          payload?: Json
          priority?: Database["public"]["Enums"]["job_priority"]
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          locked_until?: string | null
          max_attempts?: number
          payload?: Json
          priority?: Database["public"]["Enums"]["job_priority"]
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_tenant_id_fkey"
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
      lead_sales_people: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          sales_person_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          sales_person_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          sales_person_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sales_people_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sales_people_sales_person_id_fkey"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "sales_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sales_people_tenant_id_fkey"
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
          attachments: Json
          campaign_name: string | null
          closing_date: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          estimated_deal_value: number | null
          folder_link: string | null
          folder_links: Json
          follow_up_date: string | null
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
          status: string
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
          attachments?: Json
          campaign_name?: string | null
          closing_date?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          estimated_deal_value?: number | null
          folder_link?: string | null
          folder_links?: Json
          follow_up_date?: string | null
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
          status?: string
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
          attachments?: Json
          campaign_name?: string | null
          closing_date?: string | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          estimated_deal_value?: number | null
          folder_link?: string | null
          folder_links?: Json
          follow_up_date?: string | null
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
          status?: string
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
      manus_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          credit_usage: number | null
          id: string
          output: Json | null
          prompt: string
          share_url: string | null
          status: string
          task_id: string
          task_url: string | null
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_usage?: number | null
          id?: string
          output?: Json | null
          prompt: string
          share_url?: string | null
          status?: string
          task_id: string
          task_url?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_usage?: number | null
          id?: string
          output?: Json | null
          prompt?: string
          share_url?: string | null
          status?: string
          task_id?: string
          task_url?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manus_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_item_transitions: {
        Row: {
          created_at: string
          from_stage_id: string | null
          id: string
          item_id: string
          notes: string | null
          tenant_id: string
          to_stage_id: string | null
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          from_stage_id?: string | null
          id?: string
          item_id: string
          notes?: string | null
          tenant_id: string
          to_stage_id?: string | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          from_stage_id?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          tenant_id?: string
          to_stage_id?: string | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_item_transitions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketing_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_pipeline_stages: {
        Row: {
          agent_id: string | null
          approval_mode: Database["public"]["Enums"]["marketing_approval_mode"]
          configuration: Json
          created_at: string
          id: string
          name: string
          parent_stage_id: string | null
          pipeline_id: string
          position_x: number
          position_y: number
          sort_order: number
          stage_type: Database["public"]["Enums"]["marketing_stage_type"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          approval_mode?: Database["public"]["Enums"]["marketing_approval_mode"]
          configuration?: Json
          created_at?: string
          id?: string
          name: string
          parent_stage_id?: string | null
          pipeline_id: string
          position_x?: number
          position_y?: number
          sort_order?: number
          stage_type: Database["public"]["Enums"]["marketing_stage_type"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          approval_mode?: Database["public"]["Enums"]["marketing_approval_mode"]
          configuration?: Json
          created_at?: string
          id?: string
          name?: string
          parent_stage_id?: string | null
          pipeline_id?: string
          position_x?: number
          position_y?: number
          sort_order?: number
          stage_type?: Database["public"]["Enums"]["marketing_stage_type"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_pipeline_stages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_pipeline_stages_parent_stage_id_fkey"
            columns: ["parent_stage_id"]
            isOneToOne: false
            referencedRelation: "marketing_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "marketing_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_pipelines: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          track: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id: string
          track?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          track?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_pipelines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_work_items: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          current_stage_id: string | null
          id: string
          links: Json
          payload: Json
          pipeline_id: string
          scheduled_date: string | null
          status: Database["public"]["Enums"]["marketing_item_status"]
          target_channel: string | null
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          id?: string
          links?: Json
          payload?: Json
          pipeline_id: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["marketing_item_status"]
          target_channel?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          id?: string
          links?: Json
          payload?: Json
          pipeline_id?: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["marketing_item_status"]
          target_channel?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_work_items_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "marketing_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_work_items_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "marketing_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      maskyoo_manual_overrides: {
        Row: {
          answered_count: number | null
          created_at: string
          created_by: string | null
          id: string
          incoming_count: number | null
          maskyoo_last9: string
          note: string | null
          period_days: number
          tenant_id: string
          unique_count: number | null
          updated_at: string
        }
        Insert: {
          answered_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          incoming_count?: number | null
          maskyoo_last9: string
          note?: string | null
          period_days?: number
          tenant_id: string
          unique_count?: number | null
          updated_at?: string
        }
        Update: {
          answered_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          incoming_count?: number | null
          maskyoo_last9?: string
          note?: string | null
          period_days?: number
          tenant_id?: string
          unique_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      maskyoo_numbers: {
        Row: {
          category: string | null
          client_id: string | null
          created_at: string
          display_number: string
          id: string
          is_ignored: boolean
          label: string | null
          phone_last9: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          display_number: string
          id?: string
          is_ignored?: boolean
          label?: string | null
          phone_last9: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          display_number?: string
          id?: string
          is_ignored?: boolean
          label?: string | null
          phone_last9?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maskyoo_numbers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      maskyoo_settings: {
        Row: {
          api_token: string
          base_url: string
          click2call_service: string
          created_at: string
          default_user_phone: string | null
          id: string
          is_active: boolean
          last_cdr_sync_at: string | null
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_token: string
          base_url: string
          click2call_service?: string
          created_at?: string
          default_user_phone?: string | null
          id?: string
          is_active?: boolean
          last_cdr_sync_at?: string | null
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string
          base_url?: string
          click2call_service?: string
          created_at?: string
          default_user_phone?: string | null
          id?: string
          is_active?: boolean
          last_cdr_sync_at?: string | null
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
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
      one_time_incomes: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          expense_amount: number
          id: string
          is_paid: boolean
          notes: string | null
          paid_at: string | null
          payment_month: string
          product_name: string
          supplier_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          expense_amount?: number
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_month: string
          product_name: string
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          expense_amount?: number
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_month?: string
          product_name?: string
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_incomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_incomes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_incomes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          paid_at: string | null
          payment_url: string
          send_email: boolean | null
          status: string | null
          sumit_payment_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payment_url: string
          send_email?: boolean | null
          status?: string | null
          sumit_payment_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payment_url?: string
          send_email?: boolean | null
          status?: string | null
          sumit_payment_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_events: {
        Row: {
          event_key: string
          id: string
          processed_at: string
          tenant_id: string
        }
        Insert: {
          event_key: string
          id?: string
          processed_at?: string
          tenant_id: string
        }
        Update: {
          event_key?: string
          id?: string
          processed_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhook_messages: {
        Row: {
          external_message_id: string
          processed_at: string
          provider: string
          tenant_id: string
        }
        Insert: {
          external_message_id: string
          processed_at?: string
          provider: string
          tenant_id: string
        }
        Update: {
          external_message_id?: string
          processed_at?: string
          provider?: string
          tenant_id?: string
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
          avatar_url: string | null
          calendar_iframe_code: string | null
          campaigner_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notification_group_link: string | null
          phone: string | null
          sales_person_id: string | null
          status: string
          ui_mode: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          calendar_iframe_code?: string | null
          campaigner_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          notification_group_link?: string | null
          phone?: string | null
          sales_person_id?: string | null
          status?: string
          ui_mode?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          calendar_iframe_code?: string | null
          campaigner_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notification_group_link?: string | null
          phone?: string | null
          sales_person_id?: string | null
          status?: string
          ui_mode?: string
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
      rank_tracking_alert_logs: {
        Row: {
          alert_id: string
          id: string
          keyword_id: string | null
          message: string
          new_position: number | null
          old_position: number | null
          triggered_at: string
        }
        Insert: {
          alert_id: string
          id?: string
          keyword_id?: string | null
          message: string
          new_position?: number | null
          old_position?: number | null
          triggered_at?: string
        }
        Update: {
          alert_id?: string
          id?: string
          keyword_id?: string | null
          message?: string
          new_position?: number | null
          old_position?: number | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_alert_logs_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "rank_tracking_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_tracking_alert_logs_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "rank_tracking_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_tracking_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          notify_email: boolean
          notify_whatsapp: boolean
          project_id: string
          threshold: number
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          project_id: string
          threshold?: number
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          project_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "rank_tracking_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_tracking_competitors: {
        Row: {
          created_at: string
          domain: string
          id: string
          name: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          name?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          name?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_competitors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "rank_tracking_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_tracking_history: {
        Row: {
          checked_at: string
          competitors_data: Json | null
          id: string
          keyword_id: string
          position: number | null
          serp_features: Json | null
          url_found: string | null
        }
        Insert: {
          checked_at?: string
          competitors_data?: Json | null
          id?: string
          keyword_id: string
          position?: number | null
          serp_features?: Json | null
          url_found?: string | null
        }
        Update: {
          checked_at?: string
          competitors_data?: Json | null
          id?: string
          keyword_id?: string
          position?: number | null
          serp_features?: Json | null
          url_found?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_history_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "rank_tracking_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_tracking_keywords: {
        Row: {
          best_position: number | null
          created_at: string
          current_position: number | null
          found_url: string | null
          id: string
          is_active: boolean
          keyword: string
          last_checked_at: string | null
          position_change: number | null
          previous_position: number | null
          project_id: string
          search_volume: number | null
          target_url: string | null
          updated_at: string
          worst_position: number | null
        }
        Insert: {
          best_position?: number | null
          created_at?: string
          current_position?: number | null
          found_url?: string | null
          id?: string
          is_active?: boolean
          keyword: string
          last_checked_at?: string | null
          position_change?: number | null
          previous_position?: number | null
          project_id: string
          search_volume?: number | null
          target_url?: string | null
          updated_at?: string
          worst_position?: number | null
        }
        Update: {
          best_position?: number | null
          created_at?: string
          current_position?: number | null
          found_url?: string | null
          id?: string
          is_active?: boolean
          keyword?: string
          last_checked_at?: string | null
          position_change?: number | null
          previous_position?: number | null
          project_id?: string
          search_volume?: number | null
          target_url?: string | null
          updated_at?: string
          worst_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_keywords_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "rank_tracking_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_tracking_projects: {
        Row: {
          agency_id: string | null
          check_frequency: string
          client_id: string | null
          country: string
          created_at: string
          device: string
          domain: string
          id: string
          is_active: boolean
          language: string
          last_checked_at: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          check_frequency?: string
          client_id?: string | null
          country?: string
          created_at?: string
          device?: string
          domain: string
          id?: string
          is_active?: boolean
          language?: string
          last_checked_at?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          check_frequency?: string
          client_id?: string | null
          country?: string
          created_at?: string
          device?: string
          domain?: string
          id?: string
          is_active?: boolean
          language?: string
          last_checked_at?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_projects_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_tracking_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_tracking_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          last_triggered_at: string | null
          last_triggered_data: Json | null
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
          last_triggered_at?: string | null
          last_triggered_data?: Json | null
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
          last_triggered_at?: string | null
          last_triggered_data?: Json | null
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
      seo_call_snapshots: {
        Row: {
          category: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          incoming_count: number
          is_manual: boolean
          note: string | null
          period_end: string
          period_start: string
          synced_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          incoming_count?: number
          is_manual?: boolean
          note?: string | null
          period_end: string
          period_start: string
          synced_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          incoming_count?: number
          is_manual?: boolean
          note?: string | null
          period_end?: string
          period_start?: string
          synced_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_monthly_updates: {
        Row: {
          client_id: string
          created_at: string
          id: string
          month: string
          notes: string | null
          status: Database["public"]["Enums"]["seo_monthly_status"]
          tenant_id: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          status: Database["public"]["Enums"]["seo_monthly_status"]
          tenant_id: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["seo_monthly_status"]
          tenant_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_monthly_updates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_monthly_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_documents: {
        Row: {
          completed_at: string | null
          content: string | null
          created_at: string | null
          created_by: string
          document_type: string
          file_url: string | null
          id: string
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          content?: string | null
          created_at?: string | null
          created_by: string
          document_type?: string
          file_url?: string | null
          id?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string
          document_type?: string
          file_url?: string | null
          id?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_recipients: {
        Row: {
          created_at: string | null
          document_id: string
          email: string
          id: string
          ip_address: string | null
          name: string
          role: string | null
          sign_order: number | null
          sign_token: string | null
          signature_data: string | null
          signature_position: Json | null
          signed_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          email: string
          id?: string
          ip_address?: string | null
          name: string
          role?: string | null
          sign_order?: number | null
          sign_token?: string | null
          signature_data?: string | null
          signature_position?: Json | null
          signed_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          email?: string
          id?: string
          ip_address?: string | null
          name?: string
          role?: string | null
          sign_order?: number | null
          sign_token?: string | null
          signature_data?: string | null
          signature_position?: Json | null
          signed_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_recipients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_events: {
        Row: {
          event_category: string | null
          event_data: Json | null
          event_label: string | null
          event_name: string
          event_value: number | null
          id: string
          occurred_at: string
          page_url: string | null
          session_id: string
          tenant_id: string
          tracking_config_id: string
          visitor_id: string
        }
        Insert: {
          event_category?: string | null
          event_data?: Json | null
          event_label?: string | null
          event_name: string
          event_value?: number | null
          id?: string
          occurred_at?: string
          page_url?: string | null
          session_id: string
          tenant_id: string
          tracking_config_id: string
          visitor_id: string
        }
        Update: {
          event_category?: string | null
          event_data?: Json | null
          event_label?: string | null
          event_name?: string
          event_value?: number | null
          id?: string
          occurred_at?: string
          page_url?: string | null
          session_id?: string
          tenant_id?: string
          tracking_config_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "site_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_events_tracking_config_id_fkey"
            columns: ["tracking_config_id"]
            isOneToOne: false
            referencedRelation: "site_tracking_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_events_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "site_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pageviews: {
        Row: {
          id: string
          left_at: string | null
          page_path: string | null
          page_title: string | null
          page_url: string
          scroll_depth: number | null
          session_id: string
          tenant_id: string
          time_on_page: number | null
          tracking_config_id: string
          viewed_at: string
          visitor_id: string
        }
        Insert: {
          id?: string
          left_at?: string | null
          page_path?: string | null
          page_title?: string | null
          page_url: string
          scroll_depth?: number | null
          session_id: string
          tenant_id: string
          time_on_page?: number | null
          tracking_config_id: string
          viewed_at?: string
          visitor_id: string
        }
        Update: {
          id?: string
          left_at?: string | null
          page_path?: string | null
          page_title?: string | null
          page_url?: string
          scroll_depth?: number | null
          session_id?: string
          tenant_id?: string
          time_on_page?: number | null
          tracking_config_id?: string
          viewed_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_pageviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "site_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_pageviews_tracking_config_id_fkey"
            columns: ["tracking_config_id"]
            isOneToOne: false
            referencedRelation: "site_tracking_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_pageviews_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "site_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      site_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          exit_page: string | null
          id: string
          is_bounce: boolean | null
          landing_page: string | null
          os: string | null
          page_count: number | null
          referrer: string | null
          screen_resolution: string | null
          started_at: string
          tenant_id: string
          tracking_config_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          exit_page?: string | null
          id?: string
          is_bounce?: boolean | null
          landing_page?: string | null
          os?: string | null
          page_count?: number | null
          referrer?: string | null
          screen_resolution?: string | null
          started_at?: string
          tenant_id: string
          tracking_config_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          exit_page?: string | null
          id?: string
          is_bounce?: boolean | null
          landing_page?: string | null
          os?: string | null
          page_count?: number | null
          referrer?: string | null
          screen_resolution?: string | null
          started_at?: string
          tenant_id?: string
          tracking_config_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_sessions_tracking_config_id_fkey"
            columns: ["tracking_config_id"]
            isOneToOne: false
            referencedRelation: "site_tracking_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "site_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      site_tracking_configs: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          settings: Json | null
          tenant_id: string
          tracking_id: string | null
          updated_at: string
          website_domain: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          settings?: Json | null
          tenant_id: string
          tracking_id?: string | null
          updated_at?: string
          website_domain?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          settings?: Json | null
          tenant_id?: string
          tracking_id?: string | null
          updated_at?: string
          website_domain?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_tracking_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visitors: {
        Row: {
          client_id_ref: string | null
          created_at: string
          first_utm: Json | null
          first_visit: string
          id: string
          last_visit: string
          lead_id: string | null
          tenant_id: string
          tracking_config_id: string
          visit_count: number | null
          visitor_fingerprint: string
        }
        Insert: {
          client_id_ref?: string | null
          created_at?: string
          first_utm?: Json | null
          first_visit?: string
          id?: string
          last_visit?: string
          lead_id?: string | null
          tenant_id: string
          tracking_config_id: string
          visit_count?: number | null
          visitor_fingerprint: string
        }
        Update: {
          client_id_ref?: string | null
          created_at?: string
          first_utm?: Json | null
          first_visit?: string
          id?: string
          last_visit?: string
          lead_id?: string | null
          tenant_id?: string
          tracking_config_id?: string
          visit_count?: number | null
          visitor_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visitors_client_id_ref_fkey"
            columns: ["client_id_ref"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visitors_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visitors_tracking_config_id_fkey"
            columns: ["tracking_config_id"]
            isOneToOne: false
            referencedRelation: "site_tracking_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comments: {
        Row: {
          author_id: string | null
          author_name: string | null
          client_id: string | null
          created_at: string
          created_at_external: string | null
          external_comment_id: string
          external_post_id: string | null
          hidden_at: string | null
          id: string
          is_from_page: boolean | null
          message: string | null
          page_id: string | null
          parent_comment_id: string | null
          platform: string
          replied_at: string | null
          reply_text: string | null
          sentiment: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          client_id?: string | null
          created_at?: string
          created_at_external?: string | null
          external_comment_id: string
          external_post_id?: string | null
          hidden_at?: string | null
          id?: string
          is_from_page?: boolean | null
          message?: string | null
          page_id?: string | null
          parent_comment_id?: string | null
          platform: string
          replied_at?: string | null
          reply_text?: string | null
          sentiment?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          client_id?: string | null
          created_at?: string
          created_at_external?: string | null
          external_comment_id?: string
          external_post_id?: string | null
          hidden_at?: string | null
          id?: string
          is_from_page?: boolean | null
          message?: string | null
          page_id?: string | null
          parent_comment_id?: string | null
          platform?: string
          replied_at?: string | null
          reply_text?: string | null
          sentiment?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "social_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      social_gantt_posts: {
        Row: {
          copy_prompt: string | null
          copy_text: string | null
          created_at: string
          creative_prompt: string | null
          creative_url: string | null
          id: string
          notes: string | null
          platform: string
          scheduled_date: string
          status: string
          tenant_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          copy_prompt?: string | null
          copy_text?: string | null
          created_at?: string
          creative_prompt?: string | null
          creative_url?: string | null
          id?: string
          notes?: string | null
          platform: string
          scheduled_date: string
          status?: string
          tenant_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          copy_prompt?: string | null
          copy_text?: string | null
          created_at?: string
          creative_prompt?: string | null
          creative_url?: string | null
          id?: string
          notes?: string | null
          platform?: string
          scheduled_date?: string
          status?: string
          tenant_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_gantt_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_channels: {
        Row: {
          access_token: string | null
          avatar_url: string | null
          channel_id: string | null
          channel_name: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          platform: string
          refresh_token: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          avatar_url?: string | null
          channel_id?: string | null
          channel_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          platform: string
          refresh_token?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          avatar_url?: string | null
          channel_id?: string | null
          channel_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          platform?: string
          refresh_token?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_post_channels: {
        Row: {
          channel_id: string
          created_at: string
          error_message: string | null
          id: string
          platform_post_id: string | null
          post_id: string
          published_at: string | null
          status: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          platform_post_id?: string | null
          post_id: string
          published_at?: string | null
          status?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          platform_post_id?: string | null
          post_id?: string
          published_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_post_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "social_media_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_post_channels_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          media_urls: Json
          metadata: Json
          post_type: string
          publish_to_wordpress: boolean
          published_at: string | null
          scheduled_at: string | null
          status: string
          tenant_id: string
          title: string | null
          updated_at: string
          wordpress_post_id: string | null
          wordpress_site_url: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          media_urls?: Json
          metadata?: Json
          post_type?: string
          publish_to_wordpress?: boolean
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          wordpress_post_id?: string | null
          wordpress_site_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          media_urls?: Json
          metadata?: Json
          post_type?: string
          publish_to_wordpress?: boolean
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          wordpress_post_id?: string | null
          wordpress_site_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_wordpress_sites: {
        Row: {
          agency_id: string | null
          app_password: string
          campaign_form_mapping: Json | null
          campaign_url_mapping: Json | null
          client_id: string | null
          created_at: string
          id: string
          is_active: boolean
          last_woocommerce_sync_at: string | null
          notes: string | null
          site_name: string | null
          site_url: string
          tenant_id: string
          updated_at: string
          username: string
          woo_last_sync_at: string | null
          woo_sync_enabled: boolean
          woocommerce_consumer_key: string | null
          woocommerce_consumer_secret: string | null
          woocommerce_enabled: boolean
        }
        Insert: {
          agency_id?: string | null
          app_password: string
          campaign_form_mapping?: Json | null
          campaign_url_mapping?: Json | null
          client_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_woocommerce_sync_at?: string | null
          notes?: string | null
          site_name?: string | null
          site_url: string
          tenant_id: string
          updated_at?: string
          username: string
          woo_last_sync_at?: string | null
          woo_sync_enabled?: boolean
          woocommerce_consumer_key?: string | null
          woocommerce_consumer_secret?: string | null
          woocommerce_enabled?: boolean
        }
        Update: {
          agency_id?: string | null
          app_password?: string
          campaign_form_mapping?: Json | null
          campaign_url_mapping?: Json | null
          client_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_woocommerce_sync_at?: string | null
          notes?: string | null
          site_name?: string | null
          site_url?: string
          tenant_id?: string
          updated_at?: string
          username?: string
          woo_last_sync_at?: string | null
          woo_sync_enabled?: boolean
          woocommerce_consumer_key?: string | null
          woocommerce_consumer_secret?: string | null
          woocommerce_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "social_media_wordpress_sites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_wordpress_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_wordpress_sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_pages: {
        Row: {
          category: string | null
          client_id: string | null
          created_at: string
          id: string
          ig_business_id: string | null
          is_active: boolean | null
          metadata: Json | null
          page_access_token: string | null
          page_id: string
          page_name: string | null
          picture_url: string | null
          platform: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          ig_business_id?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          page_access_token?: string | null
          page_id: string
          page_name?: string | null
          picture_url?: string | null
          platform: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          ig_business_id?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          page_access_token?: string | null
          page_id?: string
          page_name?: string | null
          picture_url?: string | null
          platform?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_publications: {
        Row: {
          caption: string | null
          client_id: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          media_url: string | null
          page_id: string | null
          permalink: string | null
          platform: string
          post_type: string
          published_at: string | null
          published_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          media_url?: string | null
          page_id?: string | null
          permalink?: string | null
          platform: string
          post_type: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          media_url?: string | null
          page_id?: string | null
          permalink?: string | null
          platform?: string
          post_type?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_publications_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "social_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          ai_extracted: boolean
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          invoice_amount: number
          invoice_date: string | null
          invoice_month: string
          invoice_name: string
          notes: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          ai_extracted?: boolean
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_amount?: number
          invoice_date?: string | null
          invoice_month?: string
          invoice_name?: string
          notes?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          ai_extracted?: boolean
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_amount?: number
          invoice_date?: string | null
          invoice_month?: string
          invoice_name?: string
          notes?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          progress: Json
          settings: Json
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          progress?: Json
          settings?: Json
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          progress?: Json
          settings?: Json
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_shares: {
        Row: {
          allowed_emails: string[] | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          share_token: string
          table_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allowed_emails?: string[] | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          share_token?: string
          table_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allowed_emails?: string[] | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          share_token?: string
          table_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_shares_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "crm_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_shares_tenant_id_fkey"
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
          update_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          task_id: string
          update_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          update_type?: string
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
          assigned_agent: string | null
          attachments: Json
          campaigner_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          goal_id: string | null
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
          assigned_agent?: string | null
          attachments?: Json
          campaigner_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
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
          assigned_agent?: string | null
          attachments?: Json
          campaigner_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
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
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
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
      team_channel_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_invites: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          tenant_id: string
          token: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          tenant_id: string
          token?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_invites_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          notify_enabled: boolean | null
          notify_override_group: string | null
          notify_override_phone: string | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          notify_enabled?: boolean | null
          notify_override_group?: string | null
          notify_override_phone?: string | null
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          notify_enabled?: boolean | null
          notify_override_group?: string | null
          notify_override_phone?: string | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_whatsapp_links: {
        Row: {
          channel_id: string
          client_id: string | null
          created_at: string | null
          created_by: string | null
          display_name: string | null
          forward_files: boolean | null
          id: string
          lead_id: string | null
          tenant_id: string
          whatsapp_chat_id: string | null
          whatsapp_group_id: string | null
        }
        Insert: {
          channel_id: string
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          forward_files?: boolean | null
          id?: string
          lead_id?: string | null
          tenant_id: string
          whatsapp_chat_id?: string | null
          whatsapp_group_id?: string | null
        }
        Update: {
          channel_id?: string
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          forward_files?: boolean | null
          id?: string
          lead_id?: string | null
          tenant_id?: string
          whatsapp_chat_id?: string | null
          whatsapp_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_whatsapp_links_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_whatsapp_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_whatsapp_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_whatsapp_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_whatsapp_links_whatsapp_group_id_fkey"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channels: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          category: string
          category_id: string | null
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_private: boolean | null
          linked_client_id: string | null
          linked_lead_id: string | null
          name: string
          notification_group_link: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          category?: string
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          linked_client_id?: string | null
          linked_lead_id?: string | null
          name: string
          notification_group_link?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          category?: string
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          linked_client_id?: string | null
          linked_lead_id?: string | null
          name?: string
          notification_group_link?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channels_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "team_channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_files: {
        Row: {
          channel_id: string
          client_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          lead_id: string | null
          message_id: string | null
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          channel_id: string
          client_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          channel_id?: string
          client_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          lead_id?: string | null
          message_id?: string | null
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_files_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          linked_client_id: string | null
          linked_lead_id: string | null
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          linked_client_id?: string | null
          linked_lead_id?: string | null
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          linked_client_id?: string | null
          linked_lead_id?: string | null
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_message_attachments_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_message_attachments_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      team_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      team_message_read_status: {
        Row: {
          channel_id: string
          id: string
          last_read_at: string
          last_read_message_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_message_read_status_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_message_read_status_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          attachments: Json | null
          channel_id: string
          content: string
          created_at: string
          id: string
          is_edited: boolean | null
          parent_message_id: string | null
          sender_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean | null
          parent_message_id?: string | null
          sender_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean | null
          parent_message_id?: string | null
          sender_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_state: {
        Row: {
          bot_name: string | null
          bot_username: string | null
          created_at: string
          id: string
          is_active: boolean
          shared_from_state_id: string | null
          tenant_id: string
          update_offset: number
          updated_at: string
        }
        Insert: {
          bot_name?: string | null
          bot_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          shared_from_state_id?: string | null
          tenant_id: string
          update_offset?: number
          updated_at?: string
        }
        Update: {
          bot_name?: string | null
          bot_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          shared_from_state_id?: string | null
          tenant_id?: string
          update_offset?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_state_shared_from_state_id_fkey"
            columns: ["shared_from_state_id"]
            isOneToOne: false
            referencedRelation: "telegram_bot_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_bot_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_messages: {
        Row: {
          chat_id: number
          client_id: string | null
          created_at: string
          direction: string
          id: string
          lead_id: string | null
          raw_update: Json | null
          sender_name: string | null
          sender_username: string | null
          tenant_id: string
          text: string | null
          update_id: number | null
        }
        Insert: {
          chat_id: number
          client_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string | null
          raw_update?: Json | null
          sender_name?: string | null
          sender_username?: string | null
          tenant_id: string
          text?: string | null
          update_id?: number | null
        }
        Update: {
          chat_id?: number
          client_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string | null
          raw_update?: Json | null
          sender_name?: string | null
          sender_username?: string | null
          tenant_id?: string
          text?: string | null
          update_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_settings: {
        Row: {
          auto_record: boolean | null
          created_at: string
          id: string
          personal_phone: string | null
          provider: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          virtual_number: string | null
        }
        Insert: {
          auto_record?: boolean | null
          created_at?: string
          id?: string
          personal_phone?: string | null
          provider?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
          virtual_number?: string | null
        }
        Update: {
          auto_record?: boolean | null
          created_at?: string
          id?: string
          personal_phone?: string | null
          provider?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          virtual_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telephony_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_heartbeat_settings: {
        Row: {
          active_hours_end: number
          active_hours_start: number
          allowed_actions: Json
          enabled: boolean
          interval_hours: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active_hours_end?: number
          active_hours_start?: number
          allowed_actions?: Json
          enabled?: boolean
          interval_hours?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active_hours_end?: number
          active_hours_start?: number
          allowed_actions?: Json
          enabled?: boolean
          interval_hours?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_heartbeat_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
          display_name: string | null
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
          display_name?: string | null
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
          display_name?: string | null
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
      tenant_rate_limits: {
        Row: {
          current_count: number
          id: string
          max_per_minute: number
          resource_type: string
          tenant_id: string
          window_start: string
        }
        Insert: {
          current_count?: number
          id?: string
          max_per_minute?: number
          resource_type: string
          tenant_id: string
          window_start?: string
        }
        Update: {
          current_count?: number
          id?: string
          max_per_minute?: number
          resource_type?: string
          tenant_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_rate_limits_tenant_id_fkey"
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
      terminology_presets: {
        Row: {
          created_at: string | null
          created_by_tenant_id: string | null
          created_by_user_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          terms: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_tenant_id?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          terms: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_tenant_id?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          terms?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminology_presets_created_by_tenant_id_fkey"
            columns: ["created_by_tenant_id"]
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
        Relationships: [
          {
            foreignKeyName: "user_active_tenant_tenant_id_fkey"
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
      user_workspace_layout: {
        Row: {
          created_at: string
          height: number
          id: string
          is_open: boolean
          module_id: string
          tenant_id: string
          updated_at: string
          user_id: string
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          is_open?: boolean
          module_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          is_open?: boolean
          module_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          agency_id: string | null
          created_at: string
          description: string | null
          group_chat_id: string
          group_name: string
          id: string
          invite_link: string | null
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
          invite_link?: string | null
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
          invite_link?: string | null
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
      whatsapp_sessions: {
        Row: {
          chat_id: string
          conversation_history: Json | null
          created_at: string | null
          id: string
          last_message_at: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          chat_id: string
          conversation_history?: Json | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          chat_id?: string
          conversation_history?: Json | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      woocommerce_customers: {
        Row: {
          avatar_url: string | null
          billing: Json | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          orders_count: number | null
          raw_data: Json | null
          role: string | null
          shipping: Json | null
          site_id: string
          synced_at: string | null
          tenant_id: string
          total_spent: number | null
          updated_at: string | null
          username: string | null
          woo_customer_id: number
        }
        Insert: {
          avatar_url?: string | null
          billing?: Json | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          orders_count?: number | null
          raw_data?: Json | null
          role?: string | null
          shipping?: Json | null
          site_id: string
          synced_at?: string | null
          tenant_id: string
          total_spent?: number | null
          updated_at?: string | null
          username?: string | null
          woo_customer_id: number
        }
        Update: {
          avatar_url?: string | null
          billing?: Json | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          orders_count?: number | null
          raw_data?: Json | null
          role?: string | null
          shipping?: Json | null
          site_id?: string
          synced_at?: string | null
          tenant_id?: string
          total_spent?: number | null
          updated_at?: string | null
          username?: string | null
          woo_customer_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_customers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "social_media_wordpress_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woocommerce_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_orders: {
        Row: {
          billing: Json | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_id: number | null
          customer_last_name: string | null
          customer_phone: string | null
          date_completed: string | null
          date_created: string | null
          date_modified: string | null
          date_paid: string | null
          discount_total: number | null
          id: string
          line_items: Json | null
          order_number: string | null
          payment_method: string | null
          payment_method_title: string | null
          raw_data: Json | null
          shipping: Json | null
          shipping_total: number | null
          site_id: string
          status: string | null
          subtotal: number | null
          synced_at: string | null
          tenant_id: string
          total: number | null
          total_tax: number | null
          updated_at: string | null
          woo_order_id: number
        }
        Insert: {
          billing?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number | null
          customer_last_name?: string | null
          customer_phone?: string | null
          date_completed?: string | null
          date_created?: string | null
          date_modified?: string | null
          date_paid?: string | null
          discount_total?: number | null
          id?: string
          line_items?: Json | null
          order_number?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          raw_data?: Json | null
          shipping?: Json | null
          shipping_total?: number | null
          site_id: string
          status?: string | null
          subtotal?: number | null
          synced_at?: string | null
          tenant_id: string
          total?: number | null
          total_tax?: number | null
          updated_at?: string | null
          woo_order_id: number
        }
        Update: {
          billing?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number | null
          customer_last_name?: string | null
          customer_phone?: string | null
          date_completed?: string | null
          date_created?: string | null
          date_modified?: string | null
          date_paid?: string | null
          discount_total?: number | null
          id?: string
          line_items?: Json | null
          order_number?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          raw_data?: Json | null
          shipping?: Json | null
          shipping_total?: number | null
          site_id?: string
          status?: string | null
          subtotal?: number | null
          synced_at?: string | null
          tenant_id?: string
          total?: number | null
          total_tax?: number | null
          updated_at?: string | null
          woo_order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "social_media_wordpress_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woocommerce_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_products: {
        Row: {
          categories: Json | null
          created_at: string | null
          id: string
          images: Json | null
          name: string | null
          price: number | null
          raw_data: Json | null
          regular_price: number | null
          sale_price: number | null
          site_id: string
          sku: string | null
          slug: string | null
          status: string | null
          stock_quantity: number | null
          stock_status: string | null
          synced_at: string | null
          tenant_id: string
          total_sales: number | null
          type: string | null
          updated_at: string | null
          woo_product_id: number
        }
        Insert: {
          categories?: Json | null
          created_at?: string | null
          id?: string
          images?: Json | null
          name?: string | null
          price?: number | null
          raw_data?: Json | null
          regular_price?: number | null
          sale_price?: number | null
          site_id: string
          sku?: string | null
          slug?: string | null
          status?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          synced_at?: string | null
          tenant_id: string
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
          woo_product_id: number
        }
        Update: {
          categories?: Json | null
          created_at?: string | null
          id?: string
          images?: Json | null
          name?: string | null
          price?: number | null
          raw_data?: Json | null
          regular_price?: number | null
          sale_price?: number | null
          site_id?: string
          sku?: string | null
          slug?: string | null
          status?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          synced_at?: string | null
          tenant_id?: string
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
          woo_product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_products_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "social_media_wordpress_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woocommerce_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_sync_log: {
        Row: {
          customers_synced: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          orders_synced: number | null
          products_synced: number | null
          site_id: string
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          customers_synced?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          orders_synced?: number | null
          products_synced?: number | null
          site_id: string
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          customers_synced?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          orders_synced?: number | null
          products_synced?: number | null
          site_id?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_sync_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "social_media_wordpress_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woocommerce_sync_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_recordings: {
        Row: {
          client_id: string | null
          created_at: string
          duration: number | null
          file_path: string | null
          file_size: number | null
          host_email: string | null
          id: string
          lead_id: string | null
          meeting_id: string
          meeting_topic: string | null
          notes: string | null
          recording_password: string | null
          recording_type: string | null
          recording_url: string | null
          source: string
          start_time: string | null
          summary_file_url: string | null
          tenant_id: string
          transcription: string | null
          transcription_error: string | null
          transcription_status: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration?: number | null
          file_path?: string | null
          file_size?: number | null
          host_email?: string | null
          id?: string
          lead_id?: string | null
          meeting_id: string
          meeting_topic?: string | null
          notes?: string | null
          recording_password?: string | null
          recording_type?: string | null
          recording_url?: string | null
          source?: string
          start_time?: string | null
          summary_file_url?: string | null
          tenant_id: string
          transcription?: string | null
          transcription_error?: string | null
          transcription_status?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration?: number | null
          file_path?: string | null
          file_size?: number | null
          host_email?: string | null
          id?: string
          lead_id?: string | null
          meeting_id?: string
          meeting_topic?: string | null
          notes?: string | null
          recording_password?: string | null
          recording_type?: string | null
          recording_url?: string | null
          source?: string
          start_time?: string | null
          summary_file_url?: string | null
          tenant_id?: string
          transcription?: string | null
          transcription_error?: string | null
          transcription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_recordings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_recordings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_recordings_tenant_id_fkey"
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
      can_view_cross_tenant_campaigner: {
        Args: { _campaigner_id: string; _user_id?: string }
        Returns: boolean
      }
      carmen_memory_decay_episodes: {
        Args: { p_lambda?: number }
        Returns: number
      }
      check_circuit_breaker: {
        Args: { p_provider: string; p_tenant_id: string }
        Returns: boolean
      }
      check_idempotency: {
        Args: { p_event_key: string; p_tenant_id: string }
        Returns: boolean
      }
      check_rate_limit:
        | {
            Args: { p_resource_type: string; p_tenant_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_default_max?: number
              p_resource_type: string
              p_tenant_id: string
            }
            Returns: boolean
          }
      claim_next_job: {
        Args: { p_job_types?: string[] }
        Returns: {
          attempts: number
          id: string
          job_type: string
          max_attempts: number
          payload: Json
          priority: number
          tenant_id: string
        }[]
      }
      cleanup_old_events: { Args: never; Returns: number }
      cleanup_old_jobs: { Args: never; Returns: number }
      complete_job: {
        Args: { p_error?: string; p_job_id: string; p_success: boolean }
        Returns: undefined
      }
      copy_custom_fields_to_tenant: {
        Args: { _source_tenant_id: string; _target_tenant_id: string }
        Returns: undefined
      }
      copy_tenant_template: {
        Args: { _source_tenant_id: string; _target_tenant_id: string }
        Returns: undefined
      }
      count_leads_by_tags: {
        Args: {
          p_agency_ids?: string[]
          p_tag_ids: string[]
          p_tenant_id: string
        }
        Returns: number
      }
      create_client_with_assignment: {
        Args: {
          p_agency_id: string
          p_contact_name?: string
          p_email?: string
          p_folder_link?: string
          p_google_ads_account_id?: string
          p_is_seo_client?: boolean
          p_meta_ads_account_id?: string
          p_monthly_budget?: number
          p_name: string
          p_notes?: string
          p_phone?: string
          p_retainer?: number
          p_services?: string[]
          p_tenant_id: string
          p_website?: string
        }
        Returns: string
      }
      decline_signature_by_token: { Args: { _token: string }; Returns: Json }
      enqueue_job: {
        Args: {
          p_job_type: string
          p_max_attempts?: number
          p_payload?: Json
          p_priority?: number
          p_tenant_id: string
        }
        Returns: string
      }
      find_campaign_tables: {
        Args: { p_client_ids: string[] }
        Returns: {
          client_id: string
          name: string
          slug: string
          table_id: string
        }[]
      }
      generate_tracking_id: { Args: never; Returns: string }
      get_channel_invite_by_token: { Args: { _token: string }; Returns: Json }
      get_chat_contacts: {
        Args: {
          p_connection_user_ids: string[]
          p_provider: Database["public"]["Enums"]["chat_provider"]
          p_tenant_id: string
        }
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
          sender_phone: string
          unread_count: number
          whatsapp_avatar_url: string
        }[]
      }
      get_client_tenant_id: { Args: { _client_id: string }; Returns: string }
      get_cron_job_history: {
        Args: { p_jobid: number; p_limit?: number }
        Returns: {
          duration_ms: number
          end_time: string
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      get_cross_tenant_campaigner_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_effective_setting: {
        Args: { _setting_key: string; _tenant_id: string }
        Returns: Json
      }
      get_effective_tenant_id: { Args: never; Returns: string }
      get_lead_visitor_journey: {
        Args: { p_lead_id: string }
        Returns: {
          device_type: string
          duration_seconds: number
          events: Json
          landing_page: string
          page_count: number
          pages: Json
          referrer: string
          session_id: string
          started_at: string
          utm_campaign: string
          utm_medium: string
          utm_source: string
        }[]
      }
      get_leads_by_stages: {
        Args: {
          p_agency_ids?: string[]
          p_end_date?: string
          p_follow_up_today?: boolean
          p_from_date?: string
          p_limit_per_stage?: number
          p_offset_per_stage?: number
          p_response_statuses?: string[]
          p_sales_person_ids?: string[]
          p_search_query?: string
          p_stages?: string[]
          p_start_date?: string
          p_tag_ids?: string[]
          p_tenant_id: string
          p_to_date?: string
        }
        Returns: Json
      }
      get_leads_by_tags: {
        Args: {
          p_agency_ids?: string[]
          p_limit?: number
          p_offset?: number
          p_tag_ids: string[]
          p_tenant_id: string
        }
        Returns: {
          active_chat_provider:
            | Database["public"]["Enums"]["chat_provider"]
            | null
          agency_id: string | null
          attachments: Json
          campaign_name: string | null
          closing_date: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          estimated_deal_value: number | null
          folder_link: string | null
          folder_links: Json
          follow_up_date: string | null
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
          status: string
          tenant_id: string | null
          three_month_budget: number | null
          updated_at: string
          whatsapp_avatar_url: string | null
          won_date: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_signature_by_token: { Args: { _token: string }; Returns: Json }
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
      increment_skill_usage: {
        Args: { skill_ids: string[] }
        Returns: undefined
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
      initialize_tenant_pipeline_stages: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      initialize_tenant_terminology: {
        Args: { _business_type?: string; _tenant_id: string }
        Returns: undefined
      }
      initialize_tenant_terminology_from_preset: {
        Args: { _preset_id: string; _tenant_id: string }
        Returns: undefined
      }
      is_automation_shared_to_tenant: {
        Args: { _automation_id: string; _tenant_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: boolean
      }
      is_root_tenant: { Args: { tenant_id: string }; Returns: boolean }
      is_seo_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_admin_of_automation_source_tenant: {
        Args: { _automation_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_in_automation_source_tenant: {
        Args: { _automation_id: string; _user_id: string }
        Returns: boolean
      }
      kb_match_pointers: {
        Args: {
          p_category?: string
          p_limit?: number
          p_query_embedding: string
          p_since_days?: number
          p_tenant_id: string
        }
        Returns: {
          category: string
          entity_id: string
          entity_type: string
          id: string
          path: string
          ref_date: string
          similarity: number
          subcategory: string
          summary: string
          title: string
        }[]
      }
      link_visitor_to_lead: {
        Args: {
          p_lead_id: string
          p_tracking_id: string
          p_visitor_fingerprint: string
        }
        Returns: string
      }
      list_system_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          fail_count_7d: number
          jobid: number
          jobname: string
          last_duration_ms: number
          last_return_message: string
          last_run_at: string
          last_status: string
          schedule: string
          success_count_7d: number
        }[]
      }
      mark_all_chats_read: { Args: { p_tenant_id: string }; Returns: number }
      match_agent_memory: {
        Args: {
          p_agent_id: string
          p_limit?: number
          p_query_embedding: string
        }
        Returns: {
          category: string
          id: string
          importance: number
          similarity: number
          summary: string
          title: string
        }[]
      }
      record_integration_failure: {
        Args: { p_provider: string; p_tenant_id: string }
        Returns: undefined
      }
      record_integration_result: {
        Args: {
          p_cooldown_minutes?: number
          p_failure_threshold?: number
          p_provider: string
          p_success: boolean
          p_tenant_id: string
        }
        Returns: undefined
      }
      record_integration_success: {
        Args: { p_provider: string; p_tenant_id: string }
        Returns: undefined
      }
      run_system_cron_job_now: { Args: { p_jobid: number }; Returns: string }
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
      submit_signature_by_token: {
        Args: { _ip?: string; _signature_data: string; _token: string }
        Returns: Json
      }
      update_system_cron_job: {
        Args: { p_active?: boolean; p_jobid: number; p_schedule?: string }
        Returns: undefined
      }
      user_can_access_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_crm_table: {
        Args: { _table_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_campaigner: {
        Args: { _campaigner_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_calendar_access: {
        Args: {
          _accessor_user_id: string
          _owner_user_id: string
          _required_permission?: string
        }
        Returns: boolean
      }
      user_has_cross_tenant_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_cross_tenant_client_access: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_cross_tenant_integration_access: {
        Args: { _integration_tenant_id: string; _user_id: string }
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
      user_is_restricted_client_viewer: {
        Args: { _user_id: string }
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
      agent_memory_layer: "working" | "episodic" | "semantic" | "user_model"
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
        | "create_task"
        | "create_lead"
        | "send_telegram"
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
        | "inbound_webhook_task"
        | "inbound_webhook_lead"
        | "manual_command"
        | "whatsapp_message_received"
        | "carmen_whatsapp_session"
        | "telegram_message_received"
        | "account_stopped_spending"
        | "ad_account_billing_issue"
        | "ad_account_blocked"
        | "integration_disconnected"
      chat_provider: "manychat" | "green_api" | "internal" | "manus_wa"
      client_mood_status:
        | "happy"
        | "wavering"
        | "churn_risk"
        | "not_progressing"
      client_status: "active" | "paused" | "ended" | "onboarding"
      client_tier: "A" | "B" | "C"
      communication_status: "normal" | "sensitive" | "complaint"
      finance_type: "income" | "expense"
      interaction_type:
        | "client_initiated"
        | "campaigner_initiated"
        | "call"
        | "whatsapp"
        | "meeting"
        | "other"
        | "system_alert"
      job_priority: "critical" | "high" | "medium" | "low"
      job_status: "queued" | "running" | "done" | "failed" | "dead_letter"
      job_type: "user_action" | "workflow" | "integration" | "heavy_job"
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
      marketing_approval_mode: "manual" | "auto" | "hybrid"
      marketing_item_status:
        | "draft"
        | "in_progress"
        | "waiting_approval"
        | "approved"
        | "published"
        | "failed"
        | "archived"
      marketing_stage_type:
        | "strategy"
        | "copy"
        | "creative"
        | "target_paid"
        | "target_seo"
        | "target_organic"
        | "measurement"
      onboarding_status:
        | "research_meeting"
        | "receiving_access"
        | "setup_and_content"
        | "campaign_live"
      org_type: "root" | "organization" | "sub_organization"
      payment_method: "cash" | "card" | "wire" | "check"
      priority_level: "high" | "medium" | "low"
      seo_monthly_status: "up" | "stable" | "down"
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
      agent_memory_layer: ["working", "episodic", "semantic", "user_model"],
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
        "create_task",
        "create_lead",
        "send_telegram",
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
        "inbound_webhook_task",
        "inbound_webhook_lead",
        "manual_command",
        "whatsapp_message_received",
        "carmen_whatsapp_session",
        "telegram_message_received",
        "account_stopped_spending",
        "ad_account_billing_issue",
        "ad_account_blocked",
        "integration_disconnected",
      ],
      chat_provider: ["manychat", "green_api", "internal", "manus_wa"],
      client_mood_status: [
        "happy",
        "wavering",
        "churn_risk",
        "not_progressing",
      ],
      client_status: ["active", "paused", "ended", "onboarding"],
      client_tier: ["A", "B", "C"],
      communication_status: ["normal", "sensitive", "complaint"],
      finance_type: ["income", "expense"],
      interaction_type: [
        "client_initiated",
        "campaigner_initiated",
        "call",
        "whatsapp",
        "meeting",
        "other",
        "system_alert",
      ],
      job_priority: ["critical", "high", "medium", "low"],
      job_status: ["queued", "running", "done", "failed", "dead_letter"],
      job_type: ["user_action", "workflow", "integration", "heavy_job"],
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
      marketing_approval_mode: ["manual", "auto", "hybrid"],
      marketing_item_status: [
        "draft",
        "in_progress",
        "waiting_approval",
        "approved",
        "published",
        "failed",
        "archived",
      ],
      marketing_stage_type: [
        "strategy",
        "copy",
        "creative",
        "target_paid",
        "target_seo",
        "target_organic",
        "measurement",
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
      seo_monthly_status: ["up", "stable", "down"],
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
