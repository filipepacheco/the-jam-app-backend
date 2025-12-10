# Plan: Translate Entire Codebase from Portuguese to English

## Overview
Complete translation of the karaoke-jam-backend project from Portuguese to English, including:
- Prisma schema (model names, field names, enum values)
- All TypeScript source files (DTO names, descriptions, API summaries)
- Directory and file names
- Database structure and migrations
- Comments and descriptions throughout

## Translation Mapping

### Database Layer (Prisma Schema)

**Models & Tables:**
- `Jam` → `Jam` (stays same)
- `Musica` → `Music`
- `Musico` → `Musician`
- `Inscricao` → `Registration`
- `Escala` → `Schedule`
- `JamMusica` → `JamMusic`

**Fields:**
- `nome` → `name`
- `descricao` → `description`
- `data` → `date`
- `titulo` → `title`
- `artista` → `artist`
- `genero` → `genre`
- `duracao` → `duration`
- `instrumento` → `instrument`
- `nivel` → `level`
- `contato` → `contact`
- `ordem` → `order`
- `createdAt` → `createdAt` (stays same)
- `updatedAt` → `updatedAt` (stays same)
- `musicoId` → `musicianId`
- `musicaId` → `musicId`
- `jamMusicaId` → `jamMusicId`
- `inscricaoId` → `registrationId`
- `jammusics` (table map) → `jams_musics`
- `musicas` (table map) → `musics`
- `musicos` (table map) → `musicians`
- `inscricoes` (table map) → `registrations`
- `escalas` (table map) → `schedules`

**Enums:**
- `StatusJam.ATIVO` → `JamStatus.ACTIVE`
- `StatusJam.INATIVO` → `JamStatus.INACTIVE`
- `StatusJam.FINALIZADO` → `JamStatus.FINISHED`
- `StatusInscricao.PENDENTE` → `RegistrationStatus.PENDING`
- `StatusInscricao.APROVADA` → `RegistrationStatus.APPROVED`
- `StatusInscricao.REJEITADA` → `RegistrationStatus.REJECTED`
- `StatusEscala.AGENDADO` → `ScheduleStatus.SCHEDULED`
- `StatusEscala.EM_ANDAMENTO` → `ScheduleStatus.IN_PROGRESS`
- `StatusEscala.CONCLUIDO` → `ScheduleStatus.COMPLETED`
- `StatusEscala.CANCELADO` → `ScheduleStatus.CANCELED`
- `NivelMusico.INICIANTE` → `MusicianLevel.BEGINNER`
- `NivelMusico.INTERMEDIARIO` → `MusicianLevel.INTERMEDIATE`
- `NivelMusico.AVANCADO` → `MusicianLevel.ADVANCED`
- `NivelMusico.PROFISSIONAL` → `MusicianLevel.PROFESSIONAL`

### File & Directory Structure

**Directories:**
- `src/musica/` → `src/music/`
- `src/musico/` → `src/musician/`
- `src/inscricao/` → `src/registration/`
- `src/escala/` → `src/schedule/`
- `src/jam/` → `src/jam/` (stays same)
- `src/prisma/` → `src/prisma/` (stays same)
- `src/websocket/` → `src/websocket/` (stays same)

**Files:**
- `*musica*` → `*music*`
- `*musico*` → `*musician*`
- `*inscricao*` → `*registration*`
- `*escala*` → `*schedule*`

### TypeScript Files

**DTO Classes:**
- `CreateMusicaDto` → `CreateMusicDto`
- `UpdateMusicaDto` → `UpdateMusicDto`
- `CreateMusicoDto` → `CreateMusicianDto`
- `UpdateMusicoDto` → `UpdateMusicianDto`
- `CreateInscricaoDto` → `CreateRegistrationDto`
- `CreateEscalaDto` → `CreateScheduleDto`
- `UpdateEscalaDto` → `UpdateScheduleDto`
- `JamMusicaResponseDto` → `JamMusicResponseDto`

**Controllers:**
- `MusicaController` → `MusicController`
- `MusicoController` → `MusicianController`
- `InscricaoController` → `RegistrationController`
- `EscalaController` → `ScheduleController`

**Services:**
- `MusicaService` → `MusicService`
- `MusicoService` → `MusicianService`
- `InscricaoService` → `RegistrationService`
- `EscalaService` → `ScheduleService`

**Modules:**
- `MusicaModule` → `MusicModule`
- `MusicoModule` → `MusicianModule`
- `InscricaoModule` → `RegistrationModule`
- `EscalaModule` → `ScheduleModule`

### API Descriptions & Summaries

**Controllers:**
- `Criar uma nova jam session` → `Create a new jam session`
- `Listar todas as jams` → `List all jams`
- `Buscar jam por ID` → `Get jam by ID`
- `Atualizar jam` → `Update jam`
- `Deletar jam` → `Delete jam`
- `Nome da jam session` → `Jam session name`
- `Descrição da jam session` → `Jam session description`
- `Data e hora da jam session` → `Jam session date and time`
- `Local da jam session` → `Jam session location`
- `Nome do host` → `Host name`
- `Contato do host` → `Host contact`
- Similar translations for all music, musician, registration, schedule controllers

**DTO Properties:**
- All `@ApiProperty` descriptions translated from Portuguese to English
- All field names in enums translated

## Execution Steps

### Phase 1: Prisma Schema & Migration
1. Update `prisma/schema.prisma` with new model/field/enum names
2. Create new migration: `prisma migrate dev --name translate_to_english`
3. Generate Prisma client: `npm run prisma:generate`

### Phase 2: Source Code Translation
1. Translate DTOs in all modules (music, musician, registration, schedule, jam)
2. Update controller classes and API documentation
3. Update service classes and method signatures
4. Update module imports and exports

### Phase 3: Directory & File Rename
1. Rename directories: `musica/` → `music/`, `musico/` → `musician/`, etc.
2. Rename all files within those directories
3. Update all imports in other files

### Phase 4: Validation & Testing
1. Run `npm run lint` to fix formatting
2. Run `npm run build` to verify compilation
3. Run tests if available
4. Start dev server to verify no runtime errors

### Phase 5: Database Update
1. Run new migrations on local database
2. Verify schema changes applied correctly
3. Update any seed data if applicable

## Key Considerations

1. **Breaking Changes Risk**: HIGH - This affects database schema, all file paths, and all imports
2. **Migration**: Will require running `prisma migrate` to update database schema
3. **Import Paths**: 200+ imports will need updating across the codebase
4. **Enum Values**: Database may have existing records with old enum values (handle in migration)
5. **Git History**: Consider committing after each phase for easy rollback

## Expected Outcomes

- All Portuguese terminology replaced with English equivalents
- Database schema fully translated
- All imports and references updated
- Codebase compiles without errors
- API documentation in English
- Directory structure follows English naming conventions

## Rollback Strategy

If issues arise:
1. Database: Roll back migrations with `prisma migrate resolve --rolled-back <migration_name>`
2. Code: Git revert to previous commit
3. Node modules: `rm -rf node_modules && npm install`

