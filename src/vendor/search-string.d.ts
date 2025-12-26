declare module 'search-string' {
  export interface TextSegment {
    text: string;
    negated: boolean;
  }

  export interface ParsedQuery {
    getTextSegments(): TextSegment[];
  }

  export default class SearchString {
    static parse(_query: string): ParsedQuery;
  }
}
