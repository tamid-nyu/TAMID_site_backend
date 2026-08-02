export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
  pagination?: PaginationInfo;
  error?: ApiError;
}

export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
