/*
 * Akari Programming Language Engine
 * Copyright (c) 2026 [HvK Okla]
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { tokenize, LexerError } = require('./core/lexer.js');
const { parse, ParseError } = require('./core/Parser.js');
const { transpile, CompileError } = require('./transpiler.js');
const { bundleAndTranspile, BundlerError } = require('./bundler.js');

/**
 * API publique d'Akari.
 */
module.exports = {
  // Compilation
  tokenize,
  parse,
  transpile,
  bundleAndTranspile,

  // Erreurs
  LexerError,
  ParseError,
  CompileError,
  BundlerError,

  // Helpers haut niveau
  compile,
  compileFile,
  run
};

/**
 * Compile du code Akari (string) en JavaScript.
 */
function compile(source) {
  const ast = parse(source);
  return transpile(ast);
}

/**
 * Compile un fichier Akari (avec résolution des imports).
 */
function compileFile(filePath) {
  return bundleAndTranspile(filePath);
}

/**
 * Compile et exécute du code Akari.
 */
function run(source) {
  const js = compile(source);
  return (0, eval)(js);
}