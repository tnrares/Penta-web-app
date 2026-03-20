import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';

// 1. INSTANȚA FASTIFY (GLOBAL)
const fastify = Fastify({ logger: false });

// 2. SETUP CONEXIUNE DB CU PRISMA CLIENT (GLOBAL)
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const startServer = async () => {
  // 3. ATASAREA RUTELOR
  
  // Endpoint 1: Simple Query
  fastify.get('/users', async (request, reply) => {
    const result = await prisma.user.findMany({
      take: 50,
    });
    return result;
  });

  // Endpoint 2: Complex Query (JOIN)
  fastify.get('/users-with-posts', async (request, reply) => {
    const result = await prisma.user.findMany({
      take: 50,
      include: {
        posts: true,
      },
    });
    return result;
  });

  // Scenariul 3 - Write (POST)
  fastify.post('/insert-user', async (request, reply) => {
    const newUser = await prisma.user.create({
      data: {
        name: `Test User ${Math.random()}`,
        email: `test-${Math.random()}@example.com`,
      },
      select: {
        id: true,
      },
    });

    return { success: true, id: newUser.id };
  });

  // Scenariul 4 - Update (PUT)
  fastify.put('/update-user', async (request, reply) => {
    await prisma.user.update({
      where: { id: 1 },
      data: {
        name: `Updated Name ${new Date().toISOString()}`,
      },
    });
    
    return { success: true };
  });
  
  // 4. PORNIREA SERVERULUI
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });
    console.log('Server Prisma running at http://localhost:3002');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

startServer();
