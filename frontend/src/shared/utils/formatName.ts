export function formatName(name: string | null | undefined): string {
  if (!name) return '-';

  const lowercaseWords = ['da', 'de', 'do', 'das', 'dos', 'e'];

  return name
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.includes(word)) {
        return word;
      }

      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
    })
    .join(' ');
}
