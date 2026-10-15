import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemDuyetNhapVienQuanLy1789793266975 implements MigrationInterface {
    name = 'ThemDuyetNhapVienQuanLy1789793266975'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD "thoi_gian_duyet" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD "ghi_chu_duyet" text`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD "nguoi_duyet_id" integer`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD CONSTRAINT "FK_1aec403d57bcb73cbec548e58ab" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP CONSTRAINT "FK_1aec403d57bcb73cbec548e58ab"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP COLUMN "nguoi_duyet_id"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP COLUMN "ghi_chu_duyet"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP COLUMN "thoi_gian_duyet"`);
    }

}
