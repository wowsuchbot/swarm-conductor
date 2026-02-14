# Development Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js** 20.x LTS or higher ([Download](https://nodejs.org/))
- **pnpm** 8.x or higher (Install: `npm install -g pnpm`)
- **Docker** 24.x or higher ([Download](https://www.docker.com/products/docker-desktop))
- **Docker Compose** 2.x or higher (Included with Docker Desktop)
- **Git** 2.x or higher

### Optional

- **PostgreSQL Client** (`psql`) for database management
- **Redis CLI** (`redis-cli`) for cache debugging
- **Expo CLI** (Install: `npm install -g @expo/cli`) for mobile development
- **VS Code** with recommended extensions (see below)

### Check Versions

```bash
node --version    # Should be v20.x or higher
pnpm --version    # Should be 8.x or higher
docker --version  # Should be 24.x or higher
git --version     # Should be 2.x or higher
```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/wowsuchbot/swarm-conductor.git
cd swarm-conductor
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This installs dependencies for:
# - packages/api
# - packages/agents
# - packages/mobile
# - packages/shared
```

### 3. Environment Variables

Create `.env` files for each package:

#### `packages/api/.env`

```bash
# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/swarm_conductor
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key-change-in-production
REFRESH_TOKEN_EXPIRES_IN=7d

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# CORS
CORS_ORIGIN=http://localhost:19006,exp://localhost:8081

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
```

#### `packages/agents/.env`

```bash
# Agent System
NODE_ENV=development
AGENT_WORKER_CONCURRENCY=5

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/swarm_conductor

# Redis
REDIS_URL=redis://localhost:6379

# OpenClaw Configuration
OPENCLAW_API_KEY=your-openclaw-api-key
OPENCLAW_BASE_URL=https://api.openclaw.io

# Heartbeat
HEARTBEAT_INTERVAL_MS=30000
HEARTBEAT_TIMEOUT_MS=5000

# Logging
LOG_LEVEL=debug
```

#### `packages/mobile/.env`

```bash
# API
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_WS_URL=http://localhost:3000

# Stripe (Test Mode)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Feature Flags
EXPO_PUBLIC_ENABLE_ANALYTICS=false
EXPO_PUBLIC_ENABLE_SENTRY=false
```

**Important:** Replace placeholder values with actual keys. For Stripe, use test mode keys during development.

### 4. Start Infrastructure Services

```bash
# Start PostgreSQL and Redis with Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps

# Should show:
# - postgres (port 5432)
# - redis (port 6379)
```

### 5. Setup Database

```bash
# Navigate to API package
cd packages/api

# Generate migration files from schema
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# (Optional) Seed database with sample data
pnpm db:seed

# Verify database setup
psql postgresql://postgres:postgres@localhost:5432/swarm_conductor -c "\dt"
```

---

## Running the Application

### Development Mode (All Services)

Run all services in parallel using the root workspace:

```bash
# From project root
pnpm dev

# This starts:
# - API server on http://localhost:3000
# - Agent system (background workers)
# - Mobile app on exp://localhost:8081
```

### Individual Services

#### API Server Only

```bash
cd packages/api
pnpm dev

# API available at http://localhost:3000
# API docs at http://localhost:3000/api-docs
```

#### Agent System Only

```bash
cd packages/agents
pnpm dev

# Monitors BullMQ queues and processes agent tasks
```

#### Mobile App Only

```bash
cd packages/mobile
pnpm start

# Opens Expo DevTools in browser
# Scan QR code with Expo Go app (iOS/Android)
# Or press 'i' for iOS simulator, 'a' for Android emulator
```

---

## Development Workflow

### Project Structure

```
swarm-conductor/
├── packages/
│   ├── api/              # Express API server
│   ├── agents/           # Agent orchestration
│   ├── mobile/           # Expo React Native app
│   └── shared/           # Shared TypeScript types
├── infrastructure/      # Docker configs
├── docs/                # Documentation
├── pnpm-workspace.yaml # Workspace config
└── package.json         # Root package.json
```

### Common Commands

```bash
# Root workspace commands (run from project root)
pnpm dev              # Start all services
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier
pnpm clean            # Clean build artifacts

# Package-specific commands (run from package directory)
pnpm dev              # Start in dev mode
pnpm build            # Build for production
pnpm test             # Run tests
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Lint code
pnpm type-check       # TypeScript type checking
```

### Working with TypeScript

All packages use TypeScript with strict mode enabled:

```bash
# Type check all packages
pnpm type-check

# Type check specific package
cd packages/api
pnpm type-check

# Watch mode for continuous type checking
pnpm type-check --watch
```

### Database Management

#### Schema Changes

```bash
cd packages/api

# 1. Modify schema in src/db/schema.ts
# 2. Generate migration
pnpm db:generate

# 3. Review migration file in src/db/migrations/
# 4. Apply migration
pnpm db:migrate

# 5. (Optional) Rollback last migration
pnpm db:rollback
```

#### Database Studio (GUI)

```bash
cd packages/api
pnpm db:studio

# Opens Drizzle Studio at http://localhost:4983
# Browse and edit data with GUI
```

#### Manual Database Access

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/swarm_conductor

# Useful SQL commands:
\dt                    # List tables
\d+ table_name        # Describe table
SELECT * FROM users LIMIT 5;
```

### Redis Management

```bash
# Connect to Redis
redis-cli

# Common commands:
KEYS *                # List all keys
GET key_name          # Get value
DEL key_name          # Delete key
FLUSHDB               # Clear all data (careful!)

# Monitor real-time commands
redis-cli MONITOR
```

### Mobile Development

#### iOS Simulator (macOS only)

```bash
cd packages/mobile
pnpm start
# Press 'i' to open iOS simulator
```

#### Android Emulator

```bash
# Start emulator first (Android Studio)
# Then:
cd packages/mobile
pnpm start
# Press 'a' to open Android emulator
```

#### Physical Device

```bash
cd packages/mobile
pnpm start
# Scan QR code with Expo Go app
# iOS: App Store
# Android: Google Play
```

#### Debugging

```bash
# React Native debugger
pnpm start
# Press 'j' to open debugger

# View logs
pnpm logs

# Clear cache
pnpm start --clear
```

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/api
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### Integration Tests

```bash
cd packages/api
pnpm test:integration

# Requires test database
# Set DATABASE_URL in .env.test
```

### End-to-End Tests

```bash
# Start all services first
pnpm dev

# Run E2E tests (separate terminal)
pnpm test:e2e
```

### API Testing with Thunder Client / Postman

1. Import collection from `docs/api-collection.json`
2. Set environment variables:
   - `BASE_URL`: http://localhost:3000/api/v1
   - `TOKEN`: (Get from login response)
3. Run requests

---

## Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/packages/api",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Agent System",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/packages/agents",
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

All packages use Winston for structured logging:

```typescript
import { logger } from '@/lib/logger';

logger.debug('Debug message', { userId: '123' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error });
```

### Debugging WebSocket Connections

```javascript
// Client-side debugging
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('error', (err) => console.error('Error:', err));

// Enable debug mode
localStorage.debug = 'socket.io-client:*';
```

---

## Code Quality

### Linting

```bash
# Lint all packages
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix

# Lint specific package
cd packages/api
pnpm lint
```

ESLint configuration:
- TypeScript rules
- React/React Native rules (mobile)
- Prettier integration
- Import sorting

### Formatting

```bash
# Format all files
pnpm format

# Check formatting without changes
pnpm format:check
```

Prettier configuration in `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Pre-commit Hooks

Husky + lint-staged runs checks before commits:

```bash
# Install git hooks
pnpm prepare

# Hooks run automatically on:
# - git commit: lint + format staged files
# - git push: run tests
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 pnpm dev
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
pnpm db:migrate
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
# Should return: PONG

# View logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules packages/*/node_modules
pnpm install

# Clear pnpm cache
pnpm store prune
```

### TypeScript Errors

```bash
# Rebuild all packages
pnpm clean
pnpm build

# Check for type errors
pnpm type-check
```

### Mobile App Not Loading

```bash
# Clear Expo cache
cd packages/mobile
pnpm start --clear

# Reset Metro bundler
r (in Expo DevTools)

# Check API_URL in .env
echo $EXPO_PUBLIC_API_URL
```

### Build Failures

```bash
# Clean all build artifacts
pnpm clean

# Rebuild from scratch
pnpm install
pnpm build

# Check for circular dependencies
pnpm why package-name
```

---

## VS Code Setup

### Recommended Extensions

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "firsttris.vscode-jest-runner",
    "expo.vscode-expo-tools",
    "orta.vscode-jest"
  ]
}
```

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

---

## Performance Optimization

### Development Build Times

- Use `--turbo` flag with pnpm for faster installs
- Enable TypeScript incremental compilation
- Use SWC for faster compilation (already configured)

### Hot Module Replacement

- API server: Automatic reload with nodemon
- Mobile app: Fast Refresh enabled by default
- Agent system: Manual restart required for now

---

## Contributing

### Branch Naming

- Feature: `feature/description`
- Bug fix: `fix/description`
- Hotfix: `hotfix/description`
- Docs: `docs/description`

### Commit Messages

Follow Conventional Commits:

```
feat: add user authentication
fix: resolve database connection timeout
docs: update API documentation
chore: upgrade dependencies
test: add unit tests for billing service
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes and commit
3. Push branch and create PR
4. Ensure CI passes (linting, tests, build)
5. Request review from team
6. Merge after approval

---

## Additional Resources

- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

## Getting Help

- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share ideas
- Discord: Join our community (link in README)

---

## Quick Reference

```bash
# Start everything
pnpm dev

# Run tests
pnpm test

# Lint and format
pnpm lint && pnpm format

# Database migrations
cd packages/api && pnpm db:generate && pnpm db:migrate

# View logs
docker-compose logs -f

# Reset everything
docker-compose down -v && pnpm clean && pnpm install
```