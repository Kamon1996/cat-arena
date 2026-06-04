type JsonLdProps = {
  data: Record<string, unknown>;
};

/**
 * Injects a schema.org JSON-LD block. Server Component only.
 * Escapes `<` to `<` so user-controlled fields (e.g. a cat name containing
 * "</script>") cannot break out of the script element — JSON.stringify alone does not.
 */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script content; `<` is escaped above
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
