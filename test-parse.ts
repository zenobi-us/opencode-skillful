import SearchString from 'search-string';

const instance = SearchString.parse('*');
const segments = instance.getTextSegments();
console.log('Segments:', segments);
console.log(
  'Include would be:',
  segments.filter((s: any) => !s.negated).map((s: any) => s.text.toLowerCase())
);
