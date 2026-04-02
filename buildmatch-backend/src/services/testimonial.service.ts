import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { RequestTestimonialInput, SubmitTestimonialInput } from '../schemas/testimonial.schemas';

export async function requestTestimonial(contractorUserId: string, input: RequestTestimonialInput) {
  const profile = await prisma.contractorProfile.findUnique({ where: { userId: contractorUserId } });
  if (!profile) throw new AppError('Contractor profile not found', 404);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const request = await prisma.testimonialRequest.create({
    data: {
      contractorProfileId: profile.id,
      recipientEmail:      input.recipientEmail,
      recipientName:       input.recipientName,
      personalMessage:     input.personalMessage ?? null,
      expiresAt,
    },
  });

  console.log(
    `[testimonial] Request created — send email to ${input.recipientEmail}: ` +
    `http://localhost:5173/testimonials/${request.token}`,
  );

  return request;
}

export async function getTestimonialRequest(token: string) {
  const request = await prisma.testimonialRequest.findUnique({
    where:   { token },
    include: {
      contractorProfile: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!request) throw new AppError('Testimonial request not found', 404);
  if (request.status === 'SUBMITTED') throw new AppError('A testimonial has already been submitted for this request', 409);
  if (request.status === 'EXPIRED' || request.expiresAt < new Date()) {
    if (request.status !== 'EXPIRED') {
      await prisma.testimonialRequest.update({ where: { token }, data: { status: 'EXPIRED' } });
    }
    throw new AppError('This testimonial link has expired', 410);
  }

  return request;
}

export async function submitTestimonial(token: string, input: SubmitTestimonialInput) {
  const request = await getTestimonialRequest(token);

  const [testimonial] = await prisma.$transaction([
    prisma.testimonial.create({
      data: {
        contractorProfileId: request.contractorProfileId,
        requestId:           request.id,
        authorName:          request.recipientName,
        authorEmail:         request.recipientEmail,
        body:                input.body,
      },
    }),
    prisma.testimonialRequest.update({
      where: { id: request.id },
      data:  { status: 'SUBMITTED' },
    }),
  ]);

  return testimonial;
}

export async function listTestimonialsForContractor(contractorUserId: string) {
  const profile = await prisma.contractorProfile.findUnique({ where: { userId: contractorUserId } });
  if (!profile) throw new AppError('Contractor profile not found', 404);

  return prisma.testimonial.findMany({
    where:   { contractorProfileId: profile.id, approved: true },
    orderBy: { createdAt: 'desc' },
  });
}
