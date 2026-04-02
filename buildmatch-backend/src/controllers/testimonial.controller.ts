import { Request, Response } from 'express';
import * as testimonialService from '../services/testimonial.service';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof Error) {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    sendError(res, err.message, status);
  } else {
    sendError(res, 'Something went wrong', 500);
  }
}

export async function requestTestimonial(req: Request, res: Response): Promise<void> {
  try {
    const result = await testimonialService.requestTestimonial(req.user!.userId, req.body);
    sendSuccess(res, result, 'Testimonial request sent', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getTestimonialRequest(req: Request, res: Response): Promise<void> {
  try {
    const result = await testimonialService.getTestimonialRequest(req.params.token);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function submitTestimonial(req: Request, res: Response): Promise<void> {
  try {
    const result = await testimonialService.submitTestimonial(req.params.token, req.body);
    sendSuccess(res, result, 'Testimonial submitted', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function listContractorTestimonials(req: Request, res: Response): Promise<void> {
  try {
    const result = await testimonialService.listTestimonialsForContractor(req.params.contractorId);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}
