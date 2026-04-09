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
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }
}
