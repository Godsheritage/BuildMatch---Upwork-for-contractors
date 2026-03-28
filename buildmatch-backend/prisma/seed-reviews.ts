/**
 * seed-reviews.ts
 * Creates fake reviewer investors, one seed job per contractor,
 * and N reviews per contractor. Then recalculates
 * averageRating + totalReviews on each ContractorProfile.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Fake reviewers ────────────────────────────────────────────────────────────

const REVIEWER_POOL = [
  { firstName: 'James',    lastName: 'Hartley',   email: 'james.hartley@seed.dev'   },
  { firstName: 'Sofia',    lastName: 'Martinez',  email: 'sofia.martinez@seed.dev'  },
  { firstName: 'Michael',  lastName: 'Chen',      email: 'michael.chen@seed.dev'    },
  { firstName: 'Priya',    lastName: 'Patel',     email: 'priya.patel@seed.dev'     },
  { firstName: 'David',    lastName: 'Okafor',    email: 'david.okafor@seed.dev'    },
  { firstName: 'Rachel',   lastName: 'Kim',       email: 'rachel.kim@seed.dev'      },
  { firstName: 'Carlos',   lastName: 'Rivera',    email: 'carlos.rivera@seed.dev'   },
  { firstName: 'Emily',    lastName: 'Walsh',     email: 'emily.walsh@seed.dev'     },
  { firstName: 'Liam',     lastName: 'Nguyen',    email: 'liam.nguyen@seed.dev'     },
  { firstName: 'Aisha',    lastName: 'Johnson',   email: 'aisha.johnson@seed.dev'   },
  { firstName: 'Tyler',    lastName: 'Brooks',    email: 'tyler.brooks@seed.dev'    },
  { firstName: 'Hannah',   lastName: 'Robinson',  email: 'hannah.robinson@seed.dev' },
  { firstName: 'Marcus',   lastName: 'Lee',       email: 'marcus.lee@seed.dev'      },
  { firstName: 'Fatima',   lastName: 'Hassan',    email: 'fatima.hassan@seed.dev'   },
  { firstName: 'Ethan',    lastName: 'Powell',    email: 'ethan.powell@seed.dev'    },
];

// ── Review content pool ───────────────────────────────────────────────────────

const REVIEW_TEMPLATES = [
  { title: 'Outstanding work', body: 'Showed up on time every day, communicated well throughout the project, and the finished product exceeded our expectations. Would definitely hire again.' },
  { title: 'Highly recommend', body: 'Professional, knowledgeable, and fair pricing. The crew was respectful of our home and cleaned up each day. Everything was done right the first time.' },
  { title: 'Great experience', body: "We had a tight timeline and they made it work without cutting corners. Kept us informed at every stage and the quality was top-notch." },
  { title: 'Solid craftsmanship', body: 'Very detail-oriented and clearly takes pride in their work. Minor hiccup mid-project was handled quickly and professionally. Happy with the result.' },
  { title: 'Exceeded expectations', body: 'Came in under budget and finished two days early. The work is beautiful and the team was a pleasure to have around. 10/10.' },
  { title: 'Professional and reliable', body: 'This was our first major renovation and they made the whole process stress-free. Always responsive, always on schedule. Fantastic job.' },
  { title: 'Would hire again', body: 'They tackled a complicated project that two other contractors had turned down. The solution was creative and the execution was flawless.' },
  { title: 'Quality work', body: 'Everything was explained upfront with no hidden fees. The work was completed cleanly and the team was courteous throughout. Very pleased.' },
  { title: 'Very satisfied', body: 'Our neighbors have already asked us for the contact. That says it all — the quality really speaks for itself. Great contractor to work with.' },
  { title: 'Fast and clean', body: 'Wrapped up the job faster than expected and left the site spotless each day. Pricing was transparent from the start. Highly recommend.' },
  { title: 'Good communication', body: 'Always responded to messages within the hour. Sent photos of progress when we were away. Made us feel completely at ease during the project.' },
  { title: 'Fair pricing, great result', body: 'Got three quotes and went with them — and it was the right call. The quality at that price point is hard to beat. Very happy customer.' },
  { title: 'Did exactly what was promised', body: 'No surprises on the invoice, no corners cut. The scope was delivered exactly as agreed. Simple and professional — that\'s all you can ask for.' },
  { title: 'Attention to detail', body: 'The little things that others miss, they got right. From the finishing trim to the cleanup, everything was handled with care.' },
  { title: 'Smooth from start to finish', body: 'Booking was easy, the estimate was accurate, and the job was done well. No drama, no delays, no excuses. Couldn\'t ask for more.' },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

// Weighted rating: skew heavily toward 4-5 stars for realistic data
function randomRating(): number {
  const roll = Math.random();
  if (roll < 0.40) return 5;
  if (roll < 0.70) return 4;
  if (roll < 0.85) return 3;
  if (roll < 0.95) return 2;
  return 1;
}

async function main() {
  const hashedPw = await bcrypt.hash('Seed1234!', 10);

  // ── 1. Upsert reviewer pool (sequential to stay within pool_size) ───────────
  console.log('Upserting reviewer pool…');
  const reviewers = [];
  for (const r of REVIEWER_POOL) {
    const user = await prisma.user.upsert({
      where:  { email: r.email },
      update: {},
      create: {
        email:     r.email,
        password:  hashedPw,
        role:      'INVESTOR',
        firstName: r.firstName,
        lastName:  r.lastName,
        isActive:  true,
      },
    });
    reviewers.push(user);
  }
  console.log(`  ${reviewers.length} reviewers ready.`);

  // ── 2. Fetch all contractor profiles ────────────────────────────────────────
  const contractors = await prisma.contractorProfile.findMany({
    select: { id: true, userId: true, totalReviews: true },
  });
  console.log(`\nSeeding reviews for ${contractors.length} contractors…`);

  for (const contractor of contractors) {
    // Cap at pool size — one review per reviewer per job
    const targetCount = Math.min(contractor.totalReviews, REVIEWER_POOL.length);

    // Pick the reviewers to use (slice from pool)
    const chosenReviewers = reviewers.slice(0, targetCount);

    // Create one seed job owned by the first reviewer
    const seedJob = await prisma.job.create({
      data: {
        title:       'Seed job (test data)',
        description: 'This job was created by the seed script for testing purposes only.',
        tradeType:   'GENERAL',
        budgetMin:   1000,
        budgetMax:   5000,
        city:        'Austin',
        state:       'TX',
        zipCode:     '78701',
        status:      'COMPLETED',
        isCompleted: true,
        reviewsUnlocked: true,
        investorId:  chosenReviewers[0].id,
      },
    });

    // Create reviews from each chosen reviewer
    const ratings: number[] = [];
    for (let i = 0; i < chosenReviewers.length; i++) {
      const reviewer = chosenReviewers[i];
      const rating   = randomRating();
      const template = REVIEW_TEMPLATES[i % REVIEW_TEMPLATES.length];

      // Each reviewer needs their own job to satisfy the unique(jobId, reviewerId) constraint
      let reviewJobId = seedJob.id;
      if (i > 0) {
        const extraJob = await prisma.job.create({
          data: {
            title:       'Seed job (test data)',
            description: 'This job was created by the seed script for testing purposes only.',
            tradeType:   'GENERAL',
            budgetMin:   1000,
            budgetMax:   5000,
            city:        'Austin',
            state:       'TX',
            zipCode:     '78701',
            status:      'COMPLETED',
            isCompleted: true,
            reviewsUnlocked: true,
            investorId:  reviewer.id,
          },
        });
        reviewJobId = extraJob.id;
      }

      await prisma.review.create({
        data: {
          jobId:       reviewJobId,
          reviewerId:  reviewer.id,
          revieweeId:  contractor.userId,
          reviewerRole: 'INVESTOR',
          rating,
          title:       template.title,
          body:        template.body,
          createdAt:   new Date(Date.now() - randInt(1, 365) * 86_400_000),
        },
      });

      ratings.push(rating);
    }

    // Recalculate from actual inserted data
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    const roundedAvg = Math.round(avg * 10) / 10;

    await prisma.contractorProfile.update({
      where: { id: contractor.id },
      data:  { totalReviews: ratings.length, averageRating: roundedAvg },
    });

    console.log(`  ✓ contractor ${contractor.userId}  →  ${ratings.length} reviews  avg ${roundedAvg}★`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
