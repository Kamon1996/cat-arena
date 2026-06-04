// Entity limits (configurable defaults — may change later)
export const MAX_CATS_PER_USER = 2;
export const MAX_IMAGES_PER_CAT = 3;
export const MAX_ORGS_PER_USER = 1;
export const MAX_ORGS_PER_CAT = 2;

// Glicko-2 starting values (the rating entity is the Cat)
export const GLICKO_DEFAULT = {
  rating: 1500,
  rd: 350,
  vol: 0.06,
} as const;

// Conservative leaderboard score: lower bound of 95% CI.
// score = rating - 2 * rd  (denormalized into Cat.score / CatOrg.score)
export const SCORE = (rating: number, rd: number): number => rating - 2 * rd;

// Image processing sizes (max edge, px) — sharp → WebP
export const IMAGE_SIZE = {
  THUMB: 200,
  CARD: 800,
} as const;

// Pairing — candidate pools & selection windows
export const PAIR_A_CANDIDATE_POOL = 40; // rows pulled via (status, rd) index for A
export const PAIR_B_CANDIDATE_POOL = 40; // rows pulled via (status, score) index for B
export const PAIR_B_SCORE_WINDOW = 120; // B.score must be within ±window of A.score
export const PAIR_EPSILON = 0.15; // prob. of picking a random eligible B instead of the closest
export const PAIR_MIN_POOL = 2; // need ≥2 distinct eligible cats to form a pair

// Pair token — single-use HMAC token lifetime
export const PAIR_TOKEN_TTL_SECONDS = 60 * 30; // 30 min pair→vote window; nonce gives single-use

// Rate limiting — vote token bucket (per voterKey/IP)
export const RATE_LIMIT_REFILL_TOKENS = 10; // tokens added per interval
export const RATE_LIMIT_REFILL_INTERVAL = "10 s" as const; // refill cadence (Duration literal)
export const RATE_LIMIT_MAX_TOKENS = 20; // bucket capacity (allows a short burst)
export const RATE_LIMIT_PREFIX = "ratelimit:vote";

// Anonymous voter identity (cookies)
export const ANON_ID_COOKIE = "ca_anon";
export const SEEN_COOKIE = "ca_seen";

// Recent-seen ring buffer (cat ids), no DB
export const SEEN_BUFFER_SIZE = 50;
export const SEEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// TanStack Query timings for the duel
export const PAIR_STALE_TIME_MS = 0;
export const PAIR_GC_TIME_MS = 5 * 60 * 1000;

// Auth.js (magic-link) — provider id, route paths, token lifetime, email subject
export const AUTH = {
  PROVIDER_ID: "resend",
  SIGN_IN_PATH: "/signin",
  VERIFY_REQUEST_PATH: "/signin?sent=1",
  MAGIC_LINK_MAX_AGE_SECONDS: 15 * 60, // 15 min
  EMAIL_SUBJECT: "Sign in to WhosMeowing",
} as const;

// ── Upload limits ──────────────────────────────────────────────
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per original

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

// ── Moderation thresholds (configurable defaults; tune on data) ──
export const REPORT_HIDE_THRESHOLD = 5; // distinct reports → auto-hide cat
export const NSFW_REJECT_THRESHOLD = 0.85; // P(nsfw) ≥ → REJECTED
export const NSFW_PENDING_THRESHOLD = 0.5; // P(nsfw) ≥ (but < reject) → PENDING
export const CAT_MIN_CONFIDENCE = 0.4; // P(is-a-cat) ≥ → eligible for APPROVED

// ── Image encoding ───────────────────────────────────────────────
export const WEBP_QUALITY = 82; // sharp .webp({ quality })

// Presigned PUT URL lifetime — keep short (skill: < 1h)
export const PRESIGN_TTL_SECONDS = 300; // 5 min

// Admin users table — rows per page
export const ADMIN_USERS_PAGE_SIZE = 20;

// Moderation queue — cats per "Load more" page
export const MODERATION_PAGE_SIZE = 10;

// Organizations — SEO indexing gate: an org page is noindex until it has at least this many members.
export const ORG_MIN_INDEXABLE_MEMBERS = 3;

// Organizations — join code: long, URL-safe, hard to guess.
export const ORG_JOIN_CODE_LENGTH = 24;

// Organizations — name + description field limits (shared by Zod schemas + form).
export const ORG_NAME_MIN = 2;
export const ORG_NAME_MAX = 50;
export const ORG_DESCRIPTION_MAX = 280;

// ── Cat toasts (branded Sonner cards) ───────────────────────────
export const CAT_TOAST_DURATION_MS = 4500; // default auto-dismiss; 0 = sticky
export const CAT_TOAST_CONFETTI_COUNT = 28; // lighter burst than the duel celebration

// ── Site identity / SEO ──────────────────────────────────────────
// Canonical origin (no trailing slash); env-overridable for previews/prod.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://whosmeowing.app";
export const SITE_NAME = "WhosMeowing";
export const SITE_LOCALE = "en_US";
export const SITE_DESCRIPTION =
  "Vote in 1-vs-1 cat photo duels and watch the cutest cats climb the Glicko-2 leaderboard.";

// Open Graph image canvas (next/og ImageResponse).
export const OG_SIZE = { width: 1200, height: 630 } as const;

// ISR: how often cat/leaderboard pages and the sitemap revalidate.
export const ISR_REVALIDATE_SECONDS = 60 * 60; // 1 hour

// Leaderboard / cat-page list sizes.
export const TOP_LEADERBOARD_LIMIT = 100;
export const RECENT_DUELS_LIMIT = 10;

// (ORG_MIN_INDEXABLE_MEMBERS is defined above by phase 07 — reused by the sitemap.)

// ── Analytics: PostHog vote-funnel event names (category:object_action) ──
export const ANALYTICS_EVENT = {
  PAIR_SERVED: "duel:pair_served",
  VOTE_CAST: "duel:vote_cast",
  SKIP: "duel:skip",
} as const;
