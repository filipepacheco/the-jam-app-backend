# Plan: Authentication & Login Endpoints Implementation

## TL;DR
Create a new `auth` module with simplified login/register flow. Users authenticate with email OR phone, auto-register if they don't exist, and receive a JWT token. The Musician model needs email/phone fields added to the database.

---

## Prerequisites & Setup

### Step 1: Update Prisma Schema
Add authentication fields to the Musician model:
- `email` (String, unique, optional)
- `phone` (String, unique, optional)

**Rationale:** Store credentials for user lookup during login. Use unique constraints to prevent duplicates.

### Step 2: Create Database Migration
```bash
npx prisma migrate dev --name add_auth_fields_to_musician
```

---

## Phase 1: Database & Models

### 1.1: Update Prisma Schema (`prisma/schema.prisma`)

Add authentication fields to the Musician model:
```prisma
model Musician {
  id         String        @id @default(uuid())
  name       String        @map("nome")
  email      String?       @unique @map("email")
  phone      String?       @unique @map("telefone")
  instrument String?       @map("instrumento")
  level      MusicianLevel? @map("nivel")
  contact    String?       @map("contato")
  createdAt  DateTime      @default(now())

  registrations Registration[]

  @@map("musicos")
}
```

**Changes:**
- ✅ Add `email` field (unique, optional)
- ✅ Add `phone` field (unique, optional)
- ✅ Make `instrument` and `level` optional (filled during jam registration)

### 1.2: Create & Run Migration
```bash
npx prisma migrate dev --name add_auth_fields_to_musician
```

---

## Phase 2: Authentication Module Structure

Create new module: `src/auth/`

```
src/auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.module.ts
├── strategies/
│   └── jwt.strategy.ts
├── guards/
│   └── jwt.guard.ts
└── dto/
    ├── login.dto.ts
    ├── auth-response.dto.ts
    └── logout.dto.ts
```

---

## Phase 3: DTOs

### LoginDto (`src/auth/dto/login.dto.ts`)
```typescript
import { IsEmail, IsPhoneNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'User email',
    example: 'user@example.com'
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ 
    description: 'User phone number',
    example: '+1234567890'
  })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}
```

**Validation:** Exactly ONE of email or phone must be provided

### AuthResponseDto (`src/auth/dto/auth-response.dto.ts`)
```typescript
export class AuthResponseDto {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'user';
  token: string;
  isNewUser: boolean;
}
```

---

## Phase 4: Auth Service Logic

### Key Methods:

1. **`login(dto: LoginDto): Promise<AuthResponseDto>`**
   - ✅ Validate: email XOR phone (exactly one)
   - ✅ Query musician by email OR phone
   - ✅ If exists: return user data + JWT (isNewUser: false)
   - ✅ If not exists: create new musician + JWT (isNewUser: true)
   - ✅ Auto-generate name from email/phone

2. **`generateToken(musicianId: string): Promise<string>`**
   - ✅ Use JWT with `process.env.JWT_SECRET`
   - ✅ Payload: `{ sub: musicianId, role: 'user' }`
   - ✅ Expiration: 24 hours

3. **`getMusicianProfile(musicianId: string): Promise<Musician>`**
   - ✅ Get musician by ID
   - ✅ Return with all fields

4. **`createMusicianFromLogin(email?: string, phone?: string): Promise<Musician>`**
   - ✅ Auto-generate name: extract from email/phone
   - ✅ Set `instrument: null`, `level: null`

---

## Phase 5: Auth Controller Endpoints

### `POST /auth/login`
- **Request:** `{ email?: string, phone?: string }`
- **Response:** `{ userId, name, email, phone, role: 'user', token, isNewUser }`
- **Errors:** 400 (validation), 409 (unique violation)
- **Summary:** Login or auto-register with email or phone

### `POST /auth/logout`
- **Request:** (requires JWT)
- **Response:** `{ message: 'Logged out successfully' }`
- **Guard:** `@UseGuards(JwtAuthGuard)`
- **Summary:** Logout user

### `GET /auth/me`
- **Request:** (requires JWT)
- **Response:** `{ id, name, email, phone, instrument, level, createdAt }`
- **Guard:** `@UseGuards(JwtAuthGuard)`
- **Summary:** Get current user profile

---

## Phase 6: JWT Strategy & Guard

### `strategies/jwt.strategy.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; role: string }) {
    return { musicianId: payload.sub, role: payload.role };
  }
}
```

### `guards/jwt.guard.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

---

## Phase 7: Auth Module

### `auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    PrismaModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## Phase 8: Installation & Setup

