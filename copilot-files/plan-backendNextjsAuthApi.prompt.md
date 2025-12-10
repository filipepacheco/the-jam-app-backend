# Plan: Backend API Setup for Supabase Auth (Next.js)

**TL;DR:** Create Next.js API route handlers for authentication and user sync endpoints. Set up Supabase JWT verification middleware, create the `/api/auth/sync-user` endpoint to auto-create musicians from Supabase tokens, implement role-based access control middleware, and prepare database schema changes to support `supabaseUserId` foreign key linking.

## Steps

### 1. Create Supabase JWT Verification Middleware (`lib/api/supabaseMiddleware.ts`)
- Parse Authorization header (Bearer token)
- Verify JWT signature using Supabase public key
- Extract `sub` (supabaseUserId) and other claims from decoded token
- Handle expired/invalid tokens gracefully
- Attach decoded token to request context for downstream handlers
- Return standardized error responses (401 Unauthorized)

### 2. Add Backend Schema Changes (Prisma/Database)
- Add `supabaseUserId` (String, unique, nullable) column to `Musician` model
- Create Prisma migration: `createSupabaseUserIdColumn`
- Add database index on `supabaseUserId` for fast lookups
- Mark as nullable initially for backward compatibility with existing musicians
- Plan backfill script to migrate existing users if needed

### 3. Create Auth Sync Endpoint (`pages/api/auth/sync-user.ts`)
- POST request handler
- Receive Supabase token in `Authorization: Bearer {token}` header
- Use supabaseMiddleware to verify and extract supabaseUserId
- Query database: find existing musician by supabaseUserId
- **If exists:** return musician data + `isNewUser: false`
- **If not exists:** 
  - Create new musician with:
    - `supabaseUserId` = extracted from token
    - `name` = from Supabase user metadata or default
    - `email` = from Supabase user metadata
    - `phone` = null (will be collected later)
    - `role` = 'guest' (default)
    - `favoriteInstrument` = null
    - `favoriteGenre` = null
  - Return created musician + `isNewUser: true`
- Return response with HTTP 200 and musician object
- Handle edge cases: duplicate creation (race condition), invalid data

### 4. Add Role-Based Access Control Middleware (`lib/api/roleMiddleware.ts`)
- Higher-order middleware that wraps supabaseMiddleware
- Accept array of permitted roles as parameter: `roleMiddleware(['host', 'admin'])`
- After JWT verification, lookup musician in database by supabaseUserId
- Check if musician's `role` is in permitted roles array
- **If authorized:** attach musician object to request context, proceed to handler
- **If not authorized:** return 403 Forbidden with error message
- **If musician not found:** return 404 Not Found
- Used for protected endpoints (create jam, approve registrations, etc.)

### 5. Protect Existing Endpoints (Jam, Musician, Music routes)
- Apply `supabaseMiddleware` to all existing protected routes
- Replace any hardcoded or session-based musician lookups with token-verified lookups
- Update protected route files:
  - `/api/jams/` - Add middleware, use current user from token
  - `/api/jams/[id]` - GET (public), PATCH/DELETE (owner or host only)
  - `/api/musicians/` - GET (public list), POST (protected for self-update)
  - `/api/musicians/[id]` - GET (public), PATCH (owner only)
  - `/api/musics/` - GET (public), POST/PATCH/DELETE (host only)
  - `/api/musicas/jam/[jamId]` - GET (public)
- Add route-level authorization checks:
  - CREATE jam → require `role='host'`
  - UPDATE/DELETE jam → require owner or `role='host'`
  - APPROVE registrations → require `role='host'` for that jam
  - UPDATE musician → require owner or `role='admin'`

### 6. Create Health Check Route (`pages/api/health.ts`)
- Simple GET handler
- Check database connection status (test query or connection pool)
- Return JSON response:
  ```json
  {
    "status": "ok",
    "timestamp": "2025-12-09T10:30:00Z",
    "database": "connected"
  }
  ```
- Used for deployment monitoring and uptime checks
- No authentication required

### 7. Setup Environment Variables (`.env.local`)
- `SUPABASE_JWT_SECRET` - Public key/secret from Supabase dashboard
  - Found in: Supabase Dashboard → Project Settings → API → JWT Secret
  - Used for verifying JWT signature
- `SUPABASE_URL` - Supabase project URL (already may exist)
- `DATABASE_URL` - Existing Prisma connection string
- `NODE_ENV` - Set to 'production' for hosted deployment
- On application startup:
  - Validate that required env vars are present
  - Throw error if SUPABASE_JWT_SECRET is missing
  - Log which authentication providers are enabled

