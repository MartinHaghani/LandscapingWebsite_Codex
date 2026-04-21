import { QuoteDoneButton } from './QuoteDoneButton';
import { QuoteGuideButton } from './QuoteGuideButton';

interface QuoteMapActionClusterProps {
  doneDisabled: boolean;
  onDoneClick: () => void;
  onGuideClick: () => void;
}

export const QuoteMapActionCluster = ({
  doneDisabled,
  onDoneClick,
  onGuideClick
}: QuoteMapActionClusterProps) => (
  <div
    className="flex flex-col items-end gap-2 sm:flex-row sm:items-center"
    data-quote-map-action-cluster="true"
  >
    <QuoteGuideButton onClick={onGuideClick} />
    <QuoteDoneButton onClick={onDoneClick} disabled={doneDisabled} />
  </div>
);
