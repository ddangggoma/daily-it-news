/**
 * _io.js — Node-side helper for evaluating browser-side data files.
 *
 * Usage:
 *   const { loadBrowserGlobal } = require("./_io");
 *   const D = loadBrowserGlobal("data/today.js", "__DAILY__");
 *
 * Why this exists:
 * The static dashboard publishes data as `window.__DAILY__ = {...}` etc. To
 * use that data from Node tooling (validators, RSS generator, builders), we
 * need to evaluate the file in a sandbox without polluting Node globals.
 *
 *   sandbox = { window: {} };
 *   new Function("window", code)(sandbox.window);
 *
 * `new Function` creates an isolated scope with no access to the outer
 * lexical environment, unlike `eval`. The only escape hatch is the explicit
 * `window` parameter we pass in.
 *
 * /ce-code-review maintainability M1 flagged this pattern duplicated across
 * 5 callers (validate-data.js, generate-feed.js, build-today.js, collect.js
 * mock, build-today test). This module is the single source of truth.
 *
 * Zero dependencies. Node std lib only.
 */
"use strict";

const fs = require("fs");

/**
 * Evaluate a browser-side `window.X = ...` file in isolation and return the
 * named global. Throws on missing files (caller decides how to handle).
 *
 * @param {string} file        Absolute path to the .js file
 * @param {string} key         Property name on `window` to return (e.g. "__DAILY__")
 * @returns {*}                The value at `window[key]`, or undefined if not set
 */
function loadBrowserGlobal(file, key) {
  if (!fs.existsSync(file)) {
    const err = new Error(`File not found: ${file}`);
    err.code = "ENOENT";
    throw err;
  }
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  // new Function is isolated from outer lexical scope. Only the explicit
  // `window` parameter is reachable from the evaluated code.
  new Function("window", code)(sandbox.window);
  return sandbox.window[key];
}

module.exports = { loadBrowserGlobal };