### Install Dependencies
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install --save-dev @types/passport-jwt
```

### Update `.env`
```env
JWT_SECRET=your-super-secret-random-key-here
JWT_EXPIRATION=24h
```

### Update `src/app.module.ts`
```typescript
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // ... existing imports
    AuthModule,
  ],
  // ...
})
export class AppModule {}
```

---

## Phase 9: Integration Points

### Protect Existing Endpoints (Add `@UseGuards(JwtAuthGuard)`)
- ✅ `POST /inscricoes` (register for jam music)
- ✅ `PATCH /escalas/:id` (update schedule)
- ✅ `DELETE /inscricoes/:id` (cancel registration)

### Keep Public Endpoints
- ✅ `GET /jams` (list all jams - public)
- ✅ `GET /jams/:id` (jam details - public)
- ✅ `GET /musicas` (list musics - public)

---

## Phase 10: Test Cases

| Test Case | Input | Expected |
|-----------|-------|----------|
| New email login | `{ email: "new@ex.com" }` | 201, isNewUser: true |
| Existing email | `{ email: "new@ex.com" }` | 200, isNewUser: false |
| New phone login | `{ phone: "+1234567890" }` | 201, isNewUser: true |
| Both fields | `{ email, phone }` | 400 error |
| Neither field | `{}` | 400 error |
| Invalid email | `{ email: "invalid" }` | 400 error |
| Get profile | GET /auth/me + token | 200, user data |
| No token | GET /auth/me | 401 Unauthorized |

---

## Phase 11: Error Handling

### Expected Errors:
- `400 Bad Request`: Neither email nor phone provided
- `400 Bad Request`: Both email and phone provided
- `400 Bad Request`: Invalid email/phone format
- `401 Unauthorized`: Invalid token
- `403 Forbidden`: Expired token
- `409 Conflict`: Email/phone already exists (shouldn't happen with unique constraint)

### Response Format:
```typescript
{
  statusCode: number;
  message: string;
  error?: string;
}
```

---

## Further Considerations

### 1. Rate Limiting (Optional)
Apply rate limiting to `/auth/login`:
```bash
npm install @nestjs/throttler
```

### 2. Email Verification (Future)
Add email verification flow for enhanced security.

### 3. Phone Verification (Future)
Add SMS verification using Twilio or similar service.

### 4. Token Refresh Strategy (Optional)
Implement refresh tokens for better security:
- Short-lived access token (15 min)
- Long-lived refresh token (7 days)
- Separate endpoint to refresh access token

### 5. Role-Based Access Control (Future)
Expand roles:
- `'user'` - Regular musician
- `'host'` - Can create jams
- `'admin'` - Full access

### 6. Database Constraints
Ensure unique constraints at database level:
```sql
ALTER TABLE musicos ADD CONSTRAINT unique_email UNIQUE(email);
ALTER TABLE musicos ADD CONSTRAINT unique_telefone UNIQUE(telefone);
```

---

## Success Criteria

✅ User can login with email OR phone
✅ New users auto-register on first login
✅ JWT token returned (valid 24 hours)
✅ Protected endpoints require valid token
✅ Clear error messages for validation failures
✅ No duplicate emails/phones in database
✅ All endpoints tested and working

---

## Files to Create/Modify

### Create (New)
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.module.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/auth/guards/jwt.guard.ts`
- `src/auth/dto/login.dto.ts`
- `src/auth/dto/auth-response.dto.ts`

### Modify (Existing)
- `prisma/schema.prisma` (add email, phone fields)
- `src/app.module.ts` (import AuthModule)
- `.env` (add JWT_SECRET)

### Migration
- Run: `npx prisma migrate dev --name add_auth_fields_to_musician`

---

## Implementation Timeline

| Phase | Task | Effort | Timeline |
|-------|------|--------|----------|
| 1 | Update Prisma + Migration | 15 min | Day 1 |
| 2 | Create Module Structure | 10 min | Day 1 |
| 3 | Implement DTOs | 20 min | Day 1 |
| 4 | Implement Auth Service | 60 min | Day 1-2 |
| 5 | Implement Controller | 30 min | Day 1-2 |
| 6 | Setup JWT & Guards | 30 min | Day 2 |
| 7 | Integration & Updates | 30 min | Day 2 |
| 8 | Error Handling | 20 min | Day 2 |
| 9 | Testing & Validation | 45 min | Day 2 |

**Total Estimated Effort:** ~4 hours

---

## Summary

This authentication flow provides a simple yet effective login system that:
1. Uses email OR phone as the authentication credential
2. Auto-registers new users on first login
3. Returns JWT tokens for subsequent authenticated requests
4. Maintains backward compatibility with existing endpoints
5. Provides a foundation for role-based access control
6. Allows for future enhancements like email verification and refresh tokens

The implementation follows NestJS best practices and leverages Passport.js for security.

