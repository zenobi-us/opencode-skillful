/**
 * JSON to XML Converter - Format skill results for message injection
 *
 * WHY: OpenCode messages are rendered as markdown with XML injection blocks.
 * When a tool returns skill data (search results, resource content, etc.),
 * we need to format it as XML so it can be injected into the message and
 * displayed in a human-readable format to the user.
 *
 * DESIGN: Recursive conversion that handles:
 * - Primitives: converted to <key>value</key>
 * - Objects: recursively converted with key as element name
 * - Arrays: each item converted with parent key as element name
 * - null/undefined: converted to <key/>
 *
 * EXAMPLE:
 * Input:  { skill: { name: 'git-commit', description: 'Write commits' } }
 * Output: <root><skill><name>git-commit</name><description>Write commits...</description></skill></root>
 *
 * WHY XML NOT JSON:
 * - XML renders as human-readable indented blocks in message injection
 * - JSON would be compressed/escaped, harder to read
 * - Users see the XML structure directly in the message context
 *
 * NOTE: This is a basic implementation. Edge cases like:
 * - Circular references (not handled)
 * - Deeply nested structures (may produce large output)
 * are not fully addressed. If you need full robustness, consider a library.
 *
 * @param json Object to convert
 * @param rootElement XML element name for root (default: 'root')
 * @returns XML string representation
 */
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function jsonToXml(json: object, rootElement: string = 'root'): string {
  let xml = `<${rootElement}>`;

  for (const key in json) {
    if (!Object.hasOwn(json, key)) {
      continue;
    }
    if (typeof key !== 'string') {
      continue;
    }

    const value = Object.getOwnPropertyDescriptor(json, key)?.value;

    if (Array.isArray(value)) {
      for (const item of value) {
        xml += jsonToXml(item, key);
      }
    } else if (typeof value === 'object' && value !== null) {
      xml += jsonToXml(value, key);
    } else if (value !== undefined && value !== null) {
      xml += `<${key}>${escapeXml(String(value))}</${key}>`;
    } else {
      xml += `<${key}/>`;
    }
  }

  xml += `</${rootElement}>`;
  return xml;
}
