import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export interface EcgSettings {
  verticalScale: number;
  horizontalScale: number;
  normalize: boolean;
  baselineOffset: number;
  lineWidth: number;
  lineStyle: "smooth" | "linear" | "step";
  showGrid: boolean;
  gridDensity: number;
  highpass: number;
  lowpass: number;
  derivativeHighlight: boolean;
  rpeakDetection: boolean;
  autoScale: boolean;
}

interface EcgSettingsProps {
  settings: EcgSettings;
  onChange: (settings: EcgSettings) => void;
}

export function EcgSettingsPanel({ settings, onChange }: EcgSettingsProps) {
  const updateSetting = <K extends keyof EcgSettings>(
    key: K,
    value: EcgSettings[K],
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Scale & Normalization */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Scale & Normalization
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Vertical Scale (Gain)</Label>
            <span className="text-xs text-muted-foreground">
              {settings.verticalScale.toFixed(1)}x
            </span>
          </div>
          <Slider
            value={[settings.verticalScale]}
            onValueChange={([v]) => updateSetting("verticalScale", v)}
            min={0.1}
            max={5.0}
            step={0.1}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Horizontal Scale (Speed)</Label>
            <span className="text-xs text-muted-foreground">
              {settings.horizontalScale} mm/s
            </span>
          </div>
          <Slider
            value={[settings.horizontalScale]}
            onValueChange={([v]) => updateSetting("horizontalScale", v)}
            min={1}
            max={50}
            step={1}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Normalize Signal</Label>
          <Switch
            checked={settings.normalize}
            onCheckedChange={(v) => updateSetting("normalize", v)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Baseline Offset</Label>
            <span className="text-xs text-muted-foreground">
              {settings.baselineOffset}px
            </span>
          </div>
          <Slider
            value={[settings.baselineOffset]}
            onValueChange={([v]) => updateSetting("baselineOffset", v)}
            min={-200}
            max={200}
            step={1}
          />
        </div>
      </div>

      <Separator />

      {/* Rendering Display Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Display Options
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Line Thickness</Label>
            <span className="text-xs text-muted-foreground">
              {settings.lineWidth}px
            </span>
          </div>
          <Slider
            value={[settings.lineWidth]}
            onValueChange={([v]) => updateSetting("lineWidth", v)}
            min={1}
            max={6}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Line Style</Label>
          <Select
            value={settings.lineStyle}
            onValueChange={(v) =>
              updateSetting("lineStyle", v as EcgSettings["lineStyle"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smooth">Smooth (Bezier)</SelectItem>
              <SelectItem value="linear">Straight (Linear)</SelectItem>
              <SelectItem value="step">Step (ECG monitor style)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Grid Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Grid Options</h3>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Show Grid</Label>
          <Switch
            checked={settings.showGrid}
            onCheckedChange={(v) => updateSetting("showGrid", v)}
          />
        </div>

        {settings.showGrid && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Grid Density</Label>
              <span className="text-xs text-muted-foreground">
                {settings.gridDensity}px
              </span>
            </div>
            <Slider
              value={[settings.gridDensity]}
              onValueChange={([v]) => updateSetting("gridDensity", v)}
              min={5}
              max={50}
              step={5}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Advanced */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Advanced</h3>

        <div className="space-y-2">
          <Label className="text-xs">High-pass Filter (Hz)</Label>
          <Input
            type="number"
            value={settings.highpass}
            onChange={(e) =>
              updateSetting("highpass", parseFloat(e.target.value) || 0)
            }
            min={0}
            max={10}
            step={0.1}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Low-pass Filter (Hz)</Label>
          <Input
            type="number"
            value={settings.lowpass}
            onChange={(e) =>
              updateSetting("lowpass", parseFloat(e.target.value) || 150)
            }
            min={20}
            max={200}
            step={1}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Derivative Highlighting</Label>
          <Switch
            checked={settings.derivativeHighlight}
            onCheckedChange={(v) => updateSetting("derivativeHighlight", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">R-peak Detection</Label>
          <Switch
            checked={settings.rpeakDetection}
            onCheckedChange={(v) => updateSetting("rpeakDetection", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Auto-scale to Viewport</Label>
          <Switch
            checked={settings.autoScale}
            onCheckedChange={(v) => updateSetting("autoScale", v)}
          />
        </div>
      </div>
    </div>
  );
}
