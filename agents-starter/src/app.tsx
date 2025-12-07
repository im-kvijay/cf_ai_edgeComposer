import { useState, useCallback } from 'react';
import type { ViewTab, Rule, PlaybookScenario, PlaybookStep } from './types';
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

// Common
import { useToast } from './components/common/Toast';
import { Badge } from './components/common/Badge';

// Playbook definitions
interface PlaybookDefinition {
  steps: PlaybookStep[];
  rules: Rule[];
}

const PLAYBOOK_DEFINITIONS: Record<PlaybookScenario, () => PlaybookDefinition> = {
  ecommerce: () => ({
    steps: [
      { id: generateId(), title: 'Configure image caching', description: 'Cache product images for faster loading', status: 'pending' },
      { id: generateId(), title: 'Enable compression', description: 'Compress responses to reduce bandwidth', status: 'pending' },
      { id: generateId(), title: 'Set up API rate limiting', description: 'Protect your API from abuse', status: 'pending' },
      { id: generateId(), title: 'Review and apply', description: 'Verify configuration and promote to production', status: 'pending' },
    ],
    rules: [
      { id: generateId(), type: 'cache', path: '/images/*', ttl: 86400, description: 'Cache product images for 24h' },
      { id: generateId(), type: 'cache', path: '/static/*', ttl: 604800, description: 'Cache static assets for 7 days' },
      { id: generateId(), type: 'performance', optimization: 'compression', enabled: true, description: 'Enable gzip/brotli compression' },
      { id: generateId(), type: 'rate-limit', path: '/api/*', requestsPerMinute: 600, burst: 100, action: 'challenge', description: 'Rate limit API endpoints' },
      { id: generateId(), type: 'security', hstsMaxAge: 31536000, xfo: 'SAMEORIGIN', referrerPolicy: 'strict-origin-when-cross-origin', description: 'Security headers' },
    ],
  }),
  blog: () => ({
    steps: [
      { id: generateId(), title: 'Configure asset caching', description: 'Long-term caching for static content', status: 'pending' },
      { id: generateId(), title: 'Enable minification', description: 'Minify HTML, CSS, and JS', status: 'pending' },
      { id: generateId(), title: 'Set cache headers', description: 'Configure browser caching', status: 'pending' },
      { id: generateId(), title: 'Review and apply', description: 'Verify configuration and promote', status: 'pending' },
    ],
    rules: [
      { id: generateId(), type: 'cache', path: '/assets/*', ttl: 604800, description: 'Cache static assets for 7 days' },
      { id: generateId(), type: 'cache', path: '/images/*', ttl: 2592000, description: 'Cache images for 30 days' },
      { id: generateId(), type: 'performance', optimization: 'minification', enabled: true, description: 'Minify HTML/CSS/JS' },
      { id: generateId(), type: 'header', action: 'add', name: 'Cache-Control', value: 'public, max-age=604800', description: 'Browser cache headers' },
    ],
  }),
  api: () => ({
    steps: [
      { id: generateId(), title: 'Configure rate limiting', description: 'Protect API from abuse', status: 'pending' },
      { id: generateId(), title: 'Disable caching', description: 'Ensure fresh API responses', status: 'pending' },
      { id: generateId(), title: 'Add security headers', description: 'Harden API security', status: 'pending' },
      { id: generateId(), title: 'Review and apply', description: 'Verify configuration and promote', status: 'pending' },
    ],
    rules: [
      { id: generateId(), type: 'rate-limit', path: '/api/*', requestsPerMinute: 1000, burst: 100, action: 'block', description: 'API rate limiting' },
      { id: generateId(), type: 'header', action: 'add', name: 'Cache-Control', value: 'no-store, no-cache, must-revalidate', description: 'Disable caching' },
      { id: generateId(), type: 'security', hstsMaxAge: 31536000, xfo: 'DENY', referrerPolicy: 'no-referrer', description: 'Strict security headers' },
      { id: generateId(), type: 'header', action: 'add', name: 'X-Content-Type-Options', value: 'nosniff', description: 'Prevent MIME sniffing' },
    ],
  }),
  static: () => ({
    steps: [
      { id: generateId(), title: 'Configure long-term caching', description: 'Maximize cache duration for static files', status: 'pending' },
      { id: generateId(), title: 'Set immutable headers', description: 'Tell browsers content won\'t change', status: 'pending' },
      { id: generateId(), title: 'Add SPA fallback', description: 'Route all paths to index.html', status: 'pending' },
      { id: generateId(), title: 'Review and apply', description: 'Verify configuration and promote', status: 'pending' },
    ],
    rules: [
      { id: generateId(), type: 'cache', path: '/*', ttl: 31536000, description: 'Cache everything for 1 year' },
      { id: generateId(), type: 'header', action: 'add', name: 'Cache-Control', value: 'public, max-age=31536000, immutable', description: 'Immutable cache headers' },
      { id: generateId(), type: 'route', from: '/app/*', to: '/index.html', ruleType: 'rewrite', description: 'SPA fallback routing' },
      { id: generateId(), type: 'performance', optimization: 'compression', enabled: true, description: 'Enable compression' },
    ],
  }),
  custom: () => ({
    steps: [
      { id: generateId(), title: 'Add custom rules', description: 'Configure your own rules', status: 'pending' },
      { id: generateId(), title: 'Review and apply', description: 'Verify configuration and promote', status: 'pending' },
    ],
    rules: [],
  }),
};

