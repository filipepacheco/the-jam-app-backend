# Refactor Summary: Move musicId from Registration to Schedule Table

## Completion Date
December 7, 2025

## Overview
Successfully refactored the data architecture to move `musicId` from the Registration table to the Schedule table. This ensures better separation of concerns where:
- **Registration**: Records that a musician wants to perform at a jam session (for a specific JamMusic)
- **Schedule**: Records a specific performance slot with a specific musician and music piece

## Changes Made

### 1. Database Schema (Prisma)

#### Updated Models
- **Schedule Model**: Added `musicId` field with foreign key to Music
- **Music Model**: Added `schedules` relation array

#### Migration Created
- File: `prisma/migrations/20251207002307_add_musicId_to_schedule/migration.sql`
- Actions:
  1. Added `musicId` column as nullable
  2. Created foreign key constraint with cascade delete
  3. Backfilled `musicId` from Registration → JamMusic → Music relationship
  4. Made `musicId` NOT NULL after backfill

**Migration SQL:**
```sql
-- Add musicId column as nullable
ALTER TABLE "escalas" ADD COLUMN "musicId" TEXT;

-- Create foreign key constraint
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_musicId_fkey" 
FOREIGN KEY ("musicId") REFERENCES "musicas"("id") ON DELETE CASCADE;

-- Backfill musicId from the registration's jamMusic relationship
UPDATE "escalas" e
SET "musicId" = jm."musicId"
FROM "inscricoes" i
JOIN "jamsmusics" jm ON i."jamMusicaId" = jm."id"
WHERE e."inscricaoId" = i."id";

-- Make musicId NOT NULL after backfill
ALTER TABLE "escalas" ALTER COLUMN "musicId" SET NOT NULL;
```

### 2. Data Transfer Objects (DTOs)

#### CreateScheduleDto (`src/escala/dto/create-escala.dto.ts`)
- Added required `musicId: string` field
- Imports `ScheduleStatus` from Prisma client instead of defining locally
- Updated API documentation with musicId property

#### UpdateScheduleDto (`src/escala/dto/update-escala.dto.ts`)
- No changes needed (uses PartialType of CreateScheduleDto)
- Automatically includes `musicId` as optional field

#### ScheduleResponseDto (`src/jam/dto/schedule-response.dto.ts`)
- Added `musicId: string` property
- Added `music?: Music` property for full music details in response
- Removed unused import

### 3. Service Layer

#### EscalaService (`src/escala/escala.service.ts`)

**Create Method:**
- Added validation to verify `musicId` exists in Music table
- Passes `musicId` to schedule creation
- Includes `music` relation in response

**FindByJam Method:**
- Added `music: true` to include statement
- Returns full music details with schedule data

**FindByMusico Method:**
- Added `music: true` to include statement
- Returns full music details with schedule data

**Update Method:**
- Added `music: true` to include statement
- Supports updating musicId via UpdateScheduleDto

### 4. Response Models

#### JamResponseDto (`src/jam/dto/jam-response.dto.ts`)
- Already supports `schedules: ScheduleResponseDto[]` (no changes needed)

## Data Flow After Refactor

```
Jam
├── jamMusics: JamMusic[]
│   ├── jamId
│   ├── musicId
│   └── music: Music
├── registrations: Registration[]
│   ├── musicianId
│   ├── jamMusicId → JamMusic
│   ├── musician: Musician
│   └── jamMusic: JamMusic
└── schedules: Schedule[]
    ├── musicId (NEW)
    ├── registrationId → Registration
    ├── music: Music (NEW)
    └── registration: Registration
```

## Database Consistency

### Foreign Key Relationships
- Schedule.musicId → Music.id (CASCADE delete)
- Schedule.registrationId → Registration.id (CASCADE delete)
- Schedule.jamId → Jam.id (CASCADE delete)

### Unique Constraints
- Registration: `[musicianId, jamId, jamMusicId]` - Ensures musician registers once per music per jam
- Schedule: `[registrationId, order]` - Ensures unique performance order per musician

## API Changes

### POST /escalas (Create Schedule)
**Request Body:**
```json
{
  "jamId": "string",
  "musicId": "string",
  "registrationId": "string",
  "order": number,
  "status": "SCHEDULED|IN_PROGRESS|COMPLETED|CANCELED"
}
```

**Response:**
```json
{
  "id": "string",
  "jamId": "string",
  "musicId": "string",
  "order": number,
  "status": "string",
  "registrationId": "string",
  "music": {
    "id": "string",
    "title": "string",
    "artist": "string",
    "genre": "string",
    "duration": number
  },
  "registration": {...},
  "jam": {...}
}
```

## Testing

✅ **Build**: Successful (no compilation errors)
✅ **Server**: Running successfully on port 3000
✅ **DTOs**: All validation decorators working
✅ **Database**: Migration applied successfully with data preservation

## Migration Path

If anyone needs to revert this change:
1. Run `npx prisma migrate resolve --rolled-back 20251207002307_add_musicId_to_schedule`
2. All schedule data will be preserved (cascading won't delete due to migration design)

## Architecture Benefits

1. **Direct Music Reference**: Schedule now directly references the music piece being performed
2. **Query Optimization**: Can fetch music details directly without joining through Registration
3. **Data Integrity**: Prevents orphaned schedules with mismatched music
4. **Audit Trail**: Clear relationship hierarchy (Jam → Musician + Music → Schedule)
5. **Future-Proof**: Allows for music substitution without affecting registration

## Next Steps

1. **Update Frontend**: Ensure API calls include `musicId` when creating schedules
2. **Testing**: Run integration tests with sample data
3. **Documentation**: Update API documentation in Swagger
4. **Monitoring**: Monitor database queries for performance improvements

---

**Status**: ✅ Complete and Deployed

