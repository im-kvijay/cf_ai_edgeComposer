import { useState, useCallback } from 'react';
import type { ViewTab, Rule, PlaybookScenario } from './types';
import { api } from './api/client';
import { generateId } from './utils/formatters';

// Hooks
import { useTheme, usePlan, useVersions, useTokens, useChat, useSettings } from './hooks';

// Layout
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Panel } from './components/layout/Panel';

// Dashboard Panels
import { RulesPanel } from './components/dashboard/RulesPanel';
import { InsightsPanel } from './components/dashboard/InsightsPanel';
import { VersionsPanel } from './components/dashboard/VersionsPanel';
import { TokensPanel } from './components/dashboard/TokensPanel';
import { PlaybooksPanel } from './components/dashboard/PlaybooksPanel';

// Chat
import { ChatInput } from './components/chat/ChatInput';
import { MessageList } from './components/chat/MessageList';

// Actions & Settings
import { ActionBar } from './components/actions/ActionBar';
import { SettingsModal } from './components/settings/SettingsModal';

// Default rules for playbooks
const PLAYBOOK_RULES: Record<PlaybookScenario, () => Rule[]> = {
  ecommerce: () => [
    { id: generateId(), type: 'cache', path: '/images/*', ttl: 86400, description: 'Cache product images' },
    { id: generateId(), type: 'performance', optimization: 'compression', enabled: true, description: 'Enable compression' },
    { id: generateId(), type: 'rate-limit', path: '/api/*', requestsPerMinute: 600, action: 'challenge', description: 'Rate limit API' },
  ],
  blog: () => [
    { id: generateId(), type: 'cache', path: '/assets/*', ttl: 604800, description: 'Cache static assets' },
    { id: generateId(), type: 'performance', optimization: 'minification', enabled: true, description: 'Minify HTML/CSS/JS' },
    { id: generateId(), type: 'header', action: 'add', name: 'Cache-Control', value: 'public, max-age=604800', description: 'Cache headers' },
  ],
  api: () => [
    { id: generateId(), type: 'rate-limit', path: '/api/*', requestsPerMinute: 1000, burst: 100, action: 'block', description: 'API rate limiting' },
    { id: generateId(), type: 'header', action: 'add', name: 'Cache-Control', value: 'no-store', description: 'No caching for API' },
    { id: generateId(), type: 'security', hstsMaxAge: 31536000, xfo: 'DENY', description: 'Security headers' },
  ],
  static: () => [
    { id: generateId(), type: 'cache', path: '/*', ttl: 31536000, description: 'Long cache for static assets' },
    { id: generateId(), type: 'header', action: 'add', name: 'Cache-Control', value: 'public, max-age=31536000, immutable', description: 'Immutable cache' },
    { id: generateId(), type: 'route', from: '/app/*', to: '/app/index.html', ruleType: 'rewrite', description: 'SPA fallback' },
  ],
  custom: () => [],
};

