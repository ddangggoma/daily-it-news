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

    /* per-item flags */
    isFlagged(kind, id) {
      return ensureArr(kind).includes(id);
    },
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

    /* saved views */
    getViews() { return ensureArr("savedViews"); },
    addView(view) {
      const arr = ensureArr("savedViews");
      arr.push(view);
      safe.set("savedViews", arr);
    },
    removeView(id) {
      const arr = ensureArr("savedViews").filter(v => v.id !== id);
      safe.set("savedViews", arr);
    },
  };

  window.Storage = Storage;
})();
