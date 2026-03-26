import type { Request, Response } from 'express';
export declare function listJobs(req: Request, res: Response): Promise<void>;
export declare function getJobById(req: Request, res: Response): Promise<void>;
export declare function createJob(req: Request, res: Response): Promise<void>;
export declare function updateJob(req: Request, res: Response): Promise<void>;
export declare function cancelJob(req: Request, res: Response): Promise<void>;
export declare function getMyJobs(req: Request, res: Response): Promise<void>;
export declare function createBid(req: Request, res: Response): Promise<void>;
export declare function getJobBids(req: Request, res: Response): Promise<void>;
export declare function getMyBid(req: Request, res: Response): Promise<void>;
export declare function acceptBid(req: Request, res: Response): Promise<void>;
export declare function withdrawBid(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=job.controller.d.ts.map