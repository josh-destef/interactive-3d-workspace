import { createHistory } from "./history.js";
import { createSelection } from "./selection.js";
import { validateMesh } from "./mesh.js";

const TYPES = new Set([
  "group",
  "gizmobot",
  "cube",
  "sphere",
  "cylinder",
  "cone",
  "plane",
  "assemblyPart",
]);
const PRIMITIVES = new Set(["cube", "sphere", "cylinder", "cone", "plane"]);
const EPSILON = 1e-7;
const clone = (value) => structuredClone(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Every scene object has a Three.js Object3D transform, so any object can be a
// parent. This lets learners build useful subassemblies such as an antenna tip
// following its mast without inserting an otherwise meaningless empty group.
const isContainerType = (type) => TYPES.has(type);

function identityTransform() {
  return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
}

function geometryFor(type) {
  if (type === "cube") return { width: 1, height: 1, depth: 1 };
  if (type === "sphere") return { radius: 0.6 };
  if (type === "cylinder" || type === "cone") return { radius: 0.5, height: 1 };
  if (type === "plane") return { width: 1, height: 1 };
}

function spawnTransform(type, index) {
  const transform = identityTransform();
  const columns = 3;
  transform.position[0] = (index % columns) * 1.5;
  transform.position[2] = Math.floor(index / columns) * 1.5;
  if (type === "cube" || type === "cylinder" || type === "cone")
    transform.position[1] = 0.5;
  if (type === "sphere") transform.position[1] = 0.6;
  if (type === "plane") {
    transform.position[1] = 0.01;
    transform.rotation[0] = -Math.PI / 2;
  }
  return transform;
}

function compose({ position: p, rotation: r, scale: s }) {
  const [x, y, z] = r,
    [sx, sy, sz] = s;
  const a = Math.cos(x),
    b = Math.sin(x),
    c = Math.cos(y),
    d = Math.sin(y),
    e = Math.cos(z),
    f = Math.sin(z);
  const ae = a * e,
    af = a * f,
    be = b * e,
    bf = b * f;
  return [
    c * e * sx,
    (af + be * d) * sx,
    (bf - ae * d) * sx,
    0,
    -c * f * sy,
    (ae - bf * d) * sy,
    (be + af * d) * sy,
    0,
    d * sz,
    -b * c * sz,
    a * c * sz,
    0,
    p[0],
    p[1],
    p[2],
    1,
  ];
}

function multiply(a, b) {
  const out = Array(16).fill(0);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 4; k++)
        out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  return out;
}

function invertAffine(m) {
  const a00 = m[0],
    a01 = m[4],
    a02 = m[8],
    a10 = m[1],
    a11 = m[5],
    a12 = m[9],
    a20 = m[2],
    a21 = m[6],
    a22 = m[10];
  const det =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);
  if (Math.abs(det) < EPSILON) throw new Error("Transform is not invertible");
  const d = 1 / det;
  const out = [
    (a11 * a22 - a12 * a21) * d,
    (a12 * a20 - a10 * a22) * d,
    (a10 * a21 - a11 * a20) * d,
    0,
    (a02 * a21 - a01 * a22) * d,
    (a00 * a22 - a02 * a20) * d,
    (a01 * a20 - a00 * a21) * d,
    0,
    (a01 * a12 - a02 * a11) * d,
    (a02 * a10 - a00 * a12) * d,
    (a00 * a11 - a01 * a10) * d,
    0,
    0,
    0,
    0,
    1,
  ];
  const x = m[12],
    y = m[13],
    z = m[14];
  out[12] = -(out[0] * x + out[4] * y + out[8] * z);
  out[13] = -(out[1] * x + out[5] * y + out[9] * z);
  out[14] = -(out[2] * x + out[6] * y + out[10] * z);
  return out;
}

