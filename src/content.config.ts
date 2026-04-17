import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import entities from './data/entities.json';

const openHouses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/open-houses' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    date: z.string(),
    location: z.string(),
    summary: z.string(),
    heroImage: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

// --- Auto-linking system (build-time) ---
// This will use the entities.json map to inject internal links
// during content rendering. Implementation will follow in next step.
// Entities loaded above:
// console.log(entities);

export const collections = {
  'open-houses': openHouses,
};