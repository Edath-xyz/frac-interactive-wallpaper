/* Companion text has its own stable-ID history; ordinary wardrobes keep their rules. */
'use strict';
(() => {
  window.createPurpleCompanionDialogue = ({data = {looks: {}}, storage, storageKey,
    random = Math.random, onShown = () => {}} = {}) => {
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(storageKey) || '{}') || {}; } catch (_) {}
    const history = saved.version === 1 && saved.bags && typeof saved.bags === 'object' ? saved.bags : {};
    let topics = Array.isArray(saved.topics) ? saved.topics.filter(t => typeof t === 'string').slice(-2) : [];
    let regular = Number.isFinite(saved.regular) ? Math.max(0, saved.regular) : 0;
    const bags = new Map(), pending = new Map();
    let scene = null;
    const timing = data.timing || {rareAfterRegular: 5};
    const has = id => Boolean(data.looks[id]);
    function persist() {
      if (!storageKey) return;
      try { storage?.setItem(storageKey, JSON.stringify({version: 1, bags: Object.fromEntries(bags), topics, regular})); } catch (_) {}
    }
    // Restore all valid pools up front, so a write for one look retains the others.
    for (const [id, spec] of Object.entries(data.looks)) for (const kind of ['enter', 'continuous', 'restored', 'random', 'affection']) {
      const key = id + ':' + kind, ids = spec[kind].map(line => line.id), old = history[key];
      const valid = old && Array.isArray(old.remaining) && Array.isArray(old.ids) &&
        old.ids.length === ids.length && ids.every(value => old.ids.includes(value));
      bags.set(key, {ids, remaining: valid ? [...new Set(old.remaining.filter(value => ids.includes(value)))] : [], last: ids.includes(old?.last) ? old.last : null});
    }
    function reserve(id, kind) {
      const spec = data.looks[id], pool = spec?.[kind];
      if (!pool?.length) return null;
      const key = id + ':' + kind, bag = bags.get(key);
      if (!bag.remaining.length) {
        bag.remaining = [...bag.ids];
        for (let i = bag.remaining.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag.remaining[i], bag.remaining[j]] = [bag.remaining[j], bag.remaining[i]];
        }
      }
      const choices = bag.remaining.map(value => pool.find(line => line.id === value));
      const fresh = choices.filter(line => line.id !== bag.last);
      const candidates = fresh.length ? fresh : choices;
      const line = (kind === 'continuous' && candidates.find(item => !topics.includes(item.topic))) || candidates[0];
      pending.set(line.text, {id, kind, line, bag});
      return line;
    }
    function enter(id) {
      const line = reserve(id, 'enter');
      scene = line ? {id, line, seen: false, followed: false} : null;
      return line?.text || '';
    }
    function follow(id, time) {
      if (!scene || scene.id !== id || !scene.seen || scene.followed || time + .002 < data.looks[id].settledAt) return '';
      const line = scene.line.follow;
      pending.set(line.text, {id, kind: 'follow', line, scene});
      return line.text;
    }
    function restored(id, time = Infinity) {
      if (time + .002 < data.looks[id].settledAt) return data.looks[id].name;
      return reserve(id, 'restored')?.text || '';
    }
    function ambient(id, allowRare = true) {
      // Keep only the current ambient ticket, including a background rotation.
      for (const [text, ticket] of pending) if (['continuous', 'affection'].includes(ticket.kind)) pending.delete(text);
      const rare = allowRare && regular >= timing.rareAfterRegular;
      const line = reserve(id, rare ? 'affection' : 'continuous');
      return {text: line?.text || '', rare};
    }
    function shown(text, {background = false} = {}) {
      const ticket = pending.get(text);
      if (!ticket) return null;
      const {id, kind, line, bag} = ticket;
      if (background && (kind !== 'continuous' || ticket.rotated)) return null;
      if (!background) pending.delete(text);
      if (!ticket.rotated && bag) { bag.remaining = bag.remaining.filter(value => value !== line.id); bag.last = line.id; }
      if (kind === 'enter' && scene?.line.id === line.id) scene.seen = true;
      if (kind === 'follow' && scene === ticket.scene) scene.followed = true;
      if (kind === 'continuous') {
        if (!background) regular++;
        if (!ticket.rotated) topics = [...topics, line.topic].slice(-2);
      }
      if (kind === 'affection') { regular = 0; topics = [...topics, 'affection'].slice(-2); }
      ticket.rotated = true;
      persist(); onShown({id: line.id, look: id, kind, background});
      return kind;
    }
    function skipFollow() {
      scene = null;
      for (const [text, ticket] of pending) if (['enter', 'follow', 'continuous', 'affection'].includes(ticket.kind)) pending.delete(text);
    }
    function cancelPending() { pending.clear(); scene = null; }
    return Object.freeze({has, enter, follow, restored, ambient, shown, skipFollow, cancelPending,
      random: id => reserve(id, 'random')?.text || '', discard: text => pending.delete(text)});
  };
})();
