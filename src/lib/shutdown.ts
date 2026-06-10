import "server-only";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { closeRedis } from "@/lib/redis-client";

// Clean shutdown on container stop/restart (docker/systemd send SIGTERM). Without
// this, in-flight DB/Redis sockets are killed abruptly, which can leave the
// managed Postgres holding connections until they time out. Idempotent.

let registered = false;

async function shutdown(signal: string): Promise<void> {
  console.log(`[shutdown] ${signal} received — closing Prisma + Redis…`);
  try {
    await prisma.$disconnect();
    // closeRedis() is a no-op under the upstash driver (no TCP client to close).
    if (env.REDIS_DRIVER === "redis") {
      await closeRedis();
    }
  } catch (err) {
    console.error("[shutdown] error during cleanup:", err);
  } finally {
    process.exit(0);
  }
}

export function registerShutdownHandlers(): void {
  if (registered) {
    return;
  }
  registered = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}
