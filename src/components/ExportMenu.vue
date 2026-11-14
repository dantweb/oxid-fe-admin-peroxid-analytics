<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

/** One entry of the menu: the format it hands back and its text (the format and what it holds). */
interface ExportItem {
  format: string;
  label: string;
}

/**
 * An icon button that opens a menu of export formats (the WAI-ARIA menu button pattern): Enter, Space and the arrow keys
 * open it, the arrow keys, Home and End walk the items, Escape and Tab close it, Escape and a choice return the focus to
 * the button. It only says which format was chosen (`select`); the page does the export.
 */
defineProps<{ label: string; items: ExportItem[]; fieldId: string }>();
const emit = defineEmits<{ select: [format: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuId = useId();

const itemElements = (): HTMLElement[] =>
  Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

async function openAt(position: 'first' | 'last'): Promise<void> {
  open.value = true;
  await nextTick();
  const elements = itemElements();
  (position === 'first' ? elements[0] : elements.at(-1))?.focus();
}

function close(returnFocus: boolean): void {
  open.value = false;
  if (returnFocus) {
    button.value?.focus();
  }
}

function onButtonKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    void openAt('first');
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    void openAt('last');
  }
}

function toggle(): void {
  if (open.value) {
    close(false);
    return;
  }
  void openAt('first');
}

function move(step: number): void {
  const elements = itemElements();
  const current = elements.indexOf(document.activeElement as HTMLElement);
  elements[(current + step + elements.length) % elements.length]?.focus();
}

function onMenuKey(event: KeyboardEvent): void {
  const actions: Record<string, () => void> = {
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    Home: () => itemElements()[0]?.focus(),
    End: () => itemElements().at(-1)?.focus(),
    Escape: () => close(true),
    Tab: () => close(false),
  };
  const action = actions[event.key];
  if (action !== undefined) {
    event.preventDefault();
    action();
  }
}

function choose(format: string): void {
  emit('select', format);
  close(true);
}

function closeOnOutsideClick(event: Event): void {
  if (open.value && !root.value?.contains(event.target as Node)) {
    close(false);
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', closeOnOutsideClick);
  } else {
    document.removeEventListener('click', closeOnOutsideClick);
  }
});
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutsideClick));
</script>

<template>
  <div ref="root" class="export" :data-field="fieldId" data-test="export-menu">
    <button
      ref="button"
      type="button"
      class="export__button"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      data-test="export-button"
      @click="toggle"
      @keydown="onButtonKey"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          d="M12 3v11m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <ul
      v-if="open"
      :id="menuId"
      ref="menu"
      class="export__menu"
      role="menu"
      :aria-label="label"
      data-test="export-items"
      @keydown="onMenuKey"
    >
      <li v-for="item in items" :key="item.format" role="none">
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="export__item"
          :data-test="`export-${item.format}`"
          @click="choose(item.format)"
        >
          {{ item.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.export {
  position: relative;
  display: inline-block;
}
.export__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  color: var(--oxfe-color-text, #333333);
  background: var(--oxfe-color-surface, #ffffff);
  border: 1px solid var(--oxfe-color-input-border, #cccccc);
  border-radius: var(--oxfe-radius-md, 6px);
  cursor: pointer;
}
.export__button:hover {
  border-color: var(--oxfe-color-primary, #2471a3);
}
.export__button:focus-visible,
.export__item:focus-visible {
  outline: 2px solid var(--oxfe-color-primary, #2471a3);
  outline-offset: 2px;
}
.export__menu {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  z-index: 10;
  display: grid;
  min-width: 14rem;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--oxfe-color-surface, #ffffff);
  border: 1px solid var(--oxfe-color-border, #e0e0e0);
  border-radius: var(--oxfe-radius-md, 6px);
  box-shadow: 0 6px 16px rgb(0 0 0 / 12%);
}
.export__item {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--oxfe-color-text, #333333);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--oxfe-radius-sm, 4px);
  cursor: pointer;
}
.export__item:hover,
.export__item:focus {
  background: color-mix(in srgb, var(--oxfe-color-primary, #2471a3) 12%, transparent);
}
</style>
