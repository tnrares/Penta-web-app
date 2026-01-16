import Fastify from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg'; 
import * as schema from './schema';
import { eq } from 'drizzle-orm';

// 1. INSTANȚA FASTIFY (GLOBAL)
const fastify = Fastify({ logger: false });

// 2. SETUP CONEXIUNE DB CU POOL (GLOBAL)
const pool = new Pool({
  connectionString: "postgresql://admin:password123@localhost:5432/benchmark",
  max: 20, 
  idleTimeoutMillis: 30000,
});


const startServer = async () => {
  // 3. DEFINIREA CLIENTULUI DB DUPĂ CE POOL-ul ESTE DEFINIT
  const db = drizzle(pool, { schema }); 

  // 4. ATASAREA RUTELOR (ACOLO UNDE db ESTE DEFINIT)
  
  // Endpoint 1: Simple Query
  fastify.get('/users', async (request, reply) => {
    const result = await db.query.users.findMany({
      limit: 50,
    });
    return result;
  });

  // Endpoint 2: Complex Query (JOIN)
  fastify.get('/users-with-posts', async (request, reply) => {
    const result = await db.query.users.findMany({
      limit: 50,
      with: {
        posts: true, 
      },
    });
    return result;
  });

  // Scenariul 3 - Write (POST)
  fastify.post('/insert-user', async (request, reply) => {
    const [newUser] = await db.insert(schema.users).values({
      name: `Test User ${Math.random()}`,
      email: `test-${Math.random()}@example.com`,
    }).returning({ id: schema.users.id }); 

    return { success: true, id: newUser.id };
  });

  // Scenariul 4 - Update (PUT)
  fastify.put('/update-user', async (request, reply) => {
    await db.update(schema.users)
      .set({ name: `Updated Name ${new Date().toISOString()}` })
      .where(eq(schema.users.id, 1));
    
    return { success: true };
  });
  
  // 5. PORNIREA SERVERULUI
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server Drizzle (Pooled) running at http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();