import { disconnectPrisma, getPrisma } from '../lib/prisma.js';

const DEV_RESET_TABLES = [
  'quote_notes',
  'quote_versions',
  'quotes',
  'lead_contacts',
  'service_area_requests',
  'attribution_touches',
  'audit_logs',
  'idempotency_records',
  'leads'
] as const;

const main = async () => {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('DATABASE_URL is required to run the freehand cutover reset.');
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${DEV_RESET_TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`
  );

  console.log(
    `Cleared development quote data for freehand cutover: ${DEV_RESET_TABLES.join(', ')}`
  );
};

main()
  .catch((error) => {
    console.error('Freehand cutover reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
