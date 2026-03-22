export interface FleetTransaction {
  LICENSE_PLATE_NO: string;
  GROSS_CC: number;
  PRODUCT_INV: string;
  TRANSACTION_DATE: string;
  parsedDate: Date;
}

export interface DashboardStats {
  totalSpend: number;
  totalTransactions: number;
  topUsersBySpend: { name: string; value: number }[];
  topUsersByNonFuel: { name: string; value: number }[];
  trends: { date: string; [key: string]: any }[];
  latestRefuelers: { name: string; time: string }[];
}
