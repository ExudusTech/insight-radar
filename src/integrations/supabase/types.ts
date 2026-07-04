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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          mission_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mission_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mission_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          analyst_id: string
          block: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          mission_id: string
          role: string
          session_id: string | null
          target_id: string | null
          time_spent_seconds: number | null
        }
        Insert: {
          analyst_id: string
          block: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mission_id: string
          role: string
          session_id?: string | null
          target_id?: string | null
          time_spent_seconds?: number | null
        }
        Update: {
          analyst_id?: string
          block?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mission_id?: string
          role?: string
          session_id?: string | null
          target_id?: string | null
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          affects_deadline: boolean
          affects_deliverables: boolean
          affects_evidences: boolean
          affects_questionnaire: boolean
          affects_targets: boolean
          approved_at: string | null
          approved_by: string | null
          change_type: string | null
          created_at: string
          description: string
          estimated_impact: string | null
          id: string
          justification: string | null
          mission_id: string
          observations: string | null
          requestor_id: string | null
          status: Database["public"]["Enums"]["change_request_status"]
        }
        Insert: {
          affects_deadline?: boolean
          affects_deliverables?: boolean
          affects_evidences?: boolean
          affects_questionnaire?: boolean
          affects_targets?: boolean
          approved_at?: string | null
          approved_by?: string | null
          change_type?: string | null
          created_at?: string
          description: string
          estimated_impact?: string | null
          id?: string
          justification?: string | null
          mission_id: string
          observations?: string | null
          requestor_id?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Update: {
          affects_deadline?: boolean
          affects_deliverables?: boolean
          affects_evidences?: boolean
          affects_questionnaire?: boolean
          affects_targets?: boolean
          approved_at?: string | null
          approved_by?: string | null
          change_type?: string | null
          created_at?: string
          description?: string
          estimated_impact?: string | null
          id?: string
          justification?: string | null
          mission_id?: string
          observations?: string | null
          requestor_id?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_requestor_id_fkey"
            columns: ["requestor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_data: {
        Row: {
          block: Database["public"]["Enums"]["collection_block"]
          field_key: string
          field_value: Json | null
          id: string
          mission_id: string
          target_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block: Database["public"]["Enums"]["collection_block"]
          field_key: string
          field_value?: Json | null
          id?: string
          mission_id: string
          target_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block?: Database["public"]["Enums"]["collection_block"]
          field_key?: string
          field_value?: Json | null
          id?: string
          mission_id?: string
          target_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_data_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_data_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_data_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coordination_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          mission_id: string
          read_at: string | null
          receiver_id: string | null
          sender_id: string | null
          target_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mission_id: string
          read_at?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          target_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mission_id?: string
          read_at?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coordination_messages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordination_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordination_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordination_messages_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          author_id: string | null
          change_summary: string | null
          created_at: string
          doc_label: string | null
          doc_type: string
          extracted_data: Json | null
          file_name: string | null
          file_url: string | null
          id: string
          mission_id: string
          reason: string | null
          status: Database["public"]["Enums"]["doc_version_status"]
          version_number: number
        }
        Insert: {
          author_id?: string | null
          change_summary?: string | null
          created_at?: string
          doc_label?: string | null
          doc_type?: string
          extracted_data?: Json | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          mission_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["doc_version_status"]
          version_number: number
        }
        Update: {
          author_id?: string | null
          change_summary?: string | null
          created_at?: string
          doc_label?: string | null
          doc_type?: string
          extracted_data?: Json | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          mission_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["doc_version_status"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          caption: string | null
          captured_at: string | null
          created_at: string
          created_by: string | null
          drive_url: string | null
          evidence_type: string
          file_url: string | null
          id: string
          interaction_id: string | null
          mission_id: string
          synced_at: string | null
          tags: string[] | null
          target_id: string
        }
        Insert: {
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          evidence_type: string
          file_url?: string | null
          id?: string
          interaction_id?: string | null
          mission_id: string
          synced_at?: string | null
          tags?: string[] | null
          target_id: string
        }
        Update: {
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          evidence_type?: string
          file_url?: string | null
          id?: string
          interaction_id?: string | null
          mission_id?: string
          synced_at?: string | null
          tags?: string[] | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          attachments: Json
          channel: string | null
          content: string | null
          created_at: string
          created_by: string | null
          event_at: string
          event_type: string
          id: string
          mission_id: string
          next_action: string | null
          status_after: string | null
          target_id: string
        }
        Insert: {
          attachments?: Json
          channel?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          event_at: string
          event_type: string
          id?: string
          mission_id: string
          next_action?: string | null
          status_after?: string | null
          target_id: string
        }
        Update: {
          attachments?: Json
          channel?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          event_at?: string
          event_type?: string
          id?: string
          mission_id?: string
          next_action?: string | null
          status_after?: string | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage_logs: {
        Row: {
          created_at: string
          estimated_cost_usd: number
          id: string
          input_tokens: number
          mission_id: string | null
          model: string
          output_tokens: number
          provider: string
          target_id: string | null
          task: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          mission_id?: string | null
          model: string
          output_tokens?: number
          provider: string
          target_id?: string | null
          task: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          mission_id?: string | null
          model?: string
          output_tokens?: number
          provider?: string
          target_id?: string | null
          task?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_logs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_usage_logs_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_analysts: {
        Row: {
          analyst_id: string
          assigned_at: string
          mission_id: string
        }
        Insert: {
          analyst_id: string
          assigned_at?: string
          mission_id: string
        }
        Update: {
          analyst_id?: string
          assigned_at?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_analysts_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_analysts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_contractors: {
        Row: {
          assigned_at: string
          contractor_id: string
          mission_id: string
        }
        Insert: {
          assigned_at?: string
          contractor_id: string
          mission_id: string
        }
        Update: {
          assigned_at?: string
          contractor_id?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_contractors_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_contractors_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          approach_type: string | null
          canais_obrigatorios: string[] | null
          cobertura_canais: string | null
          completion_criteria: string | null
          contractor_id: string | null
          created_at: string
          created_by: string | null
          deadline_final: string | null
          deadline_first: string | null
          description: string | null
          drive_folder_id: string | null
          entregavel_esperado: string | null
          ethical_rules: string | null
          expected_deliverables: string | null
          forbidden_items: string | null
          id: string
          name: string
          objective: string | null
          product_id: string | null
          profundidade_autorizada: string | null
          proposal_from: string | null
          proposed_deadline_final: string | null
          proposed_deadline_partial: string | null
          responsible_id: string | null
          restricoes: string | null
          segment: string | null
          status: Database["public"]["Enums"]["mission_status"]
          target_label: string
          updated_at: string
        }
        Insert: {
          approach_type?: string | null
          canais_obrigatorios?: string[] | null
          cobertura_canais?: string | null
          completion_criteria?: string | null
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline_final?: string | null
          deadline_first?: string | null
          description?: string | null
          drive_folder_id?: string | null
          entregavel_esperado?: string | null
          ethical_rules?: string | null
          expected_deliverables?: string | null
          forbidden_items?: string | null
          id?: string
          name: string
          objective?: string | null
          product_id?: string | null
          profundidade_autorizada?: string | null
          proposal_from?: string | null
          proposed_deadline_final?: string | null
          proposed_deadline_partial?: string | null
          responsible_id?: string | null
          restricoes?: string | null
          segment?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          target_label?: string
          updated_at?: string
        }
        Update: {
          approach_type?: string | null
          canais_obrigatorios?: string[] | null
          cobertura_canais?: string | null
          completion_criteria?: string | null
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline_final?: string | null
          deadline_first?: string | null
          description?: string | null
          drive_folder_id?: string | null
          entregavel_esperado?: string | null
          ethical_rules?: string | null
          expected_deliverables?: string | null
          forbidden_items?: string | null
          id?: string
          name?: string
          objective?: string | null
          product_id?: string | null
          profundidade_autorizada?: string | null
          proposal_from?: string | null
          proposed_deadline_final?: string | null
          proposed_deadline_partial?: string | null
          responsible_id?: string | null
          restricoes?: string | null
          segment?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          target_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          block: string | null
          created_at: string
          id: string
          message: string
          mission_id: string | null
          origin_user_id: string | null
          read_at: string | null
          target_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          block?: string | null
          created_at?: string
          id?: string
          message: string
          mission_id?: string | null
          origin_user_id?: string | null
          read_at?: string | null
          target_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          block?: string | null
          created_at?: string
          id?: string
          message?: string
          mission_id?: string | null
          origin_user_id?: string | null
          read_at?: string | null
          target_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_origin_user_id_fkey"
            columns: ["origin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          segment: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          segment?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          segment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_missions: boolean
          avatar_url: string | null
          can_view_strategic: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          organization: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          accepts_missions?: boolean
          avatar_url?: string | null
          can_view_strategic?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          organization?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          accepts_missions?: boolean
          avatar_url?: string | null
          can_view_strategic?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: Json | null
          generated_at: string
          id: string
          mission_id: string
          pdf_url: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          status: Database["public"]["Enums"]["report_status"]
          target_id: string | null
        }
        Insert: {
          content?: Json | null
          generated_at?: string
          id?: string
          mission_id: string
          pdf_url?: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
        }
        Update: {
          content?: Json | null
          generated_at?: string
          id?: string
          mission_id?: string
          pdf_url?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_documents: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_published: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      target_gaps: {
        Row: {
          block_key: string
          id: string
          missing_fields: string[]
          mission_id: string
          suggestion: string | null
          target_id: string
          updated_at: string
        }
        Insert: {
          block_key: string
          id?: string
          missing_fields?: string[]
          mission_id: string
          suggestion?: string | null
          target_id: string
          updated_at?: string
        }
        Update: {
          block_key?: string
          id?: string
          missing_fields?: string[]
          mission_id?: string
          suggestion?: string | null
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_gaps_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_gaps_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      target_timeline_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_date: string
          event_type: string
          evidence_id: string | null
          id: string
          mission_id: string
          source: string
          target_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_date?: string
          event_type: string
          evidence_id?: string | null
          id?: string
          mission_id: string
          source?: string
          target_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string
          event_type?: string
          evidence_id?: string | null
          id?: string
          mission_id?: string
          source?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_timeline_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_timeline_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_timeline_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          analyst_id: string | null
          brand: string | null
          canal_abordagem: string | null
          category: string | null
          created_at: string
          drive_folder_id: string | null
          email: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          mission_id: string
          name: string
          notes: string | null
          other_links: string | null
          persona_lead: Json
          priority: Database["public"]["Enums"]["target_priority"]
          progress: number
          site: string | null
          status: Database["public"]["Enums"]["target_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          analyst_id?: string | null
          brand?: string | null
          canal_abordagem?: string | null
          category?: string | null
          created_at?: string
          drive_folder_id?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          mission_id: string
          name: string
          notes?: string | null
          other_links?: string | null
          persona_lead?: Json
          priority?: Database["public"]["Enums"]["target_priority"]
          progress?: number
          site?: string | null
          status?: Database["public"]["Enums"]["target_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          analyst_id?: string | null
          brand?: string | null
          canal_abordagem?: string | null
          category?: string | null
          created_at?: string
          drive_folder_id?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          mission_id?: string
          name?: string
          notes?: string | null
          other_links?: string | null
          persona_lead?: Json
          priority?: Database["public"]["Enums"]["target_priority"]
          progress?: number
          site?: string | null
          status?: Database["public"]["Enums"]["target_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targets_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
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
      analyst_time_metrics: {
        Row: {
          analyst_id: string | null
          analyst_name: string | null
          first_interaction: string | null
          last_interaction: string | null
          mission_id: string | null
          mission_name: string | null
          target_id: string | null
          target_name: string | null
          total_hours_active: number | null
          total_messages: number | null
          total_seconds_active: number | null
          total_user_messages: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_mission: { Args: { _mission_id: string }; Returns: boolean }
      can_read_mission: { Args: { _mission_id: string }; Returns: boolean }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mission_contractor: { Args: { _mission_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      shares_mission_with: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superadmin" | "contractor" | "analyst" | "coordinator"
      change_request_status:
        | "requested"
        | "analyzing"
        | "approved"
        | "rejected"
        | "applied"
        | "cancelled"
      collection_block: "A" | "B" | "C" | "D" | "E" | "F" | "G"
      doc_version_status:
        | "draft"
        | "reviewing"
        | "approved"
        | "rejected"
        | "replaced"
        | "frozen"
      mission_status:
        | "draft"
        | "in_review"
        | "awaiting_approval"
        | "approved"
        | "execution_started"
        | "in_collection"
        | "in_analysis"
        | "report_review"
        | "delivered"
        | "closed"
        | "paused"
        | "cancelled"
        | "pending_acceptance"
        | "date_negotiation"
      profile_status: "active" | "inactive" | "pending" | "blocked"
      report_status:
        | "draft"
        | "generated"
        | "reviewing"
        | "approved"
        | "delivered"
      report_type: "individual" | "comparative" | "strategic"
      target_priority: "high" | "medium" | "low"
      target_status:
        | "not_started"
        | "public_research"
        | "first_contact_sent"
        | "awaiting_response"
        | "in_conversation"
        | "call_scheduled"
        | "call_done"
        | "proposal_received"
        | "price_identified"
        | "collection_complete"
        | "incomplete"
        | "discarded"
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
      app_role: ["superadmin", "contractor", "analyst", "coordinator"],
      change_request_status: [
        "requested",
        "analyzing",
        "approved",
        "rejected",
        "applied",
        "cancelled",
      ],
      collection_block: ["A", "B", "C", "D", "E", "F", "G"],
      doc_version_status: [
        "draft",
        "reviewing",
        "approved",
        "rejected",
        "replaced",
        "frozen",
      ],
      mission_status: [
        "draft",
        "in_review",
        "awaiting_approval",
        "approved",
        "execution_started",
        "in_collection",
        "in_analysis",
        "report_review",
        "delivered",
        "closed",
        "paused",
        "cancelled",
        "pending_acceptance",
        "date_negotiation",
      ],
      profile_status: ["active", "inactive", "pending", "blocked"],
      report_status: [
        "draft",
        "generated",
        "reviewing",
        "approved",
        "delivered",
      ],
      report_type: ["individual", "comparative", "strategic"],
      target_priority: ["high", "medium", "low"],
      target_status: [
        "not_started",
        "public_research",
        "first_contact_sent",
        "awaiting_response",
        "in_conversation",
        "call_scheduled",
        "call_done",
        "proposal_received",
        "price_identified",
        "collection_complete",
        "incomplete",
        "discarded",
      ],
    },
  },
} as const
