import type { JwtPayload } from '../utils/jwt.utils';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      job?:  import('@prisma/client').Job;
    }
  }
}
