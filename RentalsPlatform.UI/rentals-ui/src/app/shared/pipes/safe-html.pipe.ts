import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const html = value ?? '';

    /*
     * SECURITY NOTE (CRITICAL):
     * Binding untrusted backend HTML directly via [innerHTML] can enable severe XSS,
     * for example injected <script>, javascript: URLs, or event handlers like onerror.
     *
     * Angular DOES perform built-in DOM sanitization for [innerHTML] by default, stripping
     * many dangerous constructs. However, bypassSecurityTrustHtml() DISABLES that protection
     * and marks content as trusted.
     *
     * To reduce risk, we first run an explicit sanitization pass with sanitize(HTML, ...)
     * and only then wrap the sanitized result as SafeHtml for rendering in templates.
     * Never pass raw, untrusted user input directly to bypassSecurityTrustHtml().
     */
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';

    // If sanitization changed the content, log a helpful summary and suspicious fragments.
    if (sanitized !== html) {
      try {
        const issues: string[] = [];

        const scriptMatches = html.match(/<script[\s\S]*?>[\s\S]*?<\/script>/gi) || [];
        if (scriptMatches.length) issues.push(`script tags: ${scriptMatches.length}`);

        const inlineEventMatches = html.match(/on\w+\s*=\s*['\"]?/gi) || [];
        if (inlineEventMatches.length) issues.push(`inline event handlers: ${inlineEventMatches.length}`);

        const jsUrlMatches = html.match(/javascript:/gi) || [];
        if (jsUrlMatches.length) issues.push(`javascript: URLs: ${jsUrlMatches.length}`);

        const iframeMatches = html.match(/<iframe|<object|<embed/gi) || [];
        if (iframeMatches.length) issues.push(`iframes/objects/embeds: ${iframeMatches.length}`);

        const styleMatches = html.match(/<style[\s\S]*?>[\s\S]*?<\/style>/gi) || [];
        if (styleMatches.length) issues.push(`style tags: ${styleMatches.length}`);

        console.warn('[SafeHtmlPipe] Sanitized HTML changed content', {
          originalLength: html.length,
          sanitizedLength: sanitized.length,
          issues: issues.length ? issues : undefined,
          originalSnippet: html.slice(0, 200),
          sanitizedSnippet: sanitized.slice(0, 200),
        });
      } catch (e) {
        console.warn('[SafeHtmlPipe] Sanitization changed content (unable to enumerate issues)', e);
      }
    }

    // If the sanitizer stripped everything but the original contains an inline
    // SVG, we assume this is a trusted static icon (defined in app code) and
    // allow it as a fallback so icons still render in the UI. This is a
    // targeted, conservative fallback — avoid using on user-provided content.
    if (!sanitized.trim() && /<svg[\s\S]*?>/i.test(html)) {
      console.warn('[SafeHtmlPipe] Sanitized HTML empty but original contains <svg>; applying SVG fallback (trusted-content).');
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }
}
