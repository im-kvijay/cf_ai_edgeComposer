/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState } from "react";

// Component imports
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea/Textarea";

// Icon imports
import {
  Moon,
  Sun,
  Play,
  Eye,
  CheckCircle,
  ArrowRight,
  ArrowClockwise
} from "@phosphor-icons/react";

// Types for our CDN configuration
interface CDNPlan {
  rules: Array<{
    type: string;
    path?: string;
    ttl?: number;
    action?: string;
    name?: string;
    value?: string;
    description?: string;
  }>;
}

interface PreviewMetrics {
  version: string;
  route: 'v1' | 'v2';
  cacheStatus: 'HIT' | 'MISS';
  hitCount: number;
  missCount: number;
  p95Latency: number;
}

export default function CDNConfigurator() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });

  const [currentPlan, setCurrentPlan] = useState<CDNPlan>({
    rules: [
      {
        type: "cache",
        path: "/img/*",
        ttl: 86400,
        description: "Cache images for 24 hours"
      }
    ]
  });
  const [proposedPlan, setProposedPlan] = useState<CDNPlan | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<PreviewMetrics>({
    version: "v1.0",
    route: "v1",
    cacheStatus: "HIT",
    hitCount: 145,
    missCount: 23,
    p95Latency: 89
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const [input, setInput] = useState("");
  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Simulate AI response for demo
    setProposedPlan({
      rules: [
        {
          type: "cache",
          path: "/api/*",
          ttl: 300,
          description: "Cache API responses for 5 minutes"
        },
        {
          type: "header",
          action: "add",
          name: "X-CDN-Optimized",
          value: "true",
          description: "Add optimization header"
        }
      ]
    });

    setInput("");
  };

  const applyChanges = () => {
    if (proposedPlan) {
      setCurrentPlan(proposedPlan);
      setProposedPlan(null);
    }
  };

  const revertChanges = () => {
    setProposedPlan(null);
  };

  return (
    <div className="h-screen w-full flex bg-neutral-50 dark:bg-neutral-900">
      {/* Left Pane - Chat & Configuration */}
      <div className="flex-1 flex flex-col border-r border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 bg-blue-600 rounded-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h1 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">
                  CDN Configurator
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  AI-powered CDN optimization
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  placeholder="Describe your CDN optimization needs... (e.g., 'Cache images for 24 hours and optimize for mobile')"
                  className="min-h-[80px] resize-none border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
                  value={input}
                  onChange={handleInputChange}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="px-6"
                disabled={!input.trim()}
              >
                <Play size={18} className="mr-2" />
                Generate
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
              <span>Use natural language to describe your CDN configuration</span>
              <div className="flex items-center gap-2">
                {proposedPlan && (
                  <>
                    <Button
                      size="sm"
                      onClick={applyChanges}
                      className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <CheckCircle size={16} className="mr-1" />
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      onClick={revertChanges}
                      className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    >
                      <ArrowClockwise size={16} className="mr-1" />
                      Revert
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Configuration Display */}
        <div className="flex-1 p-6 overflow-auto">
          {proposedPlan ? (
            <div className="space-y-4">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">
                Proposed Changes
              </h3>

              {/* Diff Display */}
              <div className="space-y-3">
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Current Configuration
                </div>
                {currentPlan.rules.map((rule, index) => (
                  <div key={index} className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded">
                        {rule.type}
                      </span>
                      {rule.path && (
                        <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                          {rule.path}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-neutral-700 dark:text-neutral-300">
                      {rule.description}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600"></div>
                  <ArrowRight size={16} className="text-neutral-400" />
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600"></div>
                </div>

                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Proposed Configuration
                </div>
                {proposedPlan.rules.map((rule, index) => (
                  <div key={index} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-green-200 dark:bg-green-700 px-2 py-1 rounded">
                        {rule.type}
                      </span>
                      {rule.path && (
                        <span className="text-xs font-mono text-green-600 dark:text-green-400">
                          {rule.path}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      {rule.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600 dark:text-blue-400">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                  Ready to Optimize
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Describe your CDN optimization needs in natural language above.
                  The AI will generate a configuration plan with performance improvements.
                </p>
                <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-1">
                  <div>Try: "Cache images for 24 hours and add security headers"</div>
                  <div>Or: "Optimize for e-commerce with fast product loading"</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - Preview */}
      <div className="w-96 bg-white dark:bg-neutral-950 flex flex-col">
        {/* Preview Header */}
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-neutral-600 dark:text-neutral-400" />
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Live Preview</span>
          </div>
        </div>

        {/* Preview Iframe */}
        <div className="flex-1 relative">
          <iframe
            src="https://httpbin.org/html"
            className="w-full h-full border-0"
            title="Preview"
          />

          {/* HUD Overlay */}
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs font-mono space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">Version:</span>
              <span className="text-blue-400">{previewMetrics.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">Route:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                previewMetrics.route === 'v1'
                  ? 'bg-green-600 text-white'
                  : 'bg-orange-600 text-white'
              }`}>
                {previewMetrics.route.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">Cache:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                previewMetrics.cacheStatus === 'HIT'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}>
                {previewMetrics.cacheStatus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">Hits/Misses:</span>
              <span className="text-green-400">{previewMetrics.hitCount}</span>
              <span className="text-red-400">/{previewMetrics.missCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">P95 Latency:</span>
              <span className="text-yellow-400">{previewMetrics.p95Latency}ms</span>
            </div>
          </div>
        </div>

        {/* Preview Controls */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="space-y-3">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Preview Controls
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={() => setPreviewMetrics(prev => ({
                  ...prev,
                  route: prev.route === 'v1' ? 'v2' : 'v1'
                }))}
              >
                Switch Route
              </Button>
              <Button
                size="sm"
                onClick={() => setPreviewMetrics(prev => ({
                  ...prev,
                  cacheStatus: prev.cacheStatus === 'HIT' ? 'MISS' : 'HIT'
                }))}
              >
                Toggle Cache
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <span>Simulating real CDN behavior</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

