import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // Add seed data here
}

main().finally(() => prisma.$disconnect());
