/**
 * storage.js — namespaced localStorage helpers.
 * Single source of truth for all client-side persistence.
 *
 * Keys:
 *   dn.theme              — "light" | "dark"
 *   dn.bookmarks          — string[]   (item ids)
 *   dn.read               — string[]   (item ids)
 *   dn.starred            — string[]   (item ids)
 *   dn.savedViews         — { id, name, filters }[]
 *   dn.activeBucket       — string     (bucket key)
 */
(function () {
  "use strict";

  const NS = "dn.";
  const safe = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(NS + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) {}
    },
  };

  function ensureArr(key) {
    const v = safe.get(key, []);
    return Array.isArray(v) ? v : [];
  }

  const Storage = {
    /* theme */
    getTheme() { return safe.get("theme", "light"); },
    setTheme(t) { safe.set("theme", t); },

    /* per-item flags — app.js renderNewsGrid caches getFlagged() into a Set
       per render and checks Set.has() on cards (perf hot path) */
    toggleFlag(kind, id) {
      const arr = ensureArr(kind);
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      safe.set(kind, arr);
      return arr.includes(id);
    },
    setFlag(kind, id, on) {
      const arr = ensureArr(kind);
      const i = arr.indexOf(id);
      if (on && i < 0) arr.push(id);
      if (!on && i >= 0) arr.splice(i, 1);
      safe.set(kind, arr);
    },
    getFlagged(kind) { return ensureArr(kind); },

    /* saved views (read+remove only — UI for creating views not yet implemented) */
    getViews() { return ensureArr("savedViews"); },
    removeView(id) {
      const arr = ensureArr("savedViews").filter(v => v.id !== id);
      safe.set("savedViews", arr);
    },

    /* cross-tab sync — listens for `storage` event from another tab/window
       and invokes the supplied callback with the dn.* key (sans namespace).
       app.js wires this to refresh the rendered grid when another tab
       toggles a flag, preventing the lost-update perception (ADV-4). */
    onChange(handler) {
      if (typeof handler !== "function") return;
      window.addEventListener("storage", (e) => {
        if (!e.key || !e.key.startsWith(NS)) return;
        handler(e.key.slice(NS.length), e.newValue);
      });
    },
  };

  window.Storage = Storage;
})();
