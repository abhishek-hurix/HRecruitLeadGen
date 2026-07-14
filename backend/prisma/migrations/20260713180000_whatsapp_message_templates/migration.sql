-- CreateTable
CREATE TABLE "whatsapp_message_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_message_templates_is_active_idx" ON "whatsapp_message_templates"("is_active");

-- AddForeignKey
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
