export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      outbreaks: {
        Row: {
          active: boolean | null
          cases: number
          country: string
          country_ar: string | null
          country_en: string | null
          created_at: string | null
          date: string
          deaths: number | null
          description: string
          disease: string
          disease_ar: string | null
          disease_en: string | null
          id: string
          is_seed: boolean
          lat: number
          lng: number
          region: string
          risk_level: string
          source: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          cases?: number
          country: string
          country_ar?: string | null
          country_en?: string | null
          created_at?: string | null
          date: string
          deaths?: number
          description: string
          disease: string
          disease_ar?: string | null
          disease_en?: string | null
          id?: string
          is_seed?: boolean
          lat: number
          lng: number
          region: string
          risk_level: string
          source: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          cases?: number
          country?: string
          country_ar?: string | null
          country_en?: string | null
          created_at?: string | null
          date?: string
          deaths?: number
          description?: string
          disease?: string
          disease_ar?: string | null
          disease_en?: string | null
          id?: string
          is_seed?: boolean
          lat?: number
          lng?: number
          region?: string
          risk_level?: string
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          locale: string | null
          region: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          locale?: string | null
          region?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          locale?: string | null
          region?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
