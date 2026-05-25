/** A single payment from the MP /v1/payments/search API, filtered to the fields we use. */
export interface MpPayment {
  id: string;
  date_created: string;
  transaction_amount: number;
  description: string | null;
  payer: {
    first_name: string | null;
    last_name: string | null;
  };
}

export interface MpSearchResult {
  success: boolean;
  data?: {
    payments: MpPayment[];
    total: number;
    filtered_out: number;
  };
  error?: string;
}

export interface MpBatchPayload {
  facturar: string[];
  ignorar: string[];
  payments_data: Record<string, MpPaymentData>;
}

export interface MpPaymentData {
  transaction_amount: number;
  date_created: string;
  description: string | null;
  payer_name: string | null;
}

export interface MpBatchItemResult {
  mp_payment_id: string;
  status: 'facturado' | 'ignorado' | 'fallido';
  error?: string;
  comprobante_numero?: string;
}

export interface MpBatchJob {
  id: string;
  contribuyente_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  ignored_items: number;
  results: MpBatchItemResult[];
  created_at: string;
  updated_at: string;
}

export interface MpProcessBatchResponse {
  success: boolean;
  data?: {
    batch_job_id: string;
  };
  error?: string;
}