function decompose(m) {
  const cols = [
    [m[0], m[1], m[2]],
    [m[4], m[5], m[6]],
    [m[8], m[9], m[10]],
  ];
  const scale = cols.map((v) => Math.hypot(...v));
  if (scale.some((v) => v < EPSILON || !finite(v)))
    throw new Error("Transform has invalid scale");
  const axes = cols.map((v, i) => v.map((n) => n / scale[i]));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (
    Math.abs(dot(axes[0], axes[1])) > 1e-6 ||
    Math.abs(dot(axes[0], axes[2])) > 1e-6 ||
    Math.abs(dot(axes[1], axes[2])) > 1e-6
  )
    throw new Error("Transform cannot be represented without shear");
  const det = dot(axes[0], [
    axes[1][1] * axes[2][2] - axes[1][2] * axes[2][1],
    axes[1][2] * axes[2][0] - axes[1][0] * axes[2][2],
    axes[1][0] * axes[2][1] - axes[1][1] * axes[2][0],
  ]);
  if (det < 0) throw new Error("Reflected transforms are not supported");
  const n = [
    axes[0][0],
    axes[0][1],
    axes[0][2],
    0,
    axes[1][0],
    axes[1][1],
    axes[1][2],
    0,
    axes[2][0],
    axes[2][1],
    axes[2][2],
    0,
  ];
  const ry = Math.asin(Math.max(-1, Math.min(1, n[8])));
  let rx, rz;
  if (Math.abs(n[8]) < 0.9999999) {
    rx = Math.atan2(-n[9], n[10]);
    rz = Math.atan2(-n[4], n[0]);
  } else {
    rx = Math.atan2(n[6], n[5]);
    rz = 0;
  }
  const result = {
    position: [m[12], m[13], m[14]],
    rotation: [rx, ry, rz],
    scale,
  };
  if (compose(result).some((v, i) => Math.abs(v - m[i]) > 1e-5))
    throw new Error("Transform cannot be represented without shear");
  return result;
}

function validateTransform(value) {
  if (
    !value ||
    !["position", "rotation", "scale"].every(
      (k) =>
        Array.isArray(value[k]) &&
        value[k].length === 3 &&
        value[k].every(finite),
    )
  )
    throw new TypeError("Invalid transform");
  if (value.scale.some((v) => v <= 0))
    throw new RangeError("Scale must be positive");
}

function validateAnimation(animation) {
  if (!animation || !Array.isArray(animation.keys) || animation.keys.length > 1000)
    throw new TypeError('Animation must contain at most 1,000 keys');
  const frames = new Set();
  for (const key of animation.keys) {
    if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame > 36000 || frames.has(key.frame))
      throw new TypeError('Keyframes need unique whole frames from 0 to 36,000');
    frames.add(key.frame);
    validateTransform(key.transform);
    if (!['linear', 'smooth', 'step'].includes(key.interpolation)) throw new TypeError('Unknown interpolation');
  }
}

const DEFAULT_ANIMATION = { fps: 24, duration: 120, loop: true };
function validateAnimationSettings(value) {
  if (!value || !Number.isInteger(value.fps) || value.fps < 1 || value.fps > 60 ||
      !Number.isInteger(value.duration) || value.duration < 1 || value.duration > 36000 || typeof value.loop !== 'boolean')
    throw new TypeError('Use 1–60 FPS and an end frame from 1 to 36,000');
}

function validateEntity(entity, ids) {
  if (
    !entity ||
    typeof entity.id !== "string" ||
    !entity.id ||
    ids.has(entity.id)
  )
    throw new TypeError("Entity IDs must be unique non-empty strings");
  ids.add(entity.id);
  if (
    !TYPES.has(entity.type) ||
    typeof entity.name !== "string" ||
    !entity.name.trim()
  )
    throw new TypeError("Invalid entity");
  if (entity.parentId !== null && typeof entity.parentId !== "string")
    throw new TypeError("Invalid parent ID");
  if (
    typeof entity.visible !== "boolean" ||
    typeof entity.locked !== "boolean" ||
    !entity.components
  )
    throw new TypeError("Invalid entity flags or components");
  validateTransform(entity.components.transform);
  if (entity.type === "assemblyPart" &&
      (typeof entity.components.assemblyPart?.node !== "string" || !entity.components.assemblyPart.node.trim()))
    throw new TypeError("Assembly parts need a source node");
  if (entity.components.mesh) {
    if (!PRIMITIVES.has(entity.type)) throw new TypeError('Only primitives can have editable meshes');
    validateMesh(entity.components.mesh);
  }
  if (entity.components.animation) validateAnimation(entity.components.animation);
  const geometry = entity.components.geometry;
  if (PRIMITIVES.has(entity.type)) {
    const required = Object.keys(geometryFor(entity.type));
    if (
      !geometry ||
      required.some((k) => !finite(geometry[k]) || geometry[k] <= 0)
    )
      throw new TypeError("Invalid geometry");
  }
  if (entity.components.material) {
    const { color, roughness, metalness, emissiveIntensity } = entity.components.material;
    if (
      typeof color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(color) ||
      !finite(roughness) ||
      roughness < 0 ||
      roughness > 1 ||
      !finite(metalness) ||
      metalness < 0 ||
      metalness > 1 ||
      (emissiveIntensity !== undefined && (!finite(emissiveIntensity) || emissiveIntensity < 0 || emissiveIntensity > 1.25))
    )
      throw new TypeError("Invalid material");
  }
}

