import { nid, supabaseAdmin, throwIf } from "./db";

export async function audit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin().from("AuditLog").insert({
    id: nid(),
    actorId: input.actorId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null,
  });
  throwIf(error);
}
