// `exifr` only ships types for its root entrypoint, not for the mini bundle subpath the
// app imports directly (to avoid pulling in the full parser). Both bundles share the same
// public API, so re-export the root package's types for this specific subpath.
declare module 'exifr/dist/mini.esm.mjs' {
  export * from 'exifr';
}