### 8. Update API Response Types (`types/api.ts`)
- Create `AuthSyncResponse` type:
  ```typescript
  {
    musician: Musician;
    isNewUser: boolean;
  }
  ```
- Create `ErrorResponse` type:
  ```typescript
  {
    error: string;
    statusCode: number;
  }
  ```
- Create `HealthCheckResponse` type
- Update existing response DTOs to match Swagger specs

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│         Frontend (React/Vite)                           │
├─────────────────────────────────────────────────────────┤
│  Sends API request with:                               │
│  Authorization: Bearer {supabaseToken}                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│         Next.js API Layer                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Route: POST /api/auth/sync-user                       │
│  ├─ supabaseMiddleware (verifies JWT)                 │
│  ├─ Extract supabaseUserId from token                 │
│  ├─ Query DB: find musician by supabaseUserId         │
│  ├─ If exists → return musician + isNewUser=false     │
│  └─ If not exists → create new + isNewUser=true       │
│                                                         │
│  Protected Routes (Jams, Musicians, Music)             │
│  ├─ roleMiddleware (verifies role permission)         │
│  ├─ JWT verification + musician lookup                │
│  ├─ Check role against endpoint requirements          │
│  └─ Execute handler if authorized                     │
│                                                         │
│  Route: GET /api/health                                │
│  ├─ No auth required                                  │
│  ├─ Check database connection                         │
│  └─ Return status                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│         Database (PostgreSQL via Prisma)                │
├─────────────────────────────────────────────────────────┤
│  Musician Table:                                        │
│  ├─ id (PK)                                            │
│  ├─ supabaseUserId (FK, unique, indexed)              │
│  ├─ name                                              │
│  ├─ email                                             │
│  ├─ phone                                             │
│  ├─ role (guest|host|admin)                           │
│  ├─ favoriteInstrument                                │
│  ├─ favoriteGenre                                     │
│  └─ createdAt, updatedAt                              │
└─────────────────────────────────────────────────────────┘
```

## Data Flow - Auth Sync (First Time User)

```
1. Frontend: User completes Supabase OAuth login
   └─ Gets Supabase token (JWT) valid for 1 week

2. Frontend: Call POST /api/auth/sync-user
   └─ Headers: { Authorization: "Bearer {supabaseToken}" }

3. Backend: supabaseMiddleware
   └─ Verify JWT signature using SUPABASE_JWT_SECRET
   └─ Extract: sub, email, user_metadata
   └─ Attach to request context

4. Backend: sync-user handler
   └─ Query: SELECT * FROM Musician WHERE supabaseUserId = ?
   
   IF musician found:
   └─ Return 200 { musician, isNewUser: false }
   
   IF musician not found:
   └─ Create new Musician {
        supabaseUserId: sub,
        name: user_metadata.name || email,
        email: email,
        phone: null,
        role: 'guest',
        favoriteInstrument: null,
        favoriteGenre: null
      }
   └─ Return 201 { musician, isNewUser: true }

5. Frontend: Receive response
   └─ IF isNewUser=true: Show OnboardingModal
   └─ Save musician data to AuthContext
   └─ Proceed with redirect
```

## Data Flow - Protected Route (e.g., GET /api/jams)

```
1. Frontend: Sends GET /api/jams with Authorization header

2. Backend: roleMiddleware(['guest', 'host'])
   └─ Call supabaseMiddleware (verify JWT + extract sub)
   └─ Query: SELECT * FROM Musician WHERE supabaseUserId = sub
   
   IF not found:
   └─ Return 404 Not Found
   
   IF found, check role:
   └─ IF musician.role NOT in ['guest', 'host']
      └─ Return 403 Forbidden
   
   IF role valid:
   └─ Attach musician to request context
   └─ Call handler

3. Handler: List all jams
   └─ Query: SELECT * FROM Jam (filtered by permissions if needed)
   └─ Return 200 with jams array
