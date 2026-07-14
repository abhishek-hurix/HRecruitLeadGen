/** Convert stored email HTML into plain text for the editor. */
export function htmlToPlainEmail(html: string): string {
  if (!html) return '';

  let text = html.replace(/\r\n/g, '\n');

  // Anchors → visible URL or link text
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
    const label = stripTags(inner).trim();
    if (!label || label === href) return String(href);
    return `${label} (${href})`;
  });

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = stripTags(text);
  text = decodeBasicEntities(text);

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Convert plain text (Enter / spaces) into email HTML for storage/send. */
export function plainToEmailHtml(plain: string): string {
  const normalized = plain.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const paragraphs = normalized.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const lines = para.split('\n').map((line) => autoLinkUrls(escapeEmailText(line)));
      return `<p>${lines.join('<br/>')}</p>`;
    })
    .join('\n');
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Escape HTML special chars but keep {{variable}} placeholders intact. */
function escapeEmailText(value: string): string {
  const parts = value.split(/(\{\{[\s\S]*?\}\})/g);
  return parts
    .map((part) => {
      if (/^\{\{[\s\S]*?\}\}$/.test(part)) return part;
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    })
    .join('');
}

/** Turn bare http(s) URLs into anchors (after escaping). */
function autoLinkUrls(escapedLine: string): string {
  const parts = escapedLine.split(/(\{\{[\s\S]*?\}\})/g);
  return parts
    .map((part) => {
      if (/^\{\{[\s\S]*?\}\}$/.test(part)) return part;
      return part.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
        const clean = url.replace(/[.,);:]+$/g, '');
        const trailing = url.slice(clean.length);
        return `<a href="${clean}">${clean}</a>${trailing}`;
      });
    })
    .join('');
}
