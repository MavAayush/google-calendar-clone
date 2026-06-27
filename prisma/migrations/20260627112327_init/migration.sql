CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TYPE "ExceptionType" AS ENUM ('CANCELLED', 'MODIFIED');

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recurrence_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "frequency" "Frequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "series_start_date" DATE NOT NULL,
    "series_end_date" DATE,
    "by_day" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recurrence_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recurrence_rule_id" UUID NOT NULL,
    "instance_date" DATE NOT NULL,
    "exception_type" "ExceptionType" NOT NULL,
    "override_event_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrence_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "events_recurrence_rule_id_key" ON "events"("recurrence_rule_id");

CREATE INDEX "idx_events_user_range" ON "events"("user_id", "start_time", "end_time");

CREATE INDEX "idx_events_recurrence_rule_id" ON "events"("recurrence_rule_id");

CREATE UNIQUE INDEX "recurrence_exceptions_override_event_id_key" ON "recurrence_exceptions"("override_event_id");

CREATE UNIQUE INDEX "idx_recurrence_exceptions_lookup" ON "recurrence_exceptions"("recurrence_rule_id", "instance_date");
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurrence_exceptions" ADD CONSTRAINT "recurrence_exceptions_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurrence_exceptions" ADD CONSTRAINT "recurrence_exceptions_override_event_id_fkey" FOREIGN KEY ("override_event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "check_end_time_after_start_time" CHECK ("end_time" > "start_time");
