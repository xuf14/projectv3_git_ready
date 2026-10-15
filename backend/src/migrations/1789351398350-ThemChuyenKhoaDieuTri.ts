import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemChuyenKhoaDieuTri1789351398350 implements MigrationInterface {
    name = 'ThemChuyenKhoaDieuTri1789351398350'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chuyen_khoa" ("id" SERIAL NOT NULL, "ma_phieu" character varying NOT NULL, "trang_thai" character varying NOT NULL DEFAULT 'cho_tiep_nhan', "ly_do" text NOT NULL, "tinh_trang_nb" text, "ly_do_ket_thuc" text, "thoi_gian_tao" TIMESTAMP NOT NULL DEFAULT now(), "thoi_gian_xu_ly" TIMESTAMP, "phieu_kham_id" integer, "khoa_di_id" integer, "khoa_den_id" integer, "nguoi_tao_id" integer, "nguoi_xu_ly_id" integer, CONSTRAINT "UQ_506c7b216d62c8d3725488ec4bb" UNIQUE ("ma_phieu"), CONSTRAINT "PK_c15d04b7642267d84f89dfc9407" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_chuyen_khoa_dang_cho" ON "chuyen_khoa" ("phieu_kham_id") WHERE "trang_thai" = 'cho_tiep_nhan'`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" ADD CONSTRAINT "FK_029ae64a7795cdb90d0f08536b1" FOREIGN KEY ("phieu_kham_id") REFERENCES "phieu_kham_benh"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" ADD CONSTRAINT "FK_6de9b63326cdf2a11a8196c5c13" FOREIGN KEY ("khoa_di_id") REFERENCES "khoa_phong"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" ADD CONSTRAINT "FK_e31830e428c1a896d0e3388eca8" FOREIGN KEY ("khoa_den_id") REFERENCES "khoa_phong"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" ADD CONSTRAINT "FK_852eabe6bf30d1e92ba7b062a01" FOREIGN KEY ("nguoi_tao_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" ADD CONSTRAINT "FK_156288b1825827b0eff4488d217" FOREIGN KEY ("nguoi_xu_ly_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" DROP CONSTRAINT "FK_156288b1825827b0eff4488d217"`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" DROP CONSTRAINT "FK_852eabe6bf30d1e92ba7b062a01"`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" DROP CONSTRAINT "FK_e31830e428c1a896d0e3388eca8"`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" DROP CONSTRAINT "FK_6de9b63326cdf2a11a8196c5c13"`);
        await queryRunner.query(`ALTER TABLE "chuyen_khoa" DROP CONSTRAINT "FK_029ae64a7795cdb90d0f08536b1"`);
        await queryRunner.query(`DROP INDEX "public"."uq_chuyen_khoa_dang_cho"`);
        await queryRunner.query(`DROP TABLE "chuyen_khoa"`);
    }

}