```

## Further Considerations

### 1. Token Verification Strategy
**Decision needed:** Should backend validate Supabase JWT signature or trust frontend?
- **Option A (Recommended):** Verify signature server-side using Supabase public key
  - Pro: Maximum security, prevents token forgery
  - Pro: Works if frontend is compromised
  - Con: Requires managing Supabase public key rotation
  - Implementation: Use `jsonwebtoken` library to verify
  
- **Option B:** Trust token from frontend (require HTTPS)
  - Pro: Simpler, less overhead
  - Con: Less secure, relies on transport layer only
  - Implementation: Just decode token without verification

**Recommendation:** Use Option A for production security.

### 2. Error Handling Standards
**API error responses:**
- `401 Unauthorized` - Missing or invalid/expired token
  ```json
  { "error": "Invalid or expired authentication token", "statusCode": 401 }
  ```
- `403 Forbidden` - Valid token but insufficient role/permissions
  ```json
  { "error": "Insufficient permissions for this action", "statusCode": 403 }
  ```
- `404 Not Found` - Musician not found for given token
  ```json
  { "error": "Musician profile not found", "statusCode": 404 }
  ```
- `400 Bad Request` - Invalid request data
  ```json
  { "error": "Invalid request payload", "statusCode": 400 }
  ```

### 3. Migration Timing
**Strategy for `supabaseUserId` column:**
- Phase 1: Add nullable column to schema
- Phase 2: New users get supabaseUserId on sync
- Phase 3 (Optional): Create migration script to backfill existing musicians
  - Map existing session/email to Supabase users
  - Or prompt existing users to re-authenticate
- Production: Keep nullable for backward compatibility initially
- Future: Make NOT NULL once all users migrated

### 4. Socket.IO Integration (Real-Time Features)
**Authentication for WebSocket connections:**
- Client connects with: `socket.io({ auth: { token: supabaseToken } })`
- Server middleware intercepts connection:
  ```typescript
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const decoded = verifySupabaseToken(token);
      socket.data.supabaseUserId = decoded.sub;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });
  ```
- Real-time events can then use `socket.data.supabaseUserId` to identify user

### 5. Rate Limiting (Future)
Consider implementing rate limiting on auth endpoints:
- `/api/auth/sync-user` - limit to 10 requests per minute per token
- Protect against token enumeration attacks
- Library suggestion: `express-rate-limit` (works with Next.js)

### 6. Logging and Monitoring
Add structured logging:
- Log successful auth syncs (with masked supabaseUserId)
- Log failed token verifications
- Monitor sync endpoint latency
- Alert on sustained 401/403 rates

## Files to Create

### New Files
- `lib/api/supabaseMiddleware.ts` - JWT verification middleware
- `lib/api/roleMiddleware.ts` - Role-based access control
- `pages/api/auth/sync-user.ts` - Auth sync endpoint
- `pages/api/health.ts` - Health check endpoint
- `types/api.ts` - API response types (if not exists)

### Files to Modify
- `prisma/schema.prisma` - Add `supabaseUserId` to Musician model
- `.env.local` - Add SUPABASE_JWT_SECRET
- `pages/api/jams/index.ts` - Apply middleware
- `pages/api/jams/[id].ts` - Apply middleware + role checks
- `pages/api/musicians/index.ts` - Apply middleware
- `pages/api/musicians/[id].ts` - Apply middleware + owner checks
- `pages/api/musics/index.ts` - Apply middleware + role checks
- `pages/api/musicas/jam/[jamId].ts` - Apply middleware (public read)

### Prisma Migration
```bash
npx prisma migrate dev --name addSupabaseUserId
```

## Implementation Checklist

- [ ] Step 1: Create supabaseMiddleware.ts with JWT verification
- [ ] Step 2: Add supabaseUserId column to Musician in schema.prisma
- [ ] Step 3: Run Prisma migration to create column
- [ ] Step 4: Create roleMiddleware.ts with authorization checks
- [ ] Step 5: Implement POST /api/auth/sync-user endpoint
- [ ] Step 6: Create GET /api/health endpoint
- [ ] Step 7: Add SUPABASE_JWT_SECRET to .env.local
- [ ] Step 8: Apply supabaseMiddleware to all protected routes
- [ ] Step 9: Apply roleMiddleware to host-only endpoints
- [ ] Step 10: Update API response types in types/api.ts
- [ ] Step 11: Test auth sync flow with Supabase test token
- [ ] Step 12: Test role-based access control (guest vs host)
- [ ] Step 13: Test health check endpoint
- [ ] Step 14: Verify all existing endpoints still work
- [ ] Step 15: Integration test with frontend auth flow

## Dependencies Required

```json
{
  "jsonwebtoken": "^9.1.2",
  "jose": "^4.15.4"
}
```

Or use Supabase's JWT verification library:
```json
{
  "@supabase/supabase-js": "^2.38.0"
}
```

**Note:** Verify versions compatible with your Node.js version (recommended: 18.x or later)

