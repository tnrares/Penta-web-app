import { Client } from 'pg';
import { faker } from '@faker-js/faker';

// configurare conexiune (corespunde cu docker-compose.yml)
const client = new Client({
  connectionString: 'postgres://admin:password123@localhost:5432/benchmark',
});

const NUM_USERS = 10000;
const NUM_POSTS = 50000;
const BATCH_SIZE = 1000; //inseram cate 1000 de randuri o data pentru viteza

async function main() {
  console.time('Seeding Duration');
  await client.connect();

  try {
    console.log('Resetare baza de date...');
    //curatare si creare tabele (SQL pur)
    await client.query(`DROP TABLE IF EXISTS posts;`);
    await client.query(`DROP TABLE IF EXISTS users;`);

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        author_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tabele create.');

    // generare users
    console.log(`Generating ${NUM_USERS} users...`);
    for (let i = 0; i < NUM_USERS; i += BATCH_SIZE) {
      const values: any[] = [];
      const placeholders: string[] = [];
      
      let paramIndex = 1;
      for (let j = 0; j < BATCH_SIZE; j++) {
        if (i + j >= NUM_USERS) break;
        
        const userIndex = i + j;
        values.push(faker.person.fullName());
        // Ensure unique emails by including user index in the email
        values.push(`user${userIndex}@${faker.internet.domainName()}`);
        placeholders.push(`($${paramIndex}, $${paramIndex + 1})`);
        paramIndex += 2;
      }

      const query = `INSERT INTO users (name, email) VALUES ${placeholders.join(', ')}`;
      await client.query(query, values);
      process.stdout.write('.');
    }
    console.log('\nUtilizatori inserati.');

    //generare posts
    console.log(`Generating ${NUM_POSTS} posts...`);
    for (let i = 0; i < NUM_POSTS; i += BATCH_SIZE) {
      const values: any[] = [];
      const placeholders: string[] = [];
      
      let paramIndex = 1;
      for (let j = 0; j < BATCH_SIZE; j++) {
        if (i + j >= NUM_POSTS) break;

        values.push(faker.lorem.sentence());
        values.push(faker.lorem.paragraph());
        // random author_id intre 1 si NUM_USERS
        values.push(Math.floor(Math.random() * NUM_USERS) + 1); 
        
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
        paramIndex += 3;
      }

      const query = `INSERT INTO posts (title, content, author_id) VALUES ${placeholders.join(', ')}`;
      await client.query(query, values);
      process.stdout.write('.');
    }
    console.log('\nPosts inserate.');

  } catch (err) {
    console.error('Eroare la seeding baza de date:', err);
  } finally {
    await client.end();
    console.timeEnd('Seeding Duration');
  }
}

main();