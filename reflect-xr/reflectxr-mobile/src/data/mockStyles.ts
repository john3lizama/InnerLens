export interface Style {
  id: string;
  name: string;
  category: 'medium' | 'mood' | 'other';
}

export const mockStyles: Style[] = [
  // Artistic Mediums
  { id: 'style-1', name: 'Watercolor', category: 'medium' },
  { id: 'style-2', name: 'Oil Painting', category: 'medium' },
  { id: 'style-3', name: 'Sketch / Pencil', category: 'medium' },
  { id: 'style-4', name: 'Pastel', category: 'medium' },
  { id: 'style-5', name: 'Collage', category: 'medium' },
  { id: 'style-6', name: 'Ink / Line Art', category: 'medium' },
  // Mood / Tone
  { id: 'style-7', name: 'Dreamlike / Surreal', category: 'mood' },
  { id: 'style-8', name: 'Abstract / Expressionist', category: 'mood' },
  { id: 'style-9', name: 'Realistic', category: 'mood' },
  { id: 'style-10', name: 'Minimalist', category: 'mood' },
  { id: 'style-11', name: 'Symbolic / Archetypal', category: 'mood' },
  { id: 'style-12', name: 'Whimsical / Playful', category: 'mood' },
  // Other Styles
  { id: 'style-13', name: 'Cosmic / Spiritual', category: 'other' },
  { id: 'style-14', name: 'Mythological / Archetypal', category: 'other' },
  { id: 'style-15', name: 'Mandala / Sacred Geometry', category: 'other' },
  { id: 'style-16', name: 'Pop Art', category: 'other' },
  { id: 'style-17', name: 'Photorealism', category: 'other' },
  { id: 'style-18', name: 'Fantasy / Magical', category: 'other' },
  { id: 'style-19', name: 'Dark / Moody', category: 'other' },
  { id: 'style-20', name: 'Light / Airy', category: 'other' },
];

export const styleCategories = [
  { key: 'medium', label: 'Artistic Medium' },
  { key: 'mood', label: 'Mood & Tone' },
  { key: 'other', label: 'Other Styles' },
] as const;
