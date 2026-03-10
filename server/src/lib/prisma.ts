import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | null = null;

const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

export const hasDatabaseConfig = () => {
  const url = process.env.DATABASE_URL?.trim();
  return typeof url === 'string' && url.length > 0;
};

export const getPrisma = () => {
  if (!hasDatabaseConfig()) {
    return null;
  }

  if (!prismaSingleton) {
    prismaSingleton = createPrismaClient();
  }

  return prismaSingleton;
};

export const disconnectPrisma = async () => {
  if (!prismaSingleton) {
    return;
  }

  await prismaSingleton.$disconnect();
  prismaSingleton = null;
};
