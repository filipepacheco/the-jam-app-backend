import { PrismaClient } from '@prisma/client';
import * as QRCode from 'qrcode';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with realistic jam control data...');

  // Clear existing data in correct order (cascade dependencies)
  console.log('🗑️  Clearing existing data...');
  await prisma.playbackHistory.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.jamMusic.deleteMany();
  await prisma.jam.deleteMany();
  await prisma.music.deleteMany();
  await prisma.musician.deleteMany();

  // Create host musicians
  console.log('👨‍💼 Creating 5 host musicians...');
  const hostNames = [
    'Carlos Mendes',
    'Marina Oliveira',
    'Roberto Silva',
    'Juliana Costa',
    'Gustavo Ferreira',
  ];
  const hosts = [];
  for (let i = 0; i < 5; i++) {
    const host = await prisma.musician.create({
      data: {
        name: hostNames[i],
        email: `host${i + 1}@karaokejam.com`,
        phone: `11999${String(200000 + i).slice(-6)}`,
        instrument: 'vocal',
        level: 'PROFESSIONAL',
        isHost: true,
        contact: `+55 11 9999-${String(200000 + i).slice(-4)}`,
      },
    });
    hosts.push(host);
  }
  console.log(`✓ Created ${hosts.length} host musicians`);

  // Create musicians (25+)
  console.log('Creating 25 musicians...');
  const musicians = [];
  const musicianNames = [
    'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Ferreira',
    'Lucas Martins', 'Beatriz Rocha', 'Felipe Gomes', 'Juliana Lima', 'Rafael Alves',
    'Camila Souza', 'Thiago Ribeiro', 'Fernanda Pereira', 'Bruno Castro', 'Mariana Dias',
    'André Mendes', 'Sophia Barbosa', 'Gabriel Teixeira', 'Larissa Moura', 'Victor Carvalho',
    'Isabela Freitas', 'Gustavo Lourenço', 'Amanda Silva', 'Daniel Cardoso', 'Vanessa Tavares',
  ];

  const instruments = ['guitarra', 'bateria', 'baixo', 'teclado', 'vocal'];
  const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'];

  for (let i = 0; i < 25; i++) {
    const musician = await prisma.musician.create({
      data: {
        name: musicianNames[i],
        email: `musician${i + 1}@karaokejam.com`,
        phone: `11999${String(100000 + i).slice(-6)}`,
        instrument: instruments[i % instruments.length],
        level: levels[Math.floor(Math.random() * levels.length)] as any,
        isHost: false,
      },
    });
    musicians.push(musician);
  }
  console.log(`✓ Created ${musicians.length} musicians`);

  // Create songs (55+)
  console.log('Creating 55+ songs...');
  const songs = [];
  const songTitles = [
    { title: 'Bohemian Rhapsody', artist: 'Queen', genre: 'Rock' },
    { title: 'Imagine', artist: 'John Lennon', genre: 'Pop' },
    { title: 'Stairway to Heaven', artist: 'Led Zeppelin', genre: 'Rock' },
    { title: 'Hotel California', artist: 'Eagles', genre: 'Rock' },
    { title: 'Like a Rolling Stone', artist: 'Bob Dylan', genre: 'Rock' },
    { title: 'Yesterday', artist: 'The Beatles', genre: 'Pop' },
    { title: 'Hallelujah', artist: 'Leonard Cohen', genre: 'Pop' },
    { title: 'Smells Like Teen Spirit', artist: 'Nirvana', genre: 'Rock' },
    { title: 'Hey Jude', artist: 'The Beatles', genre: 'Pop' },
    { title: 'Wonderwall', artist: 'Oasis', genre: 'Rock' },
    { title: 'Black', artist: 'Pearl Jam', genre: 'Rock' },
    { title: 'Comfortably Numb', artist: 'Pink Floyd', genre: 'Rock' },
    { title: 'All Along the Watchtower', artist: 'Jimi Hendrix', genre: 'Rock' },
    { title: 'Sweet Home Chicago', artist: 'Blues Brothers', genre: 'Blues' },
    { title: 'The Thrill is Gone', artist: 'B.B. King', genre: 'Blues' },
    { title: 'Sultans of Swing', artist: 'Dire Straits', genre: 'Rock' },
    { title: 'Eruption', artist: 'Van Halen', genre: 'Rock' },
    { title: 'Purple Haze', artist: 'Jimi Hendrix', genre: 'Rock' },
    { title: 'Layla', artist: 'Clapton & Allman', genre: 'Rock' },
    { title: 'Cliffs of Dover', artist: 'Eric Johnson', genre: 'Rock' },
    { title: 'Fade to Black', artist: 'Metallica', genre: 'Metal' },
    { title: 'Master of Puppets', artist: 'Metallica', genre: 'Metal' },
    { title: 'One', artist: 'Metallica', genre: 'Metal' },
    { title: 'Enter Sandman', artist: 'Metallica', genre: 'Metal' },
    { title: 'Nothing Else Matters', artist: 'Metallica', genre: 'Metal' },
    { title: 'The Unforgiven', artist: 'Metallica', genre: 'Metal' },
    { title: 'Sad But True', artist: 'Metallica', genre: 'Metal' },
    { title: 'Creeping Death', artist: 'Metallica', genre: 'Metal' },
    { title: 'For Whom the Bell Tolls', artist: 'Metallica', genre: 'Metal' },
    { title: 'Seek & Destroy', artist: 'Metallica', genre: 'Metal' },
    { title: 'Harvester of Sorrow', artist: 'Metallica', genre: 'Metal' },
    { title: 'Sanitarium', artist: 'Metallica', genre: 'Metal' },
    { title: 'The Memory Remains', artist: 'Metallica', genre: 'Metal' },
    { title: 'Whiskey in the Jar', artist: 'Metallica', genre: 'Metal' },
    { title: 'Dream On', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Sweet Emotion', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Walk This Way', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'I Don\'t Want to Miss a Thing', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Cryin\'', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Love in an Elevator', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Janie\'s Got a Gun', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Dude (Looks Like a Lady)', artist: 'Aerosmith', genre: 'Rock' },
    { title: 'Mama Said Knock You Out', artist: 'LL Cool J', genre: 'Hip Hop' },
    { title: 'Love the Way You Lie', artist: 'Eminem', genre: 'Hip Hop' },
    { title: 'In da Club', artist: '50 Cent', genre: 'Hip Hop' },
    { title: 'Lose Yourself', artist: 'Eminem', genre: 'Hip Hop' },
    { title: 'Stan', artist: 'Eminem', genre: 'Hip Hop' },
    { title: 'My Name Is', artist: 'Eminem', genre: 'Hip Hop' },
    { title: 'The Real Slim Shady', artist: 'Eminem', genre: 'Hip Hop' },
    { title: 'Without Me', artist: 'Eminem', genre: 'Hip Hop' },
    { title: 'Sunshine of My Life', artist: 'Stevie Wonder', genre: 'Soul' },
    { title: 'Superstition', artist: 'Stevie Wonder', genre: 'Soul' },
    { title: 'Sir Duke', artist: 'Stevie Wonder', genre: 'Soul' },
    { title: 'Isn\'t She Lovely', artist: 'Stevie Wonder', genre: 'Soul' },
    { title: 'I Wish', artist: 'Stevie Wonder', genre: 'Soul' },
    { title: 'Higher Ground', artist: 'Stevie Wonder', genre: 'Soul' },
  ];

  for (let i = 0; i < songTitles.length; i++) {
    const song = await prisma.music.create({
      data: {
        title: songTitles[i].title,
        artist: songTitles[i].artist,
        genre: songTitles[i].genre,
        duration: Math.floor(Math.random() * 240) + 180, // 3-7 minutes
        neededDrums: Math.floor(Math.random() * 3) + 1,
        neededGuitars: Math.floor(Math.random() * 3) + 1,
        neededVocals: Math.floor(Math.random() * 3) + 1,
        neededBass: Math.floor(Math.random() * 2) + 1,
        neededKeys: Math.floor(Math.random() * 2),
        status: 'APPROVED',
      },
    });
    songs.push(song);
  }
  console.log(`✓ Created ${songs.length} songs`);

  // Create jams with different states (5)
  console.log('🎸 Creating 5 jams with different playback states...');
  const jams = [];
  const jamLocations = ['Casa do Blues', 'Rock Station', 'Jazz Club', 'Soul Bar', 'Metal Arena'];
  const jamStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'FINISHED'];
  const playbackStates = ['PLAYING', 'PAUSED', 'STOPPED', 'STOPPED', 'STOPPED'] as const;

  // Past dates for progression
  let now = new Date();
  const jamDates = [
    new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago (in progress)
    new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago (paused)
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
    new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days in future
    new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago (finished)
  ];

  for (let i = 0; i < 5; i++) {
    // Generate QR code data URL
    const qrCodeData = await QRCode.toDataURL(`jam-session-${i + 1}`, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
    });

    const jam = await prisma.jam.create({
      data: {
        name: `${jamLocations[i]} - Session ${i + 1}`,
        description: `Amazing jam session at ${jamLocations[i]} with great musicians and awesome vibes! Status: ${jamStatuses[i]}`,
        date: jamDates[i],
        location: jamLocations[i],
        hostMusicianId: hosts[i].id,
        hostName: hosts[i].name,
        hostContact: hosts[i].email,
        status: jamStatuses[i] as any,
        playbackState: playbackStates[i],
        qrCode: qrCodeData,
      },
    });
    jams.push(jam);
  }
  console.log(`✓ Created ${jams.length} jams with various states:`)
  console.log(`  - Jam 1: ACTIVE, PLAYING (currently playing)`)
  console.log(`  - Jam 2: ACTIVE, PAUSED (paused mid-session)`)
  console.log(`  - Jam 3: ACTIVE, STOPPED (scheduled for future)`)
  console.log(`  - Jam 4: INACTIVE, STOPPED (upcoming but not active)`)
  console.log(`  - Jam 5: FINISHED, STOPPED (completed session)`);

  // Create schedules with playback state and timestamps + registrations
  console.log('🎵 Creating schedules with realistic playback progression...');
  let registrationCount = 0;
  let scheduleCount = 0;
  let playbackHistoryCount = 0;
  const registrationStatuses = ['PENDING', 'APPROVED', 'REJECTED'];

  now = new Date();

  for (let jamIdx = 0; jamIdx < jams.length; jamIdx++) {
    const jam = jams[jamIdx];
    
    // Select 8-12 songs per jam
    const songsPerJam = Math.floor(Math.random() * 5) + 8;
    const selectedSongs = songs
      .sort(() => Math.random() - 0.5)
      .slice(0, songsPerJam);

    // Create schedules with realistic progression
    const schedules = [];
    let currentScheduleId: string | null = null;

    for (let order = 0; order < selectedSongs.length; order++) {
      let status = 'SCHEDULED';
      let startedAt = null;
      let completedAt = null;
      let pausedAt = null;

      // Jam 1: PLAYING - Simulate progression through songs
      if (jamIdx === 0) {
        if (order === 0) {
          status = 'COMPLETED';
          startedAt = new Date(now.getTime() - 20 * 60 * 1000); // Started 20 min ago
          completedAt = new Date(now.getTime() - 10 * 60 * 1000); // Completed 10 min ago
        } else if (order === 1) {
          status = 'IN_PROGRESS';
          startedAt = new Date(now.getTime() - 10 * 60 * 1000);
          currentScheduleId = null; // Will be set after creation
        } else {
          status = 'SCHEDULED';
        }
      }
      // Jam 2: PAUSED - Currently paused in middle of song
      else if (jamIdx === 1) {
        if (order === 0) {
          status = 'COMPLETED';
          startedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          completedAt = new Date(now.getTime() - 60 * 60 * 1000 - 40 * 60 * 1000);
        } else if (order === 1) {
          status = 'IN_PROGRESS';
          startedAt = new Date(now.getTime() - 60 * 60 * 1000 - 40 * 60 * 1000);
          pausedAt = new Date(now.getTime() - 5 * 60 * 1000); // Paused 5 min ago
          currentScheduleId = null;
        } else {
          status = 'SCHEDULED';
        }
      }
      // Jam 3, 4: STOPPED - Only scheduled songs
      else if (jamIdx === 2 || jamIdx === 3) {
        status = 'SCHEDULED';
      }
      // Jam 5: FINISHED - Show completed session
      else if (jamIdx === 4) {
        if (order < 6) {
          status = 'COMPLETED';
          startedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000 - (6 - order) * 4 * 60 * 1000);
          completedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000 - (5 - order) * 4 * 60 * 1000);
        } else {
          status = 'SCHEDULED';
        }
      }

      const schedule = await prisma.schedule.create({
        data: {
          jamId: jam.id,
          musicId: selectedSongs[order].id,
          order: order,
          status: status as any,
          startedAt,
          completedAt,
          pausedAt,
        },
      });
      schedules.push(schedule);

      // Track current schedule for Jam 1 and 2
      if (status === 'IN_PROGRESS') {
        currentScheduleId = schedule.id;
      }

      scheduleCount++;
    }

    // Update jam with current schedule if applicable
    if (currentScheduleId) {
      await prisma.jam.update({
        where: { id: jam.id },
        data: { currentScheduleId },
      });
    }

    // Create registrations with varying statuses
    for (const schedule of schedules) {
      // Minimum 2, maximum 6 musicians per schedule
      const registrationsPerSchedule = Math.floor(Math.random() * 5) + 2;
      const selectedMusicians = musicians
        .sort(() => Math.random() - 0.5)
        .slice(0, registrationsPerSchedule);

      for (let i = 0; i < selectedMusicians.length; i++) {
        const musician = selectedMusicians[i];
        const status = registrationStatuses[i % registrationStatuses.length];
        const randomInstrument = instruments[Math.floor(Math.random() * instruments.length)];

        await prisma.registration.create({
          data: {
            musicianId: musician.id,
            jamId: jam.id,
            scheduleId: schedule.id,
            instrument: randomInstrument,
            status: status as any,
          },
        });
        registrationCount++;
      }
    }

    // Create playback history for jams with progression
    if (jamIdx === 0) {
      // Jam 1 is actively playing - create realistic history
      const schedule1 = schedules[0];


      // START_JAM action
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedule1.id,
          action: 'START_JAM',
          timestamp: new Date(now.getTime() - 20 * 60 * 1000),
          userId: hosts[jamIdx].id,
          metadata: { firstSongId: schedule1.id },
        },
      });

      // SKIP_SONG action (to song 2)
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedule1.id,
          action: 'SKIP_SONG',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000),
          userId: hosts[jamIdx].id,
        },
      });

      playbackHistoryCount += 2;
    } else if (jamIdx === 1) {
      // Jam 2 has pause/resume history
      const schedule1 = schedules[0];
      const schedule2 = schedules[1];

      // START_JAM
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedule1.id,
          action: 'START_JAM',
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          userId: hosts[jamIdx].id,
        },
      });

      // SKIP_SONG
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedule1.id,
          action: 'SKIP_SONG',
          timestamp: new Date(now.getTime() - 60 * 60 * 1000 - 40 * 60 * 1000),
          userId: hosts[jamIdx].id,
        },
      });

      // PAUSE_SONG
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedule2.id,
          action: 'PAUSE_SONG',
          timestamp: new Date(now.getTime() - 5 * 60 * 1000),
          userId: hosts[jamIdx].id,
        },
      });

      playbackHistoryCount += 3;
    } else if (jamIdx === 4) {
      // Jam 5 has complete session history
      const schedule1 = schedules[0];

      // START_JAM
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedule1.id,
          action: 'START_JAM',
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000 - 24 * 60 * 1000),
          userId: hosts[jamIdx].id,
        },
      });

      // Multiple skip actions for completed songs
      for (let i = 0; i < Math.min(5, schedules.length - 1); i++) {
        await prisma.playbackHistory.create({
          data: {
            jamId: jam.id,
            scheduleId: schedules[i].id,
            action: 'SKIP_SONG',
            timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000 - (24 - i * 4) * 60 * 1000),
            userId: hosts[jamIdx].id,
          },
        });
      }

      // STOP_JAM
      await prisma.playbackHistory.create({
        data: {
          jamId: jam.id,
          scheduleId: schedules[5].id,
          action: 'STOP_JAM',
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
          userId: hosts[jamIdx].id,
        },
      });

      playbackHistoryCount += 7;
    }
  }

  console.log(`✓ Created ${scheduleCount} schedules with timestamps`)
  console.log(`✓ Created ${registrationCount} registrations`)
  console.log(`✓ Created ${playbackHistoryCount} playback history entries`);

  console.log('\n✅ Database seed completed successfully!\n');
  console.log('📊 SEED DATA SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Musicians: ${musicians.length}`);
  console.log(`  Songs: ${songs.length}`);
  console.log(`  Jams: ${jams.length}`);
  console.log(`  Registrations: ${registrationCount}`);
  console.log(`  Schedules: ${scheduleCount}`);
  console.log(`  Playback History Entries: ${playbackHistoryCount}`);
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('🎤 JAMMING SESSIONS (Playback States)');
  console.log('───────────────────────────────────────────────────────');
  console.log('  🟢 Jam 1 (Carlos Mendes) - PLAYING');
  console.log('     └─ 2 songs completed, currently on song 2/10');
  console.log('     └─ Perfect for testing: NEXT, PAUSE, RESUME, PREVIOUS\n');
  
  console.log('  🟠 Jam 2 (Marina Oliveira) - PAUSED');
  console.log('     └─ 1 song completed, paused during song 2');
  console.log('     └─ Perfect for testing: RESUME, PREVIOUS, STOP\n');
  
  console.log('  🔵 Jam 3 (Roberto Silva) - STOPPED');
  console.log('     └─ No songs started yet, 10 songs in queue');
  console.log('     └─ Perfect for testing: START_JAM lifecycle\n');
  
  console.log('  ⚪ Jam 4 (Juliana Costa) - STOPPED');
  console.log('     └─ No songs started yet, 10 songs in queue');
  console.log('     └─ Perfect for testing: START_JAM and full navigation\n');
  
  console.log('  ⚫ Jam 5 (Gustavo Ferreira) - FINISHED');
  console.log('     └─ 6 completed songs from 24 hours ago');
  console.log('     └─ Perfect for testing: PLAYBACK_HISTORY query\n');

  console.log('🎮 QUICK TEST COMMANDS');
  console.log('───────────────────────────────────────────────────────');
  console.log('  # Get Jam 1 live state (PLAYING)');
  console.log('  GET /api/jams/{jam1Id}/live/state\n');
  
  console.log('  # Start Jam 3 (STOPPED → PLAYING)');
  console.log('  POST /api/jams/{jam3Id}/control/start\n');
  
  console.log('  # Skip to next song');
  console.log('  POST /api/jams/{jamId}/control/next\n');
  
  console.log('  # Pause current song');
  console.log('  POST /api/jams/{jamId}/control/pause\n');
  
  console.log('  # Resume paused song');
  console.log('  POST /api/jams/{jamId}/control/resume\n');
  
  console.log('  # Go back to previous song');
  console.log('  POST /api/jams/{jamId}/control/previous\n');
  
  console.log('  # Stop the jam completely');
  console.log('  POST /api/jams/{jamId}/control/stop\n');
  
  console.log('  # Get playback history');
  console.log('  GET /api/jams/{jamId}/playback-history\n');

  console.log('📚 ALL JAM IDs FOR TESTING');
  console.log('───────────────────────────────────────────────────────');
  jams.forEach((jam, idx) => {
    const states = ['PLAYING', 'PAUSED', 'STOPPED', 'STOPPED', 'FINISHED'];
    console.log(`  Jam ${idx + 1} [${states[idx]}]: ${jam.id}`);
  });
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('🚀 Ready to test! Start the dev server with: npm run start:dev\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

