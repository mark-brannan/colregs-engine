/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.2 schema/images.schema.json
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
      /**
       * Whether the figure shows the provision of the clauses it is mapped to, the exception they carve out, or both.
       */
      depicts?: 'provision' | 'exception' | 'mixed';
      /**
       * Every printed text block in the image, verbatim, in reading order. Empty when the image carries no text.
       */
      transcript: string[];
      /**
       * What is drawn, one noun phrase per vessel or object, in plain maritime vocabulary, not the Convention's classes.
       *
       * @minItems 1
       */
      subjects: string[];
      /**
       * One paragraph of what the drawing contains: vessel type and its evidence, viewpoint, then the lights and shapes as drawn. No rule citations.
       */
      description: string;
      /**
       * The day shapes the figure draws, top to bottom, from the closed vocabulary. Empty when it draws none.
       */
      shapes: ('ball' | 'diamond' | 'cone-up' | 'cone-down' | 'cylinder' | 'basket' | 'flag-a')[];
      provenance_status?: string;
      unmapped_reason?: string;
    };
  };
}
