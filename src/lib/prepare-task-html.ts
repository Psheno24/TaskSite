export interface TaskHtmlPrepResult {
  html: string;
  warnings: string[];
}

/**
 * Normalize teacher HTML before save / iframe render.
 * Fixes common patterns that break inside srcdoc iframes.
 */
export function prepareTaskHtml(html: string): TaskHtmlPrepResult {
  const warnings: string[] = [];
  let result = html.trim();

  if (!result) {
    return { html: result, warnings };
  }

  if (/<base\b/i.test(result)) {
    result = result.replace(/<base\b[^>]*\/?>/gi, "");
    warnings.push("Removed <base> tag — it breaks in-iframe navigation.");
  }

  if (/target\s*=\s*["']?(_parent|_top|_blank)["']?/gi.test(result)) {
    warnings.push(
      "Found links with target=_parent/_top — they may open outside the task."
    );
  }

  const absoluteAppLinks = result.match(
    /href\s*=\s*["']https?:\/\/[^"']*\/task\//gi
  );
  if (absoluteAppLinks?.length) {
    warnings.push(
      "Found absolute /task/ links — use relative #section anchors instead."
    );
  }

  if (!/<html[\s>]/i.test(result) && !/<body[\s>]/i.test(result)) {
    result = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${result}</body></html>`;
    warnings.push("Wrapped fragment in <html><body> for stable iframe rendering.");
  }

  return { html: result, warnings };
}