export default function App() {
  // Theme
  const { isDark, toggle: toggleTheme } = useTheme();
  const toast = useToast();

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
      toast.success(`Generated ${plan.draftPlan?.rules.length || 0} rules`);
      chat.addAssistantMessage('Configuration generated! Review the rules in the Rules tab and click "Apply Changes" when ready.');
      if (plan.toolTrace.length > 0) {
        chat.addToolMessages(plan.toolTrace);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Generation failed: ${message}`);
      chat.addAssistantMessage('Sorry, I encountered an error. Please try again.');
    }
  }, [chat, plan, toast]);

  // Handle playbook
  const handleStartPlaybook = useCallback(async (scenario: PlaybookScenario) => {
    const definition = PLAYBOOK_DEFINITIONS[scenario]();
    await plan.startPlaybook(scenario, definition.steps, definition.rules);
    toast.success(`${scenario.charAt(0).toUpperCase() + scenario.slice(1)} playbook started with ${definition.rules.length} rules`);
  }, [plan, toast]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      const blob = await api.export(displayRules);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cdn-config.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Configuration exported');
    } catch {
      toast.error('Export failed');
    }
  }, [displayRules, toast]);

  // Handle rollback
  const handleRollback = useCallback(async () => {
    const otherVersions = versions.versions.filter(v => v.id !== plan.activePlan?.id);
    if (otherVersions.length > 0) {
      try {
        await plan.rollback(otherVersions[0].id);
        await versions.refresh();
        toast.success('Rolled back to previous version');
      } catch {
        toast.error('Rollback failed');
      }
    }
  }, [versions, plan, toast]);

  // Handle copy token URL
  const handleCopyTokenUrl = useCallback(async (token: string) => {
    try {
      const url = tokens.getPreviewUrl(token);
      await navigator.clipboard.writeText(url);
      toast.success('Preview URL copied to clipboard');
    } catch {
      toast.error('Failed to copy URL');
    }
  }, [tokens, toast]);

  // Handle create token
  const handleCreateToken = useCallback(async () => {
    if (plan.activePlan?.id) {
      try {
        await tokens.create(plan.activePlan.id);
        toast.success('Preview token created');
      } catch {
        toast.error('Failed to create token');
      }
    }
  }, [plan.activePlan?.id, tokens, toast]);

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
            onAdvanceStep={plan.advancePlaybookStep}
            onCancelPlaybook={plan.cancelPlaybook}
            isLoading={plan.isGenerating}
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
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Draft Banner */}
          {plan.draftPlan && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="warning" dot>Draft</Badge>
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {plan.draftPlan.rules.length} rule{plan.draftPlan.rules.length !== 1 ? 's' : ''} pending
                  {plan.playbook && ` • ${plan.playbook.title}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('rules')}
                  className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  View Rules →
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
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
        onSimulate={async () => {
          try {
            await plan.simulate();
            toast.info('Simulation complete - check insights panel');
          } catch {
            toast.error('Simulation failed');
          }
        }}
        onPromote={async () => {
          try {
            await plan.promote();
            await versions.refresh();
            await tokens.refresh();
            toast.success('Configuration applied successfully!');
          } catch {
            toast.error('Failed to apply configuration');
          }
        }}
        onDiscard={() => {
          plan.discardDraft();
          toast.info('Draft discarded');
        }}
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
