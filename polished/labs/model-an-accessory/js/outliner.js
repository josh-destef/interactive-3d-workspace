/* ═══════════════════════════════════════════════
   OUTLINER
   Renders the object list in the viewport corner and the readout below it.
   Rows are built with document.createElement rather than innerHTML, so a
   student-given object name can never inject markup into the page.
═══════════════════════════════════════════════ */
import { state, rootEntries, childrenOf, worldSizeOf } from './model.js';

const rowsEl = document.getElementById('out-rows');
const emptyEl = document.getElementById('out-empty');
const xformEl = document.getElementById('out-xform');
const sizeEl = xformEl?.querySelector('[data-xf="size"]') || null;
const posEl = xformEl?.querySelector('[data-xf="pos"]') || null;
const rotEl = xformEl?.querySelector('[data-xf="rot"]') || null;

function fire(onPick, id, evt) {
    if (!id) return;
    const additive = !!(evt.shiftKey || evt.ctrlKey || evt.metaKey);
    onPick(id, { additive });
}

export function initOutliner({ onPick }) {
    if (!rowsEl) return;

    rowsEl.addEventListener('click', (evt) => {
        const row = evt.target.closest('.out-row');
        if (!row || !rowsEl.contains(row)) return;
        fire(onPick, row.dataset.id, evt);
    });

    rowsEl.addEventListener('keydown', (evt) => {
        if (evt.key !== 'Enter' && evt.key !== ' ') return;
        const row = evt.target.closest('.out-row');
        if (!row || !rowsEl.contains(row)) return;
        evt.preventDefault();
        fire(onPick, row.dataset.id, evt);
    });
}

function makeRow(entry, selectedIds, isChild, isFirstSelected) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = isChild ? 'out-row child' : 'out-row';
    row.setAttribute('role', 'option');
    row.dataset.id = entry.id;
    const selected = selectedIds.includes(entry.id);
    row.setAttribute('aria-selected', selected ? 'true' : 'false');

    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = entry.name;
    row.appendChild(name);

    if (isFirstSelected) {
        const badge = document.createElement('span');
        badge.className = 'row-badge';
        badge.textContent = 'EDIT';
        row.appendChild(badge);
    }

    return row;
}

export function renderRows(selectedIds) {
    if (!rowsEl) return;
    const ids = selectedIds || [];
    rowsEl.textContent = '';

    const roots = rootEntries();
    if (emptyEl) emptyEl.hidden = state.entries.length > 0;

    const firstSelected = ids.length ? ids[0] : null;

    for (const entry of roots) {
        rowsEl.appendChild(makeRow(entry, ids, false, entry.id === firstSelected));
        if (entry.kind === 'group') {
            for (const child of childrenOf(entry.id)) {
                rowsEl.appendChild(makeRow(child, ids, true, child.id === firstSelected));
            }
        }
    }
}

function fmt2(n) {
    return n.toFixed(2);
}

function fmtDeg(rad) {
    return Math.round(rad * 180 / Math.PI) + '°';
}

export function setReadout(entry) {
    if (!xformEl) return;
    if (!entry) {
        xformEl.hidden = true;
        return;
    }
    xformEl.hidden = false;

    if (!entry.mesh) {
        if (sizeEl) sizeEl.textContent = '-';
        if (posEl) posEl.textContent = '-';
        if (rotEl) rotEl.textContent = '-';
        return;
    }

    const size = worldSizeOf(entry);
    if (sizeEl) sizeEl.textContent = `${fmt2(size.x)} ${fmt2(size.y)} ${fmt2(size.z)}`;

    const p = entry.mesh.position;
    if (posEl) posEl.textContent = `${fmt2(p.x)} ${fmt2(p.y)} ${fmt2(p.z)}`;

    const r = entry.mesh.rotation;
    if (rotEl) rotEl.textContent = `${fmtDeg(r.x)} ${fmtDeg(r.y)} ${fmtDeg(r.z)}`;
}
