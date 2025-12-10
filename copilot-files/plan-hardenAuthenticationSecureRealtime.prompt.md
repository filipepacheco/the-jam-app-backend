# Plan: Harden Authentication & Secure Real-Time Communication (NestJS)

**TL;DR:** Strengthen existing simple email/phone authentication in your NestJS backend by hardening the `AuthService`, implementing role-based guards across controllers, adding Socket.IO authentication middleware, and creating rate limiting on login endpoints. Keep the simplified auth model (no Supabase) for MVP simplicity. Focus on security and data validation.

## Steps

### 1. Harden Existing `AuthService` (`src/auth/auth.service.ts`)
- Add input validation for email/phone format
- Implement conflict detection for duplicate registrations (race conditions)
- Add retry logic for database conflicts
- Hash & salt passwords if later needed (prepare infrastructure)
- Add audit logging for login attempts (success/failure)
- Implement account lockout after N failed attempts
- Add token refresh mechanism with rolling expiration
- Validate JWT claims in `getMusicianProfile`

### 2. Create JWT Guard for Route Protection (`src/auth/guards/jwt.guard.ts`)
- Already exists; verify it validates token signatures
- Ensure it extracts `musicianId` from JWT payload
- Attach musician data to `request.user` for downstream handlers
- Handle token expiration gracefully
- Return 401 with clear error message for invalid tokens

### 3. Create Role-Based Guards (`src/auth/guards/role.guard.ts`)
- Implement `RoleGuard` that checks `Musician.role` field
- Accept array of permitted roles: `@UseGuards(RoleGuard(['host', 'admin']))`
- Reject requests if musician role not in whitelist
- Return 403 Forbidden for insufficient permissions
- Attach musician object to request context for handler use

### 4. Apply Guards to Protected Endpoints
- **Jam Controller** (`src/jam/jam.controller.ts`):
  - `POST /jams` → `@UseGuards(JwtAuthGuard, RoleGuard(['host']))`
  - `PATCH /jams/:id` → require host or admin
  - `DELETE /jams/:id` → require host or admin
  
- **Musician Controller** (`src/musico/musico.controller.ts`):
  - `PATCH /musicians/:id` → require self or admin
  - `GET /musicians` → public
  
- **Music Controller** (`src/musica/musica.controller.ts`):
  - `POST /musics` → `@UseGuards(JwtAuthGuard, RoleGuard(['host']))`
  - `PATCH /musics/:id` → host only
  - `GET /musics` → public
  
- **Registration Controller** (`src/inscricao/inscricao.controller.ts`):
  - `POST /registrations` → `@UseGuards(JwtAuthGuard)` (any authenticated)
  - `PATCH /registrations/:id/approve` → host only (for that jam)
  - `PATCH /registrations/:id/reject` → host only (for that jam)

