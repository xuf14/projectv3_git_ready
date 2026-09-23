import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy, RolesGuard, JWT_SECRET } from './auth';
import { AuthService, AuthController } from './auth.module';
import { CatalogService, CatalogController } from './catalog.module';
import { ApptService, ApptController } from './appointment.module';
import { ProfileService, ProfileController } from './profile.module';
import { DocumentService, DocumentController } from './document.module';
import { UserAdminService, UserAdminController } from './user.module';
import { PaymentService, PaymentController } from './payment.module';
import { PatientInfoService, PatientInfoController } from './patient-info.module';
import { YLenhService, YLenhController } from './y-lenh.module';
import { EncounterService, EncounterController } from './encounter.module';
import { MediaService, MediaController } from './media.module';
import { dbConfig, ENTITIES } from './data-source.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(dbConfig),
    TypeOrmModule.forFeature(ENTITIES),
    PassportModule,
    JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController, CatalogController, ApptController, ProfileController, DocumentController, UserAdminController, PaymentController, PatientInfoController, YLenhController, EncounterController, MediaController],
  providers: [AuthService, CatalogService, ApptService, ProfileService, DocumentService, UserAdminService, PaymentService, PatientInfoService, YLenhService, EncounterService, MediaService, JwtStrategy, RolesGuard],
})
export class AppModule {}
