# ORM Benchmark

Proiect pentru benchmark-ul diferitelor ORM-uri.

## Tehnologii Instalate

### Docker & Database

- **Docker Compose** - pentru gestionarea containerelor
- **PostgreSQL 16 Alpine** - baza de date folosită pentru benchmark
  - Container name: `benchmark_db`
  - Port: `5432`
  - User: `admin`
  - Password: `password123`
  - Database: `benchmark`
  - Volume persistent: `db_data`

### Dependencies (Production)

- **@faker-js/faker** (^10.1.0) - pentru generarea de date de test fake
- **dotenv** (^17.2.3) - pentru gestionarea variabilelor de mediu
- **pg** (^8.16.3) - client PostgreSQL pentru Node.js

### Dev Dependencies

- **@types/node** (^24.10.1) - tipuri TypeScript pentru Node.js
- **@types/pg** (^8.15.6) - tipuri TypeScript pentru pg
- **ts-node** (^10.9.2) - pentru rularea directă a fișierelor TypeScript
- **typescript** (^5.9.3) - compilator TypeScript

### Configurație TypeScript

- **Module**: `nodenext`
- **Target**: `esnext`
- **Strict mode**: activat
- **Source maps**: activat
- **Declarations**: activat
- **Isolated modules**: activat
- **Verbatim module syntax**: activat

## Instalare

1. Instalează dependențele:
```bash
npm install
```

2. Pornește baza de date cu Docker Compose:
```bash
docker-compose up -d
```

## Structura Proiectului

```
orm-benchmark/
├── docker-compose.yml    # Configurație Docker pentru PostgreSQL
├── package.json          # Dependencies și scripturi npm
├── tsconfig.json         # Configurație TypeScript
└── node_modules/         # Dependencies instalate
```

## Utilizare

Baza de date PostgreSQL este disponibilă la:
- **Host**: `localhost`
- **Port**: `5432`
- **User**: `admin`
- **Password**: `password123`
- **Database**: `benchmark`

## Seeding Database

Pentru a popula baza de date cu date de test, rulează:

```bash
npx ts-node seed.ts
```

### Date Generate

Scriptul `seed.ts` generează următoarele date:

- **10,000 utilizatori** (`users`)
  - Nume generate cu `@faker-js/faker`
  - Email-uri unice (format: `user0@domain.com`, `user1@domain.com`, etc.)
  - Timestamp `created_at` automat

- **50,000 postări** (`posts`)
  - Titluri generate aleatoriu
  - Conținut generat aleatoriu
  - Legături către utilizatori aleatori (1-10,000)
  - Timestamp `created_at` automat

### Structura Tabelelor

**Tabela `users`:**
- `id` - SERIAL PRIMARY KEY
- `name` - VARCHAR(255) NOT NULL
- `email` - VARCHAR(255) NOT NULL UNIQUE
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**Tabela `posts`:**
- `id` - SERIAL PRIMARY KEY
- `title` - VARCHAR(255) NOT NULL
- `content` - TEXT
- `author_id` - INTEGER REFERENCES users(id)
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Performanță Seeding

- Datele sunt inserate în batch-uri de **1,000 de rânduri** pentru optimizarea vitezei
- Scriptul afișează progresul și durata totală de execuție

## Load Testing cu k6

Proiectul include configurație pentru rularea testelor de load cu k6 folosind Docker.

### Configurație Docker

Serviciul k6 este configurat în `docker-compose.yml` cu:
- **Image**: `grafana/k6:latest`
- **Volumes**: 
  - `./k6-scripts:/scripts` - pentru scripturile de test
  - `.:/workspace` - pentru accesul la module din proiect
- **Working directory**: `/scripts`
- **Environment variables**:
  - `PORT=3000` - portul serverului de testat
  - `HOST=host.docker.internal` - host-ul pentru accesarea serviciilor de pe host (Windows/Mac)

### Rulare k6 cu Docker

#### Metoda 1: Folosind Docker Compose (recomandat)

```bash
# Rulează testul cu setările default (PORT=3000)
docker-compose run --rm k6

# Rulează testul cu un port specificat
docker-compose run --rm -e PORT=3001 k6

# Rulează testul cu un host specificat (pentru Linux, folosește IP-ul host-ului)
docker-compose run --rm -e HOST=172.17.0.1 -e PORT=3000 k6
```

#### Metoda 2: Folosind Docker direct

```bash
# Din directorul root al proiectului
docker run --rm -i -v ${PWD}/k6-scripts:/scripts -v ${PWD}:/workspace -w /scripts -e PORT=3000 -e HOST=host.docker.internal grafana/k6:latest run load-test.js
```

**Pentru PowerShell (Windows):**
```powershell
docker run --rm -i -v ${PWD}/k6-scripts:/scripts -v ${PWD}:/workspace -w /scripts -e PORT=3000 -e HOST=host.docker.internal grafana/k6:latest run load-test.js
```

### Structura Testului

Testul `k6-scripts/load-test.js` include:
- **Stages**: 
  - Încălzire: 10 useri în 10 secunde
  - Stress: 50 useri timp de 30 secunde
  - Răcire: coboară la 0 useri în 10 secunde
- **Thresholds**: 95% din request-uri trebuie să fie sub 500ms
- **Scenarii testate**:
  - Simple Query: `GET /users`
  - Complex Query: `GET /users-with-posts` (JOIN)

### Notă Importantă

Când rulezi k6 în Docker și serverul rulează pe host:
- **Windows/Mac**: Folosește `host.docker.internal` (setat implicit)
- **Linux**: Poate fi necesar să folosești IP-ul host-ului sau să adaugi `extra_hosts` în docker-compose.yml

## Scripturi Disponibile

- `npm test` - rulează testele (în prezent nu sunt configurate)