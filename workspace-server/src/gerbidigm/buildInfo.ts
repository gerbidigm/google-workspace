/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

// BUILD_TIME is injected at compile time by esbuild's `define` option.
// At runtime it resolves to the ISO timestamp of the build.
declare const BUILD_TIME: string;

export const buildTime: string = BUILD_TIME;
