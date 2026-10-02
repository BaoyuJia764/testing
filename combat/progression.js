(() => {
  const coinsRequiredByLevel = [3, 3, 5, 7, 9];

  function pageTierForEmotionLevel(level) {
    if (level === 1 || level === 2) return 1;
    if (level === 3 || level === 4) return 2;
    if (level === 5) return 3;
    return null;
  }

  function createLibrarian({ id, name, maxEmotionLevel = 5, maxLight = 3 }) {
    return {
      id,
      name,
      maxEmotionLevel,
      emotionLevel: 0,
      emotionCoins: 0,
      pendingEmotionCoins: 0,
      maxLight,
      light: maxLight,
      diceSlots: 1,
      bonusPageDraw: 0,
      abnormalityPages: [],
    };
  }

  function createFloor({ id, realizationLevel, fullyRealized = false, librarians, pageCatalog = [] }) {
    if (!Array.isArray(librarians) || librarians.length === 0) {
      throw new Error(`Floor ${id} requires at least one librarian`);
    }
    const members = librarians.map((librarian) => createLibrarian({
      ...librarian,
      maxEmotionLevel: Math.min(librarian.maxEmotionLevel ?? realizationLevel, 5),
    }));
    return {
      id,
      realizationLevel: Math.max(0, Math.min(realizationLevel, 5)),
      fullyRealized,
      librarians: members,
      pageCatalog,
      teamEmotionLevel: 0,
      pendingPageOffers: [],
      acquiredPageIds: new Set(),
    };
  }

  function awardEmotionCoins(floor, librarianId, { positive = 0, negative = 0 } = {}) {
    const librarian = floor.librarians.find((member) => member.id === librarianId);
    if (!librarian) throw new Error(`Unknown librarian ${librarianId} on floor ${floor.id}`);
    const amount = Math.max(0, positive) + Math.max(0, negative);
    librarian.pendingEmotionCoins += amount;
    return amount;
  }

  function averageTeamEmotionLevel(floor) {
    const total = floor.librarians.reduce((sum, librarian) => sum + librarian.emotionLevel, 0);
    return total / floor.librarians.length;
  }

  function createPageOffer(floor, teamLevel, random) {
    const tier = pageTierForEmotionLevel(teamLevel);
    if (!tier) return null;
    const candidates = floor.pageCatalog.filter((page) =>
      page.floorId === floor.id && page.tier === tier && !floor.acquiredPageIds.has(page.id));
    if (candidates.length === 0) return null;
    const shuffled = [...candidates];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return {
      floorId: floor.id,
      teamEmotionLevel: teamLevel,
      tier,
      options: shuffled.slice(0, 3),
    };
  }

  function endScene(floor, random = Math.random) {
    const levelUps = [];
    for (const librarian of floor.librarians) {
      while (librarian.pendingEmotionCoins > 0 && librarian.emotionLevel < floor.realizationLevel) {
        const threshold = coinsRequiredByLevel[librarian.emotionLevel];
        const needed = threshold - librarian.emotionCoins;
        const gained = Math.min(needed, librarian.pendingEmotionCoins);
        librarian.emotionCoins += gained;
        librarian.pendingEmotionCoins -= gained;
        if (librarian.emotionCoins < threshold) break;
        librarian.emotionCoins = 0;
        librarian.emotionLevel += 1;
        librarian.maxLight += 1;
        librarian.light = librarian.maxLight;
        if (librarian.emotionLevel === 4) librarian.diceSlots += 1;
        if (librarian.emotionLevel === 5) librarian.bonusPageDraw += 1;
        levelUps.push({ librarianId: librarian.id, emotionLevel: librarian.emotionLevel });
      }
      if (librarian.emotionLevel >= floor.realizationLevel) librarian.pendingEmotionCoins = 0;
    }

    const nextTeamLevel = Math.min(5, Math.floor(averageTeamEmotionLevel(floor)));
    for (let teamLevel = floor.teamEmotionLevel + 1; teamLevel <= nextTeamLevel; teamLevel += 1) {
      const offer = createPageOffer(floor, teamLevel, random);
      if (offer) floor.pendingPageOffers.push(offer);
    }
    floor.teamEmotionLevel = nextTeamLevel;
    return { levelUps, teamEmotionLevel: nextTeamLevel, pageOffers: [...floor.pendingPageOffers] };
  }

  function chooseAbnormalityPage(floor, librarianId, pageId) {
    const librarian = floor.librarians.find((member) => member.id === librarianId);
    const offer = floor.pendingPageOffers[0];
    if (!librarian || !offer || offer.floorId !== floor.id) return false;
    const page = offer.options.find((option) => option.id === pageId);
    if (!page) return false;
    librarian.abnormalityPages.push({ ...page, sourceFloorId: floor.id });
    floor.acquiredPageIds.add(page.id);
    floor.pendingPageOffers.shift();
    return true;
  }

  function canChooseEgoPage(floor, teamEmotionLevel) {
    return floor.fullyRealized && teamEmotionLevel >= 3 && teamEmotionLevel <= 5;
  }

  function guestEmotionCap(chapterNumber) {
    return Math.max(0, Math.min(chapterNumber, 5));
  }

  function endReception(floor) {
    for (const librarian of floor.librarians) {
      librarian.emotionLevel = 0;
      librarian.emotionCoins = 0;
      librarian.pendingEmotionCoins = 0;
      librarian.abnormalityPages = [];
      librarian.diceSlots = 1;
      librarian.bonusPageDraw = 0;
    }
    floor.teamEmotionLevel = 0;
    floor.pendingPageOffers = [];
    floor.acquiredPageIds.clear();
  }

  window.AbnormalityProgression = {
    coinsRequiredByLevel,
    pageTierForEmotionLevel,
    createFloor,
    awardEmotionCoins,
    averageTeamEmotionLevel,
    endScene,
    chooseAbnormalityPage,
    canChooseEgoPage,
    guestEmotionCap,
    endReception,
  };
})();