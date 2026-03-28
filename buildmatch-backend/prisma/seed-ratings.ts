import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

async function main() {
  const profiles = await prisma.contractorProfile.findMany({ select: { id: true } });

  console.log(`Updating ${profiles.length} contractor profiles with random ratings...`);

  for (const { id } of profiles) {
    const totalReviews  = randInt(5, 50);
    // Bias toward positive ratings (3.5 – 5.0), rounded to 1 decimal
    const averageRating = Math.round(rand(3.5, 5.0) * 10) / 10;
    const completedJobs = totalReviews + randInt(0, 10); // slightly more jobs than reviews

    await prisma.contractorProfile.update({
      where: { id },
      data:  { totalReviews, averageRating, completedJobs },
    });

    console.log(`  ✓ ${id}  →  ${averageRating}★  (${totalReviews} reviews, ${completedJobs} jobs)`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
