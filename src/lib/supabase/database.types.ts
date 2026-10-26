/**
 * Hand-written Supabase `Database` type, matching `supabase/migrations/0001_init_schema.sql`.
 *
 * This is written in the same shape the Supabase CLI's `supabase gen types typescript`
 * command produces, so once a real project exists this file can be regenerated with:
 *
 *   npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
 *
 * Until then, keep this file in sync with the SQL migrations by hand.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          industry: string;
          timezone: string;
          phone: string | null;
          email: string | null;
          website: string | null;
          city: string | null;
          province: string | null;
          postal_code: string | null;
          address_line1: string | null;
          logo_url: string | null;
          plan: "trial" | "starter" | "growth" | "enterprise";
          status: "active" | "suspended" | "cancelled";
          demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]> & { name: string; slug: string };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: "ADMIN" | "CLINIC_OWNER" | "OFFICE_MANAGER" | "RECEPTIONIST";
          title: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          organization_id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          date_of_birth: string | null;
          patient_type: "new" | "existing";
          status: "active" | "needs_follow_up" | "inactive" | "overdue_recall";
          lead_source: string | null;
          last_appointment_at: string | null;
          next_appointment_at: string | null;
          estimated_value: number;
          is_high_value: boolean;
          notes: string | null;
          ai_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["patients"]["Row"]> & {
          organization_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["patients"]["Row"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          type: "recall" | "missed_call_recovery" | "appointment_reminder" | "treatment_follow_up" | "review_request";
          status: "draft" | "scheduled" | "active" | "completed" | "paused";
          channels: string[];
          audience_description: string | null;
          scheduled_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          start_date: string | null;
          end_date: string | null;
          budget: number | null;
          contacts_count: number;
          calls_count: number;
          sms_count: number;
          responses_count: number;
          appointments_count: number;
          estimated_revenue: number;
          ai_script: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaigns"]["Row"]> & {
          organization_id: string;
          name: string;
          type: Database["public"]["Tables"]["campaigns"]["Row"]["type"];
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Row"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string | null;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          source: "inbound_call" | "outbound_call" | "website" | "chat" | "referral" | "walk_in" | "campaign";
          source_campaign: string | null;
          service_requested: string | null;
          message: string | null;
          status: "new" | "contacted" | "qualified" | "appointment_requested" | "booked" | "completed" | "lost";
          lead_score: number;
          priority: "low" | "medium" | "high";
          estimated_value: number;
          ai_score: number | null;
          ai_priority: "low" | "medium" | "high" | null;
          ai_summary: string | null;
          ai_recommended_action: string | null;
          next_action: string | null;
          appointment_id: string | null;
          assigned_to: string | null;
          campaign_id: string | null;
          first_contact_at: string;
          last_contact_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leads"]["Row"]> & {
          organization_id: string;
          first_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      calls: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string | null;
          lead_id: string | null;
          direction: "inbound" | "outbound";
          status: "completed" | "missed" | "failed" | "transferred";
          phone_number: string;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number;
          recording_url: string | null;
          transcript: Json | null;
          intent: string | null;
          outcome: string | null;
          ai_summary: string | null;
          ai_sentiment: "positive" | "neutral" | "negative" | null;
          ai_handled: boolean;
          ai_confidence: number | null;
          appointment_id: string | null;
          campaign_id: string | null;
          recovered_from_missed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["calls"]["Row"]> & {
          organization_id: string;
          direction: "inbound" | "outbound";
          status: Database["public"]["Tables"]["calls"]["Row"]["status"];
          phone_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["calls"]["Row"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string | null;
          lead_id: string | null;
          call_id: string | null;
          campaign_id: string | null;
          provider_id: string | null;
          dentist_name: string;
          patient_name: string;
          patient_type: "new" | "existing";
          service: string;
          starts_at: string;
          ends_at: string;
          status: "requested" | "confirmed" | "completed" | "cancelled" | "no_show";
          source: string | null;
          estimated_value: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          organization_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string | null;
          lead_id: string | null;
          patient_name: string | null;
          channel: "phone" | "sms" | "email" | "website_chat";
          status: "active" | "resolved" | "archived";
          started_at: string;
          ended_at: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          ai_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["conversations"]["Row"]> & {
          organization_id: string;
          channel: Database["public"]["Tables"]["conversations"]["Row"]["channel"];
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string;
          patient_id: string | null;
          channel: "sms" | "email" | "voice" | null;
          direction: "inbound" | "outbound";
          sender_type: "patient" | "ai" | "staff" | "system" | null;
          body: string;
          external_message_id: string | null;
          status: "sent" | "delivered" | "failed" | "read" | null;
          sent_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          organization_id: string;
          conversation_id: string;
          direction: "inbound" | "outbound";
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      automation_events: {
        Row: {
          id: string;
          organization_id: string;
          event_type: string;
          entity_type: string;
          entity_id: string | null;
          payload: Json;
          status: "pending" | "processing" | "completed" | "failed";
          processed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["automation_events"]["Row"]> & {
          organization_id: string;
          event_type: string;
          entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["automation_events"]["Row"]>;
        Relationships: [];
      };
      automation_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          workflow_name: string;
          execution_id: string | null;
          event_type: string | null;
          status: "pending" | "processing" | "completed" | "failed";
          message: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["automation_logs"]["Row"]> & {
          workflow_name: string;
          status: Database["public"]["Tables"]["automation_logs"]["Row"]["status"];
        };
        Update: Partial<Database["public"]["Tables"]["automation_logs"]["Row"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          file_name: string;
          file_type: "pdf" | "docx" | "txt" | "csv";
          category: "clinic_policies" | "services" | "insurance" | "pricing" | "faqs" | "emergency_procedures" | "patient_instructions";
          status: "processing" | "indexed" | "failed";
          chunk_count: number;
          file_size_bytes: number;
          uploaded_by: string | null;
          storage_path: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["documents"]["Row"]> & {
          organization_id: string;
          file_name: string;
          file_type: Database["public"]["Tables"]["documents"]["Row"]["file_type"];
          category: Database["public"]["Tables"]["documents"]["Row"]["category"];
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          content: string;
          chunk_index: number;
          embedding: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["document_chunks"]["Row"]> & {
          organization_id: string;
          document_id: string;
          content: string;
          chunk_index: number;
        };
        Update: Partial<Database["public"]["Tables"]["document_chunks"]["Row"]>;
        Relationships: [];
      };
      prompt_templates: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          purpose: string | null;
          system_prompt: string;
          user_prompt: string | null;
          model: string;
          temperature: number;
          version: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prompt_templates"]["Row"]> & {
          name: string;
          system_prompt: string;
        };
        Update: Partial<Database["public"]["Tables"]["prompt_templates"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_organization_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      match_document_chunks: {
        Args: { query_embedding: string; match_count?: number; filter_organization_id?: string };
        Returns: {
          id: string;
          document_id: string;
          file_name: string;
          category: string;
          content: string;
          chunk_index: number;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
