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
      actual_usage: {
        Row: {
          actual_credits: number
          created_at: string
          execution_date: string
          id: string
          notes: string | null
          prompt_id: string
          user_id: string
        }
        Insert: {
          actual_credits: number
          created_at?: string
          execution_date?: string
          id?: string
          notes?: string | null
          prompt_id: string
          user_id: string
        }
        Update: {
          actual_credits?: number
          created_at?: string
          execution_date?: string
          id?: string
          notes?: string | null
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actual_usage_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          estimated_cost: number
          id: string
          input_tokens: number
          model: string
          operation: string
          output_tokens: number
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model: string
          operation: string
          output_tokens?: number
          provider: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model?: string
          operation?: string
          output_tokens?: number
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      estimator_parameters: {
        Row: {
          active: boolean
          description: string | null
          id: string
          parameter_name: string
          parameter_value: number
          platform: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          id?: string
          parameter_name: string
          parameter_value: number
          platform?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          description?: string | null
          id?: string
          parameter_name?: string
          parameter_value?: number
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      openai_optimizations: {
        Row: {
          analysis: string | null
          created_at: string
          duration_ms: number
          error_message: string | null
          id: string
          improvements: Json
          input_tokens: number
          missing_information: Json
          model: string
          optimized_prompt: string | null
          original_prompt: string
          output_tokens: number
          prompt_id: string | null
          quality_score_after: number | null
          quality_score_before: number | null
          status: string
          user_id: string
        }
        Insert: {
          analysis?: string | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          improvements?: Json
          input_tokens?: number
          missing_information?: Json
          model: string
          optimized_prompt?: string | null
          original_prompt: string
          output_tokens?: number
          prompt_id?: string | null
          quality_score_after?: number | null
          quality_score_before?: number | null
          status?: string
          user_id: string
        }
        Update: {
          analysis?: string | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          improvements?: Json
          input_tokens?: number
          missing_information?: Json
          model?: string
          optimized_prompt?: string | null
          original_prompt?: string
          output_tokens?: number
          prompt_id?: string | null
          quality_score_after?: number | null
          quality_score_before?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "openai_optimizations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          monthly_analysis_limit: number
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          monthly_analysis_limit?: number
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          monthly_analysis_limit?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          plan_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          plan_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_analyses: {
        Row: {
          authentication_score: number
          backend_score: number
          complexity_score: number
          confidence_score: number
          created_at: string
          database_score: number
          estimated_entities: number
          estimated_expected: number
          estimated_max: number
          estimated_min: number
          estimated_operations: number
          factors: Json
          frontend_score: number
          id: string
          integration_score: number
          logic_score: number
          platform: string
          prompt_id: string
          recommendation: string | null
          steps: Json
          task_type: string
          user_id: string
        }
        Insert: {
          authentication_score?: number
          backend_score?: number
          complexity_score?: number
          confidence_score?: number
          created_at?: string
          database_score?: number
          estimated_entities?: number
          estimated_expected?: number
          estimated_max?: number
          estimated_min?: number
          estimated_operations?: number
          factors?: Json
          frontend_score?: number
          id?: string
          integration_score?: number
          logic_score?: number
          platform?: string
          prompt_id: string
          recommendation?: string | null
          steps?: Json
          task_type?: string
          user_id: string
        }
        Update: {
          authentication_score?: number
          backend_score?: number
          complexity_score?: number
          confidence_score?: number
          created_at?: string
          database_score?: number
          estimated_entities?: number
          estimated_expected?: number
          estimated_max?: number
          estimated_min?: number
          estimated_operations?: number
          factors?: Json
          frontend_score?: number
          id?: string
          integration_score?: number
          logic_score?: number
          platform?: string
          prompt_id?: string
          recommendation?: string | null
          steps?: Json
          task_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_analyses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_optimizations: {
        Row: {
          created_at: string
          estimated_optimized: number
          estimated_original: number
          estimated_reduction_percentage: number
          id: string
          optimized_prompt: string
          original_prompt: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_optimized?: number
          estimated_original?: number
          estimated_reduction_percentage?: number
          id?: string
          optimized_prompt: string
          original_prompt: string
          prompt_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_optimized?: number
          estimated_original?: number
          estimated_reduction_percentage?: number
          id?: string
          optimized_prompt?: string
          original_prompt?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_optimizations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_demo: boolean
          platform: string
          project_id: string | null
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_demo?: boolean
          platform?: string
          project_id?: string | null
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          platform?: string
          project_id?: string | null
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_history: {
        Row: {
          analyses_count: number
          created_at: string
          id: string
          period_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analyses_count?: number
          created_at?: string
          id?: string
          period_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analyses_count?: number
          created_at?: string
          id?: string
          period_month?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
