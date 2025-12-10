# Plan: Fix 9 npm Security Vulnerabilities

## Overview
Your project has 4 low, 2 moderate, and 3 high-severity vulnerabilities. These stem from outdated transitive dependencies in your NestJS ecosystem. The fix upgrades key direct dependencies to patch versions that include security fixes, then regenerates the lock file to pull in patched transitive deps.

## Steps

### 1. Upgrade NestJS core packages
Update `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/platform-socket.io`, `@nestjs/websockets`, `@nestjs/swagger` from ^10.0.0 to ^10.4.x (latest stable).

### 2. Upgrade validation & transformation
Bump `class-validator` to ^0.14.1 and `class-transformer` to ^0.5.2 to get input validation security patches.

### 3. Upgrade runtime deps
Update `socket.io` (^4.7.2), `rxjs` (^7.8.2), `uuid` (^9.0.1), and `@prisma/client` (^6.x latest).

### 4. Upgrade dev tooling
Update `@types/node` (^20.10.x), `@types/express` (^4.17.21), `typescript` (^5.3.x), `ts-node` (^10.9.2), and ESLint/Prettier patches.

### 5. Regenerate lock file
Delete `node_modules` + `package-lock.json`, run `npm install` to resolve all transitive dependencies with security patches.

### 6. Validate
Run `npm audit` (should show 0 vulnerabilities), then `npm run build` and quick `npm start:dev` smoke test.

## Further Considerations

1. **All within major versions** – Patch/minor bumps only; NestJS 10.x stability maintained, minimal breaking change risk.

2. **Test scope** – Focus on WebSocket, validation, and Swagger endpoints since those are where the vulns likely live.

3. **If issues arise** – Can revert specific packages individually or pin to known-good versions if conflicts appear.

## Affected Dependency Categories

- **NestJS framework** (common, core, platform-*, websockets, swagger)
- **Input validation** (class-validator, class-transformer)
- **Real-time** (socket.io, rxjs)
- **Database** (prisma)
- **Dev tooling** (TypeScript, ESLint, types)

## Expected Outcome

- All 9 vulnerabilities resolved
- Clean `npm audit` output
- No breaking changes to application logic
- Build succeeds without errors
- Application runs without errors in dev mode

