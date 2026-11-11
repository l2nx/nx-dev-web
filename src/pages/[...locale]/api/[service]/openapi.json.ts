import type { APIRoute } from 'astro';
import { apiStaticPaths, specText } from '../../../../lib/openapi-specs.mjs';

export const getStaticPaths = apiStaticPaths;

export const GET: APIRoute = ({ params, props }) =>
  new Response(specText(params.service as string, props.lang as string), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