export default function App() {
  // Theme
  const { isDark, toggle: toggleTheme } = useTheme();

  // Core state
  const plan = usePlan();
  const versions = useVersions();
  const tokens = useTokens();
  const chat = useChat();
  const settings = useSettings();

  // UI state
  const [activeTab, setActiveTab] = useState<ViewTab>('rules');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Current rules to display
  const displayRules = plan.draftPlan?.rules || plan.activePlan?.plan.rules || [];

  // Handle generate
  const handleGenerate = useCallback(async (prompt: string) => {
    chat.addUserMessage(prompt);
    try {
      await plan.generate(prompt);
      chat.addAssistantMessage('I\'ve generated a configuration based on your request. Review the rules and apply when ready.');
      if (plan.toolTrace.length > 0) {
        chat.addToolMessages(plan.toolTrace);
      }
    } catch {
      chat.addAssistantMessage('Sorry, I encountered an error generating the configuration. Please try again.');
    }
  }, [chat, plan]);

  // Handle playbook
  const handleStartPlaybook = useCallback((scenario: PlaybookScenario) => {
    const rules = PLAYBOOK_RULES[scenario]();
    for (const rule of rules) {
      plan.addRule(rule);
    }
  }, [plan]);

  // Handle export
  const handleExport = useCallback(async () => {
    const blob = await api.export(displayRules);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cdn-config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [displayRules]);

  // Handle rollback
  const handleRollback = useCallback(async () => {
    const otherVersions = versions.versions.filter(v => v.id !== plan.activePlan?.id);
    if (otherVersions.length > 0) {
      await plan.rollback(otherVersions[0].id);
      await versions.refresh();
    }
  }, [versions, plan]);

  // Handle copy token URL
  const handleCopyTokenUrl = useCallback((token: string) => {
    const url = tokens.getPreviewUrl(token);
    navigator.clipboard.writeText(url);
  }, [tokens]);

  // Handle create token
  const handleCreateToken = useCallback(async () => {
    if (plan.activePlan?.id) {
      await tokens.create(plan.activePlan.id);
    }
  }, [plan.activePlan?.id, tokens]);

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'rules':
        return (
          <RulesPanel
            rules={displayRules}
            draftRules={plan.draftPlan?.rules}
            selectedRuleId={selectedRuleId}
            onSelectRule={setSelectedRuleId}
            onDeleteRule={plan.removeRule}
            onDuplicateRule={(rule) => plan.addRule({ ...rule, id: generateId() })}
            onExport={handleExport}
            onRefresh={plan.refresh}
          />
        );
      case 'versions':
        return (
          <VersionsPanel
            versions={versions.versions}
            activeVersionId={plan.activePlan?.id || null}
            onRollback={async (id) => {
              await plan.rollback(id);
              await versions.refresh();
            }}
            isLoading={versions.isLoading}
          />
        );
      case 'tokens':
        return (
          <TokensPanel
            tokens={tokens.tokens}
            activeVersionId={plan.activePlan?.id || null}
            onCreateToken={handleCreateToken}
            onDeleteToken={tokens.remove}
            onCopyUrl={handleCopyTokenUrl}
            isCreating={tokens.isCreating}
          />
        );
      case 'playbooks':
        return (
          <PlaybooksPanel
            activePlaybook={plan.playbook}
            onStartPlaybook={handleStartPlaybook}
            onAdvanceStep={() => {}}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-100 dark:bg-neutral-950">
      {/* Header */}
      <Header
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isGenerating={plan.isGenerating}
        hasDraft={!!plan.draftPlan}
        activeVersionId={plan.activePlan?.id}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ruleCounts={{
            total: displayRules.length,
            draft: plan.draftPlan?.rules.length || 0,
          }}
          versionCount={versions.versions.length}
          tokenCount={tokens.tokens.length}
        />

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel - Tab Content */}
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex-1 overflow-hidden">
              {renderTabContent()}
            </div>
          </div>

          {/* Center Panel - Chat */}
          <div className="w-96 flex flex-col border-x border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <Panel
              title="Chat"
              subtitle="Describe your configuration needs"
              className="flex-1 flex flex-col overflow-hidden rounded-none border-0"
              noPadding
            >
              <div className="flex-1 overflow-y-auto p-4">
                <MessageList messages={chat.messages} />
              </div>
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                <ChatInput
                  onSubmit={handleGenerate}
                  isLoading={plan.isGenerating}
                />
              </div>
            </Panel>
          </div>

          {/* Right Panel - Insights */}
          <div className="w-72 p-4">
            <InsightsPanel
              insights={plan.insights}
              todos={plan.todos}
              notes={plan.notes}
            />
          </div>
        </main>
      </div>

      {/* Action Bar */}
      <ActionBar
        hasDraft={!!plan.draftPlan}
        canPromote={!!plan.draftVersionId}
        canRollback={versions.versions.length > 1}
        isGenerating={plan.isGenerating}
        isPromoting={plan.isPromoting}
        onSimulate={plan.simulate}
        onPromote={async () => {
          await plan.promote();
          await versions.refresh();
          await tokens.refresh();
        }}
        onDiscard={plan.discardDraft}
        onRollback={handleRollback}
        onExport={handleExport}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        originUrl={settings.originUrl}
        onSaveOrigin={settings.setOrigin}
        onClearOrigin={settings.clearOrigin}
        isSaving={settings.isSaving}
        isLoading={settings.isLoading}
      />
    </div>
  );
}
