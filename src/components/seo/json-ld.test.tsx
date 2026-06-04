import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JsonLd } from "@/components/seo/json-ld";

describe("JsonLd", () => {
  it("escapes < so user-controlled content cannot break out of the script tag", () => {
    const malicious = "</script><script>alert(1)</script>";
    const { container } = render(<JsonLd data={{ name: malicious }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    const html = script?.innerHTML ?? "";
    // No raw closing tag survives; "<" is encoded.
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
    // Still valid JSON once unescaped — content is preserved, just neutralized.
    const parsed = JSON.parse(html.replace(/\\u003c/g, "<")) as { name: string };
    expect(parsed.name).toBe(malicious);
  });

  it("renders well-formed JSON-LD for normal data", () => {
    const { container } = render(<JsonLd data={{ "@type": "ItemList", name: "Top" }} />);
    const html = container.querySelector('script[type="application/ld+json"]')?.innerHTML ?? "";
    expect(JSON.parse(html)).toEqual({ "@type": "ItemList", name: "Top" });
  });
});
