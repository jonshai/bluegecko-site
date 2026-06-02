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

const outreach = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/outreach' }),
  schema: z.object({
    slug: z.string(),
    property_address: z.string(),
    owner_name: z.string(),
    bucket: z.enum(['pricing', 'marketing', 'condition', 'timing']),
    created_date: z.coerce.date(),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    hero: z.string().optional(),
    gallery: z.array(z.string()).optional(),
    before_after: z.array(z.object({
      before: z.string(),
      after: z.string(),
      label: z.string().optional(),
    })).optional(),
    ai_rendering: z.string().nullable().optional(),
    avm_sources: z.array(z.object({
      name: z.string(),
      value: z.number(),
      date_pulled: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })).optional(),
    avm_midpoint: z.number().optional(),
    recommended_price: z.number().optional(),
    headline: z.string(),
    opening_narrative: z.string().optional(),
    strategy_block: z.string().optional(),
    action_plan: z.array(z.string()).optional(),
    outbound_links: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })).optional(),
    pdf_link: z.string().optional(),
    cta_type: z.enum(['appointment', 'call', 'reply']).optional(),
    cta_url: z.string().optional(),
    qr_slug: z.string().optional(),
    fub_contact_id: z.string().nullable().optional(),
    utm_source: z.string().optional(),
  }),
});

const prospecting = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/prospecting' }),
  schema: z.object({
    slug: z.string(),
    prospect_name: z.string(),
    address: z.string(),
    agent: z.enum(['William Whipple', 'Lucky Whipple']).default('William Whipple'),
    headline: z.string(),
    cma_range: z.string(),
    pub_date: z.coerce.date(),
    expiry_date: z.coerce.date(),
    hero_image: z.string(),
    gallery_images: z.array(z.string()).optional(),
    noindex: z.literal(true).default(true),
  }),
});

export const collections = {
  properties,
  events,
  faq,
  blog,
  communities,
  builders,
  outreach,
  prospecting,
};
