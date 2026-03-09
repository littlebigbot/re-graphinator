<script setup lang="ts">
import { ref, computed } from 'vue';

// In Vue 3 <script setup>, the SFC filename is used for self-reference, so
// <JsonTree> works recursively inside this template without a manual import.

const props = withDefaults(
  defineProps<{
    value: unknown;
    label?: string;
    depth?: number;
  }>(),
  { depth: 0 },
);

// Auto-expand the top 2 levels
const expanded = ref((props.depth ?? 0) < 2);

const valueType = computed(() => {
  if (props.value === null) {
    return 'null';
  }
  if (Array.isArray(props.value)) {
    return 'array';
  }
  return typeof props.value;
});

const isExpandable = computed(() => valueType.value === 'array' || valueType.value === 'object');

const entries = computed((): [string, unknown][] => {
  if (!isExpandable.value || props.value === null) {
    return [];
  }
  return Object.entries(props.value as Record<string, unknown>);
});

// Short inline preview shown on collapsed nodes
const summary = computed(() => {
  switch (valueType.value) {
    case 'array': {
      const arr = props.value as unknown[];
      return `Array(${arr.length})`;
    }
    case 'object': {
      const keys = Object.keys(props.value as object);
      const preview = keys.slice(0, 4).join(', ');
      return `{ ${preview}${keys.length > 4 ? ', …' : ''} }`;
    }
    case 'string':
      return `"${props.value}"`;
    case 'null':
      return 'null';
    default:
      return String(props.value);
  }
});

// Full leaf value
const leafDisplay = computed(() => {
  if (valueType.value === 'string') {
    return `"${props.value}"`;
  }
  if (valueType.value === 'null') {
    return 'null';
  }
  return String(props.value);
});
</script>

<template>
  <div class="jt-row">
    <!-- ── Leaf (primitive / null) ── -->
    <template v-if="!isExpandable">
      <span v-if="label !== undefined" class="jt-key">{{ label }}: </span>
      <span class="jt-val" :class="`jt-${valueType}`">{{ leafDisplay }}</span>
    </template>

    <!-- ── Expandable (object / array) ── -->
    <template v-else>
      <button class="jt-toggle" @click="expanded = !expanded">
        <span class="jt-arrow">{{ expanded ? '▾' : '▸' }}</span>
        <span v-if="label !== undefined" class="jt-key">{{ label }}: </span>
        <span v-if="!expanded" class="jt-summary">{{ summary }}</span>
      </button>
      <div v-if="expanded" class="jt-children">
        <JsonTree v-for="([k, v], i) in entries" :key="i" :value="v" :label="k" :depth="(depth ?? 0) + 1" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.jt-row {
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
  font-size: 0.71rem;
  line-height: 1.65;
}

.jt-toggle {
  background: none;
  border: none;
  padding: 0 2px;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  border-radius: 3px;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.jt-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}

.jt-children {
  padding-left: 14px;
  border-left: 1px solid rgba(255, 255, 255, 0.07);
  margin-left: 5px;
}

.jt-arrow {
  color: #666;
  font-size: 0.65rem;
  width: 10px;
  display: inline-block;
}
.jt-key {
  color: #9cdcfe;
}
.jt-summary {
  color: #555;
}

/* primitive colours — VS Code Dark+ inspired */
.jt-string {
  color: #ce9178;
}
.jt-number {
  color: #b5cea8;
}
.jt-boolean {
  color: #569cd6;
}
.jt-null {
  color: #569cd6;
  font-style: italic;
}
</style>
