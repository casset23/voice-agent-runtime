// 通用 API 响应格式
export class ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// 分页信息
export class PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 带分页的响应格式
export class PaginatedResponse<T = any> {
  data: T[];
  meta: PaginationMeta;
}