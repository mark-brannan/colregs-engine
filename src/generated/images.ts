/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.2.0 schema/images.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * Every catalogued image, its source and what it illustrates. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface ImagesData {
  note?: string;
  count: number;
  images: {
    [k: string]: {
      file: string;
      bytes: number;
      sha256: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      pixels: number[];
      source_url: string | null;
      source: string;
      retrieved: string;
      rights: string;
      /**
       * @minItems 1
       */
      captions?: string[];
      /**
       * @minItems 1
       */
      paragraphs?: string[];
      /**
       * @minItems 1
       */
      entries?: string[];
      provenance_status?: string;
      unmapped_reason?: string;
    };
  };
}
