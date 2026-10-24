  // Peek is stable: preloading, transport labels and the actual handoff share
  // one choice. Only a completed handoff consumes it; media retries do not.
  function createCarouselShuffle(random = Math.random) {
    let scope = null, remaining = [], seen = new Set();
    const shuffled = values => {
      const result = [...values];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    return {
      reset() { scope = null; remaining = []; seen.clear(); },
      peek(pool, current, key) {
        if (scope !== key) {
          scope = key; remaining = []; seen = new Set(pool.includes(current) ? [current] : []);
        }
        if (!pool.length) { remaining = []; return null; }
        remaining = remaining.filter(index => pool.includes(index));
        // Preserve the prepared choice when favorites are added. Removed looks
        // disappear immediately; previously played looks wait for the next lap.
        const added = pool.filter(index => !seen.has(index) && !remaining.includes(index));
        remaining.push(...shuffled(added));
        if (!remaining.length) { seen.clear(); remaining = shuffled(pool); }
        if (remaining[0] === current && remaining.length > 1) {
          const other = 1 + Math.floor(random() * (remaining.length - 1));
          [remaining[0], remaining[other]] = [remaining[other], remaining[0]];
        }
        return remaining[0];
      },
      commit(index) { remaining = remaining.filter(value => value !== index); seen.add(index); }
    };
  }
