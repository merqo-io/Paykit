import type { Admin, AdminAudit, AuthFailure, OpsEvent } from "./admin";
import type {
  Booking,
  BookingStatus,
  Inquiry,
  InquiryForm,
  InquiryStatus,
} from "./bookings";
import type {
  Feedback,
  PaymentAudit,
  PaymentEvidence,
  Refund,
  Transaction,
  TxStatus,
} from "./payments";
import type {
  LegalCheckState,
  PaymentConfigKind,
  VendorEntitlement,
  VendorPaymentConfig,
  VendorPrefs,
  VerificationMethod,
} from "./vendor";
import type { Json } from "./json";

export interface Database {
  paykit: {
    Tables: {
      vendor_payment_config: {
        Row: VendorPaymentConfig;
        Insert: {
          vendor_id: string;
          kind?: PaymentConfigKind;
          uen?: string | null;
          mobile?: string | null;
          payee_name?: string | null;
          label?: string | null;
          url?: string | null;
          qr_image_url?: string | null;
          verification_method?: VerificationMethod;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kind?: PaymentConfigKind;
          uen?: string | null;
          mobile?: string | null;
          payee_name?: string | null;
          label?: string | null;
          url?: string | null;
          qr_image_url?: string | null;
          verification_method?: VerificationMethod;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: {
          id?: string;
          vendor_id: string;
          kit_slug: string;
          order_ref: string;
          amount_cents: number;
          status?: TxStatus;
          qr_payload: string;
          checkout_kind?: "qr" | "link" | "image" | null;
          checkout_label?: string | null;
          pay_token_hash?: string | null;
          return_url?: string | null;
          pay_title?: string | null;
          claimed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          status?: TxStatus;
          claimed_at?: string | null;
          confirmed_at?: string | null;
          pay_token_hash?: string | null;
          return_url?: string | null;
          pay_title?: string | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: {
          id?: string;
          vendor_id: string;
          customer_name: string;
          customer_phone?: string | null;
          event_date: string;
          total_amount_cents: number;
          deposit_amount_cents: number;
          balance_amount_cents: number;
          balance_due_date: string;
          status?: BookingStatus;
          deposit_transaction_id?: string | null;
          balance_transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          customer_name?: string;
          customer_phone?: string | null;
          event_date?: string;
          total_amount_cents?: number;
          deposit_amount_cents?: number;
          balance_amount_cents?: number;
          balance_due_date?: string;
          status?: BookingStatus;
          deposit_transaction_id?: string | null;
          balance_transaction_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      inquiry_forms: {
        Row: InquiryForm;
        Insert: {
          vendor_id: string;
          public_id?: string;
          business_name: string;
          enabled?: boolean;
          terms_url?: string | null;
          terms_version?: string | null;
        };
        Update: {
          business_name?: string;
          enabled?: boolean;
          terms_url?: string | null;
          terms_version?: string | null;
        };
        Relationships: [];
      };
      inquiries: {
        Row: Inquiry;
        Insert: {
          id?: string;
          vendor_id: string;
          customer_name: string;
          customer_phone: string;
          event_date?: string | null;
          message: string;
          status?: InquiryStatus;
          terms_url?: string | null;
          terms_version?: string | null;
          terms_accepted_at?: string | null;
          booking_id?: string | null;
        };
        Update: {
          status?: InquiryStatus;
          booking_id?: string | null;
        };
        Relationships: [];
      };
      refunds: {
        Row: Refund;
        Insert: {
          id?: string;
          transaction_id: string;
          refunded_amount_cents: number;
          reason?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          reason?: string | null;
        };
        Relationships: [];
      };
      kit_api_keys: {
        Row: {
          kit_slug: string;
          secret_hash: string;
          created_at: string;
          last_used_at: string | null;
          callback_url: string | null;
          callback_secret: string | null;
          return_origin: string | null;
        };
        Insert: {
          kit_slug: string;
          secret_hash: string;
          created_at?: string;
          last_used_at?: string | null;
          callback_url?: string | null;
          callback_secret?: string | null;
          return_origin?: string | null;
        };
        Update: {
          secret_hash?: string;
          last_used_at?: string | null;
          callback_url?: string | null;
          callback_secret?: string | null;
          return_origin?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: Feedback;
        Insert: {
          id?: number;
          vendor_id: string;
          nps: number;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          nps?: number;
          message?: string | null;
        };
        Relationships: [];
      };
      vendor_prefs: {
        Row: VendorPrefs;
        Insert: {
          vendor_id: string;
          tour_seen_at?: string | null;
        };
        Update: {
          tour_seen_at?: string | null;
        };
        Relationships: [];
      };
      admins: {
        Row: Admin;
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      admin_audit: {
        Row: AdminAudit;
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          detail?: Json;
        };
        Relationships: [];
      };
      vendor_entitlements: {
        Row: VendorEntitlement;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payment_audit: {
        Row: PaymentAudit;
        Insert: {
          id?: string;
          transaction_id: string;
          kit_slug: string;
          action: string;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          detail?: Json;
        };
        Relationships: [];
      };
      payment_evidence: {
        Row: PaymentEvidence;
        Insert: {
          id?: string;
          transaction_id: string;
          kind: "screenshot";
          storage_path?: string | null;
          content_hash?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          storage_path?: string | null;
          content_hash?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ops_events: {
        Row: OpsEvent;
        Insert: {
          vendor_id: string;
          kind: "payment_callback_failed";
          ref: string;
          code: string;
          created_at?: string;
        };
        Update: {
          [_ in never]: never;
        };
        Relationships: [];
      };
      auth_failures: {
        Row: AuthFailure;
        Insert: {
          id?: string;
          kit_slug?: string | null;
          reason: string;
          ip?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: { key: string; window_start: string; count: number };
        Insert: {
          key: string;
          window_start: string;
          count?: number;
        };
        Update: { count?: number };
        Relationships: [];
      };
      legal_check_state: {
        Row: LegalCheckState;
        Insert: {
          email: string;
          checked_at?: string;
          is_current: boolean;
        };
        Update: {
          checked_at?: string;
          is_current?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_vendor_entitlement: {
        Args: {
          p_email: string;
          p_tier: string;
          p_founder: boolean;
          p_stats_window: string;
          p_event_pass_starts_at: string | null;
          p_event_pass_ends_at: string | null;
          p_valid_until: string | null;
          p_issued_at: string;
        };
        Returns: string;
      };
      link_booking_balance: {
        Args: {
          p_booking_id: string;
          p_vendor_id: string;
          p_transaction_id: string;
        };
        Returns: string;
      };
      link_booking_deposit: {
        Args: {
          p_booking_id: string;
          p_vendor_id: string;
          p_transaction_id: string;
        };
        Returns: string;
      };
      tx_count_this_month: {
        Args: { p_vendor: string };
        Returns: number;
      };
      is_admin: {
        Args: { p_uid: string };
        Returns: boolean;
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      purge_ops_events: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
  };
}
