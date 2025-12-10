import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScheduleStatus } from '@prisma/client';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Jam session ID' })
  @IsString()
  @IsNotEmpty()
  jamId: string;

  @ApiProperty({ description: 'Music ID' })
  @IsString()
  @IsNotEmpty()
  musicId: string;


  @ApiProperty({ description: 'Order in schedule' })
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty({
    description: 'Performance status',
    enum: ScheduleStatus,
    required: false
  })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;
}
