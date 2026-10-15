import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemDieuPhoiBenhNhan1789372656773 implements MigrationInterface {
    name = 'ThemDieuPhoiBenhNhan1789372656773'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dieu_phoi_benh_nhan" ("id" SERIAL NOT NULL, "trang_thai" character varying NOT NULL DEFAULT 'cho_duyet', "phong" character varying, "ghi_chu" text, "ly_do_tu_choi" text, "thoi_gian_tiep_don" TIMESTAMP NOT NULL DEFAULT now(), "thoi_gian_chi_dinh" TIMESTAMP, "thoi_gian_chuyen_phong" TIMESTAMP, "ngay_cap_nhat" TIMESTAMP NOT NULL DEFAULT now(), "lich_hen_id" integer, "khoa_id" integer, "bac_si_id" integer, "nguoi_duyet_id" integer, "nguoi_chuyen_phong_id" integer, CONSTRAINT "REL_30c5c4d20495148f72b95e5dd3" UNIQUE ("lich_hen_id"), CONSTRAINT "PK_59f665edf8185f903305bc9077b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" ADD CONSTRAINT "FK_30c5c4d20495148f72b95e5dd33" FOREIGN KEY ("lich_hen_id") REFERENCES "lich_hen"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" ADD CONSTRAINT "FK_63c5bc8b177e856d674a7507c7b" FOREIGN KEY ("khoa_id") REFERENCES "khoa_phong"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" ADD CONSTRAINT "FK_25060cb1dd9fe892f661c5f3d71" FOREIGN KEY ("bac_si_id") REFERENCES "bac_si"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" ADD CONSTRAINT "FK_973a358492610535bd5aa0e3d90" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" ADD CONSTRAINT "FK_eb2689b69a7ce16000283d61000" FOREIGN KEY ("nguoi_chuyen_phong_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" DROP CONSTRAINT "FK_eb2689b69a7ce16000283d61000"`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" DROP CONSTRAINT "FK_973a358492610535bd5aa0e3d90"`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" DROP CONSTRAINT "FK_25060cb1dd9fe892f661c5f3d71"`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" DROP CONSTRAINT "FK_63c5bc8b177e856d674a7507c7b"`);
        await queryRunner.query(`ALTER TABLE "dieu_phoi_benh_nhan" DROP CONSTRAINT "FK_30c5c4d20495148f72b95e5dd33"`);
        await queryRunner.query(`DROP TABLE "dieu_phoi_benh_nhan"`);
    }

}
