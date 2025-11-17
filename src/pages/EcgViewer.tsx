import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Activity, Home } from "lucide-react";
import { SampleInputPanel } from "@/components/SampleInputPanel";
import { EcgViewerCanvas } from "@/components/EcgViewerCanvas";
import { SampleInspector } from "@/components/SampleInspector";
import { useSamples } from "@/hooks/useSamples";
import { EcgSettings } from "@/components/EcgSettings";

const STORAGE_KEY = "ecg-viewer-state";

const EcgViewer = () => {
  const navigate = useNavigate();
  const { samples, error, parseSamples, getStats } = useSamples();
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(
    undefined,
  );

  // Load initial state from localStorage
  const loadInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error("Failed to load state from localStorage:", err);
    }
    return null;
  };

  const initialState = loadInitialState();

  const [zoom, setZoom] = useState(initialState?.zoom ?? 1);
  const [offset, setOffset] = useState(initialState?.offset ?? 0);
  const [inputText, setInputText] = useState(initialState?.inputText ?? "");

  const [settings, setSettings] = useState<EcgSettings>(
    initialState?.settings ?? {
      verticalScale: 1.0,
      horizontalScale: 25,
      normalize: false,
      baselineOffset: 0,
      lineWidth: 2,
      lineStyle: "smooth",
      showGrid: true,
      gridDensity: 10,
      highpass: 0,
      lowpass: 150,
      derivativeHighlight: false,
      rpeakDetection: false,
      autoScale: false,
    },
  );

  // Load samples from localStorage on mount
  useEffect(() => {
    if (initialState?.inputText) {
      parseSamples(initialState.inputText);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      zoom,
      offset,
      settings,
      inputText,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save state to localStorage:", err);
    }
  }, [zoom, offset, settings, inputText]);

  const stats = getStats();

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">
              ECG Sample Viewer
            </h1>
            <p className="text-xs text-muted-foreground">
              Manual ECG waveform analysis and rendering
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Binary Workbench
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Input & Settings */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <SampleInputPanel
              onLoadSamples={parseSamples}
              error={error}
              settings={settings}
              onSettingsChange={setSettings}
              inputText={inputText}
              onInputTextChange={setInputText}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - ECG Viewer */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <EcgViewerCanvas
              samples={samples}
              settings={settings}
              selectedIndex={selectedIndex}
              zoom={zoom}
              onZoomChange={setZoom}
              offset={offset}
              onOffsetChange={setOffset}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Sample Inspector */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <SampleInspector
              samples={samples}
              stats={stats}
              settings={settings}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default EcgViewer;
