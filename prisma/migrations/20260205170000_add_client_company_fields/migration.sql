-- Add normalized company/contact fields for clients.
ALTER TABLE "Client"
ADD COLUMN "vatNumber" TEXT,
ADD COLUMN "companyNumber" TEXT,
ADD COLUMN "contactFirstName" TEXT,
ADD COLUMN "contactLastName" TEXT,
ADD COLUMN "contactEmail" TEXT;
