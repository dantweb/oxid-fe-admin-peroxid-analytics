import { describe, expect, it } from 'vitest';
import ExportMenu from '../../src/components/ExportMenu.vue';
import { mountInAdmin } from './helpers';

const items = [
  { format: 'xlsx', label: 'XLSX — data table' },
  { format: 'csv', label: 'CSV — data table' },
] as const;

const mountMenu = () =>
  mountInAdmin(ExportMenu, {
    props: { label: 'Export table', items: [...items], fieldId: 'analytics.export.table' },
    attachTo: document.body,
  });

const focused = (): string => document.activeElement?.textContent?.trim() ?? '';

describe('ExportMenu', () => {
  it('is an icon button named by its label, closed, with the field id on its root', () => {
    const wrapper = mountMenu();

    const button = wrapper.get('[data-test="export-button"]');
    expect(button.attributes('aria-label')).toBe('Export table');
    expect(button.attributes('aria-haspopup')).toBe('menu');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.find('svg').attributes('aria-hidden')).toBe('true');
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(wrapper.element.getAttribute('data-field')).toBe('analytics.export.table');
    wrapper.unmount();
  });

  it('opens on a click with one menuitem per format and the first one focused', async () => {
    const wrapper = mountMenu();

    await wrapper.get('[data-test="export-button"]').trigger('click');

    expect(wrapper.get('[data-test="export-button"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[role="menu"]').attributes('aria-label')).toBe('Export table');
    expect(wrapper.findAll('[role="menuitem"]').map((item) => item.text())).toEqual([
      'XLSX — data table',
      'CSV — data table',
    ]);
    expect(focused()).toBe('XLSX — data table');
    wrapper.unmount();
  });

  it('ArrowDown on the button opens it on the first item, ArrowUp on the last', async () => {
    const wrapper = mountMenu();
    const button = wrapper.get('[data-test="export-button"]');

    await button.trigger('keydown', { key: 'ArrowDown' });
    expect(focused()).toBe('XLSX — data table');
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' });
    await button.trigger('keydown', { key: 'ArrowUp' });

    expect(focused()).toBe('CSV — data table');
    wrapper.unmount();
  });

  it('the arrow keys, Home and End move the focus inside the menu and wrap around', async () => {
    const wrapper = mountMenu();
    await wrapper.get('[data-test="export-button"]').trigger('click');
    const menu = wrapper.get('[role="menu"]');

    await menu.trigger('keydown', { key: 'ArrowDown' });
    expect(focused()).toBe('CSV — data table');
    await menu.trigger('keydown', { key: 'ArrowDown' });
    expect(focused()).toBe('XLSX — data table');
    await menu.trigger('keydown', { key: 'ArrowUp' });
    expect(focused()).toBe('CSV — data table');
    await menu.trigger('keydown', { key: 'Home' });
    expect(focused()).toBe('XLSX — data table');
    await menu.trigger('keydown', { key: 'End' });
    expect(focused()).toBe('CSV — data table');
    wrapper.unmount();
  });

  it('Escape closes the menu and returns the focus to the button', async () => {
    const wrapper = mountMenu();
    await wrapper.get('[data-test="export-button"]').trigger('click');

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('[data-test="export-button"]').element);
    expect(wrapper.get('[data-test="export-button"]').attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });

  it('choosing an item emits its format, closes the menu and returns the focus to the button', async () => {
    const wrapper = mountMenu();
    await wrapper.get('[data-test="export-button"]').trigger('click');

    await wrapper.findAll('[role="menuitem"]')[1]!.trigger('click');

    expect(wrapper.emitted('select')).toEqual([['csv']]);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('[data-test="export-button"]').element);
    wrapper.unmount();
  });

  it('a click elsewhere closes it, Tab closes it, and the button toggles it', async () => {
    const wrapper = mountMenu();
    const button = wrapper.get('[data-test="export-button"]');

    await button.trigger('click');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    await button.trigger('click');
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Tab' });
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    await button.trigger('click');
    await button.trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