export function createProject() {
  const listeners = new Set();
  let animationSettings = { ...DEFAULT_ANIMATION };
  let counter = 1,
    transaction = null,
    restoring = false;
  let entities = [
    {
      id: "gizmobot",
      name: "Gizmobot",
      type: "gizmobot",
      parentId: null,
      visible: true,
      locked: false,
      components: {
        transform: {
          position: [-2, 0, 0],
          rotation: [0, Math.PI, 0],
          scale: [1, 1, 1],
        },
      },
    },
    {
      id: "creation",
      name: "My Creation",
      type: "group",
      parentId: null,
      visible: true,
      locked: false,
      components: { transform: identityTransform() },
    },
  ];
  const emit = (event) => listeners.forEach((fn) => fn(event));
  const get = (id) => entities.find((entity) => entity.id === id);
  const selection = createSelection({
    exists: (id) => Boolean(get(id)),
    onChange: () => emit({ kind: "selection" }),
  });
  const state = () => ({
    entities: clone(entities),
    animationSettings: clone(animationSettings),
    selection: { ids: selection.ids, activeId: selection.activeId },
  });
  const restoreState = (s) => {
    entities = clone(s.entities);
    animationSettings = clone(s.animationSettings || DEFAULT_ANIMATION);
    selection._restore(s.selection, false);
    emit({ kind: "change" });
    emit({ kind: "selection" });
  };
  const history = createHistory({
    restore: restoreState,
    emit,
    isBlocked: () => Boolean(transaction),
    limit: 100,
  });
  const nextId = (type) => {
    let id;
    do id = `${type}-${counter++}`;
    while (get(id));
    return id;
  };

  const mutate = (label, fn) => {
    const before = state();
    const result = fn();
    const after = state();
    if (same(before, after)) return result;
    emit({ kind: "change", label });
    if (!transaction && !restoring) history._push({ label, before, after });
    return result;
  };
  // Hierarchy edits operate on matrices so changing a parent does not move an
  // entity in world space. Decomposition rejects results that require shear.
  const worldMatrix = (id) => {
    const entity = get(id);
    if (!entity) throw new Error(`Unknown entity: ${id}`);
    const local = compose(entity.components.transform);
    return entity.parentId
      ? multiply(worldMatrix(entity.parentId), local)
      : local;
  };
  const localForWorld = (world, parentId) =>
    decompose(
      parentId ? multiply(invertAffine(worldMatrix(parentId)), world) : world,
    );
  const descendants = (id) => {
    const result = [];
    const walk = (parent) =>
      entities
        .filter((e) => e.parentId === parent)
        .forEach((e) => {
          result.push(e);
          walk(e.id);
        });
    walk(id);
    return result;
  };
  const assertParent = (id, parentId) => {
    const entity = get(id);
    if (!entity) throw new Error(`Unknown entity: ${id}`);
    if (id === "creation") throw new Error("My Creation is protected");
    if (
      parentId !== null &&
      (!get(parentId) || !isContainerType(get(parentId).type))
    )
      throw new Error("Parent must be another scene object or No parent");
    if (parentId === id || descendants(id).some((e) => e.id === parentId))
      throw new Error("Hierarchy cycle");
  };
  const reparentRaw = (id, parentId) => {
    assertParent(id, parentId);
    const world = worldMatrix(id);
    const transform = localForWorld(world, parentId);
    const entity = get(id);
    entity.parentId = parentId;
    entity.components.transform = transform;
  };

  const api = {
    get entities() {
      return entities;
    },
    get,
    get animationSettings() { return clone(animationSettings); },
    setAnimationSettings(partial) {
      const next = { ...animationSettings, ...partial };
      validateAnimationSettings(next);
      if (entities.some(entity => entity.components.animation?.keys.some(key => key.frame > next.duration)))
        throw new RangeError('Move or remove keys beyond the new end frame first');
      return mutate('Animation settings', () => { animationSettings = next; });
    },
    updateAnimation(id, value) {
      const entity = get(id);
      if (!entity || entity.locked) throw new Error('Select an unlocked object to animate');
      if (value !== null) {
        validateAnimation(value);
        if (value.keys.some(key => key.frame > animationSettings.duration)) throw new RangeError('Key is beyond the end frame');
      }
      return mutate('Keyframe', () => {
        if (value === null || !value.keys.length) delete entity.components.animation;
        else entity.components.animation = { keys: clone(value.keys).sort((a, b) => a.frame - b.frame) };
      });
    },
    setMesh(id, value) {
      const entity = get(id);
      if (!entity || !PRIMITIVES.has(entity.type) || entity.locked) throw new Error('Select an unlocked shape to edit its mesh');
      validateMesh(value);
      return mutate('Edit mesh', () => { entity.components.mesh = clone(value); });
    },
    children(parentId) {
      return entities.filter((e) => e.parentId === parentId);
    },
    selection,
    history,
    subscribe(listener) {
      if (typeof listener !== "function")
        throw new TypeError("Listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addPrimitive(type, { name: requestedName } = {}) {
      if (!PRIMITIVES.has(type))
        throw new TypeError(`Unsupported primitive: ${type}`);
      if (requestedName != null && (typeof requestedName !== 'string' || !requestedName.trim())) throw new TypeError('Name must not be empty');
      return mutate(`Add ${type}`, () => {
        const id = nextId(type);
        const name = requestedName?.trim() || type[0].toUpperCase() + type.slice(1);
        const primitiveIndex = entities.filter((entity) =>
          PRIMITIVES.has(entity.type),
        ).length;
        entities.push({
          id,
          name,
          type,
          parentId: "creation",
          visible: true,
          locked: false,
          components: {
            transform: spawnTransform(type, primitiveIndex),
            geometry: geometryFor(type),
            material: { color: "#f28c28", roughness: 0.55, metalness: 0 },
          },
        });
        selection.set(id);
        return get(id);
      });
    },
    rename(id, name) {
      if (!get(id)) throw new Error(`Unknown entity: ${id}`);
      if (typeof name !== "string" || !name.trim())
        throw new TypeError("Name must not be empty");
      return mutate("Rename", () => {
        get(id).name = name.trim();
      });
    },
    setVisible(id, value) {
      if (!get(id) || typeof value !== "boolean")
        throw new TypeError("Invalid visibility change");
      return mutate(value ? "Show" : "Hide", () => {
        get(id).visible = value;
      });
    },
    duplicate(id) {
      const source = get(id);
      if (!source) throw new Error(`Unknown entity: ${id}`);
      return mutate("Duplicate", () => {
        const nodes = [source, ...descendants(id)],
          map = new Map(nodes.map((node) => [node.id, nextId(node.type)]));
        for (const node of nodes) {
          const copy = clone(node);
          copy.id = map.get(node.id);
          copy.name = node === source ? `${node.name} Copy` : node.name;
          copy.parentId = map.get(node.parentId) ?? node.parentId;
          if (node === source) {
            copy.components.transform.position[0] += 0.35;
            copy.components.transform.position[2] += 0.35;
          }
          entities.push(copy);
        }
        const newId = map.get(id);
        selection.set(newId);
        return get(newId);
      });
    },
    remove(id) {
      if (!get(id)) return false;
      if (id === "creation") throw new Error("My Creation is protected");
      return mutate("Delete", () => {
        const removed = new Set([id, ...descendants(id).map((e) => e.id)]);
        entities = entities.filter((e) => !removed.has(e.id));
        selection._restore({
          ids: selection.ids.filter((selected) => !removed.has(selected)),
          activeId: selection.activeId,
        });
        return true;
      });
    },
    group(ids = selection.ids) {
      ids = [...new Set(ids)].filter((id) => get(id));
      if (!ids.length) return null;
      if (ids.includes("creation")) throw new Error("My Creation is protected");
      ids = ids.filter(
        (id) =>
          !ids.some(
            (other) =>
              other !== id &&
              descendants(other).some((child) => child.id === id),
          ),
      );
      const parents = new Set(ids.map((id) => get(id).parentId));
      const parentId = parents.size === 1 ? [...parents][0] : "creation";
      const worlds = new Map(ids.map((id) => [id, worldMatrix(id)]));
      for (const world of worlds.values()) localForWorld(world, parentId);
      return mutate("Group", () => {
        const groupId = nextId("group");
        entities.push({
          id: groupId,
          name: "Group",
          type: "group",
          parentId,
          visible: true,
          locked: false,
          components: { transform: identityTransform() },
        });
        for (const id of ids) {
          get(id).parentId = groupId;
          get(id).components.transform = localForWorld(worlds.get(id), groupId);
        }
        selection.set(groupId);
        return get(groupId);
      });
    },
    ungroup(id) {
      const group = get(id);
      if (!group || group.type !== "group")
        throw new Error("Only groups can be ungrouped");
      if (id === "creation") throw new Error("My Creation is protected");
      const kids = entities.filter((e) => e.parentId === id);
      const worlds = new Map(
        kids.map((child) => [child.id, worldMatrix(child.id)]),
      );
      for (const world of worlds.values()) localForWorld(world, group.parentId);
      return mutate("Ungroup", () => {
        for (const child of kids) {
          child.parentId = group.parentId;
          child.components.transform = localForWorld(
            worlds.get(child.id),
            group.parentId,
          );
        }
        entities = entities.filter((e) => e.id !== id);
        selection.set(kids.map((e) => e.id));
        return kids;
      });
    },
    reparent(id, parentId) {
      assertParent(id, parentId);
      if (get(id).parentId === parentId) return;
      const world = worldMatrix(id);
      localForWorld(world, parentId);
      return mutate("Reparent", () => reparentRaw(id, parentId));
    },
    updateTransform(id, partial) {
      const entity = get(id);
      if (!entity) throw new Error(`Unknown entity: ${id}`);
      const next = { ...clone(entity.components.transform), ...clone(partial) };
      validateTransform(next);
      return mutate("Transform", () => {
        entity.components.transform = next;
      });
    },
    updateGeometry(id, partial) {
      const entity = get(id);
      if (!entity || !PRIMITIVES.has(entity.type))
        throw new Error("Entity has no editable geometry");
      if (entity.components.mesh) throw new Error('Use Edit mesh to change this shape');
      const allowed = Object.keys(geometryFor(entity.type));
      if (
        !partial ||
        Object.keys(partial).some((k) => !allowed.includes(k)) ||
        Object.values(partial).some((v) => !finite(v) || v <= 0)
      )
        throw new TypeError("Invalid geometry update");
      return mutate("Geometry", () =>
        Object.assign(entity.components.geometry, partial),
      );
    },
    updateMaterial(id, partial) {
      const entity = get(id);
      if (!entity?.components.material)
        throw new Error("Entity has no editable material");
      const next = { ...entity.components.material, ...partial };
      if (
        Object.keys(partial ?? {}).some(
          (k) => !["color", "roughness", "metalness", "emissiveIntensity"].includes(k),
        )
      )
        throw new TypeError("Invalid material update");
      validateEntity(
        {
          ...clone(entity),
          components: { ...clone(entity.components), material: next },
        },
        new Set(),
      );
      return mutate("Appearance", () => {
        entity.components.material = next;
      });
    },
    beginTransaction(label = "Edit") {
      if (transaction) throw new Error("A transaction is already active");
      // Keep the pre-drag snapshot until commit or cancellation. Mutations still
      // notify live consumers, but only commit adds a history entry.
      transaction = { label, before: state() };
    },
    commitTransaction() {
      if (!transaction) return false;
      const current = transaction;
      transaction = null;
      const after = state();
      if (same(current.before, after)) return false;
      history._push({ label: current.label, before: current.before, after });
      return true;
    },
    cancelTransaction() {
      if (!transaction) return false;
      const before = transaction.before;
      transaction = null;
      restoreState(before);
      return true;
    },
    serialize() {
      return { version: 1, entities: clone(entities), animationSettings: clone(animationSettings) };
    },
    restore(data) {
      if (transaction) throw new Error("Cannot restore during a transaction");
      if (!data || data.version !== 1 || !Array.isArray(data.entities))
        throw new TypeError("Unsupported project data");
      const proposed = clone(data.entities),
        ids = new Set();
      if (proposed.length > 2000) throw new RangeError('Projects support up to 2,000 objects');
      const nextSettings = { ...DEFAULT_ANIMATION, ...data.animationSettings };
      validateAnimationSettings(nextSettings);
      proposed.forEach((entity) => validateEntity(entity, ids));
      if (proposed.some(entity => entity.components.animation?.keys.some(key => key.frame > nextSettings.duration)))
        throw new RangeError('Animation keys exceed the end frame');
      const creation = proposed.find((e) => e.id === "creation");
      if (!creation || creation.type !== "group" || creation.parentId !== null)
        throw new TypeError("Project must contain an unparented creation root");
      for (const entity of proposed) {
        if (entity.parentId !== null && !ids.has(entity.parentId))
          throw new TypeError("Missing parent");
        if (
          entity.parentId !== null &&
          !isContainerType(
            proposed.find((candidate) => candidate.id === entity.parentId).type,
          )
        )
          throw new TypeError("Parent must be another scene object");
        const seen = new Set([entity.id]);
        let parent = entity.parentId;
        while (parent !== null) {
          if (seen.has(parent)) throw new TypeError("Hierarchy cycle");
          seen.add(parent);
          parent = proposed.find((e) => e.id === parent)?.parentId ?? null;
        }
      }
      restoring = true;
      entities = proposed;
      animationSettings = nextSettings;
      selection.clear();
      restoring = false;
      counter = 1;
      history._clear();
      emit({ kind: "change", label: "Restore" });
    },
  };
  return api;
}
