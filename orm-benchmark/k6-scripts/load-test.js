import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // incalzire: urcă la 10 useri in 10 sec
    { duration: '30s', target: 50 }, // Stress: ține 50 useri timp de 30 sec
    { duration: '10s', target: 0 },  // racire: coboara la 0    
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% din request-uri trebuie sa fie sub 500ms
  },
};

// PORTUL se ia din variabila de mediu sau default 3000 
const PORT = __ENV.PORT || 3000;
// Use host.docker.internal when running in Docker, localhost otherwise
const HOST = __ENV.HOST || 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;

export default function () {
  // Scenario 1: Complex Read (Users + Posts - JOIN)
  const resComplex = http.get(`${BASE_URL}/users-with-posts`);
  check(resComplex, {
    'Complex Read status 200': (r) => r.status === 200,
  });

  // Scenario 2: Write Test (POST /insert-user)
  const resWrite = http.post(`${BASE_URL}/insert-user`, JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(resWrite, {
    'Write status 200': (r) => r.status === 200,
  });
  
  // Scenario 3: Update Test (PUT /update-user)
  const resUpdate = http.put(`${BASE_URL}/update-user`, JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(resUpdate, {
    'Update status 200': (r) => r.status === 200,
  });
  
  // Scenario 4: Simple Read (Users) - Acesta a fost testat deja

  sleep(1); 
} 
