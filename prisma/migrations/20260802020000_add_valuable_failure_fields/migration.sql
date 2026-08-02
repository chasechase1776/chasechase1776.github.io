-- AlterTable
ALTER TABLE "PortfolioListEntry" ADD COLUMN "response" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PortfolioListEntry" ADD COLUMN "reflection" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PortfolioListEntry" ADD COLUMN "plan" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PortfolioListEntry" ADD COLUMN "resolved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PortfolioListEntry" ADD COLUMN "followUpsJson" TEXT NOT NULL DEFAULT '[]';
