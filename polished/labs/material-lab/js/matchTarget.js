/* Random but readable challenge materials. Metalness stays near either end so
   a beginner can identify the response, while color and roughness use broad
   continuous ranges. Nothing here selects from the Material examples. */

function randomInt(random, min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return '#' + rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('');
}

function hueName(hue) {
    if (hue < 15 || hue >= 345) return 'red';
    if (hue < 45) return 'orange';
    if (hue < 70) return 'yellow';
    if (hue < 155) return 'green';
    if (hue < 195) return 'cyan';
    if (hue < 255) return 'blue';
    if (hue < 290) return 'violet';
    return 'magenta';
}

function describeColour(hue, saturation, lightness) {
    const tone = lightness < 42 ? 'dark ' : lightness > 64 ? 'light ' : '';
    const strength = saturation < 55 ? 'muted ' : saturation > 78 ? 'vivid ' : '';
    return `a ${tone}${strength}${hueName(hue)}`;
}

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
        const hue = randomInt(random, 0, 359);
        const saturation = randomInt(random, 48, 88);
        const lightness = randomInt(random, 34, 72);
        const roughness = randomInt(random, 10, 90);
        const metalness = random() < 0.5
            ? randomInt(random, 0, 15)
            : randomInt(random, 85, 100);
        target = {
            color: hslToHex(hue, saturation, lightness),
            roughness,
            metalness,
            hue: describeColour(hue, saturation, lightness),
            feel: describeSurface(roughness, metalness),
        };
        attempts++;
    } while (isTooSimilar(target, previous) && attempts < 12);
    return target;
}
