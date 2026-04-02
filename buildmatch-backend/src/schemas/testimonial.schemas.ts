import { z } from 'zod';

export const requestTestimonialSchema = z.object({
  recipientEmail:  z.string().email('Valid email required'),
  recipientName:   z.string().min(2).max(100),
  personalMessage: z.string().max(500).optional(),
});
export type RequestTestimonialInput = z.infer<typeof requestTestimonialSchema>;

export const submitTestimonialSchema = z.object({
  body: z.string().min(20, 'At least 20 characters required').max(1000),
});
export type SubmitTestimonialInput = z.infer<typeof submitTestimonialSchema>;
