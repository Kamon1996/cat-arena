import { createId } from "@paralleldrive/cuid2";

const DIACRITICS = /[̀-ͯ]/g;
const NON_ALNUM = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const SUFFIX_LENGTH = 6;

/** SEO slug: kebab-cased name + short unique suffix → e.g. "fluffy-ab12cd". */
export function slug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(NON_ALNUM, "-")
    .replace(EDGE_DASHES, "");
  const suffix = createId().slice(0, SUFFIX_LENGTH);
  return base ? `${base}-${suffix}` : suffix;
}
