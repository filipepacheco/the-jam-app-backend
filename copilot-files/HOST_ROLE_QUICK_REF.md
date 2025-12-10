# Host Role Implementation - Quick Reference

## What Changed

### 🔐 Authentication Flow
- Users login with email OR phone
- New musicians created with `name: null` (deferred to profile setup)
- Response includes `isHost: boolean` flag
- All regular users get `isHost: false` by default

### 👤 Profile Setup
- New endpoint: `PATCH /auth/profile`
- Allows musicians to fill in: `name`, `instrument`, `level`, `contact`
- Protected by JWT bearer token

### 🎭 Host Role
- Set internally via database (`UPDATE musicians SET isHost = true WHERE id = '...'`)
- No UI control yet (MVP feature)
- Hosts can create/manage jams

### 🍆 Ghost Host
- Special account for test/demo jams
- Name: `"Ghost Host"`
- ID: `f606d589-b3d8-41e9-a28d-9d44ec8f9cd6`
- All test jams linked to this account

### 🎵 Jam Creation
- Now requires `hostMusicianId` (validates it exists)
- Denormalizes host name/contact for backward compatibility
- Old fields `hostName` and `hostContact` still work but populated from musician

## Files Changed

### Core Files
- `prisma/schema.prisma` - Added `isHost`, relations
- `src/auth/auth.service.ts` - Updated login, profile methods
- `src/auth/auth.controller.ts` - Added PATCH /profile endpoint
- `src/auth/dto/auth-response.dto.ts` - Added `isHost` field
- `src/auth/dto/update-profile.dto.ts` - NEW
- `src/jam/dto/create-jam.dto.ts` - Added `hostMusicianId`
- `src/jam/jam.service.ts` - Updated create with validation
- `prisma/seed.ts` - Creates ghost host + test data
- `package.json` - Added prisma seed config

### New Files
- `src/auth/dto/update-profile.dto.ts`

## Test Data

Run: `npm run seed`

Creates:
- 1 Ghost Host
- 25 Musicians
- 56 Songs
- 5 Jams (all hosted by Ghost Host)
- 233 Registrations
- 52 Schedules

## API Examples

### Login (New)
```bash
POST /auth/login
{
  "email": "user@example.com"
}

Response:
{
  "userId": "...",
  "name": null,
  "email": "user@example.com",
  "phone": null,
  "role": "user",
  "isHost": false,
  "token": "...",
  "isNewUser": true
}
```

### Update Profile (New)
```bash
PATCH /auth/profile
Authorization: Bearer <token>
{
  "name": "João Silva",
  "instrument": "guitarra",
  "level": "INTERMEDIATE"
}

Response:
{
  "id": "...",
  "name": "João Silva",
  "instrument": "guitarra",
  "level": "INTERMEDIATE",
  ...
}
```

### Create Jam (Updated)
```bash
POST /jams
{
  "name": "Rock Night",
  "date": "2025-01-15T20:00:00Z",
  "location": "Rock Club",
  "hostMusicianId": "f606d589-b3d8-41e9-a28d-9d44ec8f9cd6"
}
```

## Next Steps

1. **Frontend Integration:**
   - After login, show profile form to collect name + instrument
   - Store name in localStorage or complete form before accessing jam

2. **Host UI (Future):**
   - Admin panel to toggle `isHost` flag
   - Host dashboard for managing jams

3. **Permission Checks:**
   - Add middleware to protect jam endpoints (require host)
   - Validate user permissions before allowing jam modifications

4. **Testing:**
   - Run `npm run seed` to populate test data
   - Login with any test musician
   - Call `PATCH /auth/profile` to complete setup

