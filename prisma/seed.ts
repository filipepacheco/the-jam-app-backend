import { PrismaClient } from '@prisma/client';
import * as QRCode from 'qrcode';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.schedule.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.jamMusic.deleteMany();
  await prisma.jam.deleteMany();
  await prisma.music.deleteMany();
  await prisma.musician.deleteMany();

  // Create ghost host musician
  console.log('Creating ghost host musician...');
  const ghostHost = await prisma.musician.create({
    data: {
      name: 'Ghost Host',
      email: null,
      phone: null,
      instrument: null,
      level: null,
      isHost: true,
      contact: null,
    },
  });
  console.log(`✓ Created ghost host: ${ghostHost.id}`);

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
      },
    });
    songs.push(song);
  }
  console.log(`✓ Created ${songs.length} songs`);

  // Create jams (5)
  console.log('Creating 5 jams...');
  const jams = [];
  const jamLocations = ['Casa do Blues', 'Rock Station', 'Jazz Club', 'Soul Bar', 'Metal Arena'];
  const jamDates = [
    new Date('2024-12-15T20:00:00'),
    new Date('2024-12-22T20:00:00'),
    new Date('2025-01-05T20:00:00'),
    new Date('2025-01-19T20:00:00'),
    new Date('2025-02-05T20:00:00'),
  ];

  for (let i = 0; i < 5; i++) {
    // Generate QR code data URL
    const qrCodeData = await QRCode.toDataURL(`jam-${i + 1}`, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
    });

    const jam = await prisma.jam.create({
      data: {
        name: `Jam Session ${i + 1}`,
        description: `Amazing jam session #${i + 1} with great musicians and awesome vibes!`,
        date: jamDates[i],
        location: jamLocations[i],
        hostMusicianId: ghostHost.id,
        hostName: `Ghost Host - Jam ${i + 1}`,
        hostContact: `host${i + 1}@karaokejam.com`,
        status: 'ACTIVE',
        qrCode: qrCodeData,
      },
    });
    jams.push(jam);
  }
  console.log(`✓ Created ${jams.length} jams`);

  // Create JamMusic entries and Registrations
  console.log('Creating JamMusic entries and registrations...');
  let registrationCount = 0;
  let scheduleCount = 0;
  const registrationStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
  const scheduleStatuses = ['SUGGESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

  for (const jam of jams) {
    // Select 8-12 songs per jam
    const songsPerJam = Math.floor(Math.random() * 5) + 8;
    const selectedSongs = songs
      .sort(() => Math.random() - 0.5)
      .slice(0, songsPerJam);

    // Create JamMusic entries
    const jamMusics = [];
    for (const song of selectedSongs) {
      const jamMusic = await prisma.jamMusic.create({
        data: {
          jamId: jam.id,
          musicId: song.id,
        },
      });
      jamMusics.push(jamMusic);
    }

    // Create schedules for each song with varying statuses
    const schedules = [];
    for (let order = 0; order < selectedSongs.length; order++) {
      const scheduleStatus = scheduleStatuses[order % scheduleStatuses.length];
      const schedule = await prisma.schedule.create({
        data: {
          jamId: jam.id,
          musicId: selectedSongs[order].id,
          order: order,
          status: scheduleStatus as any,
        },
      });
      schedules.push(schedule);
      scheduleCount++;
    }

    // Ensure at least 3 registrations per schedule with varying statuses
    for (const schedule of schedules) {
      // Minimum 3 musicians per schedule, maximum 6
      const registrationsPerSchedule = Math.floor(Math.random() * 4) + 3;
      const selectedMusicians = musicians
        .sort(() => Math.random() - 0.5)
        .slice(0, registrationsPerSchedule);

      for (let i = 0; i < selectedMusicians.length; i++) {
        const musician = selectedMusicians[i];
        const status = registrationStatuses[i % registrationStatuses.length];

        await prisma.registration.create({
          data: {
            musicianId: musician.id,
            jamId: jam.id,
            scheduleId: schedule.id,
            instrument: musician.instrument || 'guitarra',
            status: status as any,
          },
        });
        registrationCount++;
      }
    }
  }
  console.log(`✓ Created ${registrationCount} registrations`);
  console.log(`✓ Created ${scheduleCount} schedules`);

  console.log('✅ Database seed completed successfully!');
  console.log(`
    Summary:
    - Musicians: ${musicians.length}
    - Songs: ${songs.length}
    - Jams: ${jams.length}
    - Registrations: ${registrationCount}
    - Schedules: ${scheduleCount}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

