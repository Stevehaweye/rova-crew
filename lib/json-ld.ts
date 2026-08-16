const LINE_SEPARATORS = new RegExp('[\\u2028\\u2029]', 'g')

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATORS, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}
