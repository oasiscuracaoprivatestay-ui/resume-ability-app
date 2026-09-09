import { useState, useCallback, useRef, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import {
  loadDietPlan,
  saveDietPlan,
  generateBlockId,
  isOvernightBlock,
  sortBlocks,
} from '../utils/dietStorage';
import type { StructuredDietBlock, StructuredDietPlan } from '../utils/dietStorage';
import {
  BLOCK_TYPE_KEYS,
  BLOCK_TYPE_ICONS,
  FOOD_OPTION_KEYS,
  TIME_SLOTS,
  formatTime,
} from '../data/dietData';
import type { BlockTypeKey } from '../data/dietData';
import './StructuredDietScreen.css';

interface StructuredDietScreenProps {
  onNavigate: (screen: Screen) => void;
}

// ── Block editor modal ─────────────────────────────────────────────────────────

interface BlockEditorProps {
  initial: StructuredDietBlock | null; // null = new block
  onSave: (block: StructuredDietBlock) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BlockEditor({ initial, onSave, onCancel, t }: BlockEditorProps) {
  const [startTime, setStartTime] = useState(initial?.startTime ?? '08:00');
  const [endTime, setEndTime]     = useState(initial?.endTime   ?? '09:00');
  const [type, setType]           = useState<string>(initial?.type ?? 'breakfast');
  const [items, setItems]         = useState<string[]>(initial?.items ?? []);
  const [customText, setCustomText] = useState(initial?.customText ?? '');
  const [error, setError]         = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus inside modal
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('select,input,button');
    first?.focus();
  }, []);

  const toggleItem = (key: string) => {
    setItems(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const validate = (): boolean => {
    if (!startTime) { setError(t.sdb_err_start_required); return false; }
    if (!endTime)   { setError(t.sdb_err_end_required);   return false; }
    if (!type)      { setError(t.sdb_err_type_required);  return false; }
    setError('');
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const block: StructuredDietBlock = {
      id: initial?.id ?? generateBlockId(),
      startTime,
      endTime,
      type,
      items,
      customText: customText.trim(),
    };
    onSave(block);
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const overnight = isOvernightBlock({ startTime, endTime });

  return (
    <div className="sdb-overlay" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label={t.sdb_editor_title}>
      <div className="sdb-modal" ref={modalRef}>
        <div className="sdb-modal-header">
          <h2 className="sdb-modal-title">
            {initial ? t.sdb_edit_block : t.sdb_add_block}
          </h2>
          <button className="sdb-modal-close" onClick={onCancel} aria-label={t.commit_cancel}>✕</button>
        </div>

        <div className="sdb-modal-body">
          {/* ── Time range ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_start_time}</label>
            <select
              className="sdb-select"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              aria-label={t.sdb_start_time}
            >
              {TIME_SLOTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_end_time}</label>
            <select
              className="sdb-select"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              aria-label={t.sdb_end_time}
            >
              {TIME_SLOTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {overnight && (
              <span className="sdb-overnight-badge">{t.sdb_overnight}</span>
            )}
          </div>

          {/* ── Block type ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_block_type}</label>
            <div className="sdb-type-grid">
              {BLOCK_TYPE_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  className={`sdb-type-chip ${type === key ? 'sdb-type-chip--active' : ''}`}
                  onClick={() => setType(key)}
                >
                  <span className="sdb-chip-icon">{BLOCK_TYPE_ICONS[key as BlockTypeKey]}</span>
                  <span className="sdb-chip-label">{t[`sdb_type_${key}` as keyof typeof t] as string}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Food / structure options ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_food_label}</label>
            <div className="sdb-food-grid">
              {FOOD_OPTION_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  className={`sdb-food-chip ${items.includes(key) ? 'sdb-food-chip--active' : ''}`}
                  onClick={() => toggleItem(key)}
                >
                  {t[`sdb_food_${key}` as keyof typeof t] as string}
                </button>
              ))}
            </div>
          </div>

          {/* ── Custom note ── */}
          <div className="sdb-field">
            <label className="sdb-label sdb-label--optional">
              {t.sdb_custom_label}
              <span className="sdb-optional">{t.sdb_optional}</span>
            </label>
            <input
              id="sdb-custom-text"
              className="sdb-input"
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder={t.sdb_custom_placeholder}
              maxLength={120}
              aria-label={t.sdb_custom_label}
            />
          </div>

          {error && <p className="sdb-error" role="alert">{error}</p>}
        </div>

        <div className="sdb-modal-footer">
          <button className="sdb-btn sdb-btn--cancel" onClick={onCancel}>
            {t.commit_cancel}
          </button>
          <button className="sdb-btn sdb-btn--save" onClick={handleSave}>
            {t.commit_save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Block card ─────────────────────────────────────────────────────────────────

interface BlockCardProps {
  block: StructuredDietBlock;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BlockCard({ block, onEdit, onDelete, t }: BlockCardProps) {
  const typeKey = block.type as BlockTypeKey;
  const icon = BLOCK_TYPE_ICONS[typeKey] ?? '🍽️';
  const typeName = (t[`sdb_type_${block.type}` as keyof typeof t] as string | undefined) ?? block.type;
  const overnight = isOvernightBlock(block);

  // Build display items list
  const foodLabels = block.items.map(key =>
    (t[`sdb_food_${key}` as keyof typeof t] as string | undefined) ?? key
  );
  if (block.customText) foodLabels.push(block.customText);

  return (
    <div className="sdb-block-card">
      <div className="sdb-block-time-row">
        <span className="sdb-block-time">
          {formatTime(block.startTime)} → {formatTime(block.endTime)}
          {overnight && <span className="sdb-block-overnight">{' '}({t.sdb_next_day})</span>}
        </span>
        <div className="sdb-block-actions">
          <button
            className="sdb-icon-btn"
            onClick={onEdit}
            aria-label={`${t.commit_edit}: ${typeName}`}
            title={t.commit_edit}
          >
            ✎
          </button>
          <button
            className="sdb-icon-btn sdb-icon-btn--delete"
            onClick={onDelete}
            aria-label={`${t.commit_delete}: ${typeName}`}
            title={t.commit_delete}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="sdb-block-type-row">
        <span className="sdb-block-icon">{icon}</span>
        <span className="sdb-block-type-label">{typeName.toUpperCase()}</span>
      </div>

      {foodLabels.length > 0 && (
        <p className="sdb-block-items">{foodLabels.join(', ')}</p>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StructuredDietScreen({ onNavigate }: StructuredDietScreenProps) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<StructuredDietPlan>(() => loadDietPlan());
  const [editingBlock, setEditingBlock] = useState<StructuredDietBlock | null | 'new'>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(plan.name);

  // ── Persist helper ─────────────────────────────────────────────────────────
  const updatePlan = useCallback((updater: (p: StructuredDietPlan) => StructuredDietPlan) => {
    setPlan(prev => {
      const next = updater({ ...prev });
      saveDietPlan(next);
      return next;
    });
  }, []);

  // ── Name edit ──────────────────────────────────────────────────────────────
  const commitName = () => {
    const trimmed = nameText.trim();
    const finalName = trimmed || t.sdb_default_plan_name;
    setNameText(finalName);
    updatePlan(p => ({ ...p, name: finalName }));
    setEditingName(false);
  };

  // ── Block CRUD ─────────────────────────────────────────────────────────────
  const handleSaveBlock = (block: StructuredDietBlock) => {
    updatePlan(p => {
      const existing = p.blocks.findIndex(b => b.id === block.id);
      const blocks = existing >= 0
        ? p.blocks.map((b, i) => i === existing ? block : b)
        : [...p.blocks, block];
      return { ...p, blocks: sortBlocks(blocks) };
    });
    setEditingBlock(null);
  };

  const handleDeleteBlock = (id: string) => {
    updatePlan(p => ({ ...p, blocks: p.blocks.filter(b => b.id !== id) }));
  };

  const sortedBlocks = sortBlocks(plan.blocks);

  return (
    <div className="screen sdb-screen">
      <div className="sdb-inner">
        <ScreenHeader
          onBack={() => onNavigate('commitment')}
          onHome={() => onNavigate('home')}
        />

        <div className="sdb-content">
          {/* ── Heading ── */}
          <div className="sdb-heading-block">
            <span className="section-label">{t.sdb_label}</span>
            <h1 className="sdb-heading">{t.sdb_heading}</h1>
            <p className="sdb-sub">{t.sdb_sub}</p>
          </div>

          {/* ── Plan name ── */}
          <div className="sdb-plan-name-row">
            {editingName ? (
              <div className="sdb-name-edit">
                <input
                  id="sdb-plan-name-input"
                  className="sdb-name-input"
                  value={nameText}
                  onChange={e => setNameText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') { setNameText(plan.name); setEditingName(false); }
                  }}
                  autoFocus
                  maxLength={60}
                  aria-label={t.sdb_plan_name_label}
                />
                <div className="sdb-name-actions">
                  <button className="commit-btn commit-btn--save" onClick={commitName}>{t.commit_save}</button>
                  <button className="commit-btn commit-btn--cancel" onClick={() => { setNameText(plan.name); setEditingName(false); }}>{t.commit_cancel}</button>
                </div>
              </div>
            ) : (
              <div className="sdb-name-display">
                <span className="sdb-plan-name">{plan.name}</span>
                <button
                  className="sdb-icon-btn"
                  onClick={() => { setNameText(plan.name); setEditingName(true); }}
                  aria-label={t.sdb_rename_plan}
                  title={t.sdb_rename_plan}
                >
                  ✎
                </button>
              </div>
            )}
          </div>

          {/* ── Block list or empty state ── */}
          {sortedBlocks.length === 0 ? (
            <div className="sdb-empty">
              <div className="sdb-empty-icon">🥗</div>
              <p className="sdb-empty-title">{t.sdb_empty_title}</p>
              <p className="sdb-empty-sub">{t.sdb_empty_sub}</p>
            </div>
          ) : (
            <div className="sdb-block-list">
              {sortedBlocks.map(block => (
                <BlockCard
                  key={block.id}
                  block={block}
                  onEdit={() => setEditingBlock(block)}
                  onDelete={() => handleDeleteBlock(block.id)}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* ── Add block CTA ── */}
          <button
            id="btn-sdb-add-block"
            className="sdb-add-btn"
            onClick={() => setEditingBlock('new')}
          >
            <span className="sdb-add-btn-icon">+</span>
            {t.sdb_add_block}
          </button>
        </div>
      </div>

      {/* ── Block editor modal ── */}
      {editingBlock !== null && (
        <BlockEditor
          initial={editingBlock === 'new' ? null : editingBlock}
          onSave={handleSaveBlock}
          onCancel={() => setEditingBlock(null)}
          t={t}
        />
      )}
    </div>
  );
}
