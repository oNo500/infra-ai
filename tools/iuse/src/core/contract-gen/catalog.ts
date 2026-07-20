/* AUTO-GENERATED from ../../schema by scripts/codegen.ts -- do not edit. Regenerate: bun run codegen */

export interface Catalog {
  generatedAt: string;
  tags: TagVocabulary;
  rules: {
    [k: string]: CatalogRule;
  };
}
export interface TagVocabulary {
  [k: string]: TagFacet;
}
export interface TagFacet {
  exclusive: boolean;
  values: {
    [k: string]: string;
  };
}
export interface CatalogRule {
  description: string;
  tags: string[];
  requires: string[];
  path: string;
  profiles: string[];
}
