import { cn } from '../../lib/cn';

interface QuoteGuideDemoToolbarProps {
  drawButtonLabel: string;
  drawButtonActive: boolean;
  obstacleButtonActive?: boolean;
  deleteEnabled: boolean;
  clearAllEnabled: boolean;
  undoEnabled: boolean;
  redoEnabled: boolean;
  doneEnabled: boolean;
  deletePressed?: boolean;
}

export const QuoteGuideDemoToolbar = ({
  drawButtonLabel,
  drawButtonActive,
  obstacleButtonActive = false,
  deleteEnabled,
  clearAllEnabled,
  undoEnabled,
  redoEnabled,
  doneEnabled,
  deletePressed = false
}: QuoteGuideDemoToolbarProps) => {
  const toolbarButtonClass =
    'inline-flex h-[2.125rem] w-[4.95rem] shrink-0 items-center justify-center rounded-full border px-1.5 text-center text-[10.5px] font-semibold leading-none tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-45';

  return (
    <div className="relative z-20 flex h-full items-center justify-center gap-1.5 border-b border-[#DCE6DA] bg-white px-2">
      <button
        type="button"
        disabled={!undoEnabled}
        aria-label="Undo"
        data-guide-demo-toolbar-button="true"
        className={cn(toolbarButtonClass, 'border-[#D6E0D4] bg-[#F8FBF7] text-base text-ink')}
      >
        <span aria-hidden="true">&larr;</span>
      </button>
      <button
        type="button"
        disabled={!redoEnabled}
        aria-label="Redo"
        data-guide-demo-toolbar-button="true"
        className={cn(toolbarButtonClass, 'border-[#D6E0D4] bg-[#F8FBF7] text-base text-ink')}
      >
        <span aria-hidden="true">&rarr;</span>
      </button>

      <button
        type="button"
        data-guide-demo-toolbar-button="true"
        className={cn(
          toolbarButtonClass,
          drawButtonActive
            ? 'border-[#2EBB61] bg-[#2EBB61] text-white'
            : 'border-[#D4DDD2] bg-white text-ink'
        )}
      >
        {drawButtonLabel}
      </button>
      <button
        type="button"
        data-guide-demo-toolbar-button="true"
        className={cn(
          toolbarButtonClass,
          obstacleButtonActive
            ? 'border-red-500 bg-red-600 text-white'
            : 'border-[#D4DDD2] bg-white text-copy-muted'
        )}
      >
        {obstacleButtonActive ? 'Stop drawing' : 'Draw obstacle'}
      </button>
      <button
        type="button"
        disabled={!deleteEnabled}
        data-guide-demo-toolbar-button="true"
        className={cn(
          toolbarButtonClass,
          deletePressed
            ? 'border-[#DC2626] bg-[#DC2626] text-white shadow-[0_0_0_4px_rgba(220,38,38,0.14)]'
            : deleteEnabled
              ? 'border-[#E8928A] bg-white text-[#AF4436]'
              : 'border-[#D4DDD2] bg-white text-copy-muted'
        )}
      >
        Delete
      </button>
      <button
        type="button"
        disabled={!clearAllEnabled}
        data-guide-demo-toolbar-button="true"
        className={cn(
          toolbarButtonClass,
          clearAllEnabled
            ? 'border-[#E8928A] bg-white text-[#AF4436]'
            : 'border-[#D4DDD2] bg-white text-copy-muted'
        )}
      >
        Clear all
      </button>

      <button
        type="button"
        disabled={!doneEnabled}
        data-guide-demo-toolbar-button="true"
        className={cn(
          toolbarButtonClass,
          'uppercase tracking-[0.12em]',
          doneEnabled
            ? 'border-[#212A23] bg-[#212A23] text-white'
            : 'border-[#D4DDD2] bg-white text-copy-muted'
        )}
      >
        Done
      </button>
    </div>
  );
};
