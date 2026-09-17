import { useRef, useState } from 'react';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';

type Item = ProposalDetail['items'][number];

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SWIPE_REVEAL_PX = 96;

type Props = {
  item: Item;
  isEditable: boolean;
  mutationPending: boolean;
  peeked: boolean;
  onPeek: () => void;
  onClosePeek: () => void;
  onOpenEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ProposalItemCard({
  item,
  isEditable,
  mutationPending,
  peeked,
  onPeek,
  onClosePeek,
  onOpenEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const dragRef = useRef({ startX: 0, dragging: false, moved: false });
  const [dragX, setDragX] = useState<number | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditable) return;
    dragRef.current = { startX: event.clientX, dragging: true, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 4) dragRef.current.moved = true;
    const base = peeked ? -SWIPE_REVEAL_PX : 0;
    setDragX(Math.min(0, Math.max(-SWIPE_REVEAL_PX, base + delta)));
  };

  const endDrag = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    if (dragX !== null) {
      if (dragX < -SWIPE_REVEAL_PX / 2) onPeek(); else onClosePeek();
      setDragX(null);
      return;
    }
    if (!dragRef.current.moved) {
      peeked ? onClosePeek() : onOpenEdit();
    }
  };

  const transform = dragX !== null ? `translateX(${dragX}px)` : peeked ? `translateX(-${SWIPE_REVEAL_PX}px)` : undefined;

  return (
    <li className="proposal-item-card-wrap">
      <div className="proposal-item-card-swipe-actions" aria-hidden={!peeked}>
        <button
          type="button"
          className="duplicate"
          disabled={!isEditable || mutationPending}
          onClick={onDuplicate}
          aria-label={`Duplicar ${item.description}`}
        >
          <Copy size={16} />
        </button>
        <button
          type="button"
          className="delete"
          disabled={!isEditable || mutationPending}
          onClick={onDelete}
          aria-label={`Excluir ${item.description}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div
        className={`proposal-item-card ${dragX !== null ? 'dragging' : ''}`}
        style={transform ? { transform } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="button"
        tabIndex={0}
        aria-label={`Editar ${item.description}`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenEdit(); }
        }}
      >
        <GripVertical size={14} className="proposal-item-card-drag" aria-hidden="true" />
        <div className="proposal-item-card-main">
          <b>{item.description}</b>
          <span>{item.code} · {String(item.quantity).replace('.', ',')} {item.unit}</span>
        </div>
        <div className="proposal-item-card-value">
          R$ {money.format(item.totalCost)}
          <small>venda R$ {money.format(item.totalSale)}</small>
        </div>
      </div>
    </li>
  );
}
