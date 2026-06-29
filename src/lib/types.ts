export const ROLES = [
  'admin',
  'chief_editor',
  'editor',
  'reviewer',
  'moderator',
  'subscriber',
  'user'
] as const;

export type Role = (typeof ROLES)[number];

export type ArticleBlock = {
  id: string;
  type: 'paragraph' | 'lead' | 'heading' | 'quote' | 'list' | 'image';
  text: string;
  items?: string[];
  src?: string;
  alt?: string;
};

export type Annotation = {
  id: number;
  article_id: number;
  paragraph_id: string;
  type: 'highlight' | 'underline' | 'note';
  quote: string;
  prefix: string;
  suffix: string;
  start_off: number;
  end_off: number;
  note: string;
  color: string;
  created_at: string;
};

export type PageBlock = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  position: number;
};
