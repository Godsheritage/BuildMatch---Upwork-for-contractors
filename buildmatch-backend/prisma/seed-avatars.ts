/**
 * seed-avatars.ts
 * Assigns random randomuser.me portrait URLs to every User.
 * Contractor profiles get the same URL in their avatarUrl field.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 50 male + 50 female portraits from randomuser.me
function randomAvatarUrl(): string {
  const gender = Math.random() < 0.5 ? 'men' : 'women';
  const index  = Math.floor(Math.random() * 70) + 1; // 1–70
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, role: true, contractor: { select: { id: true } } },
  });

  console.log(`Setting avatars for ${users.length} users…`);

  for (const user of users) {
    const avatarUrl = randomAvatarUrl();

    await prisma.user.update({
      where: { id: user.id },
      data:  { avatarUrl },
    });

    // Mirror to ContractorProfile if applicable
    if (user.contractor) {
      await prisma.contractorProfile.update({
        where: { id: user.contractor.id },
        data:  { avatarUrl },
      });
    }

    console.log(`  ✓ ${user.id}  (${user.role})  →  ${avatarUrl}`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
