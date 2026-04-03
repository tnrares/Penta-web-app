-- Crew / squad groupings for workers (manager-maintained)
CREATE TABLE "team" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("_id")
);

CREATE TABLE "team_member" (
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","user_id")
);

ALTER TABLE "team" ADD CONSTRAINT "team_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
