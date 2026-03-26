import type { Response } from 'express';
export declare function sendSuccess<T>(res: Response, data: T, message?: string, status?: number): Response;
export declare function sendError(res: Response, message: string, status?: number, errors?: unknown): Response;
//# sourceMappingURL=response.utils.d.ts.map