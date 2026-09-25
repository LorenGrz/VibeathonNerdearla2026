import { Glossary, GlossaryTerm } from '@subs/domain';

/**
 * Baseline glossary for LiveSubs sessions: tech loanwords that Spanish-speaking conference
 * audiences expect to see untouched, rather than translated literally.
 */
export const DEFAULT_GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  new GlossaryTerm('Nerdearla', {}),
  new GlossaryTerm('Kubernetes', {}),
  new GlossaryTerm('deploy', { es: 'deploy' }, 'do not translate to "despliegue"'),
  new GlossaryTerm(
    'pull request',
    { es: 'pull request' },
    'do not translate to "solicitud de extracción"',
  ),
  new GlossaryTerm('open source', { es: 'open source' }, 'do not translate to "código abierto"'),
  new GlossaryTerm('LLM', {}),
  new GlossaryTerm('API', {}),
  new GlossaryTerm('backend', { es: 'backend' }),
  new GlossaryTerm('frontend', { es: 'frontend' }),
  new GlossaryTerm('commit', { es: 'commit' }),
  new GlossaryTerm('merge', { es: 'merge' }),
  new GlossaryTerm('branch', { es: 'branch' }, 'do not translate to "rama"'),
  new GlossaryTerm('bug', { es: 'bug' }),
  new GlossaryTerm('framework', { es: 'framework' }),
  new GlossaryTerm('sprint', { es: 'sprint' }),
  new GlossaryTerm('cloud', { es: 'cloud' }),
  new GlossaryTerm('container', { es: 'container' }, 'do not translate to "contenedor"'),
  new GlossaryTerm('webhook', {}),
  new GlossaryTerm('endpoint', { es: 'endpoint' }),
  new GlossaryTerm('token', { es: 'token' }),
];

export const defaultGlossary = new Glossary([...DEFAULT_GLOSSARY_TERMS]);
