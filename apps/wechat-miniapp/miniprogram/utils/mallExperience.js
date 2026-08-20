/**
 * Maps an authorized mall's published application version onto the frozen
 * mini-program structure. Invalid or absent values fall back to approved VI
 * data; transactional/member data never enters this projection.
 */
function resolve(experience, demo) {
  if (!isObject(experience) || experience.schemaVersion !== 1) return fromDemo(demo);

  return {
    mallDisplayName: text(experience.mallDisplayName, demo.scope.brandTitle),
    announcement: text(experience.announcement, ''),
    themePreset: ['smart-blue', 'city-blue', 'festival-blue'].indexOf(experience.themePreset) >= 0 ? experience.themePreset : 'smart-blue',
    hero: mergeHero(experience.hero, demo.hero),
    entries: orderedProjection(experience.entries, demo.entries, 'label'),
    partners: partnerProjection(experience.partners, demo.partners),
    segments: orderedProjection(experience.segments, demo.segments, 'title').map(function (item) {
      return Object.assign({}, item, { desc: text(item.description, item.desc || '') });
    }),
    memberCodeCta: {
      title: text(experience.memberCodeCta && experience.memberCodeCta.title, demo.memberCodeCta.title),
      desc: text(experience.memberCodeCta && experience.memberCodeCta.description, demo.memberCodeCta.desc),
    },
    recommendationLimit: [2, 4, 6].indexOf(Number(experience.recommendationLimit)) >= 0 ? Number(experience.recommendationLimit) : 2,
  };
}

function fromDemo(demo) {
  return {
    mallDisplayName: demo.scope.brandTitle,
    announcement: '',
    themePreset: 'smart-blue',
    hero: demo.hero,
    entries: demo.entries,
    partners: demo.partners,
    segments: demo.segments,
    memberCodeCta: demo.memberCodeCta,
    recommendationLimit: 2,
  };
}

function orderedProjection(configRows, defaults, labelKey) {
  if (!Array.isArray(configRows)) return defaults;
  var byKey = {};
  defaults.forEach(function (item) {
    byKey[item.key] = item;
  });
  return configRows
    .filter(function (item) {
      return isObject(item) && item.visible && byKey[item.key];
    })
    .map(function (item) {
      var merged = Object.assign({}, byKey[item.key], item);
      merged[labelKey] = text(item[labelKey], byKey[item.key][labelKey]);
      return merged;
    })
    .sort(function (left, right) {
      return Number(left.sortOrder) - Number(right.sortOrder);
    });
}

function partnerProjection(names, defaults) {
  if (!Array.isArray(names) || !names.length) return defaults;
  return names.slice(0, 8).map(function (name, index) {
    var fallback = defaults.find(function (item) {
      return item.label === name;
    });
    return fallback || { key: 'custom-' + index, label: text(name, '合作商'), logo: null };
  });
}

function mergeHero(hero, fallback) {
  if (!isObject(hero)) return fallback;
  return Object.assign({}, fallback, {
    title: text(hero.title, fallback.title),
    subtitle: text(hero.subtitle, fallback.subtitle),
  });
}

function text(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = { resolve: resolve };
