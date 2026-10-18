import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  releases: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/releases' }),
    schema: z.object({
      module: z.string().min(1),
      version: z.string().min(1),
      tag: z.string().min(1),
      date: z.coerce.date(),
    }),
  }),
};
