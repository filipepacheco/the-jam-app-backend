import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Karaoke Jam API is running! 🎤🎸';
  }
}

