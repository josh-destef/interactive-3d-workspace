/* Random but readable challenge materials. Color comes from the same base
   palette the learner already used, while roughness varies and metalness stays
   near either end so each property can be identified clearly. */

import { COLOR_SWATCHES } from './config.js';

function randomInt(random, min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
}

const COLOR_NAMES = {
    '#ff9022': 'orange',
    '#c0453a': 'red',
    '#ffda22': 'yellow',
    '#00aa00': 'green',
    '#3a6fa8': 'blue',
    '#8b5cf6': 'purple',
    '#c66f48': 'terracotta',
    '#22252b': 'charcoal',
    '#ffdb93': 'cream',
    '#fad1c2': 'pale pink',
    '#c5c7c8': 'silver gray',
    '#f2f0eb': 'warm white',
};

function describeSurface(roughness, metalness) {
    const metal = metalness >= 50 ? 'metal' : 'not metal';
    const finish = roughness <= 30 ? 'polished with a tight highlight'
        : roughness >= 70 ? 'rough with a broad highlight'
            : 'between polished and rough';
    return `${metal} and ${finish}`;
}

function isTooSimilar(a, b) {
    if (!a || !b) return false;
    return a.color === b.color
        && Math.abs(a.roughness - b.roughness) < 8
        && Math.abs(a.metalness - b.metalness) < 8;
}

export function makeRandomTarget(previous = null, random = Math.random) {
    let target;
    let attempts = 0;
    do {
        const color = COLOR_SWATCHES[randomInt(random, 0, COLOR_SWATCHES.length - 1)];
        const roughness = randomInt(random, 10, 90);
        const metalness = random() < 0.5
            ? randomInt(random, 0, 15)
            : randomInt(random, 85, 100);
        target = {
            color,
            roughness,
            metalness,
            hue: COLOR_NAMES[color] || 'one of the base colors',
            feel: describeSurface(roughness, metalness),
        };
        attempts++;
    } while (isTooSimilar(target, previous) && attempts < 12);
    return target;
}
