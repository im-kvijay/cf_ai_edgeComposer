import { useState, type FormEvent } from 'react';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  originUrl: string | null;
  onSaveOrigin: (url: string) => Promise<boolean>;
  onClearOrigin: () => Promise<boolean>;
  isSaving?: boolean;
  isLoading?: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  originUrl,
  onSaveOrigin,
  onClearOrigin,
  isSaving = false,
  isLoading = false,
}: SettingsModalProps) {
  const [input, setInput] = useState(originUrl || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = input.trim();
    if (trimmed && !isValidUrl(trimmed)) {
      setError('Please enter a valid URL');
      return;
    }

    const success = trimmed ? await onSaveOrigin(trimmed) : await onClearOrigin();
    if (success) {
      onClose();
    } else {
      setError('Failed to save settings');
    }
  };

  const handleClear = async () => {
    setError(null);
    const success = await onClearOrigin();
    if (success) {
      setInput('');
      onClose();
    } else {
      setError('Failed to clear origin');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      description="Configure preview behavior and local overrides"
      size="md"
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-neutral-500">
          Loading settings...
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Preview Origin URL"
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://your-origin.example.com"
              hint={
                originUrl
                  ? `Currently targeting: ${originUrl}`
                  : 'Leave blank to use the built-in sample response'
              }
              error={error || undefined}
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={isSaving || !originUrl}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Save
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export default SettingsModal;
