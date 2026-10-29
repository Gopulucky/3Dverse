export interface DownloadOrder {
  status?: string;
  currency?: string;
  payment_verified_at?: string | null;
}

export interface DownloadItem {
  product_id: number;
  selected_config?: { purchase_type?: string } | null;
  product?: {
    is_mode_2_active?: boolean;
    digital_download_enabled?: boolean;
    is_mode_3_active?: boolean;
    is_mode_4_active?: boolean;
  } | null;
}

/** Controls visibility only. The authenticated download API checks entitlement. */
export function canDownloadModel(order: DownloadOrder, item: DownloadItem): boolean {
  if (!["paid", "queued", "printing", "qc", "packed", "shipped", "delivered", "completed"].includes(order.status || "")) return false;
  if (order.currency !== "USD" && !order.payment_verified_at) return false;
  const format = item.selected_config?.purchase_type;
  if (format) return format === "digital";
  // Old USD orders predate format selection. Only unambiguous digital-only
  // listings can offer this shortcut; support can review mixed-format orders.
  return order.currency === "USD" && Boolean(item.product?.is_mode_2_active && item.product.digital_download_enabled && !item.product.is_mode_3_active && !item.product.is_mode_4_active);
}
