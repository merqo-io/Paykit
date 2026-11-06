export type BookingStatus =
  "pending_deposit" | "deposit_paid" | "fully_paid" | "cancelled";

export type Booking = {
  id: string;
  vendor_id: string;
  customer_name: string;
  customer_phone: string | null;
  event_date: string;
  total_amount_cents: number;
  deposit_amount_cents: number;
  balance_amount_cents: number;
  balance_due_date: string;
  status: BookingStatus;
  deposit_transaction_id: string | null;
  balance_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InquiryStatus = "new" | "contacted" | "converted" | "declined";

export type InquiryForm = {
  vendor_id: string;
  public_id: string;
  business_name: string;
  enabled: boolean;
  terms_url: string | null;
  terms_version: string | null;
  created_at: string;
  updated_at: string;
};

export type Inquiry = {
  id: string;
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  event_date: string | null;
  message: string;
  status: InquiryStatus;
  terms_url: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
};
