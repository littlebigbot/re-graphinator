<script setup lang="ts">
import { ref, computed } from 'vue';
import type { RoleCategory } from '@/types/tmdb';
import { ALL_ROLE_CATS, ROLE_LABELS } from '@/types/tmdb';
import { IconCaret, IconCheck } from '@/components/icons';
import { useClickOutside } from '@/composables/useClickOutside';

const props = defineProps<{
  modelValue: RoleCategory[];
  counts: Record<RoleCategory, number>;
  color?: string;
  numberMode?: boolean; // compact number trigger instead of label
  totalCount?: number; // used in numberMode as the displayed count
}>();

const emit = defineEmits<{
  'update:modelValue': [value: RoleCategory[]];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
useClickOutside([root], () => {
  open.value = false;
});

const allSelected = computed(() => props.modelValue.length === ALL_ROLE_CATS.length);

const triggerLabel = computed(() => {
  if (allSelected.value) {
    return 'All roles';
  }
  return props.modelValue.map((category) => ROLE_LABELS[category]).join(', ');
});

// Only show categories that have at least 1 credit, unless they're actively selected
const visibleCategories = computed(() =>
  ALL_ROLE_CATS.filter((category) => props.counts[category] > 0 || props.modelValue.includes(category)),
);

function toggle(category: RoleCategory) {
  const current = props.modelValue;
  const has = current.includes(category);
  if (has && current.length === 1) {
    return;
  } // must keep at least one
  emit('update:modelValue', has ? current.filter((cat) => cat !== category) : [...current, category]);
}

function selectAll() {
  emit('update:modelValue', [...ALL_ROLE_CATS]);
}
</script>

<template>
  <div ref="root" class="role-dropdown" :style="color ? `--dd-color: ${color}` : ''">
    <button
      class="dd-trigger"
      :class="{
        'dd-trigger--open': open,
        'dd-trigger--filtered': !allSelected,
        'dd-trigger--number': numberMode,
      }"
      @click="open = !open"
    >
      <!-- Number mode: compact (N) or (N*) trigger -->
      <template v-if="numberMode">
        <span class="dd-label dd-number-label">
          ({{ totalCount ?? 0 }}<span v-if="!allSelected" class="dd-asterisk">*</span>)
        </span>
      </template>
      <!-- Default mode: label text + caret -->
      <template v-else>
        <span class="dd-label">{{ triggerLabel }}</span>
        <IconCaret class="dd-caret" />
      </template>
    </button>

    <Transition name="dd">
      <div v-if="open" class="dd-panel">
        <ul class="dd-list">
          <li
            v-for="category in visibleCategories"
            :key="category"
            class="dd-item"
            :class="{
              'dd-item--checked': modelValue.includes(category),
              'dd-item--zero': counts[category] === 0,
            }"
            @click="toggle(category)"
          >
            <span class="dd-check">
              <IconCheck v-if="modelValue.includes(category)" />
            </span>
            <span class="dd-cat-label">{{ ROLE_LABELS[category] }}</span>
            <span class="dd-count">{{ counts[category] ?? 0 }}</span>
          </li>
        </ul>
        <div v-if="!allSelected" class="dd-footer">
          <button class="dd-all-btn" @click.stop="selectAll">Select all</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.role-dropdown {
  --dd-color: #888;
  position: relative;
  display: inline-block;
}

/* ── Trigger ── */
.dd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px 4px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: none;
  color: var(--text-3);
  font-size: 0.73rem;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s,
    border-color 0.12s;
  white-space: nowrap;
  max-width: 180px;
}

.dd-trigger:hover,
.dd-trigger--open {
  background: var(--surface2);
  color: var(--text-2);
}

.dd-trigger--filtered {
  border-color: var(--dd-color);
  color: var(--dd-color);
  background: color-mix(in srgb, var(--dd-color) 8%, transparent);
}

.dd-trigger--filtered:hover {
  background: color-mix(in srgb, var(--dd-color) 15%, transparent);
}

.dd-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-caret {
  flex-shrink: 0;
  transition: transform 0.15s;
  stroke: currentColor;
  stroke-width: 1.5;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dd-trigger--open .dd-caret {
  transform: rotate(180deg);
}

/* ── Panel ── */
.dd-panel {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  min-width: 160px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  z-index: 400;
  overflow: hidden;
}

.dd-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}

/* ── Item ── */
.dd-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px 7px 9px;
  cursor: pointer;
  transition: background 0.1s;
}

.dd-item:hover {
  background: var(--surface3);
}

.dd-item--zero {
  opacity: 0.4;
}

.dd-check {
  width: 14px;
  height: 14px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.1s,
    border-color 0.1s;
}

.dd-item--checked .dd-check {
  background: var(--dd-color);
  border-color: var(--dd-color);
}

.dd-check svg {
  stroke: #fff;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dd-cat-label {
  flex: 1;
  font-size: 0.76rem;
  color: var(--text);
}

.dd-count {
  font-size: 0.68rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

/* ── Footer ── */
.dd-footer {
  border-top: 1px solid var(--border);
  padding: 5px 9px;
}

.dd-all-btn {
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 0.69rem;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.12s;
}

.dd-all-btn:hover {
  color: var(--text-2);
}

/* ── Number mode trigger ── */
.dd-trigger--number {
  padding: 2px 5px;
  border-color: transparent;
  font-size: 0.69rem;
  font-weight: 400;
  color: var(--text-3);
  max-width: none;
  min-width: 0;
}

.dd-trigger--number:hover,
.dd-trigger--number.dd-trigger--open {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border);
  color: var(--text-2);
}

.dd-trigger--number.dd-trigger--filtered {
  color: var(--dd-color);
  background: color-mix(in srgb, var(--dd-color) 8%, transparent);
  border-color: transparent;
}

.dd-trigger--number.dd-trigger--filtered:hover,
.dd-trigger--number.dd-trigger--filtered.dd-trigger--open {
  border-color: var(--dd-color);
  background: color-mix(in srgb, var(--dd-color) 14%, transparent);
}

.dd-number-label {
  font-variant-numeric: tabular-nums;
}

.dd-asterisk {
  color: var(--dd-color);
  font-weight: 700;
  font-size: 0.8em;
  vertical-align: super;
  line-height: 0;
}

/* ── Transition ── */
.dd-enter-active,
.dd-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.dd-enter-from,
.dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
