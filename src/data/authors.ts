export type AuthorName = 'William Whipple' | 'Lucky Whipple';

export interface Author {
  name: AuthorName;
  bio: string;
  photo: string;
}

export const authors: Record<AuthorName, Author> = {
  'William Whipple': {
    name: 'William Whipple',
    bio: 'Local market guide, strategist, and the one most likely to go deep on pricing, positioning, and the details that can save you money or keep you out of trouble.',
    photo: '/assets/william.jpg',
  },
  'Lucky Whipple': {
    name: 'Lucky Whipple',
    bio: 'Warmth, follow-through, and the human side of the process. The kind of steady presence people remember after the paperwork fog clears.',
    photo: '/assets/lucky.jpg',
  },
};

export function getAuthor(name: AuthorName): Author {
  return authors[name];
}
