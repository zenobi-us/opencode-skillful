/**
 * Simple JSON to XML converter
 * Note: This is a basic implementation and may not cover all edge cases.
 */
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
      xml += `<${key}>${value}</${key}>`;
    } else {
      xml += `<${key}/>`;
    }
  }

  xml += `</${rootElement}>`;
  return xml;
}
