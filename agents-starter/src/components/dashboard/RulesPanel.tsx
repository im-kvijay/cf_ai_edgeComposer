import { useState, useMemo } from 'react';
import { Plus, DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react';
import type { Rule, RuleType } from '../../types';
import { Panel } from '../layout/Panel';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { RuleCard } from '../rules/RuleCard';
import { RuleFilters } from '../rules/RuleFilters';

interface RulesPanelProps {
  rules: Rule[];
  draftRules?: Rule[];
  selectedRuleId: string | null;
  onSelectRule: (id: string | null) => void;
  onDeleteRule: (id: string) => void;
  onDuplicateRule?: (rule: Rule) => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

export function RulesPanel({
  rules,
  draftRules,
  selectedRuleId,
  onSelectRule,
  onDeleteRule,
  onDuplicateRule,
  onExport,
  onRefresh,
}: RulesPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<RuleType[]>([]);

  // Calculate type counts
  const typeCounts = useMemo(() => {
    const counts: Record<RuleType, number> = {} as Record<RuleType, number>;
    for (const rule of rules) {
      counts[rule.type] = (counts[rule.type] || 0) + 1;
    }
    return counts;
  }, [rules]);

  // Filter rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(rule.type)) {
        return false;
      }

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesType = rule.type.toLowerCase().includes(searchLower);
        const matchesDescription = rule.description?.toLowerCase().includes(searchLower);
        const matchesPath =
          ('path' in rule && rule.path?.toLowerCase().includes(searchLower)) ||
          ('from' in rule && rule.from?.toLowerCase().includes(searchLower));

        if (!matchesType && !matchesDescription && !matchesPath) {
          return false;
        }
      }

      return true;
    });
  }, [rules, search, selectedTypes]);

  const handleTypeToggle = (type: RuleType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const isDraftRule = (ruleId: string) => {
    return draftRules?.some((r) => r.id === ruleId) ?? false;
  };

  return (
    <Panel
      title="Rules"
      subtitle={`${filteredRules.length} of ${rules.length} rules`}
      action={
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <ArrowsClockwise size={16} />
            </Button>
          )}
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <DownloadSimple size={16} />
            </Button>
          )}
        </div>
      }
      className="h-full flex flex-col"
      noPadding
    >
      {/* Filters */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <RuleFilters
          search={search}
          onSearchChange={setSearch}
          selectedTypes={selectedTypes}
          onTypeToggle={handleTypeToggle}
          typeCounts={typeCounts}
        />
      </div>

      {/* Rule List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredRules.length === 0 ? (
          <EmptyState
            title="No rules found"
            description={
              search || selectedTypes.length > 0
                ? 'Try adjusting your filters'
                : 'Generate a configuration to see rules here'
            }
          />
        ) : (
          filteredRules.map((rule, index) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={index}
              isSelected={selectedRuleId === rule.id}
              isDraft={isDraftRule(rule.id)}
              onSelect={() => onSelectRule(rule.id)}
              onDelete={() => onDeleteRule(rule.id)}
              onDuplicate={onDuplicateRule ? () => onDuplicateRule(rule) : undefined}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

export default RulesPanel;
