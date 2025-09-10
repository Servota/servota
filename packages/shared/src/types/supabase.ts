export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4';
  };
  public: {
    Tables: {
      account_memberships: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          role: Database['public']['Enums']['account_role'];
          status: Database['public']['Enums']['membership_status'];
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          role: Database['public']['Enums']['account_role'];
          status?: Database['public']['Enums']['membership_status'];
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['account_role'];
          status?: Database['public']['Enums']['membership_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_memberships_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      accounts: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          plan: string | null;
          status: string;
          stripe_customer_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          plan?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          plan?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          account_id: string;
          assigned_at: string;
          event_id: string;
          id: string;
          source: Database['public']['Enums']['assignment_source'];
          status: string;
          team_id: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          assigned_at?: string;
          event_id: string;
          id?: string;
          source?: Database['public']['Enums']['assignment_source'];
          status?: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          assigned_at?: string;
          event_id?: string;
          id?: string;
          source?: Database['public']['Enums']['assignment_source'];
          status?: string;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          account_id: string;
          action: string;
          at: string;
          diff: Json | null;
          id: string;
          row_id: string | null;
          table_name: string;
          team_id: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id: string;
          action: string;
          at?: string;
          diff?: Json | null;
          id?: string;
          row_id?: string | null;
          table_name: string;
          team_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string;
          action?: string;
          at?: string;
          diff?: Json | null;
          id?: string;
          row_id?: string | null;
          table_name?: string;
          team_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      event_requirements: {
        Row: {
          account_id: string;
          created_at: string;
          event_id: string;
          id: string;
          requirement_id: string;
          team_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          event_id: string;
          id?: string;
          requirement_id: string;
          team_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          event_id?: string;
          id?: string;
          requirement_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_requirements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_requirements_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_requirements_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'requirements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_requirements_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      event_templates: {
        Row: {
          account_id: string;
          capacity: number;
          created_at: string;
          description: string | null;
          duration: unknown;
          id: string;
          label: string;
          requirement_mode: Database['public']['Enums']['requirement_mode'];
          rrule: string | null;
          start_time: string;
          team_id: string;
        };
        Insert: {
          account_id: string;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          duration: unknown;
          id?: string;
          label: string;
          requirement_mode?: Database['public']['Enums']['requirement_mode'];
          rrule?: string | null;
          start_time: string;
          team_id: string;
        };
        Update: {
          account_id?: string;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          duration?: unknown;
          id?: string;
          label?: string;
          requirement_mode?: Database['public']['Enums']['requirement_mode'];
          rrule?: string | null;
          start_time?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_templates_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_templates_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          account_id: string;
          capacity: number;
          created_at: string;
          description: string | null;
          ends_at: string;
          id: string;
          label: string;
          requirement_mode: Database['public']['Enums']['requirement_mode'];
          starts_at: string;
          status: Database['public']['Enums']['event_status'];
          team_id: string;
          template_id: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          label: string;
          requirement_mode?: Database['public']['Enums']['requirement_mode'];
          starts_at: string;
          status?: Database['public']['Enums']['event_status'];
          team_id: string;
          template_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          label?: string;
          requirement_mode?: Database['public']['Enums']['requirement_mode'];
          starts_at?: string;
          status?: Database['public']['Enums']['event_status'];
          team_id?: string;
          template_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'event_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          account_id: string | null;
          attempts: number;
          body: string;
          channel: Database['public']['Enums']['notification_channel'];
          created_at: string;
          created_by: string | null;
          data: Json;
          id: string;
          last_error: string | null;
          scheduled_at: string;
          sent_at: string | null;
          status: Database['public']['Enums']['notification_status'];
          team_id: string | null;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          attempts?: number;
          body: string;
          channel?: Database['public']['Enums']['notification_channel'];
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          id?: string;
          last_error?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          team_id?: string | null;
          title: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          attempts?: number;
          body?: string;
          channel?: Database['public']['Enums']['notification_channel'];
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          id?: string;
          last_error?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          team_id?: string | null;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          default_account_id: string | null;
          full_name: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          default_account_id?: string | null;
          full_name?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_account_id?: string | null;
          full_name?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_default_account_id_fkey';
            columns: ['default_account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          device_info: string | null;
          id: string;
          last_seen: string;
          platform: string | null;
          status: Database['public']['Enums']['push_token_status'];
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_info?: string | null;
          id?: string;
          last_seen?: string;
          platform?: string | null;
          status?: Database['public']['Enums']['push_token_status'];
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_info?: string | null;
          id?: string;
          last_seen?: string;
          platform?: string | null;
          status?: Database['public']['Enums']['push_token_status'];
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      replacement_requests: {
        Row: {
          account_id: string;
          closed_at: string | null;
          event_id: string;
          id: string;
          opened_at: string;
          requester_user_id: string;
          status: Database['public']['Enums']['replacement_status'];
          team_id: string;
        };
        Insert: {
          account_id: string;
          closed_at?: string | null;
          event_id: string;
          id?: string;
          opened_at?: string;
          requester_user_id: string;
          status?: Database['public']['Enums']['replacement_status'];
          team_id: string;
        };
        Update: {
          account_id?: string;
          closed_at?: string | null;
          event_id?: string;
          id?: string;
          opened_at?: string;
          requester_user_id?: string;
          status?: Database['public']['Enums']['replacement_status'];
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'replacement_requests_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'replacement_requests_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'replacement_requests_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      requirements: {
        Row: {
          account_id: string;
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          team_id: string;
        };
        Insert: {
          account_id: string;
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          team_id: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'requirements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'requirements_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      swap_requests: {
        Row: {
          account_id: string;
          applied_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
        Insert: {
          account_id: string;
          applied_at?: string | null;
          created_at?: string;
          event_id: string;
          expires_at?: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
        Update: {
          account_id?: string;
          applied_at?: string | null;
          created_at?: string;
          event_id?: string;
          expires_at?: string | null;
          from_assignment_id?: string;
          from_user_id?: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: Database['public']['Enums']['swap_status'];
          team_id?: string;
          to_assignment_id?: string;
          to_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'swap_requests_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_from_assignment_id_fkey';
            columns: ['from_assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swap_requests_to_assignment_id_fkey';
            columns: ['to_assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
        ];
      };
      team_memberships: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          role: Database['public']['Enums']['team_role'];
          status: Database['public']['Enums']['membership_status'];
          team_id: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          role: Database['public']['Enums']['team_role'];
          status?: Database['public']['Enums']['membership_status'];
          team_id: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['team_role'];
          status?: Database['public']['Enums']['membership_status'];
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_memberships_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          account_id: string;
          active: boolean;
          allow_swaps: boolean;
          created_at: string;
          id: string;
          name: string;
          roster_visibility: Database['public']['Enums']['roster_visibility'];
          swap_requires_approval: boolean | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          active?: boolean;
          allow_swaps?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          roster_visibility?: Database['public']['Enums']['roster_visibility'];
          swap_requires_approval?: boolean | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          allow_swaps?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          roster_visibility?: Database['public']['Enums']['roster_visibility'];
          swap_requires_approval?: boolean | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      unavailability: {
        Row: {
          account_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          starts_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          starts_at: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          starts_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'unavailability_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      user_requirements: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          requirement_id: string;
          team_id: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          requirement_id: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          requirement_id?: string;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_requirements_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_requirements_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'requirements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_requirements_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_notifications_pending: {
        Row: {
          account_id: string | null;
          attempts: number | null;
          body: string | null;
          channel: Database['public']['Enums']['notification_channel'] | null;
          created_at: string | null;
          created_by: string | null;
          data: Json | null;
          id: string | null;
          last_error: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['notification_status'] | null;
          team_id: string | null;
          title: string | null;
          type: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          attempts?: number | null;
          body?: string | null;
          channel?: Database['public']['Enums']['notification_channel'] | null;
          created_at?: string | null;
          created_by?: string | null;
          data?: Json | null;
          id?: string | null;
          last_error?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'] | null;
          team_id?: string | null;
          title?: string | null;
          type?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          attempts?: number | null;
          body?: string | null;
          channel?: Database['public']['Enums']['notification_channel'] | null;
          created_at?: string | null;
          created_by?: string | null;
          data?: Json | null;
          id?: string | null;
          last_error?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'] | null;
          team_id?: string | null;
          title?: string | null;
          type?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      apply_cross_date_swap: {
        Args: { p_from_assignment_id: string; p_to_assignment_id: string };
        Returns: {
          updated_from: string;
          updated_to: string;
        }[];
      };
      apply_swap: {
        Args: { p_swap_request_id: string };
        Returns: {
          account_id: string;
          applied_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
      };
      enqueue_notification: {
        Args: {
          p_account_id?: string;
          p_body: string;
          p_channel: Database['public']['Enums']['notification_channel'];
          p_data?: Json;
          p_scheduled_at?: string;
          p_team_id?: string;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: {
          account_id: string | null;
          attempts: number;
          body: string;
          channel: Database['public']['Enums']['notification_channel'];
          created_at: string;
          created_by: string | null;
          data: Json;
          id: string;
          last_error: string | null;
          scheduled_at: string;
          sent_at: string | null;
          status: Database['public']['Enums']['notification_status'];
          team_id: string | null;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
      };
      fn_claim_replacement: {
        Args: { p_claimant_user_id?: string; p_replacement_request_id: string };
        Returns: {
          account_id: string;
          assigned_at: string;
          event_id: string;
          id: string;
          source: Database['public']['Enums']['assignment_source'];
          status: string;
          team_id: string;
          user_id: string;
        };
      };
      gbt_bit_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_bool_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_bool_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_bpchar_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_bytea_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_cash_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_cash_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_date_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_date_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_decompress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_enum_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_enum_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_float4_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_float4_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_float8_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_float8_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_inet_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_int2_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_int2_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_int4_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_int4_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_int8_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_int8_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_intv_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_intv_decompress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_intv_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_macad_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_macad_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_macad8_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_macad8_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_numeric_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_oid_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_oid_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_text_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_time_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_time_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_timetz_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_ts_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_ts_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_tstz_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_uuid_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_uuid_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_var_decompress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbt_var_fetch: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey_var_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey_var_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey16_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey16_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey2_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey2_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey32_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey32_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey4_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey4_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey8_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gbtreekey8_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      is_account_admin: {
        Args: { aid: string };
        Returns: boolean;
      };
      is_account_member: {
        Args: { aid: string };
        Returns: boolean;
      };
      is_any_team_scheduler: {
        Args: { aid: string };
        Returns: boolean;
      };
      is_team_scheduler: {
        Args: { aid: string; tid: string };
        Returns: boolean;
      };
      propose_cross_date_swap: {
        Args: {
          p_from_assignment_id: string;
          p_message?: string;
          p_to_assignment_id: string;
        };
        Returns: {
          account_id: string;
          applied_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
      };
      propose_swap: {
        Args: {
          p_from_assignment_id: string;
          p_message?: string;
          p_to_assignment_id: string;
        };
        Returns: {
          account_id: string;
          applied_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
      };
      register_push_token: {
        Args: { p_device_info?: string; p_platform?: string; p_token: string };
        Returns: {
          created_at: string;
          device_info: string | null;
          id: string;
          last_seen: string;
          platform: string | null;
          status: Database['public']['Enums']['push_token_status'];
          token: string;
          updated_at: string;
          user_id: string;
        };
      };
      respond_cross_date_swap: {
        Args: { p_action: string; p_swap_request_id: string };
        Returns: {
          account_id: string;
          applied_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
      };
      respond_swap: {
        Args: { p_action: string; p_swap_request_id: string };
        Returns: {
          account_id: string;
          applied_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string | null;
          from_assignment_id: string;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: Database['public']['Enums']['swap_status'];
          team_id: string;
          to_assignment_id: string;
          to_user_id: string;
        };
      };
    };
    Enums: {
      account_role: 'owner' | 'admin' | 'viewer';
      assignment_source: 'manual' | 'replacement' | 'swap' | 'auto';
      event_status: 'scheduled' | 'cancelled';
      membership_status: 'active' | 'invited' | 'suspended';
      notification_channel: 'push' | 'email';
      notification_status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
      push_token_status: 'active' | 'revoked';
      replacement_status: 'open' | 'filled' | 'cancelled';
      requirement_mode: 'ALL_OF' | 'ANY_OF';
      roster_visibility: 'team' | 'account' | 'private';
      swap_status:
        | 'pending'
        | 'accepted'
        | 'declined'
        | 'cancelled'
        | 'expired'
        | 'needs_approval'
        | 'applied';
      team_role: 'scheduler' | 'member';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_role: ['owner', 'admin', 'viewer'],
      assignment_source: ['manual', 'replacement', 'swap', 'auto'],
      event_status: ['scheduled', 'cancelled'],
      membership_status: ['active', 'invited', 'suspended'],
      notification_channel: ['push', 'email'],
      notification_status: ['queued', 'sending', 'sent', 'failed', 'cancelled'],
      push_token_status: ['active', 'revoked'],
      replacement_status: ['open', 'filled', 'cancelled'],
      requirement_mode: ['ALL_OF', 'ANY_OF'],
      roster_visibility: ['team', 'account', 'private'],
      swap_status: [
        'pending',
        'accepted',
        'declined',
        'cancelled',
        'expired',
        'needs_approval',
        'applied',
      ],
      team_role: ['scheduler', 'member'],
    },
  },
} as const;
