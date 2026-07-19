/* AUTO-GENERATED from ../../schema by scripts/codegen.ts -- do not edit. Regenerate: bun run codegen */

export interface Profiles {
  [k: string]: Profile;
}
export interface Profile {
  description?: string;
  rules: string[];
}
