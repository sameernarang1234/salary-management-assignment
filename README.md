# ACME Salary Management

Web software for ACME's HR Manager to manage salary records for 10,000 employees in several
countries, track every salary change, and answer pay questions without spreadsheets.

**Live app:** https://15.135.185.17.sslip.io (AWS EC2 + RDS, Sydney, loaded with 10,000 sample
employees). It has one HR Manager account. The sign-in details are shared with reviewers
separately and are not stored in this repository.

- **Requirements:** [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- **Plan, data model and design decisions:** [docs/PLAN.md](docs/PLAN.md)
- **Rules followed by the AI coding agent:** [CLAUDE.md](CLAUDE.md)
- **Prompts used to build it:** [PROMPTS.md](PROMPTS.md)

## Stack

| Part | Technology |
|---|---|
| Frontend | React 19 (functional components), TypeScript, Vite, MUI, Redux Toolkit + RTK Query, React Router, Recharts |
| Backend | Node.js 24, Express 5, TypeScript, Zod |
| Database | PostgreSQL 17 with Prisma 7 (migrations, typed queries) |
| Tests | Vitest, Supertest, React Testing Library, MSW |
| Production | One Docker image (API + built frontend) behind Caddy (HTTPS), Amazon RDS for PostgreSQL |

## Run locally

Requires Node.js 24 and Docker.

```bash
npm install
cp backend/.env.example backend/.env
cp backend/.env.test.example backend/.env.test
npm run db:up        # PostgreSQL in Docker (development and test databases)
npm run db:migrate   # apply migrations
npm run seed         # 10,000 employees and the HR Manager account
npm run dev          # API on http://localhost:3000
npm run dev -w frontend   # app on http://localhost:5173 (forwards /api to the API)
```

Sign in with the local demo account from `backend/.env.example`
(`hr.manager@acme.example` / `ChangeMe-Demo-2026`). Local use only.

## Tests and checks

```bash
npm test             # backend (against the test database) and frontend
npm run typecheck
npm run format:check
```

## Deploy to AWS (EC2 + RDS)

```
Browser ──HTTPS──▶ EC2 (Ubuntu)
                     ├─ Caddy: HTTPS (automatic Let's Encrypt certificate)
                     └─ App container: Express API + built React frontend (private port 3000)
                              │ TLS, verified against Amazon's RDS certificate authorities
                              ▼
                   RDS PostgreSQL (private: reachable only from the EC2 security group)
```

Region: **Asia Pacific (Sydney) `ap-southeast-2`** (the AWS free plan allows one region; create
everything below in it). Approximate cost: about $35–38/month (EC2 `t4g.small`, public IPv4,
20 GB disk, RDS `db.t4g.micro` with 20 GB), covered by the new-account credits.

### 1. Security groups (EC2 → Security Groups, default VPC)

- `salary-app-sg`: inbound SSH 22 from **your IP only**, HTTP 80 and HTTPS 443 from anywhere.
- `salary-db-sg`: inbound PostgreSQL 5432 **from the security group `salary-app-sg`** only.

### 2. Database (RDS → Create database)

- PostgreSQL 17, template *Free tier* or *Dev/Test*, identifier `salary-db`.
- Master username `salary_admin` with a strong password (keep it in a password manager).
- `db.t4g.micro`, 20 GB gp3, single-AZ.
- Default VPC, **Public access: No**, security group `salary-db-sg` only.
- Initial database name `salary`, automated backups 7 days, encryption on, deletion protection on.
- Note the endpoint, e.g. `salary-db.xxxxxxxxxxxx.ap-southeast-2.rds.amazonaws.com`.

### 3. Server (EC2 → Launch instance)

- Ubuntu Server 24.04 LTS (64-bit **Arm**), `t4g.small` (2 GB), 20 GB gp3. If the free plan only
  offers `t4g.micro` (1 GB), use it: the 2 GB of swap in step 4 lets the image build, just more slowly.
- A new ED25519 key pair (download the `.pem`), security group `salary-app-sg`.
- Allocate an **Elastic IP** and associate it with the instance.
- HTTPS address: your own domain (an `A` record to the Elastic IP), or the free
  `<elastic-ip-with-dashes>.sslip.io`, e.g. `13-233-10-20.sslip.io`.

### 4. Prepare the server

```bash
ssh -i salary-app.pem ubuntu@<elastic-ip>

# Updates, automatic security updates, and 2 GB of swap for building on 2 GB of RAM
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y unattended-upgrades git
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker Engine and the Compose plugin (Docker's official repository)
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu   # then log out and back in
```

### 5. Configure and start

```bash
git clone <your-repository-url> salary && cd salary
cp .env.production.example .env.production
nano .env.production      # DOMAIN, DATABASE_URL (RDS endpoint + password), HR Manager email and password
chmod 600 .env.production

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

On start the app applies any pending migrations to RDS, then listens; Caddy obtains the HTTPS
certificate. Load the data and create the HR Manager account once:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run seed:prod
```

### 6. Verify

- Open `https://<DOMAIN>` and sign in. The session cookie is `HttpOnly; Secure; SameSite=Strict`.
- The database is private: from your own computer, `nc -vz <rds-endpoint> 5432` must time out.
- Set a monthly budget alert in **Billing → Budgets**.

### Updating

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### How the production setup was tested

The production image was run locally against an SSL-only PostgreSQL with its own certificate
authority (standing in for RDS), behind Caddy: migrations and the app connected over TLS 1.3 with
the certificate verified, and both refused to connect when given the wrong certificate authority.
The test CA was placed at the end of Amazon's full certificate bundle, as on RDS: Prisma's
migration engine trusts only the first certificate in a file, so on start-up `src/db/migrate.ts`
verifies the server against the whole bundle (hostname included) and gives Prisma just the root
that signed it.
