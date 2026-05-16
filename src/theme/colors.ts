// ─────────────────────────────────────────────────────────────────────────────
// Chess Coach — Color Config
// ALL colors live here. Change any value to update the entire app.
// ─────────────────────────────────────────────────────────────────────────────

export const LightColors = {
  // Surfaces
  bg:           '#f4efe4',
  bg2:          '#ede7d6',
  surface:      '#fdfbf5',
  surface2:     '#f4efe4',
  surface3:     '#e8e1cc',
  border:       '#e1d9c1',
  borderSoft:   '#ece5d2',
  divider:      'rgba(26, 24, 21, 0.08)',

  // Ink
  ink:          '#1a1815',
  ink2:         '#3a3530',
  inkSoft:      '#6e6759',
  inkMute:      '#9a9285',

  // Brand — terracotta. Change this hex to retheme the whole app.
  brand:        '#c25e3a',
  brand2:       '#a64a2a',
  brand3:       '#823b22',
  brandSoft:    'rgba(194, 94, 58, 0.10)',
  brandTint:    'rgba(194, 94, 58, 0.18)',
  onBrand:      '#fdfbf5',

  // Semantic — move quality
  good:         '#4d7c45',
  good2:        '#3a6334',
  goodSoft:     'rgba(77, 124, 69, 0.10)',
  goodBorder:   'rgba(77, 124, 69, 0.30)',
  warn:         '#b8801f',
  warnSoft:     'rgba(184, 128, 31, 0.12)',
  warnBorder:   'rgba(184, 128, 31, 0.30)',
  bad:          '#c4453a',
  bad2:         '#a13128',
  badSoft:      'rgba(196, 69, 58, 0.10)',
  badBorder:    'rgba(196, 69, 58, 0.30)',

  // Chess board
  boardLight:   '#ede2c5',
  boardDark:    '#b0905f',
  pieceLight:   '#fbf4e0',
  pieceDark:    '#181410',

  // Shadows (expressed as drop shadow colors — use with elevation on Android)
  shadowColor:  '#1a1815',
} as const;

export const DarkColors = {
  // Surfaces
  bg:           '#14110d',
  bg2:          '#1c1813',
  surface:      '#1f1b16',
  surface2:     '#26211a',
  surface3:     '#322b22',
  border:       '#3a3327',
  borderSoft:   '#2c261e',
  divider:      'rgba(255, 245, 220, 0.07)',

  // Ink
  ink:          '#f3ecd6',
  ink2:         '#d8d0b8',
  inkSoft:      '#998f78',
  inkMute:      '#6c6353',

  // Brand
  brand:        '#e07a48',
  brand2:       '#d96a35',
  brand3:       '#b8552a',
  brandSoft:    'rgba(224, 122, 72, 0.14)',
  brandTint:    'rgba(224, 122, 72, 0.22)',
  onBrand:      '#14110d',

  // Semantic
  good:         '#7eae6f',
  good2:        '#5f8e52',
  goodSoft:     'rgba(126, 174, 111, 0.16)',
  goodBorder:   'rgba(126, 174, 111, 0.30)',
  warn:         '#d4a045',
  warnSoft:     'rgba(212, 160, 69, 0.16)',
  warnBorder:   'rgba(212, 160, 69, 0.30)',
  bad:          '#e36a5c',
  bad2:         '#c04d40',
  badSoft:      'rgba(227, 106, 92, 0.16)',
  badBorder:    'rgba(227, 106, 92, 0.30)',

  // Chess board
  boardLight:   '#5a4b35',
  boardDark:    '#382c1c',
  pieceLight:   '#ede4cb',
  pieceDark:    '#1a1610',

  shadowColor:  '#000000',
} as const;

export type ColorScheme = typeof LightColors;
export type ThemeMode = 'light' | 'dark';
