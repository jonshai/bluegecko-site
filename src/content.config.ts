import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const properties = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/properties' }),
  schema: z.object({
    slug: z.string(),
    address: z.string(),
    price: z.number(),
    beds: z.number(),
    baths: z.number(),
    sqft: z.number(),
    description: z.string(),
    hero: z.string().optional(),
    gallery: z.array(z.string()).optional(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    property: z.string(),
    date: z.string(),
    start: z.string(),
    end: z.string(),
    notes: z.string().optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    category: z.string().optional(),
    order: z.number().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author_name: z.enum(['William Whipple', 'Lucky Whipple']).optional(),
    last_updated: z.coerce.date().optional(),
    excerpt: z.string(),
    hero: z.string().optional(),
    tags: z.array(z.string()).optional(),
    link_target: z.boolean().optional(),
    autolink_cap: z.number().optional(),
  }),
});

const communities = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/communities' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    hero: z.string().optional(),
    order: z.number().optional(),
    date: z.coerce.date().optional(),
    author_name: z.enum(['William Whipple', 'Lucky Whipple']).optional(),
    last_updated: z.coerce.date().optional(),
    autolink_cap: z.number().optional(),
  }),
});

const builders = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/builders' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    hero: z.string().optional(),
    gallery: z.array(z.string()).optional(),
    website: z.string().url().optional(),
    communities: z.array(z.string()).optional(),
    date: z.coerce.date().optional(),
    author_name: z.enum(['William Whipple', 'Lucky Whipple']).optional(),
    last_updated: z.coerce.date().optional(),
    autolink_cap: z.number().optional(),
  }),
});

export const collections = {
  properties,
  events,
  faq,
  blog,
  communities,
  builders,
};
