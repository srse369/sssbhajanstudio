const NUMBER_TO_NOTE: Record<string, string> = {
  '1': 'C', '2': 'D', '3': 'E', '4': 'F', '5': 'G', '6': 'A', '7': 'B',
  '1.5': 'C#', '2.5': 'D#', '3.5': 'F', '4.5': 'F#', '5.5': 'G#', '6.5': 'A#', '7.5': 'C',
};

const NOTE_TO_NUMBER: Record<string, string> = {
  C: '1', D: '2', E: '3', F: '4', G: '5', A: '6', B: '7',
  'C#': '1.5', 'D#': '2.5', 'F#': '4.5', 'G#': '5.5', 'A#': '6.5',
};

const FLATS: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const SHARP_ALIASES: Record<string, string> = { 'E#': 'F', 'B#': 'C' };

// Mirrors the saisongs.org pitch normalization; M is major and m is minor, so case matters.
function normalizePitch(input: string): string | null {
  const value = input.replace(/[\s\u00A0\u200B]+/g, '');
  if (!value) return null;

  if (FLATS[value]) return FLATS[value];
  if (NUMBER_TO_NOTE[value]) return NUMBER_TO_NOTE[value];

  const numeric = value.match(/^(\d(?:\.5)?)(M|m|Madhyam|Pancham(?:\/[A-G]#?)?)$/);
  if (numeric && NUMBER_TO_NOTE[numeric[1]]) {
    const note = NUMBER_TO_NOTE[numeric[1]];
    if (numeric[2] === 'M') return `${note} major`;
    if (numeric[2] === 'm') return `${note} minor`;
    if (numeric[2] === 'Madhyam') return `${numeric[1]} Madhyam`;
    return note;
  }

  const letter = value.match(/^([A-G]#?)(M|m)?$/i);
  if (letter) {
    const quality = letter[2];
    if (!quality) return letter[1].toUpperCase();
    const note = letter[1].toUpperCase();
    const resolved = SHARP_ALIASES[note] ?? note;
    return `${resolved} ${quality === 'M' ? 'major' : 'minor'}`;
  }

  return null;
}

export function formatReferencePitch(input?: string | null): string {
  if (!input?.trim()) return '';
  const normalized = normalizePitch(input) || input.trim();
  if (normalized.includes('Madhyam')) return normalized;

  const display = normalized.replace('#', '♯');
  const suffix = normalized.endsWith(' major') ? 'M' : normalized.endsWith(' minor') ? 'm' : '';
  const note = normalized.replace(/ (major|minor)$/, '');
  const number = NOTE_TO_NUMBER[note];
  return `${number ? `${number}${suffix}` : normalized} (${display})`;
}

const BASE_PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const PITCH_OPTIONS = [
  ...BASE_PITCHES.flatMap((value) => [value, `${value} major`, `${value} minor`]),
  '1 Madhyam', '1.5 Madhyam', '2 Madhyam', '2.5 Madhyam', '3 Madhyam', '4 Madhyam',
  '4.5 Madhyam', '5 Madhyam', '5.5 Madhyam', '6 Madhyam', '6.5 Madhyam', '7 Madhyam',
];
const PITCH_NUMBERS: Record<string, number> = { C: 1, 'C#': 1.5, D: 2, 'D#': 2.5, E: 3, F: 4, 'F#': 4.5, G: 5, 'G#': 5.5, A: 6, 'A#': 6.5, B: 7 };

export function pitchOptionLabel(value: string) {
  if (value.includes('Madhyam')) return value;
  const suffix = value.endsWith(' major') ? 'M' : value.endsWith(' minor') ? 'm' : '';
  const base = suffix ? value.replace(/ (major|minor)$/, '') : value;
  return `${PITCH_NUMBERS[base]}${suffix} (${value.replace('#', '♯')})`;
}
