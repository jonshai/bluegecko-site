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

export const collections = {
  properties,
  events,
};
