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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      body_profiles: {
        Row: {
          body_avatar_url: string | null
          body_landmarks: Json | null
          created_at: string
          height_cm: number | null
          id: string
          inseam_cm: number | null
          scan_confidence: number | null
          shoe_size: string | null
          shoulder_width_cm: number | null
          silhouette_type: string | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_avatar_url?: string | null
          body_landmarks?: Json | null
          created_at?: string
          height_cm?: number | null
          id?: string
          inseam_cm?: number | null
          scan_confidence?: number | null
          shoe_size?: string | null
          shoulder_width_cm?: number | null
          silhouette_type?: string | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_avatar_url?: string | null
          body_landmarks?: Json | null
          created_at?: string
          height_cm?: number | null
          id?: string
          inseam_cm?: number | null
          scan_confidence?: number | null
          shoe_size?: string | null
          shoulder_width_cm?: number | null
          silhouette_type?: string | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      body_scan_images: {
        Row: {
          created_at: string
          id: string
          image_type: string
          public_url: string | null
          storage_path: string
          updated_at: string
          user_id: string
          validation_notes: string | null
          validation_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_type: string
          public_url?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
          validation_notes?: string | null
          validation_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_type?: string
          public_url?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
          validation_notes?: string | null
          validation_status?: string | null
        }
        Relationships: []
      }
      circles: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "ootd_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "ootd_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_recommendations: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          outfits: Json
          recommendation_date: string
          recommendation_type: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          outfits?: Json
          recommendation_date?: string
          recommendation_type?: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          outfits?: Json
          recommendation_date?: string
          recommendation_type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_winners: {
        Row: {
          award_date: string
          created_at: string
          id: string
          post_id: string | null
          score: number
          title: string
          user_id: string
        }
        Insert: {
          award_date: string
          created_at?: string
          id?: string
          post_id?: string | null
          score?: number
          title?: string
          user_id: string
        }
        Update: {
          award_date?: string
          created_at?: string
          id?: string
          post_id?: string | null
          score?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_winners_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ootd_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      image_failures: {
        Row: {
          brand: string | null
          created_at: string
          failure_reason: string | null
          id: string
          image_url: string | null
          product_name: string | null
          source: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          image_url?: string | null
          product_name?: string | null
          source?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          image_url?: string | null
          product_name?: string | null
          source?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_id: string
          target_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ootd_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ootd_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ootd_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ootd_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ootd_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ootd_posts: {
        Row: {
          caption: string | null
          created_at: string
          dislike_count: number | null
          id: string
          image_url: string
          like_count: number | null
          linked_products: string[] | null
          occasion_tags: string[] | null
          star_count: number | null
          style_tags: string[] | null
          topics: string[] | null
          updated_at: string
          user_id: string
          weather_tag: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          dislike_count?: number | null
          id?: string
          image_url: string
          like_count?: number | null
          linked_products?: string[] | null
          occasion_tags?: string[] | null
          star_count?: number | null
          style_tags?: string[] | null
          topics?: string[] | null
          updated_at?: string
          user_id: string
          weather_tag?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          dislike_count?: number | null
          id?: string
          image_url?: string
          like_count?: number | null
          linked_products?: string[] | null
          occasion_tags?: string[] | null
          star_count?: number | null
          style_tags?: string[] | null
          topics?: string[] | null
          updated_at?: string
          user_id?: string
          weather_tag?: string | null
        }
        Relationships: []
      }
      ootd_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ootd_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ootd_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ootd_stars: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ootd_stars_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ootd_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ootd_topics: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          post_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          post_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          post_count?: number
        }
        Relationships: []
      }
      product_cache: {
        Row: {
          brand: string | null
          category: string | null
          color_tags: string[] | null
          created_at: string
          currency: string | null
          external_id: string | null
          fit: string | null
          id: string
          image_url: string | null
          image_valid: boolean | null
          is_active: boolean
          last_validated: string | null
          like_count: number | null
          name: string
          platform: string | null
          price: string | null
          reason: string | null
          search_query: string | null
          source_trust_level: string
          source_type: string
          source_url: string | null
          store_name: string | null
          style_tags: string[] | null
          subcategory: string | null
          trend_score: number
          updated_at: string
          view_count: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          color_tags?: string[] | null
          created_at?: string
          currency?: string | null
          external_id?: string | null
          fit?: string | null
          id?: string
          image_url?: string | null
          image_valid?: boolean | null
          is_active?: boolean
          last_validated?: string | null
          like_count?: number | null
          name: string
          platform?: string | null
          price?: string | null
          reason?: string | null
          search_query?: string | null
          source_trust_level?: string
          source_type?: string
          source_url?: string | null
          store_name?: string | null
          style_tags?: string[] | null
          subcategory?: string | null
          trend_score?: number
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          color_tags?: string[] | null
          created_at?: string
          currency?: string | null
          external_id?: string | null
          fit?: string | null
          id?: string
          image_url?: string | null
          image_valid?: boolean | null
          is_active?: boolean
          last_validated?: string | null
          like_count?: number | null
          name?: string
          platform?: string | null
          price?: string | null
          reason?: string | null
          search_query?: string | null
          source_trust_level?: string
          source_type?: string
          source_url?: string | null
          store_name?: string | null
          style_tags?: string[] | null
          subcategory?: string | null
          trend_score?: number
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          color_tags: string[] | null
          created_at: string
          currency: string | null
          description: string | null
          fit_type: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price: number | null
          source_url: string | null
          style_tags: string[] | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          color_tags?: string[] | null
          created_at?: string
          currency?: string | null
          description?: string | null
          fit_type?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price?: number | null
          source_url?: string | null
          style_tags?: string[] | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          color_tags?: string[] | null
          created_at?: string
          currency?: string | null
          description?: string | null
          fit_type?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number | null
          source_url?: string | null
          style_tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email_verified: boolean | null
          gender_preference: string | null
          hashtags: string[] | null
          id: string
          is_private: boolean | null
          language: string | null
          location: string | null
          onboarded: boolean | null
          phone: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email_verified?: boolean | null
          gender_preference?: string | null
          hashtags?: string[] | null
          id?: string
          is_private?: boolean | null
          language?: string | null
          location?: string | null
          onboarded?: boolean | null
          phone?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email_verified?: boolean | null
          gender_preference?: string | null
          hashtags?: string[] | null
          id?: string
          is_private?: boolean | null
          language?: string | null
          location?: string | null
          onboarded?: boolean | null
          phone?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_folders: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "saved_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ootd_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_highlight: boolean
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_highlight?: boolean
          media_type?: string
          media_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_highlight?: boolean
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: []
      }
      style_profiles: {
        Row: {
          budget: string | null
          created_at: string
          disliked_styles: string[] | null
          favorite_brands: string[] | null
          id: string
          occasions: string[] | null
          preferred_fit: string | null
          preferred_styles: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: string | null
          created_at?: string
          disliked_styles?: string[] | null
          favorite_brands?: string[] | null
          id?: string
          occasions?: string[] | null
          preferred_fit?: string | null
          preferred_styles?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: string | null
          created_at?: string
          disliked_styles?: string[] | null
          favorite_brands?: string[] | null
          id?: string
          occasions?: string[] | null
          preferred_fit?: string | null
          preferred_styles?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end_date?: string | null
          trial_start_date?: string | null
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_plan: "free" | "premium_trial" | "premium"
      subscription_status: "active" | "expired" | "cancelled"
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
      app_role: ["admin", "moderator", "user"],
      subscription_plan: ["free", "premium_trial", "premium"],
      subscription_status: ["active", "expired", "cancelled"],
    },
  },
} as const