### 5. Secure Socket.IO Connections (`src/websocket/`)
- Add authentication middleware to Socket.IO gateway
- Verify JWT token from `socket.handshake.auth.token`
- Attach `musicianId` to `socket.data`
- Reject connections without valid tokens
- Implement socket rate limiting
- Log all socket connections/disconnections
- Validate room access (e.g., user can only join jams they're registered for)

**Example Middleware:**
```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth token required'));
  
  try {
    const decoded = this.jwtService.verify(token);
    socket.data.musicianId = decoded.sub;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});
```

### 6. Add Rate Limiting to Auth Endpoints
- Install `@nestjs/throttler` package
- Apply throttle guard to `POST /auth/login`
- Limit to 5 requests per minute per IP address
- Implement exponential backoff for failed attempts
- Return 429 Too Many Requests after limit exceeded

**Example:**
```typescript
@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle(5, 60) // 5 requests per 60 seconds
async login(@Body() loginDto: LoginDto) { ... }
```

### 7. Add Input Validation to DTOs
- Ensure `LoginDto` validates email/phone format
- Add `@IsEmail()` or `@IsPhoneNumber()` decorators
- Validate password strength if adding passwords
- Use `class-validator` decorators (already installed)
- Create consistent error responses for validation failures

### 8. Create Health & Status Endpoints
- `GET /health` - Simple health check (no auth required)
- `GET /auth/me` - Get current user profile (requires JWT)
- Both endpoints useful for monitoring and debugging

### 9. Update Environment Variables (`.env`)
- `JWT_SECRET` - Secret key for signing tokens (already exists, verify it's strong)
- `JWT_EXPIRATION` - Token expiration time (e.g., `3600` = 1 hour)
- `LOGIN_ATTEMPT_LIMIT` - Max failed attempts before lockout (e.g., `5`)
- `LOGIN_ATTEMPT_WINDOW` - Time window for lockout in seconds (e.g., `900` = 15 min)
- `NODE_ENV` - Set to 'development' or 'production'
- Validate all required vars are set on application startup

### 10. Add Swagger Documentation for Auth Endpoints
- Ensure auth routes have `@ApiTags('Authentication')`
- Add `@ApiBearerAuth()` to protected endpoints
- Document response schemas with `@ApiResponse()`
- Include examples in Swagger UI
- Test Swagger generation: `npm run swagger:generate`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│         Frontend (React/Vite)                           │
├─────────────────────────────────────────────────────────┤
│  POST /auth/login                                       │
│  { email: "user@example.com" }                          │
│  ↓                                                      │
│  Receives JWT token                                     │
│  Stores token in localStorage/cookies                   │
│  Sends with: Authorization: Bearer {token}              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│    NestJS Backend (Port 3000)                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  REST Endpoints:                                        │
│  ├─ POST /auth/login (rate limited: 5/min)            │
│  │  ├─ Validate email/phone                           │
│  │  ├─ Query: Musician exists?                        │
│  │  ├─ If yes: return musician + JWT                  │
│  │  └─ If no: create + return JWT                     │
│  │                                                    │
│  ├─ GET /auth/me (requires JWT)                       │
│  │  ├─ JwtAuthGuard verifies token                    │
│  │  └─ Return musician profile                        │
│  │                                                    │
│  ├─ POST /jams (host only)                            │
│  │  ├─ RoleGuard checks role='host'                   │
│  │  ├─ Create jam with current user as organizer      │
│  │  └─ Broadcast via WebSocket                        │
│  │                                                    │
│  └─ GET /jams (public)                                │
│     └─ Return all jams                                │
│                                                         │
│  WebSocket Gateway (Socket.IO):                         │
│  ├─ Middleware: Verify JWT from auth.token            │
│  ├─ Attach musicianId to socket.data                  │
│  ├─ Room: /jams/:jamId                                │
│  └─ Events: scheduleUpdate, registrationApproved, etc  │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL Database (Prisma ORM)                │
├─────────────────────────────────────────────────────────┤
│  Musician { id, email, phone, role, ...}               │
│  Jam { id, name, date, hostId, ...}                    │
│  Music { id, title, artist, ...}                        │
│  Registration { id, musicianId, jamMusicId, ...}       │
│  Schedule { id, jamId, musicId, order, ...}            │
└─────────────────────────────────────────────────────────┘
```

## Data Flow - Login

```
1. Frontend: POST /auth/login
   Payload: { email: "user@jam.com" }

2. NestJS AuthController
   ├─ Rate limiting: Check if client exceeded 5/min limit
   │  └─ If exceeded: return 429 Too Many Requests
   ├─ Input validation: Check email format
   │  └─ If invalid: return 400 Bad Request
   └─ Call AuthService.login(loginDto)

3. AuthService
   ├─ Query: SELECT * FROM Musician WHERE email = ?
   ├─ IF found:
   │  ├─ Check if account locked (failed attempts > limit)
   │  ├─ Generate JWT token (exp: +1 hour)
   │  ├─ Log successful login
   │  └─ Return { musician, token, isNewUser: false }
   ├─ IF not found:
   │  ├─ Create new Musician
   │  ├─ Set role = 'guest' (default)
   │  ├─ Generate JWT token
   │  ├─ Log new registration
   │  └─ Return { musician, token, isNewUser: true }
   └─ IF database error:
      └─ Retry up to 2x, then return 500

4. Frontend receives response
   ├─ IF isNewUser=true:
   │  └─ Show onboarding modal (specialty selection)
   ├─ Save token to localStorage
   ├─ Save musician data to context
   └─ Redirect to /jams

5. Subsequent requests include: Authorization: Bearer {token}
```

## Data Flow - Protected Endpoint (Host Creates Jam)

```
1. Frontend: POST /jams
   Headers: { Authorization: "Bearer {token}" }
   Payload: { name: "Jazz Jam", date: "2025-12-15", ... }

2. NestJS JamController
   ├─ JwtAuthGuard
   │  ├─ Extract token from Authorization header
   │  ├─ Verify signature using JWT_SECRET
   │  ├─ Decode payload: { sub: musicianId, ... }
   │  ├─ If invalid: return 401 Unauthorized
   │  └─ Attach to request.user
   ├─ RoleGuard(['host'])
   │  ├─ Query: SELECT role FROM Musician WHERE id = request.user.musicianId
   │  ├─ If role !== 'host': return 403 Forbidden
   │  └─ Allow to proceed
   └─ Call jamService.create(jamDto, request.user)

3. JamService
   ├─ Create Jam with hostId = request.user.musicianId
   ├─ Return created jam
   └─ Emit WebSocket event: 'jamCreated'

4. WebSocket Gateway
   ├─ Broadcast 'jamCreated' to all connected clients
   ├─ All clients receive update
   └─ Frontend updates UI in real-time

5. Frontend receives response
   ├─ Jam created successfully
   ├─ Receive WebSocket update
   └─ Show jam in list
```

## Socket.IO Authentication Flow

```
1. Frontend: Initialize Socket.IO with token
   const socket = io('http://localhost:3000', {
     auth: { token: localStorage.getItem('token') }
   });

2. NestJS Socket.IO Gateway Middleware
   ├─ io.use(async (socket, next) => {
   │  ├─ const token = socket.handshake.auth.token
   │  ├─ If !token: return next(new Error('No token'))
   │  ├─ Verify JWT signature
   │  ├─ Extract musicianId from decoded token
   │  ├─ socket.data.musicianId = musicianId
   │  ├─ Query: SELECT * FROM Musician WHERE id = musicianId
   │  ├─ socket.data.musician = musician
   │  └─ next() // Allow connection
   │  })

3. Frontend: Connected to WebSocket
   socket.on('connect', () => {
     socket.emit('joinJam', { jamId: '...' });
   });

4. NestJS Gateway
   ├─ Receives 'joinJam' event
   ├─ Validate: Does musician have registration for this jam?
   ├─ socket.join(`jam-${jamId}`)
   └─ Broadcast 'musicianJoined' to jam room

5. All clients in room receive update
   socket.on('musicianJoined', (musician) => {
     // Update UI with new musician in jam
   });

6. On socket disconnect
   ├─ Broadcast 'musicianLeft'
   └─ Update UI
```

## Further Considerations

### 1. Authentication Strategy Decision
✅ **Chosen: Simple Email/Phone Login (Current)**
- Pros: Minimal dependencies, fast to implement, works for jam sessions
- Cons: No persistent accounts across sessions, simpler threat model
- Suitable for MVP and public events

### 2. Future Auth Enhancement Options
- **Option A: Add Password Authentication**
  - Requires hashing/salting (bcrypt)
  - More secure but adds complexity
  - Useful if musician accounts become persistent
  
- **Option B: OAuth Integration (Google/GitHub)**
  - Requires external provider setup
  - Better UX for returning users
  - Add after MVP
  
- **Option C: SMS Verification**
  - Phone number verification via SMS code
  - Prevents fake accounts
  - Add cost for SMS service

### 3. Token Management
- **Access Token Expiration:** 1 hour (current: verify in `.env`)
- **Refresh Token Strategy:** Optional for now (simple auth doesn't require it)
- **Token Revocation:** Not implemented; consider for future
- **Secret Rotation:** Plan for production (at least quarterly)

### 4. Musician Role Model
Current roles: host, guest (verify in `Musician` model)
Recommended: Add `admin` role for platform administrators
- **guest:** Can register for jams, view schedules
- **host:** Can create/manage jams, approve registrations
- **admin:** Can manage all jams, users, system settings

### 5. Rate Limiting Strategy
- **Login endpoint:** 5 attempts/minute per IP
- **Registration (implicit in login):** 3 new accounts/hour per IP
- **General endpoints:** Consider 30 req/min per authenticated user
- **WebSocket:** Rate limit message frequency to prevent spam

### 6. Error Handling & Logging
- **Successful auth:** Log with masked email/phone
- **Failed attempts:** Log IP, email attempted, reason
- **Account lockout:** Alert system administrators
- **Token errors:** Log for security analysis
- Use structured logging (e.g., Pino) for production

### 7. Socket.IO Security Considerations
- **Room Access Control:** Validate user belongs to jam before joining room
- **Event Validation:** Validate event payloads before processing
- **Message Rate Limiting:** Prevent socket spam (e.g., 10 msgs/sec per user)
- **Disconnect Handling:** Clean up user data when socket closes

### 8. CORS & Cross-Origin Settings
- Verify CORS is configured correctly in `main.ts`
- Allowed origins should be frontend domain(s)
- Allow credentials: true (for cookies if used)
- Socket.IO has separate CORS settings

### 9. Testing Strategy
- **Unit Tests:** Auth service (login, token generation, validation)
- **Integration Tests:** Protected endpoints with valid/invalid tokens
- **E2E Tests:** Full auth flow (login → join jam → receive updates)
- **Load Tests:** Rate limiting works under high traffic

### 10. Monitoring & Alerting
- **Metrics to track:**
  - Login success/failure rate
  - Failed auth attempts per IP (brute force detection)
  - Token verification latency
  - Socket connection/disconnection rates
  - 401/403 error rates (auth failures)
- **Alerts:**
  - High failed login rate (possible attack)
  - Unusual IP addresses
  - Repeated 403 errors (permission issues)

## Files to Create

### New Guards
- `src/auth/guards/role.guard.ts` - Role-based authorization

### New Utilities
- `src/auth/decorators/roles.decorator.ts` - @Roles() decorator for controllers
- `src/common/interceptors/logging.interceptor.ts` - Audit logging for auth events

### WebSocket Setup
- Update `src/websocket/` gateway with auth middleware

## Files to Modify

### Authentication Module
- `src/auth/auth.service.ts` - Harden validation, add retry logic, audit logging
- `src/auth/auth.controller.ts` - Add guards, update decorators
- `src/auth/guards/jwt.guard.ts` - Verify implementation
- `src/auth/dto/login.dto.ts` - Add input validation decorators
- `src/auth/auth.module.ts` - Import ThrottlerModule

### Controllers (Add Guards)
- `src/jam/jam.controller.ts` - Add `@UseGuards(RoleGuard(['host']))`
- `src/musica/musica.controller.ts` - Add role guards
- `src/inscricao/inscricao.controller.ts` - Add role guards
- `src/escala/escala.controller.ts` - Add role guards

### Configuration
- `src/app.module.ts` - Configure ThrottlerModule globally
- `.env` - Verify `JWT_SECRET`, `JWT_EXPIRATION`, add throttle limits
- `main.ts` - Verify CORS and error handling

## Implementation Checklist

- [ ] Step 1: Harden AuthService with validation & retry logic
- [ ] Step 2: Create/verify RoleGuard implementation
- [ ] Step 3: Add @UseGuards decorators to host-only endpoints
- [ ] Step 4: Implement Socket.IO auth middleware
- [ ] Step 5: Add @nestjs/throttler for rate limiting
- [ ] Step 6: Apply throttle guard to login endpoint
- [ ] Step 7: Add audit logging interceptor
- [ ] Step 8: Update input validation in DTOs
- [ ] Step 9: Create health & status endpoints
- [ ] Step 10: Verify JWT configuration in .env
- [ ] Step 11: Test auth flow end-to-end
- [ ] Step 12: Test role-based access (host vs guest)
- [ ] Step 13: Test Socket.IO authentication
- [ ] Step 14: Test rate limiting on login
- [ ] Step 15: Verify Swagger docs include @ApiBearerAuth()
- [ ] Step 16: Run `npm run build` without errors
- [ ] Step 17: Test in production environment simulation

## Dependencies to Install/Verify

```bash
npm install @nestjs/throttler      # Rate limiting
npm install pino                   # Structured logging (optional but recommended)
npm install @nestjs/passport       # Already installed
npm install passport-jwt           # Already installed
npm install @nestjs/jwt           # Already installed
```

Verify existing:
- `@nestjs/common` ✓
- `@nestjs/core` ✓
- `class-validator` ✓
- `class-transformer` ✓
- `passport` ✓
- `@nestjs/websockets` ✓
- `socket.io` ✓

All dependencies already in `package.json`; only add `@nestjs/throttler` if not present.

## Testing Checklist

### Manual Tests
- [ ] Login with valid email → Receive JWT token
- [ ] Login with invalid email format → 400 Bad Request
- [ ] Login new user → Check `isNewUser: true` in response
- [ ] Login existing user → Check `isNewUser: false` in response
- [ ] GET /auth/me with valid token → Return user profile
- [ ] GET /auth/me with invalid token → 401 Unauthorized
- [ ] POST /jams as guest → 403 Forbidden
- [ ] POST /jams as host → 201 Created
- [ ] Rate limit: POST /login 6 times in 60 sec → 5th succeeds, 6th gets 429
- [ ] Socket connection with valid token → Connected
- [ ] Socket connection without token → Connection refused

### Automated Tests
- [ ] Unit: AuthService.login() with mock database
- [ ] Unit: JwtGuard.canActivate() with valid/invalid tokens
- [ ] Integration: Full login flow → GET protected endpoint
- [ ] Integration: Socket auth flow

---

This plan focuses on hardening your existing simple auth system rather than adding complex external providers. It's production-ready, maintains MVP simplicity, and is implementable incrementally.

